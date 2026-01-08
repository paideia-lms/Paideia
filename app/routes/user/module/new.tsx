import { Container, Paper, Select, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { parseAsStringEnum } from "nuqs";
import { href } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateAssignmentModule,
	tryCreateDiscussionModule,
	tryCreateFileModule,
	tryCreatePageModule,
	tryCreateQuizModule,
	tryCreateWhiteboardModule,
} from "server/internal/activity-module-management";
import { DiscussionForm } from "~/components/activity-module-forms/discussion-form";
import { FileForm } from "~/components/activity-module-forms/file-form";
import { PageForm } from "~/components/activity-module-forms/page-form";
import { QuizForm } from "~/components/activity-module-forms/quiz-form";
import { WhiteboardForm } from "~/components/activity-module-forms/whiteboard-form";
import { AssignmentForm } from "~/components/activity-module-forms/assignment-form";
import {
	badRequest,
	ok,
	StatusCode,
	UnauthorizedResponse,
} from "~/utils/responses";
import type { Route } from "./+types/new";
import { z } from "zod";
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { useNuqsSearchParams } from "~/utils/search-params-utils";
import type { LatestQuizConfig as QuizConfig } from "server/json/raw-quiz-config/version-resolver";
import { presetValuesToFileTypes } from "~/utils/file-types";
import { redirect } from "react-router";
import type { ActivityModule } from "server/payload-types";

// Define search params for module creation
export const loaderSearchParams = {
	type: parseAsStringEnum([
		"page",
		"whiteboard",
		"file",
		"assignment",
		"quiz",
		"discussion",
	]).withDefault("page"),
};

const createLoaderInstance = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoaderInstance({
	searchParams: loaderSearchParams,
});

export const loader = createRouteLoader(async ({ context, searchParams }) => {
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
		searchParams,
	};
})!;

enum Action {
	CreatePage = "createPage",
	CreateWhiteboard = "createWhiteboard",
	CreateFile = "createFile",
	CreateAssignment = "createAssignment",
	CreateQuiz = "createQuiz",
	CreateDiscussion = "createDiscussion",
}

// Define search params for module creation (used in actions)
export const moduleSearchParams = {
	action: parseAsStringEnum(Object.values(Action)),
};

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/user/module/new",
});

const createCreatePageActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		content: z.string().min(1),
	}),
	method: "POST",
	action: Action.CreatePage,
});

const createCreateWhiteboardActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		whiteboardContent: z.string().optional(),
	}),
	method: "POST",
	action: Action.CreateWhiteboard,
});

const createCreateFileActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		fileMedia: z.array(z.file()).optional(),
	}),
	method: "POST",
	action: Action.CreateFile,
});

const createCreateAssignmentActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		assignmentInstructions: z.string().optional(),
		assignmentRequireTextSubmission: z.coerce.boolean().optional(),
		assignmentRequireFileSubmission: z.coerce.boolean().optional(),
		assignmentAllowedFileTypes: z.array(z.string()).optional(),
		assignmentMaxFileSize: z.coerce.number().optional(),
		assignmentMaxFiles: z.coerce.number().optional(),
	}),
	method: "POST",
	action: Action.CreateAssignment,
});

const createCreateQuizActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		quizInstructions: z.string().optional(),
		quizPoints: z.coerce.number().optional(),
		quizTimeLimit: z.coerce.number().optional(),
		quizGradingType: z.enum(["automatic", "manual"]).optional(),
		rawQuizConfig: z.custom<QuizConfig>().optional(),
	}),
	method: "POST",
	action: Action.CreateQuiz,
});

const createCreateDiscussionActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		discussionInstructions: z.string().optional(),
		discussionDueDate: z.string().nullable().optional(),
		discussionRequireThread: z.coerce.boolean().optional(),
		discussionRequireReplies: z.coerce.boolean().optional(),
		discussionMinReplies: z.coerce.number().optional(),
	}),
	method: "POST",
	action: Action.CreateDiscussion,
});

