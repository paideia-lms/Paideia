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
	type CreateAssignmentModuleArgs,
	type CreateDiscussionModuleArgs,
	type CreateQuizModuleArgs,
	tryCreateAssignmentModule,
	tryCreateDiscussionModule,
	tryCreateFileModule,
	tryCreatePageModule,
	tryCreateQuizModule,
	tryCreateWhiteboardModule,
} from "server/internal/activity-module-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import {
	DiscussionForm,
	FileForm,
	PageForm,
	QuizForm,
	WhiteboardForm,
} from "~/components/activity-module-forms";
import { AssignmentForm } from "~/components/activity-module-forms/assignment-form";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { ContentType } from "~/utils/get-content-type";
import { handleUploadError } from "~/utils/handle-upload-errors";
import {
	badRequest,
	StatusCode,
	unauthorized,
	UnauthorizedResponse,
} from "~/utils/responses";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
import type { Route } from "./+types/new";
import type { ActivityModule } from "server/payload-types";
import { z } from "zod";
import { convertMyFormDataToObject, MyFormData } from "app/utils/action-utils";
import { enum_activity_modules_status } from "src/payload-generated-schema";
import type { LatestQuizConfig as QuizConfig } from "server/json/raw-quiz-config/version-resolver";
import { presetValuesToFileTypes } from "~/utils/file-types";

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

export const createPageActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	content: z.string().min(1),
});

const createWhiteboardActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	whiteboardContent: z.string().optional(),
});

const createFileActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	fileMedia: z.array(z.coerce.number()).optional(),
	files: z.array(z.file()).optional(),
});

const createAssignmentActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	assignmentInstructions: z.string().optional(),
	assignmentRequireTextSubmission: z.coerce.boolean().optional(),
	assignmentRequireFileSubmission: z.coerce.boolean().optional(),
	assignmentAllowedFileTypes: z.array(z.string()).optional(),
	assignmentMaxFileSize: z.coerce.number().optional(),
	assignmentMaxFiles: z.coerce.number().optional(),
});

const createQuizActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	quizInstructions: z.string().optional(),
	quizPoints: z.coerce.number().optional(),
	quizTimeLimit: z.coerce.number().optional(),
	quizGradingType: z.enum(["automatic", "manual"]).optional(),
	rawQuizConfig: z.custom<QuizConfig>().optional(),
});

const createDiscussionActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	discussionInstructions: z.string().optional(),
	discussionDueDate: z.string().nullable().optional(),
	discussionRequireThread: z.coerce.boolean().optional(),
	discussionRequireReplies: z.coerce.boolean().optional(),
	discussionMinReplies: z.coerce.number().optional(),
});

const createPageAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action.CreatePage } }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);

	const parsed = await request
		.formData()
		.then(convertMyFormDataToObject)
		.then(createPageActionSchema.safeParse);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: z.prettifyError(parsed.error),
		});
	}

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(payload, payloadRequest);

	return transactionInfo.tx(
		async ({ reqWithTransaction }) => {
			const createResult = await tryCreatePageModule({
				payload,
				title: parsed.data.title,
				description: parsed.data.description,
				status: parsed.data.status || ("draft" as const),
				content: parsed.data.content,
				req: reqWithTransaction,
			});

			if (!createResult.ok) {
				return badRequest({
					success: false,
					error: createResult.error.message,
				});
			}

			return redirect("/user/profile");
		},
		(errorResponse) => {
			return (
				"data" in errorResponse &&
				errorResponse.data.status === StatusCode.BadRequest
			);
		},
	);
};

const createWhiteboardAction = async ({
	request,
	context,
}: Route.ActionArgs & {
	searchParams: { action: Action.CreateWhiteboard };
}) => {
	const { payload, payloadRequest } = context.get(globalContextKey);

	const parsed = await request
		.formData()
		.then(convertMyFormDataToObject)
		.then(createWhiteboardActionSchema.safeParse);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: z.prettifyError(parsed.error),
		});
	}

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(payload, payloadRequest);

	return transactionInfo.tx(
		async ({ reqWithTransaction }) => {
			const createResult = await tryCreateWhiteboardModule({
				payload,
				title: parsed.data.title,
				description: parsed.data.description,
				status: parsed.data.status || ("draft" as const),
				content: parsed.data.whiteboardContent,
				req: reqWithTransaction,
			});

			if (!createResult.ok) {
				return badRequest({
					success: false,
					error: createResult.error.message,
				});
			}

			return redirect("/user/profile");
		},
		(errorResponse) => {
			return (
				"data" in errorResponse &&
				errorResponse.data.status === StatusCode.BadRequest
			);
		},
	);
};

const createFileAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action.CreateFile } }) => {
	const { payload, payloadRequest, systemGlobals } =
		context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized({
			success: false,
			error: "You must be logged in to create modules",
		});
	}

	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(payload, payloadRequest);

	return transactionInfo.tx(
		async ({ reqWithTransaction }) => {
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

			// Convert formData to object and parse with schema
			const formDataObj = convertMyFormDataToObject(formData);
			const parsed = createFileActionSchema.safeParse(formDataObj);

			if (!parsed.success) {
				return badRequest({
					success: false,
					error: z.prettifyError(parsed.error),
				});
			}

			// For file type, combine existing media IDs with newly uploaded media IDs
			const existingMediaIds = parsed.data.fileMedia ?? [];
			const allMediaIds = [...existingMediaIds, ...uploadedMediaIds];

			const createResult = await tryCreateFileModule({
				payload,
				title: parsed.data.title,
				description: parsed.data.description,
				status: parsed.data.status || ("draft" as const),
				media: allMediaIds.length > 0 ? allMediaIds : undefined,
				req: reqWithTransaction,
			});

			if (!createResult.ok) {
				return badRequest({
					success: false,
					error: createResult.error.message,
				});
			}

			return redirect("/user/profile");
		},
		(errorResponse) => {
			return (
				"data" in errorResponse &&
				errorResponse.data.status === StatusCode.BadRequest
			);
		},
	);
};

const createAssignmentAction = async ({
	request,
	context,
}: Route.ActionArgs & {
	searchParams: { action: Action.CreateAssignment };
}) => {
	const { payload, payloadRequest } = context.get(globalContextKey);

	const parsed = await request
		.formData()
		.then(convertMyFormDataToObject)
		.then(createAssignmentActionSchema.safeParse);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: z.prettifyError(parsed.error),
		});
	}

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(payload, payloadRequest);

	return transactionInfo.tx(
		async ({ reqWithTransaction }) => {
			const allowedFileTypes =
				parsed.data.assignmentAllowedFileTypes &&
				parsed.data.assignmentAllowedFileTypes.length > 0
					? presetValuesToFileTypes(parsed.data.assignmentAllowedFileTypes)
					: undefined;

			const createArgs = {
				payload,
				title: parsed.data.title,
				description: parsed.data.description,
				status: parsed.data.status || ("draft" as const),
				instructions: parsed.data.assignmentInstructions,
				requireTextSubmission: parsed.data.assignmentRequireTextSubmission,
				requireFileSubmission: parsed.data.assignmentRequireFileSubmission,
				allowedFileTypes,
				maxFileSize: parsed.data.assignmentMaxFileSize,
				maxFiles: parsed.data.assignmentMaxFiles,
				req: reqWithTransaction,
			} satisfies CreateAssignmentModuleArgs;

			const createResult = await tryCreateAssignmentModule(createArgs);

			if (!createResult.ok) {
				return badRequest({
					success: false,
					error: createResult.error.message,
				});
			}

			return redirect("/user/profile");
		},
		(errorResponse) => {
			return (
				"data" in errorResponse &&
				errorResponse.data.status === StatusCode.BadRequest
			);
		},
	);
};

const createQuizAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: Action.CreateQuiz } }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);

	const parsed = await request
		.formData()
		.then(convertMyFormDataToObject)
		.then(createQuizActionSchema.safeParse);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: z.prettifyError(parsed.error),
		});
	}

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(payload, payloadRequest);

	return transactionInfo.tx(
		async ({ reqWithTransaction }) => {
			const createArgs = {
				payload,
				title: parsed.data.title,
				description: parsed.data.description,
				status: parsed.data.status || ("draft" as const),
				instructions: parsed.data.quizInstructions,
				points: parsed.data.quizPoints,
				timeLimit: parsed.data.quizTimeLimit,
				gradingType: parsed.data.quizGradingType,
				rawQuizConfig: parsed.data.rawQuizConfig,
				req: reqWithTransaction,
			} satisfies CreateQuizModuleArgs;

			const createResult = await tryCreateQuizModule(createArgs);

			if (!createResult.ok) {
				return badRequest({
					success: false,
					error: createResult.error.message,
				});
			}

			return redirect("/user/profile");
		},
		(errorResponse) => {
			if ("data" in errorResponse && errorResponse.data) {
				return errorResponse.data.status === StatusCode.BadRequest;
			}
			return false;
		},
	);
};

