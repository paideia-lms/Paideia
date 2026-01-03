import { Container, Paper, Select, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { parseAsStringEnum } from "nuqs/server";
import { stringify } from "qs";
import { href } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
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
import type { LatestQuizConfig as QuizConfig } from "server/json/raw-quiz-config/version-resolver";
import { serverOnly$ } from "vite-env-only/macros";
import {
	DiscussionForm,
	FileForm,
	PageForm,
	QuizForm,
	WhiteboardForm,
} from "~/components/activity-module-forms";
import { AssignmentForm } from "~/components/activity-module-forms/assignment-form";
import { DeleteActivityModule } from "~/components/delete-activity-module";
import {
	fileTypesToPresetValues,
	presetValuesToFileTypes,
} from "~/utils/file-types";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/edit-setting";
import { z } from "zod";
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";

const createLoaderInstance = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoaderInstance({});

export const loader = createRouteLoader(async ({ context, params }) => {
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
		params
	};
})!;

enum Action {
	UpdatePage = "updatePage",
	UpdateWhiteboard = "updateWhiteboard",
	UpdateFile = "updateFile",
	UpdateAssignment = "updateAssignment",
	UpdateQuiz = "updateQuiz",
	UpdateDiscussion = "updateDiscussion",
}

// Define search params for module update (used in actions)
export const moduleUpdateSearchParams = {
	action: parseAsStringEnum(Object.values(Action)),
};

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();
const createUpdatePageActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().min(1),
		content: z.string().min(1),
	}),
	method: "POST",
	action: Action.UpdatePage,
});
const createUpdateWhiteboardActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		whiteboardContent: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateWhiteboard,
});
const createUpdateFileActionRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		fileMedia: z.array(z.coerce.number().or(z.file())).optional(),
	}),
	method: "POST",
	action: Action.UpdateFile,
});
const createUpdateAssignmentActionRpc = createActionRpc({
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
	action: Action.UpdateAssignment,
});
const createUpdateQuizActionRpc = createActionRpc({
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
	action: Action.UpdateQuiz,
});
const createUpdateDiscussionActionRpc = createActionRpc({
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
	action: Action.UpdateDiscussion,
});

export function getRouteUrl(action: Action, moduleId: string) {
	return (
		href("/user/module/edit/:moduleId", { moduleId }) +
		"?" +
		stringify({ action })
	);
}