const createPageAction = createCreatePageActionRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const createResult = await tryCreatePageModule({
			payload,
			title: formData.title,
			description: formData.description,
			content: formData.content,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "Module created successfully",
		});
	},
);

const useCreatePage = createCreatePageActionRpc.createHook<typeof createPageAction>();

const createWhiteboardAction = createCreateWhiteboardActionRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const createResult = await tryCreateWhiteboardModule({
			payload,
			title: formData.title,
			description: formData.description,
			content: formData.whiteboardContent,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "Module created successfully",
		});
	},
);

const useCreateWhiteboard = createCreateWhiteboardActionRpc.createHook<typeof createWhiteboardAction>();

const createFileAction = createCreateFileActionRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const createResult = await tryCreateFileModule({
			payload,
			title: formData.title,
			description: formData.description,
			media: formData.fileMedia,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "Module created successfully",
		});
	},
);

const useCreateFile = createCreateFileActionRpc.createHook<typeof createFileAction>();

const createAssignmentAction = createCreateAssignmentActionRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const allowedFileTypes =
			formData.assignmentAllowedFileTypes &&
				formData.assignmentAllowedFileTypes.length > 0
				? presetValuesToFileTypes(formData.assignmentAllowedFileTypes)
				: undefined;

		const createResult = await tryCreateAssignmentModule({
			payload,
			title: formData.title,
			description: formData.description,
			instructions: formData.assignmentInstructions,
			requireTextSubmission: formData.assignmentRequireTextSubmission,
			requireFileSubmission: formData.assignmentRequireFileSubmission,
			allowedFileTypes,
			maxFileSize: formData.assignmentMaxFileSize,
			maxFiles: formData.assignmentMaxFiles,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "Module created successfully",
		});
	},
);

const useCreateAssignment = createCreateAssignmentActionRpc.createHook<typeof createAssignmentAction>();

const createQuizAction = createCreateQuizActionRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const createResult = await tryCreateQuizModule({
			payload,
			title: formData.title,
			description: formData.description,
			instructions: formData.quizInstructions,
			rawQuizConfig: formData.rawQuizConfig,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "Module created successfully",
		});
	},
);

const useCreateQuiz = createCreateQuizActionRpc.createHook<typeof createQuizAction>();

const createDiscussionAction = createCreateDiscussionActionRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const createResult = await tryCreateDiscussionModule({
			payload,
			title: formData.title,
			description: formData.description,
			instructions: formData.discussionInstructions,
			dueDate: formData.discussionDueDate ?? undefined,
			requireThread: formData.discussionRequireThread,
			requireReplies: formData.discussionRequireReplies,
			minReplies: formData.discussionMinReplies,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({
				success: false,
				error: createResult.error.message,
			});
		}

		return ok({
			success: true,
			message: "Module created successfully",
		});
	},
);

const useCreateDiscussion = createCreateDiscussionActionRpc.createHook<typeof createDiscussionAction>();

const [action] = createActionMap({
	[Action.CreatePage]: createPageAction,
	[Action.CreateWhiteboard]: createWhiteboardAction,
	[Action.CreateFile]: createFileAction,
	[Action.CreateAssignment]: createAssignmentAction,
	[Action.CreateQuiz]: createQuizAction,
	[Action.CreateDiscussion]: createDiscussionAction,
});

export { action };

export const clientAction = async ({
	serverAction,
}: Route.ClientActionArgs) => {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
		// Redirect after successful creation
		// window.location.href = "/user/profile";
		return redirect(href("/user/profile/:id?"));
	} else if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}

	return actionData;
};

function getPageFormInitialValues() {
	return {
		title: "",
		description: "",
		content: "",
	};
}

export type PageFormInitialValues = ReturnType<typeof getPageFormInitialValues>;