const createDiscussionAction = async ({
	request,
	context,
}: Route.ActionArgs & {
	searchParams: { action: Action.CreateDiscussion };
}) => {
	const { payload, payloadRequest } = context.get(globalContextKey);

	const parsed = await request
		.formData()
		.then(convertMyFormDataToObject)
		.then(createDiscussionActionSchema.safeParse);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: z.prettifyError(parsed.error),
		});
	}

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(payload, payloadRequest);

	return transactionInfo.tx(
		async ({ reqWithTransaction }) => {
			const createArgs = {
				payload,
				title: parsed.data.title,
				description: parsed.data.description,
				status: parsed.data.status || ("draft" as const),
				instructions: parsed.data.discussionInstructions,
				dueDate: parsed.data.discussionDueDate ?? undefined,
				requireThread: parsed.data.discussionRequireThread,
				requireReplies: parsed.data.discussionRequireReplies,
				minReplies: parsed.data.discussionMinReplies,
				req: reqWithTransaction,
			} satisfies CreateDiscussionModuleArgs;

			const createResult = await tryCreateDiscussionModule(createArgs);

			if (!createResult.ok) {
				return badRequest({
					success: false,
					error: createResult.error.message,
				});
			}

			return redirect("/user/profile");
		},
		(errorResponse) => {
			return (
				"data" in errorResponse &&
				errorResponse.data.status === StatusCode.BadRequest
			);
		},
	);
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

	const createPage = (values: z.infer<typeof createPageActionSchema>) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof createPageActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.CreatePage),
				encType: ContentType.MULTIPART,
			},
		);
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
		values: z.infer<typeof createWhiteboardActionSchema>,
	) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof createWhiteboardActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.CreateWhiteboard),
				encType: ContentType.MULTIPART,
			},
		);
	};

	return {
		createWhiteboard,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useCreateFile() {
	const fetcher = useFetcher<typeof clientAction>();

	const createFile = (values: z.infer<typeof createFileActionSchema>) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof createFileActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.CreateFile),
				encType: ContentType.MULTIPART,
			},
		);
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
		values: z.infer<typeof createAssignmentActionSchema>,
	) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof createAssignmentActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.CreateAssignment),
				encType: ContentType.MULTIPART,
			},
		);
	};

	return {
		createAssignment,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export function useCreateQuiz() {
	const fetcher = useFetcher<typeof clientAction>();

	const createQuiz = (values: z.infer<typeof createQuizActionSchema>) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof createQuizActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.CreateQuiz),
				encType: ContentType.MULTIPART,
			},
		);
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
		values: z.infer<typeof createDiscussionActionSchema>,
	) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof createDiscussionActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.CreateDiscussion),
				encType: ContentType.MULTIPART,
			},
		);
	};

	return {
		createDiscussion,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

function getPageFormInitialValues() {
	return {
		title: "",
		description: "",
		status: "draft" as ActivityModule["status"],
		content: "",
	};
}

export type PageFormInitialValues = ReturnType<typeof getPageFormInitialValues>;

// Form wrappers that use their respective hooks
function PageFormWrapper() {
	const { createPage, isLoading } = useCreatePage();
	const initialValues = getPageFormInitialValues();
	return (
		<PageForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createPage({
					title: values.title,
					description: values.description,
					status: values.status,
					content: values.content,
				})
			}
			isLoading={isLoading}
		/>
	);
}

function getWhiteboardFormInitialValues() {
	return {
		title: "",
		description: "",
		status: "draft" as ActivityModule["status"],
		whiteboardContent: "",
	};
}

export type WhiteboardFormInitialValues = ReturnType<
	typeof getWhiteboardFormInitialValues
>;

