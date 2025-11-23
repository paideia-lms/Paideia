import { Container, Paper, Select, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryState } from "nuqs";
import {
	createLoader,
	parseAsStringEnum,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { stringify } from "qs";
import {
	href,
	type LoaderFunctionArgs,
	redirect,
	useFetcher,
} from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
} from "server/internal/activity-module-management";
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "server/internal/utils/handle-transaction-id";
import {
	AssignmentForm,
	DiscussionForm,
	FileForm,
	PageForm,
	QuizForm,
	WhiteboardForm,
} from "~/components/activity-module-forms";
import {
	type ActivityModuleFormValues,
	activityModuleSchema,
	getInitialFormValuesForType,
	transformFormValues,
	transformToActivityData,
} from "~/utils/activity-module-schema";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import { handleUploadError } from "~/utils/handle-upload-errors";
import {
	badRequest,
	StatusCode,
	UnauthorizedResponse,
} from "~/utils/responses";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
import type { Route } from "./+types/new";

export const loader = async ({ context }: LoaderFunctionArgs) => {
	const { systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new UnauthorizedResponse("You must be logged in to create modules");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	return {
		user: currentUser,
		uploadLimit: systemGlobals.sitePolicies.siteUploadLimit ?? undefined,
	};
};

enum Action {
	CreatePage = "createPage",
	CreateWhiteboard = "createWhiteboard",
	CreateFile = "createFile",
	CreateAssignment = "createAssignment",
	CreateQuiz = "createQuiz",
	CreateDiscussion = "createDiscussion",
}

// Define search params for module creation
export const moduleSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadSearchParams = createLoader(moduleSearchParams);

const createPageAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
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

	const createArgs: CreateActivityModuleArgs = {
		payload,
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status || ("draft" as const),
		userId: currentUser.id,
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		type: "page" as const,
		pageData,
	};

	const createResult = await tryCreateActivityModule(createArgs);

	if (!createResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: createResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	throw redirect("/user/profile");
};

const createWhiteboardAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
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

	const createArgs: CreateActivityModuleArgs = {
		payload,
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status || ("draft" as const),
		userId: currentUser.id,
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		type: "whiteboard" as const,
		whiteboardData,
	};

	const createResult = await tryCreateActivityModule(createArgs);

	if (!createResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: createResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	throw redirect("/user/profile");
};

const createFileAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
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

	// For file type, use uploaded media IDs
	const finalFileData =
		uploadedMediaIds.length > 0 ? { media: uploadedMediaIds } : fileData;

	if (!finalFileData) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: "Missing file data",
		});
	}

	const createArgs: CreateActivityModuleArgs = {
		payload,
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status || ("draft" as const),
		userId: currentUser.id,
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		type: "file" as const,
		fileData: finalFileData,
	};

	const createResult = await tryCreateActivityModule(createArgs);

	if (!createResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: createResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	throw redirect("/user/profile");
};

const createAssignmentAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
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

	const createArgs: CreateActivityModuleArgs = {
		payload,
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status || ("draft" as const),
		userId: currentUser.id,
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		type: "assignment" as const,
		assignmentData,
	};

	const createResult = await tryCreateActivityModule(createArgs);

	if (!createResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: createResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	throw redirect("/user/profile");
};

const createQuizAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
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

	const createArgs: CreateActivityModuleArgs = {
		payload,
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status || ("draft" as const),
		userId: currentUser.id,
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		type: "quiz" as const,
		quizData,
	};

	const createResult = await tryCreateActivityModule(createArgs);

	if (!createResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: createResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	throw redirect("/user/profile");
};

const createDiscussionAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return badRequest({
			success: false,
			error: "You must be logged in to create modules",
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

	const createArgs: CreateActivityModuleArgs = {
		payload,
		title: parsedData.title,
		description: parsedData.description,
		status: parsedData.status || ("draft" as const),
		userId: currentUser.id,
		user: currentUser,
		req: transactionInfo.reqWithTransaction,
		type: "discussion" as const,
		discussionData,
	};

	const createResult = await tryCreateActivityModule(createArgs);

	if (!createResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			success: false,
			error: createResult.error.message,
		});
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	throw redirect("/user/profile");
};

const getActionUrl = (action: Action) => {
	return href("/user/module/new") + "?" + stringify({ action });
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const { action: actionType } = loadSearchParams(request);

	if (!actionType) {
		return badRequest({
			success: false,
			error: "Action is required",
		});
	}

	if (actionType === Action.CreatePage) {
		return createPageAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.CreateWhiteboard) {
		return createWhiteboardAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.CreateFile) {
		return createFileAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.CreateAssignment) {
		return createAssignmentAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.CreateQuiz) {
		return createQuizAction({
			...args,
			searchParams: {
				action: actionType,
			},
		});
	}

	if (actionType === Action.CreateDiscussion) {
		return createDiscussionAction({
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

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData.error || "Failed to create module",
			color: "red",
		});
	} else {
		notifications.show({
			title: "Success",
			message: "Activity module created successfully",
			color: "green",
		});
	}

	return actionData;
}

