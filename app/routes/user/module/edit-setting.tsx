import { Container, Paper, Select, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import {
	tryUpdateActivityModule,
	type UpdateActivityModuleArgs,
} from "server/internal/activity-module-management";
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "server/internal/utils/handle-transaction-id";
import { handleUploadError } from "~/utils/handle-upload-errors";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
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
import { createLoader, parseAsStringEnum as parseAsStringEnumServer } from "nuqs/server";
import { stringify } from "qs";
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

const updatePageAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
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
	const transactionInfo = await handleTransactionId(payload);

	// Handle JSON request
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = activityModuleSchema.parse(data);

	if (parsedData.type !== "page") {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Invalid module type for page action",
		});
	}

	const { pageData } = transformToActivityData(parsedData);

	if (!pageData) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Missing page data",
		});
	}

	const updateArgs: UpdateActivityModuleArgs = {
		id: Number(moduleId),
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status,
		type: "page" as const,
		pageData,
		req: transactionInfo.reqWithTransaction,
		user: currentUser,
	};

	const updateResult = await tryUpdateActivityModule(payload, updateArgs);

	if (!updateResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	return ok({
		success: true,
		message: "Module updated successfully",
	});
};

const updateWhiteboardAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
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
	const transactionInfo = await handleTransactionId(payload);

	// Handle JSON request
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = activityModuleSchema.parse(data);

	if (parsedData.type !== "whiteboard") {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Invalid module type for whiteboard action",
		});
	}

	const { whiteboardData } = transformToActivityData(parsedData);

	if (!whiteboardData) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Missing whiteboard data",
		});
	}

	const updateArgs: UpdateActivityModuleArgs = {
		id: Number(moduleId),
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status,
		type: "whiteboard" as const,
		whiteboardData,
		req: transactionInfo.reqWithTransaction,
		user: currentUser,
	};

	const updateResult = await tryUpdateActivityModule(payload, updateArgs);

	if (!updateResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	return ok({
		success: true,
		message: "Module updated successfully",
	});
};

const updateFileAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload, systemGlobals } = context.get(globalContextKey);
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
	const transactionInfo = await handleTransactionId(payload);

	// Parse form data with media upload handler
	const parseResult = await tryParseFormDataWithMediaUpload({
		payload,
		request,
		userId: currentUser.id,
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		maxFileSize,
		fields: [
			{
				fieldName: "files",
			},
		],
	});

	if (!parseResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
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
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Invalid module type for file action",
		});
	}

	const { fileData } = transformToActivityData(parsedData);

	// For file type, combine existing media IDs with newly uploaded media IDs
	const existingMediaIds = parsedData.fileMedia ?? [];
	const allMediaIds = [...existingMediaIds, ...uploadedMediaIds];
	const finalFileData = allMediaIds.length > 0
		? { media: allMediaIds }
		: fileData;

	if (!finalFileData) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Missing file data",
		});
	}

	const updateArgs: UpdateActivityModuleArgs = {
		id: Number(moduleId),
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status,
		type: "file" as const,
		fileData: finalFileData,
		req: transactionInfo.reqWithTransaction,
		user: currentUser,
	};

	const updateResult = await tryUpdateActivityModule(payload, updateArgs);

	if (!updateResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	return ok({
		success: true,
		message: "Module updated successfully",
	});
};

const updateAssignmentAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
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
	const transactionInfo = await handleTransactionId(payload);

	// Handle JSON request
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = activityModuleSchema.parse(data);

	if (parsedData.type !== "assignment") {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Invalid module type for assignment action",
		});
	}

	const { assignmentData } = transformToActivityData(parsedData);

	if (!assignmentData) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Missing assignment data",
		});
	}

	const updateArgs: UpdateActivityModuleArgs = {
		id: Number(moduleId),
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status,
		type: "assignment" as const,
		assignmentData,
		req: transactionInfo.reqWithTransaction,
		user: currentUser,
	};

	const updateResult = await tryUpdateActivityModule(payload, updateArgs);

	if (!updateResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	return ok({
		success: true,
		message: "Module updated successfully",
	});
};

const updateQuizAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
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
	const transactionInfo = await handleTransactionId(payload);

	// Handle JSON request
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = activityModuleSchema.parse(data);

	if (parsedData.type !== "quiz") {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Invalid module type for quiz action",
		});
	}

	const { quizData } = transformToActivityData(parsedData);

	if (!quizData) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Missing quiz data",
		});
	}

	const updateArgs: UpdateActivityModuleArgs = {
		id: Number(moduleId),
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status,
		type: "quiz" as const,
		quizData,
		req: transactionInfo.reqWithTransaction,
		user: currentUser,
	};

	const updateResult = await tryUpdateActivityModule(payload, updateArgs);

	if (!updateResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	return ok({
		success: true,
		message: "Module updated successfully",
	});
};

const updateDiscussionAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
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
	const transactionInfo = await handleTransactionId(payload);

	// Handle JSON request
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsedData = activityModuleSchema.parse(data);

	if (parsedData.type !== "discussion") {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Invalid module type for discussion action",
		});
	}

	const { discussionData } = transformToActivityData(parsedData);

	if (!discussionData) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Missing discussion data",
		});
	}

	const updateArgs: UpdateActivityModuleArgs = {
		id: Number(moduleId),
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status,
		type: "discussion" as const,
		discussionData,
		req: transactionInfo.reqWithTransaction,
		user: currentUser,
	};

	const updateResult = await tryUpdateActivityModule(payload, updateArgs);

	if (!updateResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: updateResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	return ok({
		success: true,
		message: "Module updated successfully",
	});
};