function WhiteboardFormWrapper() {
	const { createWhiteboard, isLoading } = useCreateWhiteboard();
	const initialValues = getWhiteboardFormInitialValues();
	return (
		<WhiteboardForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createWhiteboard({
					title: values.title,
					description: values.description,
					status: values.status,
					whiteboardContent: values.whiteboardContent,
				})
			}
			isLoading={isLoading}
		/>
	);
}

function getFileFormInitialValues() {
	return {
		title: "",
		description: "",
		status: "draft" as ActivityModule["status"],
		fileMedia: [] as number[],
		fileFiles: [] as File[],
	};
}

export type FileFormInitialValues = ReturnType<typeof getFileFormInitialValues>;

function FileFormWrapper({ uploadLimit }: { uploadLimit?: number }) {
	const { createFile, isLoading } = useCreateFile();
	const initialValues = getFileFormInitialValues();
	return (
		<FileForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createFile({
					title: values.title,
					description: values.description,
					status: values.status,
					fileMedia: values.fileMedia,
					files: values.fileFiles,
				})
			}
			uploadLimit={uploadLimit}
			isLoading={isLoading}
		/>
	);
}

const getAssignmentFormInitialValues = () => {
	return {
		title: "",
		description: "",
		status: "draft" as ActivityModule["status"],
		assignmentInstructions: "",
		assignmentRequireTextSubmission: false,
		assignmentRequireFileSubmission: false,
		assignmentAllowedFileTypes: [] as string[],
		assignmentMaxFileSize: 10,
		assignmentMaxFiles: 5,
	};
};

export type AssignmentFormInitialValues = ReturnType<
	typeof getAssignmentFormInitialValues
>;

function AssignmentFormWrapper() {
	const { createAssignment, isLoading } = useCreateAssignment();
	const initialValues = getAssignmentFormInitialValues();
	return (
		<AssignmentForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createAssignment({
					title: values.title,
					description: values.description,
					status: values.status,
					assignmentInstructions: values.assignmentInstructions,
					assignmentRequireTextSubmission:
						values.assignmentRequireTextSubmission,
					assignmentRequireFileSubmission:
						values.assignmentRequireFileSubmission,
					assignmentAllowedFileTypes: values.assignmentAllowedFileTypes,
					assignmentMaxFileSize: values.assignmentMaxFileSize,
					assignmentMaxFiles: values.assignmentMaxFiles,
				})
			}
			isLoading={isLoading}
		/>
	);
}

function getQuizFormInitialValues() {
	return {
		title: "",
		description: "",
		status: "draft" as ActivityModule["status"],
		quizInstructions: "",
		quizPoints: 100,
		quizTimeLimit: 60,
		quizGradingType: "automatic" as const,
		rawQuizConfig: null as QuizConfig | null,
	};
}

export type QuizFormInitialValues = ReturnType<typeof getQuizFormInitialValues>;

function QuizFormWrapper() {
	const { createQuiz, isLoading } = useCreateQuiz();
	const initialValues = getQuizFormInitialValues();
	return (
		<QuizForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createQuiz({
					title: values.title,
					description: values.description,
					status: values.status,
					quizInstructions: values.quizInstructions,
					quizPoints: values.quizPoints,
					quizTimeLimit: values.quizTimeLimit,
					quizGradingType: values.quizGradingType,
					rawQuizConfig: values.rawQuizConfig ?? undefined,
				})
			}
			isLoading={isLoading}
		/>
	);
}

function getDiscussionFormInitialValues() {
	return {
		title: "",
		description: "",
		status: "draft" as ActivityModule["status"],
		discussionInstructions: "",
		discussionDueDate: null as Date | null,
		discussionRequireThread: false,
		discussionRequireReplies: false,
		discussionMinReplies: 1,
	};
}

export type DiscussionFormInitialValues = ReturnType<
	typeof getDiscussionFormInitialValues
>;

function DiscussionFormWrapper() {
	const { createDiscussion, isLoading } = useCreateDiscussion();
	const initialValues = getDiscussionFormInitialValues();
	return (
		<DiscussionForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createDiscussion({
					title: values.title,
					description: values.description,
					status: values.status,
					discussionInstructions: values.discussionInstructions,
					discussionDueDate: values.discussionDueDate
						? values.discussionDueDate.toISOString()
						: null,
					discussionRequireThread: values.discussionRequireThread,
					discussionRequireReplies: values.discussionRequireReplies,
					discussionMinReplies: values.discussionMinReplies,
				})
			}
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