// Custom hooks for creating modules
export function useCreatePage() {
	const fetcher = useFetcher<typeof clientAction>();

	const createPage = (
		values: Extract<ActivityModuleFormValues, { type: "page" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.CreatePage),
			encType: ContentType.JSON,
		});
	};

	return {
		createPage,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useCreateWhiteboard() {
	const fetcher = useFetcher<typeof clientAction>();

	const createWhiteboard = (
		values: Extract<ActivityModuleFormValues, { type: "whiteboard" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.CreateWhiteboard),
			encType: ContentType.JSON,
		});
	};

	return {
		createWhiteboard,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useCreateFile() {
	const fetcher = useFetcher<typeof clientAction>();

	const createFile = (
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
			action: getActionUrl(Action.CreateFile),
			encType: ContentType.MULTIPART,
		});
	};

	return {
		createFile,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useCreateAssignment() {
	const fetcher = useFetcher<typeof clientAction>();

	const createAssignment = (
		values: Extract<ActivityModuleFormValues, { type: "assignment" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.CreateAssignment),
			encType: ContentType.JSON,
		});
	};

	return {
		createAssignment,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useCreateQuiz() {
	const fetcher = useFetcher<typeof clientAction>();

	const createQuiz = (
		values: Extract<ActivityModuleFormValues, { type: "quiz" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.CreateQuiz),
			encType: ContentType.JSON,
		});
	};

	return {
		createQuiz,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useCreateDiscussion() {
	const fetcher = useFetcher<typeof clientAction>();

	const createDiscussion = (
		values: Extract<ActivityModuleFormValues, { type: "discussion" }>,
	) => {
		const submissionData = transformFormValues(values);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fetcher.submit(submissionData as any, {
			method: "POST",
			action: getActionUrl(Action.CreateDiscussion),
			encType: ContentType.JSON,
		});
	};

	return {
		createDiscussion,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

// Form wrappers that use their respective hooks
function PageFormWrapper() {
	const { createPage, isLoading } = useCreatePage();
	return (
		<PageForm
			initialValues={getInitialFormValuesForType("page")}
			onSubmit={(values) => createPage(values)}
			isLoading={isLoading}
		/>
	);
}

function WhiteboardFormWrapper() {
	const { createWhiteboard, isLoading } = useCreateWhiteboard();
	return (
		<WhiteboardForm
			initialValues={getInitialFormValuesForType("whiteboard")}
			onSubmit={(values) => createWhiteboard(values)}
			isLoading={isLoading}
		/>
	);
}

function FileFormWrapper({ uploadLimit }: { uploadLimit?: number }) {
	const { createFile, isLoading } = useCreateFile();
	return (
		<FileForm
			initialValues={getInitialFormValuesForType("file")}
			onSubmit={(values) => createFile(values)}
			uploadLimit={uploadLimit}
			isLoading={isLoading}
		/>
	);
}

function AssignmentFormWrapper() {
	const { createAssignment, isLoading } = useCreateAssignment();
	return (
		<AssignmentForm
			initialValues={getInitialFormValuesForType("assignment")}
			onSubmit={(values) => createAssignment(values)}
			isLoading={isLoading}
		/>
	);
}

function QuizFormWrapper() {
	const { createQuiz, isLoading } = useCreateQuiz();
	return (
		<QuizForm
			initialValues={getInitialFormValuesForType("quiz")}
			onSubmit={(values) => createQuiz(values)}
			isLoading={isLoading}
		/>
	);
}

function DiscussionFormWrapper() {
	const { createDiscussion, isLoading } = useCreateDiscussion();
	return (
		<DiscussionForm
			initialValues={getInitialFormValuesForType("discussion")}
			onSubmit={(values) => createDiscussion(values)}
			isLoading={isLoading}
		/>
	);
}

export default function NewModulePage({ loaderData }: Route.ComponentProps) {
	const { uploadLimit } = loaderData;
	const [selectedType, setSelectedType] = useQueryState(
		"type",
		parseAsStringEnum([
			"page",
			"whiteboard",
			"file",
			"assignment",
			"quiz",
			"discussion",
		])
			.withDefault("page")
			.withOptions({
				shallow: false,
			}),
	);

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

				<Stack gap="md">
					<Select
						value={selectedType}
						onChange={(value) =>
							setSelectedType(value as ActivityModuleFormValues["type"])
						}
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

					{selectedType === "page" && <PageFormWrapper />}
					{selectedType === "whiteboard" && <WhiteboardFormWrapper />}
					{selectedType === "file" && (
						<FileFormWrapper uploadLimit={uploadLimit} />
					)}
					{selectedType === "assignment" && <AssignmentFormWrapper />}
					{selectedType === "quiz" && <QuizFormWrapper />}
					{selectedType === "discussion" && <DiscussionFormWrapper />}
				</Stack>
			</Paper>
		</Container>
	);
}
