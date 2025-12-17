import { Container, Paper, Select, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	createLoader,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { stringify } from "qs";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import type { ActivityModuleResult } from "server/internal/activity-module-management";
import {
	tryUpdateAssignmentModule,
	tryUpdateDiscussionModule,
	tryUpdateFileModule,
	tryUpdatePageModule,
	tryUpdateQuizModule,
	tryUpdateWhiteboardModule,
} from "server/internal/activity-module-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import type { LatestQuizConfig as QuizConfig } from "server/json/raw-quiz-config/version-resolver";
import { serverOnly$ } from "vite-env-only/macros";
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
import { handleUploadError } from "~/utils/handle-upload-errors";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
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

enum Action {
	UpdatePage = "updatePage",
	UpdateWhiteboard = "updateWhiteboard",
	UpdateFile = "updateFile",
	UpdateAssignment = "updateAssignment",
	UpdateQuiz = "updateQuiz",
	UpdateDiscussion = "updateDiscussion",
}

// Define search params for module update
export const moduleUpdateSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadSearchParams = createLoader(moduleUpdateSearchParams);

const updatePageAction = serverOnly$(
	async ({
		request,
		context,
		params,
	}: Route.ActionArgs & { searchParams: { action: Action.UpdatePage } }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const moduleId = params.moduleId;
		if (!moduleId) {
			return badRequest({
				success: false,
				error: "Module ID is required",
			});
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Handle JSON request
			const { data } = await getDataAndContentTypeFromRequest(request);
			const parsedData = activityModuleSchema.parse(data);

			if (parsedData.type !== "page") {
				return badRequest({
					success: false,
					error: "Invalid module type for page action",
				});
			}

			const { pageData } = transformToActivityData(parsedData);

			if (!pageData) {
				return badRequest({
					success: false,
					error: "Missing page data",
				});
			}

			const updateResult = await tryUpdatePageModule({
				payload,
				id: Number(moduleId),
				title: parsedData.title,
				description: parsedData.description,
				status: parsedData.status,
				content: pageData.content,
				req: reqWithTransaction,
				overrideAccess: false,
			});

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
		});
	},
)!;

const updateWhiteboardAction = serverOnly$(
	async ({
		request,
		context,
		params,
	}: Route.ActionArgs & {
		searchParams: { action: Action.UpdateWhiteboard };
	}) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const moduleId = params.moduleId;
		if (!moduleId) {
			return badRequest({
				success: false,
				error: "Module ID is required",
			});
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Handle JSON request
			const { data } = await getDataAndContentTypeFromRequest(request);
			const parsedData = activityModuleSchema.parse(data);

			if (parsedData.type !== "whiteboard") {
				return badRequest({
					success: false,
					error: "Invalid module type for whiteboard action",
				});
			}

			const { whiteboardData } = transformToActivityData(parsedData);

			if (!whiteboardData) {
				return badRequest({
					success: false,
					error: "Missing whiteboard data",
				});
			}

			const updateResult = await tryUpdateWhiteboardModule({
				payload,
				id: Number(moduleId),
				title: parsedData.title,
				description: parsedData.description,
				status: parsedData.status,
				content: whiteboardData.content,
				req: reqWithTransaction,
				overrideAccess: false,
			});

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
		});
	},
)!;

const updateFileAction = serverOnly$(
	async ({
		request,
		context,
		params,
	}: Route.ActionArgs & { searchParams: { action: Action.UpdateFile } }) => {
		const { payload, payloadRequest, systemGlobals } =
			context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const moduleId = params.moduleId;
		if (!moduleId) {
			return badRequest({
				success: false,
				error: "Module ID is required",
			});
		}

		const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Parse form data with media upload handler
			const parseResult = await tryParseFormDataWithMediaUpload({
				payload,
				request,
				userId: currentUser.id,
				req: reqWithTransaction,
				maxFileSize,
				fields: [
					{
						fieldName: "files",
					},
				],
			});

			if (!parseResult.ok) {
				return handleUploadError(
					parseResult.error,
					maxFileSize,
					"Failed to parse form data",
				);
			}

			const { formData, uploadedMedia } = parseResult.value;

			const uploadedMediaIds = uploadedMedia.map((media) => media.mediaId);

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
			const parsedData = activityModuleSchema.parse(formDataObj);

			if (parsedData.type !== "file") {
				return badRequest({
					success: false,
					error: "Invalid module type for file action",
				});
			}

			// For file type, combine existing media IDs with newly uploaded media IDs
			const existingMediaIds = parsedData.fileMedia ?? [];
			const allMediaIds = [...existingMediaIds, ...uploadedMediaIds];

			const updateResult = await tryUpdateFileModule({
				payload,
				id: Number(moduleId),
				title: parsedData.title,
				description: parsedData.description,
				status: parsedData.status,
				media: allMediaIds.length > 0 ? allMediaIds : undefined,
				req: reqWithTransaction,
				overrideAccess: false,
			});

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
		});
	},
)!;