const getActionUrl = (action: Action, moduleId: string) => {
	return href("/user/module/edit/:moduleId/setting", { moduleId }) + "?" + stringify({ action });
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

	const updatePage = (moduleId: string, values: Extract<ActivityModuleFormValues, { type: "page" }>) => {
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

	const updateWhiteboard = (moduleId: string, values: Extract<ActivityModuleFormValues, { type: "whiteboard" }>) => {
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

	const updateFile = (moduleId: string, values: Extract<ActivityModuleFormValues, { type: "file" }>) => {
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

	const updateAssignment = (moduleId: string, values: Extract<ActivityModuleFormValues, { type: "assignment" }>) => {
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

	const updateQuiz = (moduleId: string, values: Extract<ActivityModuleFormValues, { type: "quiz" }>) => {
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

	const updateDiscussion = (moduleId: string, values: Extract<ActivityModuleFormValues, { type: "discussion" }>) => {
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
	moduleId,
	initialValues,
}: {
	moduleId: number;
	initialValues: Extract<ActivityModuleFormValues, { type: "page" }>;
}) {
	const { updatePage, isLoading } = useUpdatePage();
	return (
		<PageForm
			initialValues={initialValues}
			onSubmit={(values) => updatePage(String(moduleId), values)}
			isLoading={isLoading}
		/>
	);
}

function WhiteboardFormWrapper({
	moduleId,
	initialValues,
}: {
	moduleId: number;
	initialValues: Extract<ActivityModuleFormValues, { type: "whiteboard" }>;
}) {
	const { updateWhiteboard, isLoading } = useUpdateWhiteboard();
	return (
		<WhiteboardForm
			initialValues={initialValues}
			onSubmit={(values) => updateWhiteboard(String(moduleId), values)}
			isLoading={isLoading}
		/>
	);
}

function FileFormWrapper({
	moduleId,
	initialValues,
	uploadLimit,
}: {
	moduleId: number;
	initialValues: Extract<ActivityModuleFormValues, { type: "file" }>;
	uploadLimit?: number;
}) {
	const { updateFile, isLoading } = useUpdateFile();
	return (
		<FileForm
			initialValues={initialValues}
			onSubmit={(values) => updateFile(String(moduleId), values)}
			uploadLimit={uploadLimit}
			existingMedia={[]}
			isLoading={isLoading}
		/>
	);
}

function AssignmentFormWrapper({
	moduleId,
	initialValues,
}: {
	moduleId: number;
	initialValues: Extract<ActivityModuleFormValues, { type: "assignment" }>;
}) {
	const { updateAssignment, isLoading } = useUpdateAssignment();
	return (
		<AssignmentForm
			initialValues={initialValues}
			onSubmit={(values) => updateAssignment(String(moduleId), values)}
			isLoading={isLoading}
		/>
	);
}

function QuizFormWrapper({
	moduleId,
	initialValues,
}: {
	moduleId: number;
	initialValues: Extract<ActivityModuleFormValues, { type: "quiz" }>;
}) {
	const { updateQuiz, isLoading } = useUpdateQuiz();
	return (
		<QuizForm
			initialValues={initialValues}
			onSubmit={(values) => updateQuiz(String(moduleId), values)}
			isLoading={isLoading}
		/>
	);
}

function DiscussionFormWrapper({
	moduleId,
	initialValues,
}: {
	moduleId: number;
	initialValues: Extract<ActivityModuleFormValues, { type: "discussion" }>;
}) {
	const { updateDiscussion, isLoading } = useUpdateDiscussion();
	return (
		<DiscussionForm
			initialValues={initialValues}
			onSubmit={(values) => updateDiscussion(String(moduleId), values)}
			isLoading={isLoading}
		/>
	);
}

export default function EditModulePage({ loaderData }: Route.ComponentProps) {
	const { module, uploadLimit, hasLinkedCourses } = loaderData;

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
					pageContent: pageData?.content ?? "",
				};
			case "whiteboard":
				return {
					...base,
					type: "whiteboard" as const,
					whiteboardContent: whiteboardData?.content ?? "",
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
							) ?? [],
					fileFiles: [],
				};
			case "assignment":
				return {
					...base,
					type: "assignment" as const,
					assignmentInstructions: assignmentData?.instructions ?? "",
					assignmentDueDate: assignmentData?.dueDate
						? new Date(assignmentData.dueDate)
						: null,
					assignmentMaxAttempts: assignmentData?.maxAttempts ?? 1,
					assignmentAllowLateSubmissions:
						assignmentData?.allowLateSubmissions ?? false,
					assignmentRequireTextSubmission:
						assignmentData?.requireTextSubmission ?? false,
					assignmentRequireFileSubmission:
						assignmentData?.requireFileSubmission ?? false,
					assignmentAllowedFileTypes: fileTypesToPresetValues(
						assignmentData?.allowedFileTypes,
					),
					assignmentMaxFileSize: assignmentData?.maxFileSize ?? 10,
					assignmentMaxFiles: assignmentData?.maxFiles ?? 5,
				};
			case "quiz":
				return {
					...base,
					type: "quiz" as const,
					quizInstructions: quizData?.instructions ?? "",
					quizDueDate: quizData?.dueDate ? new Date(quizData.dueDate) : null,
					quizMaxAttempts: quizData?.maxAttempts ?? 1,
					quizPoints: quizData?.points ?? 100,
					quizTimeLimit: quizData?.timeLimit ?? 60,
					quizGradingType: quizData?.gradingType ?? "automatic",
					rawQuizConfig: quizData?.rawQuizConfig ?? null,
				};
			case "discussion":
				return {
					...base,
					type: "discussion" as const,
					discussionInstructions: discussionData?.instructions ?? "",
					discussionDueDate: discussionData?.dueDate
						? new Date(discussionData.dueDate)
						: null,
					discussionRequireThread: discussionData?.requireThread ?? false,
					discussionRequireReplies: discussionData?.requireReplies ?? false,
					discussionMinReplies: discussionData?.minReplies ?? 1,
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

						{module.type === "page" && (
							<PageFormWrapper
								moduleId={module.id}
								initialValues={getInitialValues() as Extract<ActivityModuleFormValues, { type: "page" }>}
							/>
						)}
						{module.type === "whiteboard" && (
							<WhiteboardFormWrapper
								moduleId={module.id}
								initialValues={getInitialValues() as Extract<ActivityModuleFormValues, { type: "whiteboard" }>}
							/>
						)}
						{module.type === "file" && (
							<FileFormWrapper
								moduleId={module.id}
								initialValues={getInitialValues() as Extract<ActivityModuleFormValues, { type: "file" }>}
								uploadLimit={uploadLimit}
							/>
						)}
						{module.type === "assignment" && (
							<AssignmentFormWrapper
								moduleId={module.id}
								initialValues={getInitialValues() as Extract<ActivityModuleFormValues, { type: "assignment" }>}
							/>
						)}
						{module.type === "quiz" && (
							<QuizFormWrapper
								moduleId={module.id}
								initialValues={getInitialValues() as Extract<ActivityModuleFormValues, { type: "quiz" }>}
							/>
						)}
						{module.type === "discussion" && (
							<DiscussionFormWrapper
								moduleId={module.id}
								initialValues={getInitialValues() as Extract<ActivityModuleFormValues, { type: "discussion" }>}
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