const [updatePageAction, useUpdatePage] = createUpdatePageActionRpc(
	serverOnly$(async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const updateResult = await tryUpdatePageModule({
			payload,
			id: params.moduleId,
			title: formData.title,
			description: formData.description,
			content: formData.content,
			req: payloadRequest,
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
	})!,
	{
		action: ({ params, searchParams }) =>
			getRouteUrl(searchParams.action, String(params.moduleId)),
	},
);

const [updateWhiteboardAction, useUpdateWhiteboard] =
	createUpdateWhiteboardActionRpc(
		serverOnly$(async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const updateResult = await tryUpdateWhiteboardModule({
				payload,
				id: params.moduleId,
				title: formData.title,
				description: formData.description,
				content: formData.whiteboardContent,
				req: payloadRequest,
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
		})!,
		{
			action: ({ params, searchParams }) =>
				getRouteUrl(searchParams.action, String(params.moduleId)),
		},
	);

const [updateFileAction, useUpdateFile] = createUpdateFileActionRpc(
	serverOnly$(async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		// For file type, combine existing media IDs with newly uploaded media IDs
		const existingMediaIds = formData.fileMedia ?? [];

		const updateResult = await tryUpdateFileModule({
			payload,
			id: params.moduleId,
			title: formData.title,
			description: formData.description,
			media: existingMediaIds,
			req: payloadRequest,
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
	})!,
	{
		action: ({ params, searchParams }) =>
			getRouteUrl(searchParams.action, String(params.moduleId)),
	},
);

const [updateAssignmentAction, useUpdateAssignment] =
	createUpdateAssignmentActionRpc(
		serverOnly$(async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const allowedFileTypes =
				formData.assignmentAllowedFileTypes &&
					formData.assignmentAllowedFileTypes.length > 0
					? presetValuesToFileTypes(formData.assignmentAllowedFileTypes)
					: undefined;

			const updateResult = await tryUpdateAssignmentModule({
				payload,
				id: params.moduleId,
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
		})!,
		{
			action: ({ params, searchParams }) =>
				getRouteUrl(searchParams.action, String(params.moduleId)),
		},
	);

const [updateQuizAction, useUpdateQuiz] = createUpdateQuizActionRpc(
	serverOnly$(async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const updateResult = await tryUpdateQuizModule({
			payload,
			id: params.moduleId,
			title: formData.title,
			description: formData.description,
			instructions: formData.quizInstructions,
			points: formData.quizPoints,
			timeLimit: formData.quizTimeLimit,
			gradingType: formData.quizGradingType,
			rawQuizConfig: formData.rawQuizConfig,
			req: payloadRequest,
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
	})!,
	{
		action: ({ params, searchParams }) =>
			getRouteUrl(searchParams.action, String(params.moduleId)),
	},
);

const [updateDiscussionAction, useUpdateDiscussion] =
	createUpdateDiscussionActionRpc(
		serverOnly$(async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const updateResult = await tryUpdateDiscussionModule({
				payload,
				id: params.moduleId,
				title: formData.title,
				description: formData.description,
				instructions: formData.discussionInstructions,
				dueDate: formData.discussionDueDate,
				requireThread: formData.discussionRequireThread,
				requireReplies: formData.discussionRequireReplies,
				minReplies: formData.discussionMinReplies,
				req: payloadRequest,
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
		})!,
		{
			action: ({ params, searchParams }) =>
				getRouteUrl(searchParams.action, String(params.moduleId)),
		},
	);

const [action] = createActionMap({
	[Action.UpdatePage]: updatePageAction,
	[Action.UpdateWhiteboard]: updateWhiteboardAction,
	[Action.UpdateFile]: updateFileAction,
	[Action.UpdateAssignment]: updateAssignmentAction,
	[Action.UpdateQuiz]: updateQuizAction,
	[Action.UpdateDiscussion]: updateDiscussionAction,
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
	} else if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}

	return actionData;
};

function getPageFormInitialValues(
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "page" }
	>,
) {
	return {
		title: module.title,
		description: module.description || "",
		content: module.content || "",
	};
}

export type PageFormInitialValues = ReturnType<typeof getPageFormInitialValues>;

// Form wrappers that use their respective hooks
function PageFormWrapper({
	module,
}: {
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "page" }
	>;
}) {
	const { submit: updatePage, isLoading } = useUpdatePage();
	const initialValues = getPageFormInitialValues(module);
	return (
		<PageForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updatePage({
					params: { moduleId: module.id },
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

function getWhiteboardFormInitialValues(
	module: Extract<ActivityModuleResult, { type: "whiteboard" }>,
) {
	return {
		title: module.title,
		description: module.description || "",
		whiteboardContent: module.content || "",
	};
}

export type WhiteboardFormInitialValues = ReturnType<
	typeof getWhiteboardFormInitialValues
>;

function WhiteboardFormWrapper({
	module,
}: {
	module: Extract<ActivityModuleResult, { type: "whiteboard" }>;
}) {
	const { submit: updateWhiteboard, isLoading } = useUpdateWhiteboard();
	const initialValues = getWhiteboardFormInitialValues(module);
	return (
		<WhiteboardForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateWhiteboard({
					params: { moduleId: module.id },
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

function getFileFormInitialValues(
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "file" }
	>,
) {
	return {
		title: module.title,
		description: module.description || "",
		fileMedia: module.media?.map((m) => m.id) ?? [],
		fileFiles: [] as File[],
	};
}

export type FileFormInitialValues = ReturnType<typeof getFileFormInitialValues>;

function FileFormWrapper({
	module,
	uploadLimit,
}: {
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "file" }
	>;
	uploadLimit?: number;
}) {
	const { submit: updateFile, isLoading } = useUpdateFile();
	const initialValues = getFileFormInitialValues(module);
	return (
		<FileForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateFile({
					params: { moduleId: module.id },
					values: {
						title: values.title,
						description: values.description,
						fileMedia: [...values.fileMedia, ...values.fileFiles],
					},
				})
			}
			uploadLimit={uploadLimit}
			existingMedia={module.media ?? []}
			isLoading={isLoading}
		/>
	);
}

const getAssignmentFormInitialValues = (
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "assignment" }
	>,
) => {
	return {
		title: module.title,
		description: module.description || "",
		assignmentInstructions: module.instructions || "",
		assignmentRequireTextSubmission: module.requireTextSubmission ?? false,
		assignmentRequireFileSubmission: module.requireFileSubmission ?? false,
		assignmentAllowedFileTypes: fileTypesToPresetValues(
			module.allowedFileTypes,
		),
		assignmentMaxFileSize: module.maxFileSize ?? 10,
		assignmentMaxFiles: module.maxFiles ?? 5,
	};
};

export type AssignmentFormInitialValues = ReturnType<
	typeof getAssignmentFormInitialValues
>;

function AssignmentFormWrapper({
	module,
}: {
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "assignment" }
	>;
}) {
	const { submit: updateAssignment, isLoading } = useUpdateAssignment();
	const initialValues = getAssignmentFormInitialValues(module);
	return (
		<AssignmentForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateAssignment({
					params: { moduleId: module.id },
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

function getQuizFormInitialValues(
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "quiz" }
	>,
) {
	return {
		title: module.title,
		description: module.description || "",
		quizInstructions: module.instructions || "",
		quizPoints: module.points ?? 100,
		quizTimeLimit: module.timeLimit ?? 60,
		// ! we force it to be automatic for now
		quizGradingType: "automatic" as const,
		rawQuizConfig: (module.rawQuizConfig as QuizConfig | null) ?? null,
	};
}

export type QuizFormInitialValues = ReturnType<typeof getQuizFormInitialValues>;

function QuizFormWrapper({
	module,
}: {
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "quiz" }
	>;
}) {
	const { submit: updateQuiz, isLoading } = useUpdateQuiz();
	const initialValues = getQuizFormInitialValues(module);
	return (
		<QuizForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateQuiz({
					params: { moduleId: module.id },
					values: {
						title: values.title,
						description: values.description,
						quizInstructions: values.quizInstructions,
						quizPoints: values.quizPoints,
						quizTimeLimit: values.quizTimeLimit,
						quizGradingType: values.quizGradingType,
						rawQuizConfig:
							values.rawQuizConfig === null ? undefined : values.rawQuizConfig,
					},
				})
			}
			isLoading={isLoading}
		/>
	);
}

function getDiscussionFormInitialValues(
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "discussion" }
	>,
) {
	return {
		title: module.title,
		description: module.description || "",
		discussionInstructions: module.instructions || "",
		discussionDueDate: module.dueDate ? new Date(module.dueDate) : null,
		discussionRequireThread: module.requireThread ?? false,
		discussionRequireReplies: module.requireReplies ?? false,
		discussionMinReplies: module.minReplies ?? 1,
	};
}

export type DiscussionFormInitialValues = ReturnType<
	typeof getDiscussionFormInitialValues
>;

function DiscussionFormWrapper({
	module,
}: {
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "discussion" }
	>;
}) {
	const { submit: updateDiscussion, isLoading } = useUpdateDiscussion();
	const initialValues = getDiscussionFormInitialValues(module);
	return (
		<DiscussionForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateDiscussion({
					params: { moduleId: module.id },
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
