import { Container, Paper, Select, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
} from "@remix-run/form-data-parser";
import prettyBytes from "pretty-bytes";
import { useState } from "react";
import { href, type SubmitTarget, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import {
	tryUpdateActivityModule,
	type UpdateActivityModuleArgs,
} from "server/internal/activity-module-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import { parseFormDataWithMediaUpload } from "~/utils/upload-handler";
import type { z } from "zod";
import {
	AssignmentForm,
	DiscussionForm,
	FileForm,
	PageForm,
	QuizForm,
	WhiteboardForm,
} from "~/components/activity-module-forms";
import { DeleteActivityModule } from "~/components/delete-activity-module";
import {
	type ActivityModuleFormValues,
	activityModuleSchema,
	transformFormValues,
	transformToActivityData,
} from "~/utils/activity-module-schema";
import { fileTypesToPresetValues } from "~/utils/file-types";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
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

	////////////////////////////////////////////////////////////
	// Update Module
	////////////////////////////////////////////////////////////

	const { transactionID, reqWithTransaction } = await handleTransactionId(
		payload,
		request,
	);

	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	try {
		const contentType = request.headers.get("content-type") || "";

		// Check if this is a multipart form (file upload)
		const isMultipart = contentType.includes("multipart/form-data");

		let parsedData: z.infer<typeof activityModuleSchema>;
		let uploadedMediaIds: number[] = [];

		if (isMultipart) {
			// Handle file uploads for file module type
			const { formData, uploadedMedia } = await parseFormDataWithMediaUpload({
				payload,
				request,
				userId: currentUser.id,
				user: currentUser,
				req: reqWithTransaction,
				maxFileSize,
				fields: [
					{
						fieldName: "files",
					},
				],
			});

			uploadedMediaIds = uploadedMedia.map((media) => media.mediaId);

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

		const {
			pageData,
			whiteboardData,
			fileData,
			assignmentData,
			quizData,
			discussionData,
		} = transformToActivityData(parsedData);

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
				...baseArgs,
				type: "page" as const,
				pageData,
				req: { transactionID },
				user: currentUser,
			};
		} else if (parsedData.type === "whiteboard" && whiteboardData) {
			updateArgs = {
				...baseArgs,
				type: "whiteboard" as const,
				whiteboardData,
				req: { transactionID },
				user: currentUser,
			};
		} else if (parsedData.type === "assignment" && assignmentData) {
			updateArgs = {
				...baseArgs,
				type: "assignment" as const,
				assignmentData,
				req: { transactionID },
				user: currentUser,
			};
		} else if (parsedData.type === "quiz" && quizData) {
			updateArgs = {
				...baseArgs,
				type: "quiz" as const,
				quizData,
				req: { transactionID },
				user: currentUser,
			};
		} else if (parsedData.type === "file" && finalFileData) {
			updateArgs = {
				...baseArgs,
				type: "file" as const,
				fileData: finalFileData,
				req: { transactionID },
				user: currentUser,
			};
		} else if (parsedData.type === "discussion" && discussionData) {
			updateArgs = {
				...baseArgs,
				type: "discussion" as const,
				discussionData,
				req: { transactionID },
				user: currentUser,
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

export default function EditModulePage({ loaderData }: Route.ComponentProps) {
	const { module, uploadLimit, hasLinkedCourses } = loaderData;
	const { updateModule, isLoading } = useUpdateModule();
	const [selectedType] = useState<ActivityModuleFormValues["type"]>(
		module.type,
	);

	// Extract activity-specific data
	const pageData = module.page;
	const whiteboardData = module.whiteboard;
	const fileData = module.file;
	const assignmentData = module.assignment;
	const quizData = module.quiz;
	const discussionData = module.discussion;

	// Prepare initial values for each form type
	const getInitialValues = () => {
		const base = {
			title: module.title,
			description: module.description || "",
			status: module.status,
		};

		switch (module.type) {
			case "page":
				return {
					...base,
					type: "page" as const,
					pageContent: pageData?.content || "",
				};
			case "whiteboard":
				return {
					...base,
					type: "whiteboard" as const,
					whiteboardContent: whiteboardData?.content || "",
				};
			case "file":
				return {
					...base,
					type: "file" as const,
					fileMedia:
						fileData?.media
							?.map((m: number | { id: number } | null | undefined) =>
								typeof m === "object" && m !== null && "id" in m ? m.id : m,
							)
							.filter(
								(id: number | null | undefined): id is number =>
									typeof id === "number",
							) || [],
					fileFiles: [],
				};
			case "assignment":
				return {
					...base,
					type: "assignment" as const,
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
				};
			case "quiz":
				return {
					...base,
					type: "quiz" as const,
					quizInstructions: quizData?.instructions || "",
					quizDueDate: quizData?.dueDate ? new Date(quizData.dueDate) : null,
					quizMaxAttempts: quizData?.maxAttempts || 1,
					quizPoints: quizData?.points || 100,
					quizTimeLimit: quizData?.timeLimit || 60,
					quizGradingType: quizData?.gradingType || "automatic",
					rawQuizConfig: quizData?.rawQuizConfig || null,
				};
			case "discussion":
				return {
					...base,
					type: "discussion" as const,
					discussionInstructions: discussionData?.instructions || "",
					discussionDueDate: discussionData?.dueDate
						? new Date(discussionData.dueDate)
						: null,
					discussionRequireThread: discussionData?.requireThread || false,
					discussionRequireReplies: discussionData?.requireReplies || false,
					discussionMinReplies: discussionData?.minReplies || 1,
				};
		}
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
					<Stack gap="md">
						<Select
							value={module.type}
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

						{selectedType === "page" && (
							<PageForm
								initialValues={getInitialValues() as any}
								onSubmit={(values) => updateModule(String(module.id), values)}
								isLoading={isLoading}
							/>
						)}
						{selectedType === "whiteboard" && (
							<WhiteboardForm
								initialValues={getInitialValues() as any}
								onSubmit={(values) => updateModule(String(module.id), values)}
								isLoading={isLoading}
							/>
						)}
						{selectedType === "file" && (
							<FileForm
								initialValues={getInitialValues() as any}
								onSubmit={(values) => updateModule(String(module.id), values)}
								uploadLimit={uploadLimit}
								existingMedia={[]}
								isLoading={isLoading}
							/>
						)}
						{selectedType === "assignment" && (
							<AssignmentForm
								initialValues={getInitialValues() as any}
								onSubmit={(values) => updateModule(String(module.id), values)}
								isLoading={isLoading}
							/>
						)}
						{selectedType === "quiz" && (
							<QuizForm
								initialValues={getInitialValues() as any}
								onSubmit={(values) => updateModule(String(module.id), values)}
								isLoading={isLoading}
							/>
						)}
						{selectedType === "discussion" && (
							<DiscussionForm
								initialValues={getInitialValues() as any}
								onSubmit={(values) => updateModule(String(module.id), values)}
								isLoading={isLoading}
							/>
						)}
					</Stack>
				</Paper>

				<DeleteActivityModule
					moduleId={module.id}
					hasLinkedCourses={hasLinkedCourses}
				/>
			</Stack>
		</Container>
	);
}
