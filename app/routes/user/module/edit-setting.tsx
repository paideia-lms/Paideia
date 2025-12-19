import { Container, Paper, Select, Stack, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	createLoader,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import { stringify } from "qs";
import { type ActionFunction, type ActionFunctionArgs, href, useFetcher } from "react-router";
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
import { ContentType } from "~/utils/get-content-type";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/edit-setting";
import { z } from "zod";
import { convertMyFormDataToObject, MyFormData } from "app/utils/action-utils";
import { enum_activity_modules_status } from "src/payload-generated-schema";
import { paramsSchema, ParamsType } from "app/routes";
import type { Simplify } from "type-fest";
import type { KeysOfUnion, OmitIndexSignature } from "type-fest";


export const loader = async ({ context, params }: Route.LoaderArgs) => {
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

export const updatePageActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
	status: z.enum(enum_activity_modules_status.enumValues),
	content: z.string().min(1),
});

const updateWhiteboardActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	whiteboardContent: z.string().optional(),
});

const updateFileActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	fileMedia: z.array(z.coerce.number()).optional(),
	files: z.array(z.file()).optional(),
});

const updateAssignmentActionSchema = z.object({
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

const updateQuizActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	quizInstructions: z.string().optional(),
	quizPoints: z.coerce.number().optional(),
	quizTimeLimit: z.coerce.number().optional(),
	quizGradingType: z.enum(["automatic", "manual"]).optional(),
	rawQuizConfig: z.custom<QuizConfig>().optional(),
});

const updateDiscussionActionSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(enum_activity_modules_status.enumValues),
	discussionInstructions: z.string().optional(),
	discussionDueDate: z.string().nullable().optional(),
	discussionRequireThread: z.coerce.boolean().optional(),
	discussionRequireReplies: z.coerce.boolean().optional(),
	discussionMinReplies: z.coerce.number().optional(),
});

type PreserveOptionalParams<T extends ActionFunctionArgs> = {
	params: Simplify<{
		[K in Extract<keyof T["params"], keyof ParamsType> as
		undefined extends T["params"][K] ? K : never
		]?: ParamsType[K];
	} & {
		[K in Extract<keyof T["params"], keyof ParamsType> as
		undefined extends T["params"][K] ? never : K
		]: ParamsType[K];
	}>;
};

function parseParamsBeforeAction<T extends ActionFunctionArgs>(
) {
	return <A extends (args: Simplify<Omit<T, "params"> & PreserveOptionalParams<T>>) => ReturnType<A>>(a: A) => {
		return serverOnly$(async (args: T) => {
			const { params } = args;
			// check every params in the schema
			for (const [key, value] of Object.entries(params)) {
				const result = paramsSchema[key as keyof typeof paramsSchema].safeParse(value);
				if (!result.success) {
					return badRequest({
						success: false,
						error: z.prettifyError(result.error),
					});
				}
			}
			return a(args as unknown as Simplify<Omit<T, "params"> & PreserveOptionalParams<T>>)
		})!
	}
}



