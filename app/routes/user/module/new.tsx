import { Button, Container, Paper, Select, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
	type ActionFunctionArgs,
	href,
	type LoaderFunctionArgs,
	redirect,
	useFetcher,
} from "react-router";
import type { FileUpload, FileUploadHandler } from "@remix-run/form-data-parser";
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
} from "@remix-run/form-data-parser";
import prettyBytes from "pretty-bytes";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
} from "server/internal/activity-module-management";
import { tryCreateMedia } from "server/internal/media-management";
import {
	AssignmentForm,
	DiscussionForm,
	FileForm,
	PageForm,
	QuizForm,
	WhiteboardForm,
} from "~/components/activity-module-forms";
import type { z } from "zod";
import {
	type ActivityModuleFormValues,
	activityModuleSchema,
	getInitialFormValues,
	transformFormValues,
	transformToActivityData,
} from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import { parseFormDataWithFallback } from "~/utils/parse-form-data-with-fallback";
import { badRequest, UnauthorizedResponse } from "~/utils/responses";
import type { Route } from "./+types/new";

export const loader = async ({ context }: LoaderFunctionArgs) => {
	const { systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new UnauthorizedResponse("You must be logged in to create modules");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	return {
		user: currentUser,
		uploadLimit: systemGlobals.sitePolicies.siteUploadLimit ?? undefined,
	};
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({
			success: false,
			error: "Failed to begin transaction",
		});
	}

	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	try {
		const contentType = request.headers.get("content-type") || "";

		// Check if this is a multipart form (file upload)
		const isMultipart = contentType.includes("multipart/form-data");

		let parsedData: ReturnType<typeof activityModuleSchema.parse>;
		let uploadedMediaIds: number[] = [];

		if (isMultipart) {
			// Handle file uploads for file module type
			const uploadHandler: FileUploadHandler = async (fileUpload: FileUpload) => {
				if (fileUpload.fieldName === "files") {
					const arrayBuffer = await fileUpload.arrayBuffer();
					const fileBuffer = Buffer.from(arrayBuffer);

					const mediaResult = await tryCreateMedia({
						payload,
						file: fileBuffer,
						filename: fileUpload.name,
						mimeType: fileUpload.type || "application/octet-stream",
						userId: currentUser.id,
						user: {
							...currentUser,
							collection: "users",
							avatar: currentUser.avatar?.id ?? undefined,
						},
						req: { transactionID },
					});

					if (!mediaResult.ok) {
						throw mediaResult.error;
					}

					const mediaId = mediaResult.value.media.id;
					uploadedMediaIds.push(mediaId);
					return String(mediaId);
				}
				return undefined;
			};


			const formData = await parseFormDataWithFallback(
				request,
				uploadHandler,
				{
					...(maxFileSize !== undefined && { maxFileSize }),
				},
			);

			console.log("uploadedMediaIds", uploadedMediaIds);
			// Extract form data (excluding files) and parse values
			const formDataObj: Record<string, unknown> = {};
			for (const [key, value] of formData.entries()) {
				if (key !== "files") {
					const stringValue = value.toString();
					// Try to parse JSON values (arrays, objects, booleans, numbers)
					try {
						formDataObj[key] = JSON.parse(stringValue);
					} catch {
						// If not JSON, keep as string
						formDataObj[key] = stringValue;
					}
				}
			}

			// Parse the form data
			parsedData = activityModuleSchema.parse(formDataObj);
		} else {
			// Handle JSON request (non-file module types)
			const { data } = await getDataAndContentTypeFromRequest(request);
			parsedData = activityModuleSchema.parse(data);
		}

		const { pageData, whiteboardData, fileData, assignmentData, quizData, discussionData } =
			transformToActivityData(parsedData);

		// For file type, use uploaded media IDs
		let finalFileData = fileData;
		if (parsedData.type === "file" && uploadedMediaIds.length > 0) {
			finalFileData = {
				media: uploadedMediaIds,
			};
		}

		// Build args based on module type (discriminated union)
		const baseArgs = {
			title: parsedData.title,
			description: parsedData.description,
			status: parsedData.status || ("draft" as const),
			userId: currentUser.id,
		};

		let createArgs: CreateActivityModuleArgs;
		if (parsedData.type === "page" && pageData) {
			createArgs = { ...baseArgs, type: "page" as const, pageData };
		} else if (parsedData.type === "whiteboard" && whiteboardData) {
			createArgs = { ...baseArgs, type: "whiteboard" as const, whiteboardData };
		} else if (parsedData.type === "assignment" && assignmentData) {
			createArgs = { ...baseArgs, type: "assignment" as const, assignmentData };
		} else if (parsedData.type === "quiz" && quizData) {
			createArgs = { ...baseArgs, type: "quiz" as const, quizData };
		} else if (parsedData.type === "file" && finalFileData) {
			createArgs = { ...baseArgs, type: "file" as const, fileData: finalFileData };
		} else if (parsedData.type === "discussion" && discussionData) {
			createArgs = { ...baseArgs, type: "discussion" as const, discussionData };
		} else {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				success: false,
				error: `Invalid module type or missing data for ${parsedData.type}`,
			});
		}

		// Note: tryCreateActivityModule creates its own transaction
		// We'll commit our transaction after media creation, then let module creation use its own
		// If module creation fails, we'll need to clean up media (future improvement)
		await payload.db.commitTransaction(transactionID);

		const createResult = await tryCreateActivityModule(payload, createArgs);

		if (!createResult.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		await payload.db.commitTransaction(transactionID);

		throw redirect("/user/profile");
	} catch (error) {
		if (error instanceof Response) {
			// we can directly throw the response error
			throw error;
		}

		await payload.db.rollbackTransaction(transactionID);
		console.error("Module creation error:", error);

		if (error instanceof MaxFileSizeExceededError) {
			return badRequest({
				success: false,
				error: `File size exceeds maximum allowed size of ${prettyBytes(maxFileSize ?? 0)}`,
			});
		}

		if (error instanceof MaxFilesExceededError) {
			return badRequest({
				success: false,
				error: error.message,
			});
		}

		console.error("Module creation error:", error);

		return badRequest({
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to process request",
		});
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success !== false) {
		notifications.show({
			title: "Success",
			message: "Activity module created successfully",
			color: "green",
		});
	} else if ("error" in actionData) {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}
	return actionData;
}

