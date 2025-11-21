import { Button, Container, Divider, Group, Paper, Select, Stack, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import {
	href,
	redirect,
	type SubmitTarget,
	useFetcher,
} from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import {
	tryDeleteActivityModule,
	tryUpdateActivityModule,
	type UpdateActivityModuleArgs,
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
	transformFormValues,
	transformToActivityData,
} from "~/utils/activity-module-schema";
import { fileTypesToPresetValues } from "~/utils/file-types";
import type { FileUpload, FileUploadHandler } from "@remix-run/form-data-parser";
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
} from "@remix-run/form-data-parser";
import prettyBytes from "pretty-bytes";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import { parseFormDataWithFallback } from "~/utils/parse-form-data-with-fallback";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/edit-setting";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const { systemGlobals } = context.get(globalContextKey);
	const userModuleContext = context.get(userModuleContextKey);

	if (!userModuleContext) {
		throw new NotFoundResponse("Module context not found");
	}

	// Check if user can edit this module
	if (userModuleContext.accessType === "readonly") {
		throw new ForbiddenResponse(
			"You only have read-only access to this module",
		);
	}



	// Check if module has linked courses (cannot be deleted if it does)
	const hasLinkedCourses = userModuleContext.linkedCourses.length > 0;

	return {
		module: userModuleContext.module,

		uploadLimit: systemGlobals.sitePolicies.siteUploadLimit ?? undefined,
		hasLinkedCourses,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to edit modules",
		});
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const moduleId = params.moduleId;
	if (!moduleId) {
		return badRequest({
			success: false,
			error: "Module ID is required",
		});
	}

	// Check if this is a delete action
	const contentType = request.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		const { data } = await getDataAndContentTypeFromRequest(request);
		if (data && typeof data === "object" && "_action" in data && data._action === "delete") {
			const deleteResult = await tryDeleteActivityModule(payload, Number(moduleId));

			if (!deleteResult.ok) {
				return badRequest({
					success: false,
					error: deleteResult.error.message,
				});
			}

			// Redirect to user modules page after successful deletion
			throw redirect(href("/user/modules/:id?", { id: String(currentUser.id) }));
		}
	}

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

		let parsedData: z.infer<typeof activityModuleSchema>;
		const uploadedMediaIds: number[] = [];

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

		// For file type, combine existing media IDs with newly uploaded media IDs
		let finalFileData = fileData;
		if (parsedData.type === "file") {
			// Get existing media IDs from parsedData.fileMedia
			const existingMediaIds = parsedData.fileMedia || [];
			// Combine with newly uploaded media IDs
			const allMediaIds = [...existingMediaIds, ...uploadedMediaIds];
			finalFileData = {
				media: allMediaIds,
			};
		}

		// Build args based on module type (discriminated union)
		const baseArgs = {
			id: Number(moduleId),
			title: parsedData.title,
			description: parsedData.description,
			status: parsedData.status,
		};

		let updateArgs: UpdateActivityModuleArgs;
		if (parsedData.type === "page" && pageData) {
			updateArgs = {
				...baseArgs, type: "page" as const, pageData, req: { transactionID }, user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				}
			};
		} else if (parsedData.type === "whiteboard" && whiteboardData) {
			updateArgs = {
				...baseArgs, type: "whiteboard" as const, whiteboardData, req: { transactionID }, user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				}
			};
		} else if (parsedData.type === "assignment" && assignmentData) {
			updateArgs = {
				...baseArgs, type: "assignment" as const, assignmentData, req: { transactionID }, user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				}
			};
		} else if (parsedData.type === "quiz" && quizData) {
			updateArgs = {
				...baseArgs, type: "quiz" as const, quizData, req: { transactionID }, user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				}
			};
		} else if (parsedData.type === "file" && finalFileData) {
			updateArgs = {
				...baseArgs, type: "file" as const, fileData: finalFileData, req: { transactionID }, user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				}
			};
		} else if (parsedData.type === "discussion" && discussionData) {
			updateArgs = {
				...baseArgs, type: "discussion" as const, discussionData, req: { transactionID }, user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				}
			};
		} else {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				success: false,
				error: `Invalid module type or missing data for ${parsedData.type}`,
			});
		}


		const updateResult = await tryUpdateActivityModule(payload, updateArgs);

		if (!updateResult.ok) {
			return badRequest({
				success: false,
				error: updateResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "Module updated successfully",
		});
	} catch (error) {
		if (error instanceof Response) {
			// we can directly throw the response error
			throw error;
		}

		await payload.db.rollbackTransaction(transactionID);
		console.error("Module update error:", error);

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

		return badRequest({
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to process request",
		});
	}
};