const updateAssignmentAction = serverOnly$(
	async ({
		request,
		context,
		params,
	}: Route.ActionArgs & {
		searchParams: { action: Action.UpdateAssignment };
	}) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const moduleId = params.moduleId;
		if (!moduleId) {
			return badRequest({
				success: false,
				error: "Module ID is required",
			});
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Handle JSON request
			const { data } = await getDataAndContentTypeFromRequest(request);
			const parsedData = activityModuleSchema.parse(data);

			if (parsedData.type !== "assignment") {
				return badRequest({
					success: false,
					error: "Invalid module type for assignment action",
				});
			}

			const { assignmentData } = transformToActivityData(parsedData);

			if (!assignmentData) {
				return badRequest({
					success: false,
					error: "Missing assignment data",
				});
			}

			const updateResult = await tryUpdateAssignmentModule({
				payload,
				id: Number(moduleId),
				title: parsedData.title,
				description: parsedData.description,
				status: parsedData.status,
				instructions: assignmentData.instructions,
				requireTextSubmission: assignmentData.requireTextSubmission,
				requireFileSubmission: assignmentData.requireFileSubmission,
				allowedFileTypes: assignmentData.allowedFileTypes,
				maxFileSize: assignmentData.maxFileSize,
				maxFiles: assignmentData.maxFiles,
				req: reqWithTransaction,
			});

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
		});
	},
)!;

const updateQuizAction = serverOnly$(
	async ({
		request,
		context,
		params,
	}: Route.ActionArgs & { searchParams: { action: Action.UpdateQuiz } }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const moduleId = params.moduleId;
		if (!moduleId) {
			return badRequest({
				success: false,
				error: "Module ID is required",
			});
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Handle JSON request
			const { data } = await getDataAndContentTypeFromRequest(request);
			const parsedData = activityModuleSchema.parse(data);

			if (parsedData.type !== "quiz") {
				return badRequest({
					success: false,
					error: "Invalid module type for quiz action",
				});
			}

			const { quizData } = transformToActivityData(parsedData);

			if (!quizData) {
				return badRequest({
					success: false,
					error: "Missing quiz data",
				});
			}

			const updateResult = await tryUpdateQuizModule({
				payload,
				id: Number(moduleId),
				title: parsedData.title,
				description: parsedData.description,
				status: parsedData.status,
				instructions: quizData.instructions,
				points: quizData.points,
				timeLimit: quizData.timeLimit,
				gradingType: quizData.gradingType,
				rawQuizConfig: quizData.rawQuizConfig,
				req: reqWithTransaction,
				overrideAccess: false,
			});

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
		});
	},
)!;

const updateDiscussionAction = serverOnly$(
	async ({
		request,
		context,
		params,
	}: Route.ActionArgs & {
		searchParams: { action: Action.UpdateDiscussion };
	}) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return badRequest({
				success: false,
				error: "You must be logged in to edit modules",
			});
		}

		const moduleId = params.moduleId;
		if (!moduleId) {
			return badRequest({
				success: false,
				error: "Module ID is required",
			});
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Handle JSON request
			const { data } = await getDataAndContentTypeFromRequest(request);
			const parsedData = activityModuleSchema.parse(data);

			if (parsedData.type !== "discussion") {
				return badRequest({
					success: false,
					error: "Invalid module type for discussion action",
				});
			}

			const { discussionData } = transformToActivityData(parsedData);

			if (!discussionData) {
				return badRequest({
					success: false,
					error: "Missing discussion data",
				});
			}

			const updateResult = await tryUpdateDiscussionModule({
				payload,
				id: Number(moduleId),
				title: parsedData.title,
				description: parsedData.description,
				status: parsedData.status,
				instructions: discussionData.instructions,
				dueDate: discussionData.dueDate,
				requireThread: discussionData.requireThread,
				requireReplies: discussionData.requireReplies,
				minReplies: discussionData.minReplies,
				req: reqWithTransaction,
			});

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
		});
	},
)!;