// Form wrappers that use their respective hooks
function PageFormWrapper() {
	const { submit: createPage, isLoading } = useCreatePage();
	const initialValues = getPageFormInitialValues();
	return (
		<PageForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createPage({
					values: {
						title: values.title,
						description: values.description,
						content: values.content,
					},
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
		whiteboardContent: "",
	};
}

export type WhiteboardFormInitialValues = ReturnType<
	typeof getWhiteboardFormInitialValues
>;

function WhiteboardFormWrapper() {
	const { submit: createWhiteboard, isLoading } = useCreateWhiteboard();
	const initialValues = getWhiteboardFormInitialValues();
	return (
		<WhiteboardForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createWhiteboard({
					values: {
						title: values.title,
						description: values.description,
						whiteboardContent: values.whiteboardContent,
					},
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
		files: {
			files: [] as File[],
			mediaIds: [] as number[],
		},
	};
}

export type FileFormInitialValues = ReturnType<typeof getFileFormInitialValues>;

function FileFormWrapper({ uploadLimit }: { uploadLimit?: number }) {
	const { submit: createFile, isLoading } = useCreateFile();
	const initialValues = getFileFormInitialValues();
	return (
		<FileForm
			initialValues={initialValues}
			onSubmit={(values) => {
				console.log(values);
				createFile({
					values: {
						title: values.title,
						description: values.description,
						// we don't care about mediaIds here, because the create Form is all new files
						fileMedia: values.files.files,
					},
				});
			}}
			uploadLimit={uploadLimit}
			isLoading={isLoading}
		/>
	);
}

const getAssignmentFormInitialValues = () => {
	return {
		title: "",
		description: "",
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
	const { submit: createAssignment, isLoading } = useCreateAssignment();
	const initialValues = getAssignmentFormInitialValues();
	return (
		<AssignmentForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createAssignment({
					values: {
						title: values.title,
						description: values.description,
						assignmentInstructions: values.assignmentInstructions,
						assignmentRequireTextSubmission:
							values.assignmentRequireTextSubmission,
						assignmentRequireFileSubmission:
							values.assignmentRequireFileSubmission,
						assignmentAllowedFileTypes: values.assignmentAllowedFileTypes,
						assignmentMaxFileSize: values.assignmentMaxFileSize,
						assignmentMaxFiles: values.assignmentMaxFiles,
					},
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
		quizInstructions: "",
		quizPoints: 100,
		quizTimeLimit: 60,
		quizGradingType: "automatic" as const,
		rawQuizConfig: null as QuizConfig | null,
	};
}

export type QuizFormInitialValues = ReturnType<typeof getQuizFormInitialValues>;

function QuizFormWrapper() {
	const { submit: createQuiz, isLoading } = useCreateQuiz();
	const initialValues = getQuizFormInitialValues();
	return (
		<QuizForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createQuiz({
					values: {
						title: values.title,
						description: values.description,
						quizInstructions: values.quizInstructions,
						quizPoints: values.quizPoints,
						quizTimeLimit: values.quizTimeLimit,
						quizGradingType: values.quizGradingType,
						rawQuizConfig: values.rawQuizConfig ?? undefined,
					},
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
	const { submit: createDiscussion, isLoading } = useCreateDiscussion();
	const initialValues = getDiscussionFormInitialValues();
	return (
		<DiscussionForm
			initialValues={initialValues}
			onSubmit={(values) =>
				createDiscussion({
					values: {
						title: values.title,
						description: values.description,
						discussionInstructions: values.discussionInstructions,
						discussionDueDate: values.discussionDueDate
							? values.discussionDueDate.toISOString()
							: null,
						discussionRequireThread: values.discussionRequireThread,
						discussionRequireReplies: values.discussionRequireReplies,
						discussionMinReplies: values.discussionMinReplies,
					},
				})
			}
			isLoading={isLoading}
		/>
	);
}

export default function NewModulePage({ loaderData }: Route.ComponentProps) {
	const { uploadLimit, searchParams } = loaderData;
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);
	const selectedType = searchParams.type;

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
							setQueryParams({
								type: (value as ActivityModule["type"]) || null,
							})
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