const updatePageAction = parseParamsBeforeAction<Route.ActionArgs & { searchParams: { action: Action.UpdatePage } }>()(async ({
	request,
	context,
	params,
}) => {
	const { payload, payloadRequest } = context.get(globalContextKey);

	const parsed = await request
		.formData()
		.then(convertMyFormDataToObject)
		.then(updatePageActionSchema.safeParse);

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
			const updateResult = await tryUpdatePageModule({
				payload,
				id: params.moduleId,
				title: parsed.data.title,
				description: parsed.data.description,
				status: parsed.data.status,
				content: parsed.data.content,
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
		},
		(errorResponse) => {
			return errorResponse.data.status === StatusCode.BadRequest;
		},
	);
})
const updateWhiteboardAction = serverOnly$(
	async ({
		request,
		context,
		params,
	}: Route.ActionArgs & {
		searchParams: { action: Action.UpdateWhiteboard };
	}) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const moduleIdResult = z.coerce.number().safeParse(params.moduleId);

		if (!moduleIdResult.success) {
			return badRequest({
				success: false,
				error: z.prettifyError(moduleIdResult.error),
			});
		}

		const moduleId = moduleIdResult.data;

		const parsed = await request
			.formData()
			.then(convertMyFormDataToObject)
			.then(updateWhiteboardActionSchema.safeParse);

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
				const updateResult = await tryUpdateWhiteboardModule({
					payload,
					id: moduleId,
					title: parsed.data.title,
					description: parsed.data.description,
					status: parsed.data.status,
					content: parsed.data.whiteboardContent,
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
			},
			(errorResponse) => {
				return errorResponse.data.status === StatusCode.BadRequest;
			},
		);
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

		const moduleIdResult = z.coerce.number().safeParse(params.moduleId);

		if (!moduleIdResult.success) {
			return badRequest({
				success: false,
				error: z.prettifyError(moduleIdResult.error),
			});
		}

		const moduleId = moduleIdResult.data;
		// Convert formData to object and parse with schema
		const parsed = await request
			.formData()
			.then(convertMyFormDataToObject)
			.then(updateFileActionSchema.safeParse);

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
				// For file type, combine existing media IDs with newly uploaded media IDs
				const existingMediaIds = parsed.data.fileMedia ?? [];

				const updateResult = await tryUpdateFileModule({
					payload,
					id: moduleId,
					title: parsed.data.title,
					description: parsed.data.description,
					status: parsed.data.status,
					media: existingMediaIds,
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
			},
			(errorResponse) => {
				return errorResponse.data.status === StatusCode.BadRequest;
			},
		);
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
		const moduleIdResult = z.coerce.number().safeParse(params.moduleId);

		if (!moduleIdResult.success) {
			return badRequest({
				success: false,
				error: z.prettifyError(moduleIdResult.error),
			});
		}

		const moduleId = moduleIdResult.data;

		const parsed = await request
			.formData()
			.then(convertMyFormDataToObject)
			.then(updateAssignmentActionSchema.safeParse);

		if (!parsed.success) {
			return badRequest({
				success: false,
				error: z.prettifyError(parsed.error),
			});
		}
		const { payload, payloadRequest } = context.get(globalContextKey);

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(
			async ({ reqWithTransaction }) => {
				const allowedFileTypes =
					parsed.data.assignmentAllowedFileTypes &&
						parsed.data.assignmentAllowedFileTypes.length > 0
						? presetValuesToFileTypes(parsed.data.assignmentAllowedFileTypes)
						: undefined;

				const updateResult = await tryUpdateAssignmentModule({
					payload,
					id: moduleId,
					title: parsed.data.title,
					description: parsed.data.description,
					status: parsed.data.status,
					instructions: parsed.data.assignmentInstructions,
					requireTextSubmission: parsed.data.assignmentRequireTextSubmission,
					requireFileSubmission: parsed.data.assignmentRequireFileSubmission,
					allowedFileTypes,
					maxFileSize: parsed.data.assignmentMaxFileSize,
					maxFiles: parsed.data.assignmentMaxFiles,
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
			},
			(errorResponse) => {
				return errorResponse.data.status === StatusCode.BadRequest;
			},
		);
	},
)!;

const updateQuizAction = serverOnly$(
	async ({
		request,
		context,
		params,
	}: Route.ActionArgs & { searchParams: { action: Action.UpdateQuiz } }) => {
		const moduleIdResult = z.coerce.number().safeParse(params.moduleId);

		if (!moduleIdResult.success) {
			return badRequest({
				success: false,
				error: z.prettifyError(moduleIdResult.error),
			});
		}

		const moduleId = moduleIdResult.data;

		const parsed = await request
			.formData()
			.then(convertMyFormDataToObject)
			.then(updateQuizActionSchema.safeParse);

		if (!parsed.success) {
			return badRequest({
				success: false,
				error: z.prettifyError(parsed.error),
			});
		}
		const { payload, payloadRequest } = context.get(globalContextKey);

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(
			async ({ reqWithTransaction }) => {
				const updateResult = await tryUpdateQuizModule({
					payload,
					id: moduleId,
					title: parsed.data.title,
					description: parsed.data.description,
					status: parsed.data.status,
					instructions: parsed.data.quizInstructions,
					points: parsed.data.quizPoints,
					timeLimit: parsed.data.quizTimeLimit,
					gradingType: parsed.data.quizGradingType,
					rawQuizConfig: parsed.data.rawQuizConfig,
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
			},
			(errorResponse) => {
				return errorResponse.data.status === StatusCode.BadRequest;
			},
		);
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

		const moduleIdResult = z.coerce.number().safeParse(params.moduleId);

		if (!moduleIdResult.success) {
			return badRequest({
				success: false,
				error: z.prettifyError(moduleIdResult.error),
			});
		}

		const moduleId = moduleIdResult.data;

		const parsed = await request
			.formData()
			.then(convertMyFormDataToObject)
			.then(updateDiscussionActionSchema.safeParse);

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
				const updateResult = await tryUpdateDiscussionModule({
					payload,
					id: moduleId,
					title: parsed.data.title,
					description: parsed.data.description,
					status: parsed.data.status,
					instructions: parsed.data.discussionInstructions,
					dueDate: parsed.data.discussionDueDate,
					requireThread: parsed.data.discussionRequireThread,
					requireReplies: parsed.data.discussionRequireReplies,
					minReplies: parsed.data.discussionMinReplies,
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
			},
			(errorResponse) => {
				return errorResponse.data.status === StatusCode.BadRequest;
			},
		);
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

	const paramsResult = paramsSchema.moduleId.safeParse(params.moduleId);

	if (!paramsResult.success) {
		return badRequest({
			success: false,
			error: z.prettifyError(paramsResult.error),
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

// Custom hooks for updating modules
export function useUpdatePage() {
	const fetcher = useFetcher<typeof clientAction>();

	const updatePage = (
		moduleId: string,
		values: z.infer<typeof updatePageActionSchema>,
	) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof updatePageActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.UpdatePage, moduleId),
				encType: ContentType.MULTIPART,
			},
		);
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
		values: z.infer<typeof updateWhiteboardActionSchema>,
	) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof updateWhiteboardActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.UpdateWhiteboard, moduleId),
				encType: ContentType.MULTIPART,
			},
		);
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
		values: z.infer<typeof updateFileActionSchema>,
	) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof updateFileActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.UpdateFile, moduleId),
				encType: ContentType.MULTIPART,
			},
		);
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
		values: z.infer<typeof updateAssignmentActionSchema>,
	) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof updateAssignmentActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.UpdateAssignment, moduleId),
				encType: ContentType.MULTIPART,
			},
		);
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
		values: z.infer<typeof updateQuizActionSchema>,
	) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof updateQuizActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.UpdateQuiz, moduleId),
				encType: ContentType.MULTIPART,
			},
		);
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
		values: z.infer<typeof updateDiscussionActionSchema>,
	) => {
		fetcher.submit(
			new MyFormData<z.infer<typeof updateDiscussionActionSchema>>(values),
			{
				method: "POST",
				action: getActionUrl(Action.UpdateDiscussion, moduleId),
				encType: ContentType.MULTIPART,
			},
		);
	};

	return {
		updateDiscussion,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

function getPageFormInitialValues(
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "page" }
	>,
) {
	return {
		title: module.title,
		description: module.description || "",
		status: module.status,
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
	const { updatePage, isLoading } = useUpdatePage();
	const initialValues = getPageFormInitialValues(module);
	return (
		<PageForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updatePage(String(module.id), {
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

function getWhiteboardFormInitialValues(
	module: Extract<ActivityModuleResult, { type: "whiteboard" }>,
) {
	return {
		title: module.title,
		description: module.description || "",
		status: module.status,
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
	const { updateWhiteboard, isLoading } = useUpdateWhiteboard();
	const initialValues = getWhiteboardFormInitialValues(module);
	return (
		<WhiteboardForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateWhiteboard(String(module.id), {
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

function getFileFormInitialValues(
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "file" }
	>,
) {
	return {
		title: module.title,
		description: module.description || "",
		status: module.status,
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
	const { updateFile, isLoading } = useUpdateFile();
	const initialValues = getFileFormInitialValues(module);
	return (
		<FileForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateFile(String(module.id), {
					title: values.title,
					description: values.description,
					status: values.status,
					fileMedia: values.fileMedia,
					files: values.fileFiles,
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
		status: module.status,
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
	const { updateAssignment, isLoading } = useUpdateAssignment();
	const initialValues = getAssignmentFormInitialValues(module);
	return (
		<AssignmentForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateAssignment(String(module.id), {
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

function getQuizFormInitialValues(
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "quiz" }
	>,
) {
	return {
		title: module.title,
		description: module.description || "",
		status: module.status,
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
	const { updateQuiz, isLoading } = useUpdateQuiz();
	const initialValues = getQuizFormInitialValues(module);
	return (
		<QuizForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateQuiz(String(module.id), {
					title: values.title,
					description: values.description,
					status: values.status,
					quizInstructions: values.quizInstructions,
					quizPoints: values.quizPoints,
					quizTimeLimit: values.quizTimeLimit,
					quizGradingType: values.quizGradingType,
					rawQuizConfig:
						values.rawQuizConfig === null ? undefined : values.rawQuizConfig,
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
		status: module.status,
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
	const { updateDiscussion, isLoading } = useUpdateDiscussion();
	const initialValues = getDiscussionFormInitialValues(module);
	return (
		<DiscussionForm
			initialValues={initialValues}
			onSubmit={(values) =>
				updateDiscussion(String(module.id), {
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