const getActionUrl = (action: Action, moduleId: string) => {
	return (
		href("/user/module/edit/:moduleId/setting", { moduleId }) +
		"?" +
		stringify({ action })
	);
};

export const action = async (args: Route.ActionArgs) => {
	const { request, params } = args;
	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			success: false,
			error: "Action is required",
		});
	}

	if (!params.moduleId) {
		return badRequest({
			success: false,
			error: "Module ID is required",
		});
	}

	if (actionType === Action.UpdatePage) {
		return updatePageAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateWhiteboard) {
		return updateWhiteboardAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateFile) {
		return updateFileAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateAssignment) {
		return updateAssignmentAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateQuiz) {
		return updateQuizAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.UpdateDiscussion) {
		return updateDiscussionAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	return badRequest({
		success: false,
		error: "Invalid action",
	});
};

export const clientAction = async ({
	serverAction,
}: Route.ClientActionArgs) => {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message || "Module updated successfully",
			color: "green",
		});
	} else if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData.error || "Failed to update module",
			color: "red",
		});
	}

	return actionData;
};

// Custom hooks for updating modules
export function useUpdatePage() {
	const fetcher = useFetcher<typeof clientAction>();

	const updatePage = (
		moduleId: string,
		values: Extract<ActivityModuleFormValues, { type: "page" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.UpdatePage, moduleId),
			encType: ContentType.JSON,
		});
	};

	return {
		updatePage,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useUpdateWhiteboard() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateWhiteboard = (
		moduleId: string,
		values: Extract<ActivityModuleFormValues, { type: "whiteboard" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.UpdateWhiteboard, moduleId),
			encType: ContentType.JSON,
		});
	};

	return {
		updateWhiteboard,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useUpdateFile() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateFile = (
		moduleId: string,
		values: Extract<ActivityModuleFormValues, { type: "file" }>,
	) => {
		const files = values.fileFiles;
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
			action: getActionUrl(Action.UpdateFile, moduleId),
			encType: ContentType.MULTIPART,
		});
	};

	return {
		updateFile,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useUpdateAssignment() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateAssignment = (
		moduleId: string,
		values: Extract<ActivityModuleFormValues, { type: "assignment" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.UpdateAssignment, moduleId),
			encType: ContentType.JSON,
		});
	};

	return {
		updateAssignment,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useUpdateQuiz() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateQuiz = (
		moduleId: string,
		values: Extract<ActivityModuleFormValues, { type: "quiz" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.UpdateQuiz, moduleId),
			encType: ContentType.JSON,
		});
	};

	return {
		updateQuiz,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useUpdateDiscussion() {
	const fetcher = useFetcher<typeof clientAction>();

	const updateDiscussion = (
		moduleId: string,
		values: Extract<ActivityModuleFormValues, { type: "discussion" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.UpdateDiscussion, moduleId),
			encType: ContentType.JSON,
		});
	};

	return {
		updateDiscussion,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

// Form wrappers that use their respective hooks
function PageFormWrapper({
	module,
}: {
	module: Extract<ActivityModuleResult, { type: "page" }>;
}) {
	const { updatePage, isLoading } = useUpdatePage();
	return (
		<PageForm
			initialValues={{
				title: module.title,
				description: module.description || "",
				status: module.status,
				type: "page",
				pageContent: module.content || "",
			}}
			onSubmit={(values) => updatePage(String(module.id), values)}
			isLoading={isLoading}
		/>
	);
}

function WhiteboardFormWrapper({
	module,
}: {
	module: Extract<ActivityModuleResult, { type: "whiteboard" }>;
}) {
	const { updateWhiteboard, isLoading } = useUpdateWhiteboard();
	return (
		<WhiteboardForm
			initialValues={{
				title: module.title,
				description: module.description || "",
				status: module.status,
				type: "whiteboard",
				whiteboardContent: module.content || "",
			}}
			onSubmit={(values) => updateWhiteboard(String(module.id), values)}
			isLoading={isLoading}
		/>
	);
}

function FileFormWrapper({
	module,
	uploadLimit,
}: {
	module: Extract<ActivityModuleResult, { type: "file" }>;
	uploadLimit?: number;
}) {
	const { updateFile, isLoading } = useUpdateFile();
	return (
		<FileForm
			initialValues={{
				title: module.title,
				description: module.description || "",
				status: module.status,
				fileMedia: module.media?.map((m) => m.id) ?? [],
				fileFiles: [],
			}}
			onSubmit={(values) => updateFile(String(module.id), values)}
			uploadLimit={uploadLimit}
			existingMedia={module.media ?? []}
			isLoading={isLoading}
		/>
	);
}

function AssignmentFormWrapper({
	module,
}: {
	module: Extract<ActivityModuleResult, { type: "assignment" }>;
}) {
	const { updateAssignment, isLoading } = useUpdateAssignment();
	return (
		<AssignmentForm
			initialValues={{
				title: module.title,
				description: module.description || "",
				status: module.status,
				type: "assignment",
				assignmentInstructions: module.instructions || "",
				assignmentRequireTextSubmission: module.requireTextSubmission ?? false,
				assignmentRequireFileSubmission: module.requireFileSubmission ?? false,
				assignmentAllowedFileTypes: fileTypesToPresetValues(
					module.allowedFileTypes,
				),
				assignmentMaxFileSize: module.maxFileSize ?? 10,
				assignmentMaxFiles: module.maxFiles ?? 5,
			}}
			onSubmit={(values) => updateAssignment(String(module.id), values)}
			isLoading={isLoading}
		/>
	);
}

function QuizFormWrapper({
	module,
}: {
	module: Extract<ActivityModuleResult, { type: "quiz" }>;
}) {
	const { updateQuiz, isLoading } = useUpdateQuiz();
	return (
		<QuizForm
			initialValues={{
				title: module.title,
				description: module.description || "",
				status: module.status,
				type: "quiz",
				quizInstructions: module.instructions || "",
				quizPoints: module.points ?? 100,
				quizTimeLimit: module.timeLimit ?? 60,
				quizGradingType: module.gradingType || "automatic",
				rawQuizConfig: (module.rawQuizConfig as QuizConfig | null) ?? null,
			}}
			onSubmit={(values) => updateQuiz(String(module.id), values)}
			isLoading={isLoading}
		/>
	);
}

function DiscussionFormWrapper({
	module,
}: {
	module: Extract<ActivityModuleResult, { type: "discussion" }>;
}) {
	const { updateDiscussion, isLoading } = useUpdateDiscussion();
	return (
		<DiscussionForm
			initialValues={{
				title: module.title,
				description: module.description || "",
				status: module.status,
				type: "discussion",
				discussionInstructions: module.instructions || "",
				discussionDueDate: module.dueDate ? new Date(module.dueDate) : null,
				discussionRequireThread: module.requireThread ?? false,
				discussionRequireReplies: module.requireReplies ?? false,
				discussionMinReplies: module.minReplies ?? 1,
			}}
			onSubmit={(values) => updateDiscussion(String(module.id), values)}
			isLoading={isLoading}
		/>
	);
}

export default function EditModulePage({ loaderData }: Route.ComponentProps) {
	const { module, uploadLimit, hasLinkedCourses } = loaderData;

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

						{module.type === "page" && <PageFormWrapper module={module} />}
						{module.type === "whiteboard" && (
							<WhiteboardFormWrapper module={module} />
						)}
						{module.type === "file" && (
							<FileFormWrapper module={module} uploadLimit={uploadLimit} />
						)}
						{module.type === "assignment" && (
							<AssignmentFormWrapper module={module} />
						)}
						{module.type === "quiz" && <QuizFormWrapper module={module} />}
						{module.type === "discussion" && (
							<DiscussionFormWrapper module={module} />
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
