import { Container, Paper, Select, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryState } from "nuqs";
import {
	createLoader,
	parseAsStringEnum,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { stringify } from "qs";
import { href } from "react-router";
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
import {
	DiscussionForm,
	FileForm,
	PageForm,
	QuizForm,
	WhiteboardForm,
} from "~/components/activity-module-forms";
import { AssignmentForm } from "~/components/activity-module-forms/assignment-form";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import {
	badRequest,
	ok,
	StatusCode,
	UnauthorizedResponse,
} from "~/utils/responses";
import type { Route } from "./+types/new";
import type { ActivityModule } from "server/payload-types";
import { z } from "zod";
import { typeCreateActionRpc } from "app/utils/action-utils";
import { enum_activity_modules_status } from "src/payload-generated-schema";
import type { LatestQuizConfig as QuizConfig } from "server/json/raw-quiz-config/version-resolver";
import { presetValuesToFileTypes } from "~/utils/file-types";
import { serverOnly$ } from "vite-env-only/macros";
import { redirect } from "react-router";

export const loader = async ({ context }: Route.LoaderArgs) => {
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

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createCreatePageActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		status: z.enum(enum_activity_modules_status.enumValues),
		content: z.string().min(1),
	}),
	method: "POST",
	action: Action.CreatePage,
});

const createCreateWhiteboardActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		status: z.enum(enum_activity_modules_status.enumValues),
		whiteboardContent: z.string().optional(),
	}),
	method: "POST",
	action: Action.CreateWhiteboard,
});

const createCreateFileActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		status: z.enum(enum_activity_modules_status.enumValues),
		fileMedia: z.array(z.file()).optional(),
	}),
	method: "POST",
	action: Action.CreateFile,
});

const createCreateAssignmentActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		status: z.enum(enum_activity_modules_status.enumValues),
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
		status: z.enum(enum_activity_modules_status.enumValues),
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
		status: z.enum(enum_activity_modules_status.enumValues),
		discussionInstructions: z.string().optional(),
		discussionDueDate: z.string().nullable().optional(),
		discussionRequireThread: z.coerce.boolean().optional(),
		discussionRequireReplies: z.coerce.boolean().optional(),
		discussionMinReplies: z.coerce.number().optional(),
	}),
	method: "POST",
	action: Action.CreateDiscussion,
});

const getRouteUrl = (action: Action) => {
	return href("/user/module/new") + "?" + stringify({ action });
};

const [createPageAction, useCreatePage] = createCreatePageActionRpc(
	serverOnly$(async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const createResult = await tryCreatePageModule({
			payload,
			title: formData.title,
			description: formData.description,
			status: formData.status,
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
	})!,
	{
		action: ({ searchParams }) => getRouteUrl(searchParams.action),
	},
);

const [createWhiteboardAction, useCreateWhiteboard] =
	createCreateWhiteboardActionRpc(
		serverOnly$(async ({ context, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const createResult = await tryCreateWhiteboardModule({
				payload,
				title: formData.title,
				description: formData.description,
				status: formData.status,
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
		})!,
		{
			action: ({ searchParams }) => getRouteUrl(searchParams.action),
		},
	);

const [createFileAction, useCreateFile] = createCreateFileActionRpc(
	serverOnly$(async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const createResult = await tryCreateFileModule({
			payload,
			title: formData.title,
			description: formData.description,
			status: formData.status,
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
	})!,
	{
		action: ({ searchParams }) => getRouteUrl(searchParams.action),
	},
);

const [createAssignmentAction, useCreateAssignment] =
	createCreateAssignmentActionRpc(
		serverOnly$(async ({ context, formData }) => {
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
				status: formData.status,
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
		})!,
		{
			action: ({ searchParams }) => getRouteUrl(searchParams.action),
		},
	);

const [createQuizAction, useCreateQuiz] = createCreateQuizActionRpc(
	serverOnly$(async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const createResult = await tryCreateQuizModule({
			payload,
			title: formData.title,
			description: formData.description,
			status: formData.status,
			instructions: formData.quizInstructions,
			points: formData.quizPoints,
			timeLimit: formData.quizTimeLimit,
			gradingType: formData.quizGradingType,
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
	})!,
	{
		action: ({ searchParams }) => getRouteUrl(searchParams.action),
	},
);

const [createDiscussionAction, useCreateDiscussion] =
	createCreateDiscussionActionRpc(
		serverOnly$(async ({ context, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const createResult = await tryCreateDiscussionModule({
				payload,
				title: formData.title,
				description: formData.description,
				status: formData.status,
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
		})!,
		{
			action: ({ searchParams }) => getRouteUrl(searchParams.action),
		},
	);

const actionMap = {
	[Action.CreatePage]: createPageAction,
	[Action.CreateWhiteboard]: createWhiteboardAction,
	[Action.CreateFile]: createFileAction,
	[Action.CreateAssignment]: createAssignmentAction,
	[Action.CreateQuiz]: createQuizAction,
	[Action.CreateDiscussion]: createDiscussionAction,
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

	return actionMap[actionType](args);
};

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
		status: "draft" as ActivityModule["status"],
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
						status: values.status,
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
		status: "draft" as ActivityModule["status"],
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
						status: values.status,
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
		status: "draft" as ActivityModule["status"],
		fileFiles: [] as File[],
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
						status: values.status,
						// we don't care about fileMedia here, beacuse the create Form is all new files
						fileMedia: values.fileFiles,
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
						status: values.status,
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
						status: values.status,
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
						status: values.status,
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