export const clientAction = async ({
	serverAction,
}: Route.ClientActionArgs) => {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData?.message,
			color: "green",
		});
	}

	if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}

	return actionData;
};

// Custom hook for updating module
export function useUpdateModule() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateModule = (moduleId: string, values: ActivityModuleFormValues) => {
		const submissionData = transformFormValues(values);
		fetcher.submit(submissionData as SubmitTarget, {
			method: "POST",
			action: href("/user/module/edit/:moduleId/setting", {
				moduleId,
			}),
			encType: ContentType.JSON,
		});
	};

	return {
		updateModule,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

// Custom hook for deleting module
export function useDeleteModule() {
	const fetcher = useFetcher<typeof clientAction>();

	const deleteModule = (moduleId: string) => {
		fetcher.submit(
			{ _action: "delete" },
			{
				method: "POST",
				action: href("/user/module/edit/:moduleId/setting", {
					moduleId,
				}),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		deleteModule,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export default function EditModulePage({ loaderData }: Route.ComponentProps) {
	const { module, uploadLimit, hasLinkedCourses } = loaderData;
	const { updateModule, isLoading } = useUpdateModule();
	const { deleteModule, isLoading: isDeleting } = useDeleteModule();

	// Extract activity-specific data
	const pageData = module.page;
	const whiteboardData = module.whiteboard;
	const fileData = module.file;
	const assignmentData = module.assignment;
	const quizData = module.quiz;
	const discussionData = module.discussion;

	// Mantine Form
	const mantineForm = useForm<
		ActivityModuleFormValues,
		(values: ActivityModuleFormValues) => ActivityModuleFormValues
	>({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: module.title,
			description: module.description || "",
			type: module.type,
			status: module.status,
			// Page fields
			pageContent: pageData?.content || "",
			// Whiteboard fields
			whiteboardContent: whiteboardData?.content || "",
			// File fields
			fileMedia:
				fileData?.media
					?.map(
						(m: number | { id: number } | null | undefined) =>
							typeof m === "object" && m !== null && "id" in m ? m.id : m,
					)
					.filter((id: number | null | undefined): id is number =>
						typeof id === "number",
					) || [],
			fileFiles: [], // Files to upload (empty for edit, user can add new files)
			// Assignment fields
			assignmentInstructions: assignmentData?.instructions || "",
			assignmentDueDate: assignmentData?.dueDate
				? new Date(assignmentData.dueDate)
				: null,
			assignmentMaxAttempts: assignmentData?.maxAttempts || 1,
			assignmentAllowLateSubmissions:
				assignmentData?.allowLateSubmissions || false,
			assignmentRequireTextSubmission:
				assignmentData?.requireTextSubmission || false,
			assignmentRequireFileSubmission:
				assignmentData?.requireFileSubmission || false,
			assignmentAllowedFileTypes: fileTypesToPresetValues(
				assignmentData?.allowedFileTypes,
			),
			assignmentMaxFileSize: assignmentData?.maxFileSize || 10,
			assignmentMaxFiles: assignmentData?.maxFiles || 5,
			// Quiz fields
			quizInstructions: quizData?.instructions || "",
			quizDueDate: quizData?.dueDate ? new Date(quizData.dueDate) : null,
			quizMaxAttempts: quizData?.maxAttempts || 1,
			quizPoints: quizData?.points || 100,
			quizTimeLimit: quizData?.timeLimit || 60,
			quizGradingType: quizData?.gradingType || "automatic",
			rawQuizConfig: quizData?.rawQuizConfig || null,
			// Discussion fields
			discussionInstructions: discussionData?.instructions || "",
			discussionDueDate: discussionData?.dueDate
				? new Date(discussionData.dueDate)
				: null,
			discussionRequireThread: discussionData?.requireThread || false,
			discussionRequireReplies: discussionData?.requireReplies || false,
			discussionMinReplies: discussionData?.minReplies || 1,
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	const selectedType = mantineForm.values.type;

	const handleDelete = () => {
		modals.openConfirmModal({
			title: "Delete Activity Module",
			children: (
				<Text size="sm">
					Are you sure you want to delete this activity module? This action
					cannot be undone. The module must not be linked to any courses to be
					deleted.
				</Text>
			),
			labels: { confirm: "Delete", cancel: "Cancel" },
			confirmProps: { color: "red" },
			onConfirm: () => {
				deleteModule(String(module.id));
			},
		});
	};

	return (
		<Container size="md" py="xl">
			<title>Edit Activity Module | Paideia LMS</title>
			<meta
				name="description"
				content="Edit an activity module in Paideia LMS"
			/>
			<meta property="og:title" content="Edit Activity Module | Paideia LMS" />
			<meta
				property="og:description"
				content="Edit an activity module in Paideia LMS"
			/>

			<Stack gap="xl">
				{/* Edit Form */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="lg">
						Edit Activity Module
					</Title>
					<form
						onSubmit={mantineForm.onSubmit((values) => {
							updateModule(String(module.id), values);
						})}
					>
						<Stack gap="md">
							<Select
								{...mantineForm.getInputProps("type")}
								key={mantineForm.key("type")}
								label="Module Type"
								placeholder="Select module type"
								disabled
								data={[
									{ value: "page", label: "Page" },
									{ value: "whiteboard", label: "Whiteboard" },
									{ value: "file", label: "File" },
									{ value: "assignment", label: "Assignment" },
									{ value: "quiz", label: "Quiz" },
									{ value: "discussion", label: "Discussion" },
								]}
							/>

							{selectedType === "page" && <PageForm form={mantineForm} />}
							{selectedType === "whiteboard" && (
								<WhiteboardForm form={mantineForm} />
							)}
							{selectedType === "file" && (
								<FileForm
									form={mantineForm}
									uploadLimit={uploadLimit}
									existingMedia={[]}
								/>
							)}
							{selectedType === "assignment" && (
								<AssignmentForm form={mantineForm} />
							)}
							{selectedType === "quiz" && <QuizForm form={mantineForm} />}
							{selectedType === "discussion" && (
								<DiscussionForm form={mantineForm} />
							)}

							<Button type="submit" size="lg" mt="lg" loading={isLoading}>
								Update Module
							</Button>
						</Stack>
					</form>
				</Paper>

				{/* Danger Zone */}
				<Paper
					withBorder
					shadow="sm"
					p="xl"
					style={{ borderColor: "var(--mantine-color-red-6)" }}
				>
					<Stack gap="md">
						<div>
							<Title order={3} c="red">
								Danger Zone
							</Title>
							<Text size="sm" c="dimmed" mt="xs">
								Irreversible and destructive actions
							</Text>
						</div>

						<Divider color="red" />

						<Group justify="space-between" align="flex-start">
							<div style={{ flex: 1 }}>
								<Text fw={500} mb="xs">
									Delete this activity module
								</Text>
								{hasLinkedCourses ? (
									<Text size="sm" c="dimmed">
										This activity module cannot be deleted because it is linked to
										one or more courses. Please remove it from all courses before
										deleting.
									</Text>
								) : (
									<Text size="sm" c="dimmed">
										Once you delete an activity module, there is no going back.
										Please be certain.
									</Text>
								)}
							</div>
							<Button
								color="red"
								variant="light"
								leftSection={<IconTrash size={16} />}
								onClick={handleDelete}
								loading={isDeleting}
								disabled={hasLinkedCourses}
								style={{ minWidth: "150px" }}
							>
								Delete Module
							</Button>
						</Group>
					</Stack>
				</Paper>
			</Stack>
		</Container>
	);
}