// Custom hook for creating module
export function useCreateModule() {
	const fetcher = useFetcher<typeof clientAction>();

	const createModule = (values: ActivityModuleFormValues) => {
		// Get files from form state if file type
		const files = values.fileFiles || [];

		// If files are present, use FormData with MULTIPART encoding
		if (files.length > 0 && values.type === "file") {
			const formData = new FormData();

			// Add form fields
			const submissionData = transformFormValues(values);
			for (const [key, value] of Object.entries(submissionData)) {
				if (value !== undefined && value !== null) {
					// JSON.stringify arrays, objects, booleans, and numbers so they can be parsed back
					if (
						typeof value === "object" ||
						typeof value === "boolean" ||
						typeof value === "number"
					) {
						formData.append(key, JSON.stringify(value));
					} else {
						formData.append(key, String(value));
					}
				}
			}

			// Add files
			for (const file of files) {
				formData.append("files", file);
			}

			fetcher.submit(formData, {
				method: "POST",
				action: href("/user/module/new"),
				encType: ContentType.MULTIPART,
			});
		} else {
			// Use JSON for non-file modules
			const submissionData = transformFormValues(values);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			fetcher.submit(submissionData as any, {
				method: "POST",
				action: href("/user/module/new"),
				encType: ContentType.JSON,
			});
		}
	};

	return {
		createModule,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export default function NewModulePage({ loaderData }: Route.ComponentProps) {
	const { uploadLimit } = loaderData;
	const { createModule, isLoading } = useCreateModule();

	const form = useForm<
		ActivityModuleFormValues,
		(values: ActivityModuleFormValues) => ActivityModuleFormValues
	>({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: getInitialFormValues(),
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	const selectedType = useFormWatchForceUpdate(form, "type");

	return (
		<Container size="md" py="xl">
			<title>Create Activity Module | Paideia LMS</title>
			<meta
				name="description"
				content="Create a new activity module in Paideia LMS"
			/>
			<meta
				property="og:title"
				content="Create Activity Module | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Create a new activity module in Paideia LMS"
			/>

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="lg">
					Create New Activity Module
				</Title>

				<form
					onSubmit={form.onSubmit((values) => {
						createModule(values);
					})}
				>
					<Stack gap="md">
						<Select
							{...form.getInputProps("type")}
							key={form.key("type")}
							label="Module Type"
							placeholder="Select module type"
							required
							withAsterisk
							data={[
								{ value: "page", label: "Page" },
								{ value: "whiteboard", label: "Whiteboard" },
								{ value: "file", label: "File" },
								{ value: "assignment", label: "Assignment" },
								{ value: "quiz", label: "Quiz" },
								{ value: "discussion", label: "Discussion" },
							]}
						/>

						{selectedType === "page" && <PageForm form={form} />}
						{selectedType === "whiteboard" && <WhiteboardForm form={form} />}
						{selectedType === "file" && (
							<FileForm form={form} uploadLimit={uploadLimit} />
						)}
						{selectedType === "assignment" && <AssignmentForm form={form} />}
						{selectedType === "quiz" && <QuizForm form={form} />}
						{selectedType === "discussion" && <DiscussionForm form={form} />}

						<Button type="submit" size="lg" mt="lg" loading={isLoading}>
							Create Module
						</Button>
					</Stack>
				</form>
			</Paper>
		</Container>
	);
}
