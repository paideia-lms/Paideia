import {
	Button,
	Container,
	Divider,
	Group,
	Paper,
	Select,
	Stack,
	Switch,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { parseAsStringEnum } from "nuqs/server";
import { useState } from "react";
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
import {
	tryAddNestedQuiz,
	tryAddPage,
	tryAddQuestion,
	tryAddQuizResource,
	tryMoveQuestionToPage,
	tryRemoveNestedQuiz,
	tryRemovePage,
	tryRemoveQuestion,
	tryRemoveQuizResource,
	tryReorderNestedQuizzes,
	tryReorderPages,
	tryToggleQuizType,
	tryUpdateContainerSettings,
	tryUpdateGlobalTimer,
	tryUpdateGradingConfig,
	tryUpdateNestedQuizInfo,
	tryUpdateNestedQuizTimer,
	tryUpdatePageInfo,
	tryUpdateQuestion,
	tryUpdateQuestionScoring,
	tryUpdateQuizInfo,
	tryUpdateQuizResource,
	tryUpdateMultipleChoiceQuestion,
	tryUpdateChoiceQuestion,
	tryUpdateShortAnswerQuestion,
	tryUpdateLongAnswerQuestion,
	tryUpdateFillInTheBlankQuestion,
	tryUpdateRankingQuestion,
	tryUpdateSingleSelectionMatrixQuestion,
	tryUpdateMultipleSelectionMatrixQuestion,
} from "server/internal/quiz-module-management";
import type { LatestQuizConfig as QuizConfig } from "server/json/raw-quiz-config/version-resolver";
import { DiscussionForm } from "~/components/activity-module-forms/discussion-form";
import { FileForm } from "~/components/activity-module-forms/file-form";
import { PageForm } from "~/components/activity-module-forms/page-form";
import { QuizFormV2 } from "app/routes/user/module/edit-setting/components/v2/quiz-form-v2";
import { WhiteboardForm } from "~/components/activity-module-forms/whiteboard-form";
import { AssignmentForm } from "~/components/activity-module-forms/assignment-form";
import { useDeleteActivityModule } from "~/routes/api/activity-module-delete";
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
import type { Route } from "./+types/route";
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
	ToggleQuizType = "toggleQuizType",
	UpdateGlobalTimer = "updateGlobalTimer",
	UpdateNestedQuizTimer = "updateNestedQuizTimer",
	UpdateGradingConfig = "updateGradingConfig",
	AddQuizResource = "addQuizResource",
	RemoveQuizResource = "removeQuizResource",
	UpdateQuizResource = "updateQuizResource",
	AddQuestion = "addQuestion",
	RemoveQuestion = "removeQuestion",
	UpdateQuestion = "updateQuestion",
	AddPage = "addPage",
	RemovePage = "removePage",
	AddNestedQuiz = "addNestedQuiz",
	RemoveNestedQuiz = "removeNestedQuiz",
	UpdateNestedQuizInfo = "updateNestedQuizInfo",
	ReorderNestedQuizzes = "reorderNestedQuizzes",
	UpdateContainerSettings = "updateContainerSettings",
	UpdateQuizInfo = "updateQuizInfo",
	UpdatePageInfo = "updatePageInfo",
	ReorderPages = "reorderPages",
	MoveQuestionToPage = "moveQuestionToPage",
	UpdateQuestionScoring = "updateQuestionScoring",
	UpdateMultipleChoiceQuestion = "updateMultipleChoiceQuestion",
	UpdateChoiceQuestion = "updateChoiceQuestion",
	UpdateShortAnswerQuestion = "updateShortAnswerQuestion",
	UpdateLongAnswerQuestion = "updateLongAnswerQuestion",
	UpdateFillInTheBlankQuestion = "updateFillInTheBlankQuestion",
	UpdateRankingQuestion = "updateRankingQuestion",
	UpdateSingleSelectionMatrixQuestion = "updateSingleSelectionMatrixQuestion",
	UpdateMultipleSelectionMatrixQuestion = "updateMultipleSelectionMatrixQuestion",
}

// Define search params for module update (used in actions)
export const moduleUpdateSearchParams = {
	action: parseAsStringEnum(Object.values(Action)),
};

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/user/module/edit/:moduleId",
});
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
const createToggleQuizTypeActionRpc = createActionRpc({
	formDataSchema: z.object({
		newType: z.enum(["regular", "container"]),
	}),
	method: "POST",
	action: Action.ToggleQuizType,
});
const createUpdateGlobalTimerActionRpc = createActionRpc({
	formDataSchema: z.object({
		seconds: z.number().optional(),
	}),
	method: "POST",
	action: Action.UpdateGlobalTimer,
});
const createUpdateNestedQuizTimerActionRpc = createActionRpc({
	formDataSchema: z.object({
		nestedQuizId: z.string(),
		seconds: z.number().optional(),
	}),
	method: "POST",
	action: Action.UpdateNestedQuizTimer,
});
const createUpdateGradingConfigActionRpc = createActionRpc({
	formDataSchema: z.object({
		gradingConfig: z.object({
			enabled: z.boolean().optional(),
			passingScore: z.number().optional(),
			showScoreToStudent: z.boolean().optional(),
			showCorrectAnswers: z.boolean().optional(),
		}),
	}),
	method: "POST",
	action: Action.UpdateGradingConfig,
});
const createAddQuizResourceActionRpc = createActionRpc({
	formDataSchema: z.object({
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.AddQuizResource,
});
const createRemoveQuizResourceActionRpc = createActionRpc({
	formDataSchema: z.object({
		resourceId: z.string(),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.RemoveQuizResource,
});
const createUpdateQuizResourceActionRpc = createActionRpc({
	formDataSchema: z.object({
		resourceId: z.string(),
		updates: z.object({
			title: z.string().optional(),
			content: z.string().optional(),
			pages: z.array(z.string()).optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateQuizResource,
});
const createAddQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		pageId: z.string(),
		questionType: z.enum([
			"multiple-choice",
			"short-answer",
			"long-answer",
			"article",
			"fill-in-the-blank",
			"choice",
			"ranking",
			"single-selection-matrix",
			"multiple-selection-matrix",
			"whiteboard",
		]),
		position: z.number().optional(),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.AddQuestion,
});
const createRemoveQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.RemoveQuestion,
});
const createUpdateQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		updates: z.object({
			prompt: z.string().optional(),
			feedback: z.string().optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateQuestion,
});
const createUpdateMultipleChoiceQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		options: z.object({
			options: z.record(z.string(), z.string()).optional(),
			correctAnswer: z.string().optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateMultipleChoiceQuestion,
});
const createUpdateChoiceQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		options: z.object({
			options: z.record(z.string(), z.string()).optional(),
			correctAnswers: z.array(z.string()).optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateChoiceQuestion,
});
const createUpdateShortAnswerQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		options: z.object({
			correctAnswer: z.string().optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateShortAnswerQuestion,
});
const createUpdateLongAnswerQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		options: z.object({
			correctAnswer: z.string().optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateLongAnswerQuestion,
});
const createUpdateFillInTheBlankQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		options: z.object({
			correctAnswers: z.record(z.string(), z.string()).optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateFillInTheBlankQuestion,
});
const createUpdateRankingQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		options: z.object({
			items: z.record(z.string(), z.string()).optional(),
			correctOrder: z.array(z.string()).optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateRankingQuestion,
});
const createUpdateSingleSelectionMatrixQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		options: z.object({
			rows: z.record(z.string(), z.string()).optional(),
			columns: z.record(z.string(), z.string()).optional(),
			correctAnswers: z.record(z.string(), z.string()).optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateSingleSelectionMatrixQuestion,
});
const createUpdateMultipleSelectionMatrixQuestionActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		options: z.object({
			rows: z.record(z.string(), z.string()).optional(),
			columns: z.record(z.string(), z.string()).optional(),
			correctAnswers: z.record(z.string(), z.array(z.string())).optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateMultipleSelectionMatrixQuestion,
});
const createAddPageActionRpc = createActionRpc({
	formDataSchema: z.object({
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.AddPage,
});
const createRemovePageActionRpc = createActionRpc({
	formDataSchema: z.object({
		pageId: z.string(),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.RemovePage,
});
const createAddNestedQuizActionRpc = createActionRpc({
	formDataSchema: z.object({}),
	method: "POST",
	action: Action.AddNestedQuiz,
});
const createRemoveNestedQuizActionRpc = createActionRpc({
	formDataSchema: z.object({
		nestedQuizId: z.string(),
	}),
	method: "POST",
	action: Action.RemoveNestedQuiz,
});
const createUpdateNestedQuizInfoActionRpc = createActionRpc({
	formDataSchema: z.object({
		nestedQuizId: z.string(),
		updates: z.object({
			title: z.string().optional(),
			description: z.string().optional(),
		}),
	}),
	method: "POST",
	action: Action.UpdateNestedQuizInfo,
});
const createReorderNestedQuizzesActionRpc = createActionRpc({
	formDataSchema: z.object({
		nestedQuizIds: z.array(z.string()),
	}),
	method: "POST",
	action: Action.ReorderNestedQuizzes,
});
const createUpdateContainerSettingsActionRpc = createActionRpc({
	formDataSchema: z.object({
		settings: z.object({
			sequentialOrder: z.boolean().optional(),
		}),
	}),
	method: "POST",
	action: Action.UpdateContainerSettings,
});
const createUpdateQuizInfoActionRpc = createActionRpc({
	formDataSchema: z.object({
		updates: z.object({
			title: z.string().optional(),
		}),
	}),
	method: "POST",
	action: Action.UpdateQuizInfo,
});
const createUpdatePageInfoActionRpc = createActionRpc({
	formDataSchema: z.object({
		pageId: z.string(),
		updates: z.object({
			title: z.string().optional(),
		}),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdatePageInfo,
});
const createReorderPagesActionRpc = createActionRpc({
	formDataSchema: z.object({
		pageIds: z.array(z.string()),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.ReorderPages,
});
const createMoveQuestionToPageActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		targetPageId: z.string(),
		position: z.number().optional(),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.MoveQuestionToPage,
});
// ScoringConfig discriminated union schema
// Note: WeightedScoring and RankingScoring are flattened since they have nested discriminated unions based on "mode"
const ScoringConfigSchema = z
	.discriminatedUnion("type", [
		z.object({
			type: z.literal("simple"),
			points: z.number(),
		}),
		// WeightedScoring variants (flattened)
		z.object({
			type: z.literal("weighted"),
			mode: z.literal("all-or-nothing"),
			maxPoints: z.number(),
		}),
		z.object({
			type: z.literal("weighted"),
			mode: z.literal("partial-with-penalty"),
			maxPoints: z.number(),
			pointsPerCorrect: z.number(),
			penaltyPerIncorrect: z.number(),
		}),
		z.object({
			type: z.literal("weighted"),
			mode: z.literal("partial-no-penalty"),
			maxPoints: z.number(),
			pointsPerCorrect: z.number(),
		}),
		z.object({
			type: z.literal("rubric"),
			rubricId: z.number(),
			maxPoints: z.number(),
		}),
		z.object({
			type: z.literal("manual"),
			maxPoints: z.number(),
		}),
		z.object({
			type: z.literal("partial-match"),
			maxPoints: z.number(),
			caseSensitive: z.boolean(),
			matchThreshold: z.number(),
		}),
		// RankingScoring variants (flattened)
		z.object({
			type: z.literal("ranking"),
			mode: z.literal("exact-order"),
			maxPoints: z.number(),
		}),
		z.object({
			type: z.literal("ranking"),
			mode: z.literal("partial-order"),
			maxPoints: z.number(),
			pointsPerCorrectPosition: z.number(),
		}),
		z.object({
			type: z.literal("matrix"),
			maxPoints: z.number(),
			pointsPerRow: z.number(),
			mode: z.enum(["all-or-nothing", "partial"]),
		}),
	])
	.or(z.undefined());

const createUpdateQuestionScoringActionRpc = createActionRpc({
	formDataSchema: z.object({
		questionId: z.string(),
		scoring: ScoringConfigSchema,
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateQuestionScoring,
});

const updatePageAction = createUpdatePageActionRpc.createAction(
	async ({ context, params, formData }) => {
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
	},
);

const useUpdatePage = createUpdatePageActionRpc.createHook<typeof updatePageAction>();

const updateWhiteboardAction = createUpdateWhiteboardActionRpc.createAction(
	async ({ context, params, formData }) => {
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
	},
);

const useUpdateWhiteboard = createUpdateWhiteboardActionRpc.createHook<typeof updateWhiteboardAction>();

const updateFileAction = createUpdateFileActionRpc.createAction(
	async ({ context, params, formData }) => {
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
	},
);

const useUpdateFile = createUpdateFileActionRpc.createHook<typeof updateFileAction>();

const updateAssignmentAction = createUpdateAssignmentActionRpc.createAction(
	async ({ context, params, formData }) => {
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
	},
);

const useUpdateAssignment = createUpdateAssignmentActionRpc.createHook<typeof updateAssignmentAction>();


const updateQuizAction = createUpdateQuizActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const updateResult = await tryUpdateQuizModule({
			payload,
			id: params.moduleId,
			title: formData.title,
			description: formData.description,
			instructions: formData.quizInstructions,
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
	},
);

const useUpdateQuiz = createUpdateQuizActionRpc.createHook<typeof updateQuizAction>();

const updateDiscussionAction = createUpdateDiscussionActionRpc.createAction(
	async ({ context, params, formData }) => {
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
	},
);

const useUpdateDiscussion = createUpdateDiscussionActionRpc.createHook<typeof updateDiscussionAction>();

const toggleQuizTypeAction = createToggleQuizTypeActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryToggleQuizType({
			payload,
			activityModuleId: params.moduleId,
			newType: formData.newType,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Quiz type toggled successfully",
		});
	},
);

const useToggleQuizType = createToggleQuizTypeActionRpc.createHook<typeof toggleQuizTypeAction>();

const updateGlobalTimerAction = createUpdateGlobalTimerActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdateGlobalTimer({
			payload,
			activityModuleId: params.moduleId,
			seconds: formData.seconds,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Global timer updated successfully",
		});
	},
);

const useUpdateGlobalTimer = createUpdateGlobalTimerActionRpc.createHook<typeof updateGlobalTimerAction>();

const updateNestedQuizTimerAction = createUpdateNestedQuizTimerActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdateNestedQuizTimer({
			payload,
			activityModuleId: params.moduleId,
			nestedQuizId: formData.nestedQuizId,
			seconds: formData.seconds,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Nested quiz timer updated successfully",
		});
	},
);

const useUpdateNestedQuizTimer = createUpdateNestedQuizTimerActionRpc.createHook<typeof updateNestedQuizTimerAction>();

const updateGradingConfigAction = createUpdateGradingConfigActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdateGradingConfig({
			payload,
			activityModuleId: params.moduleId,
			gradingConfig: formData.gradingConfig,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Grading config updated successfully",
		});
	},
);

const useUpdateGradingConfig = createUpdateGradingConfigActionRpc.createHook<typeof updateGradingConfigAction>();

const addQuizResourceAction = createAddQuizResourceActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryAddQuizResource({
			payload,
			activityModuleId: params.moduleId,
			resource: {
				id: `resource-${Date.now()}`,
				title: "",
				content: "",
				pages: [],
			},
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Quiz resource added successfully",
		});
	},
);

const useAddQuizResource = createAddQuizResourceActionRpc.createHook<typeof addQuizResourceAction>();

const removeQuizResourceAction = createRemoveQuizResourceActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryRemoveQuizResource({
			payload,
			activityModuleId: params.moduleId,
			resourceId: formData.resourceId,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Quiz resource removed successfully",
		});
	},
);

const useRemoveQuizResource = createRemoveQuizResourceActionRpc.createHook<typeof removeQuizResourceAction>();

const updateQuizResourceAction = createUpdateQuizResourceActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdateQuizResource({
			payload,
			activityModuleId: params.moduleId,
			resourceId: formData.resourceId,
			updates: formData.updates,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Quiz resource updated successfully",
		});
	},
);

const useUpdateQuizResource = createUpdateQuizResourceActionRpc.createHook<typeof updateQuizResourceAction>();

const addQuestionAction = createAddQuestionActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryAddQuestion({
			payload,
			activityModuleId: params.moduleId,
			pageId: formData.pageId,
			questionType: formData.questionType,
			position: formData.position,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Question added successfully",
		});
	},
);

const useAddQuestion = createAddQuestionActionRpc.createHook<typeof addQuestionAction>();

const removeQuestionAction = createRemoveQuestionActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryRemoveQuestion({
			payload,
			activityModuleId: params.moduleId,
			questionId: formData.questionId,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Question removed successfully",
		});
	},
);

const useRemoveQuestion = createRemoveQuestionActionRpc.createHook<typeof removeQuestionAction>();

const updateQuestionAction = createUpdateQuestionActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdateQuestion({
			payload,
			activityModuleId: params.moduleId,
			questionId: formData.questionId,
			updates: formData.updates,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Question updated successfully",
		});
	},
);

const useUpdateQuestion = createUpdateQuestionActionRpc.createHook<typeof updateQuestionAction>();

const addPageAction = createAddPageActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryAddPage({
			payload,
			activityModuleId: params.moduleId,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Page added successfully",
		});
	},
);

const useAddPage = createAddPageActionRpc.createHook<typeof addPageAction>();

const removePageAction = createRemovePageActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryRemovePage({
			payload,
			activityModuleId: params.moduleId,
			pageId: formData.pageId,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Page removed successfully",
		});
	},
);

const useRemovePage = createRemovePageActionRpc.createHook<typeof removePageAction>();

const addNestedQuizAction = createAddNestedQuizActionRpc.createAction(
	async ({ context, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryAddNestedQuiz({
			payload,
			activityModuleId: params.moduleId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Nested quiz added successfully",
		});
	},
);

const useAddNestedQuiz = createAddNestedQuizActionRpc.createHook<typeof addNestedQuizAction>();

const removeNestedQuizAction = createRemoveNestedQuizActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryRemoveNestedQuiz({
			payload,
			activityModuleId: params.moduleId,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Nested quiz removed successfully",
		});
	},
);

const useRemoveNestedQuiz = createRemoveNestedQuizActionRpc.createHook<typeof removeNestedQuizAction>();

const updateNestedQuizInfoAction = createUpdateNestedQuizInfoActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdateNestedQuizInfo({
			payload,
			activityModuleId: params.moduleId,
			nestedQuizId: formData.nestedQuizId,
			updates: formData.updates,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Nested quiz info updated successfully",
		});
	},
);

const useUpdateNestedQuizInfo = createUpdateNestedQuizInfoActionRpc.createHook<typeof updateNestedQuizInfoAction>();

const reorderNestedQuizzesAction = createReorderNestedQuizzesActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryReorderNestedQuizzes({
			payload,
			activityModuleId: params.moduleId,
			nestedQuizIds: formData.nestedQuizIds,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Nested quizzes reordered successfully",
		});
	},
);

const useReorderNestedQuizzes = createReorderNestedQuizzesActionRpc.createHook<typeof reorderNestedQuizzesAction>();

const updateContainerSettingsAction = createUpdateContainerSettingsActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdateContainerSettings({
			payload,
			activityModuleId: params.moduleId,
			settings: formData.settings,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Container settings updated successfully",
		});
	},
);

const useUpdateContainerSettings = createUpdateContainerSettingsActionRpc.createHook<typeof updateContainerSettingsAction>();


const updatePageInfoAction = createUpdatePageInfoActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdatePageInfo({
			payload,
			activityModuleId: params.moduleId,
			pageId: formData.pageId,
			updates: formData.updates,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Page info updated successfully",
		});
	},
);

const useUpdatePageInfo = createUpdatePageInfoActionRpc.createHook<typeof updatePageInfoAction>();

const reorderPagesAction = createReorderPagesActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryReorderPages({
			payload,
			activityModuleId: params.moduleId,
			pageIds: formData.pageIds,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Pages reordered successfully",
		});
	},
);

const useReorderPages = createReorderPagesActionRpc.createHook<typeof reorderPagesAction>();

const moveQuestionToPageAction = createMoveQuestionToPageActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryMoveQuestionToPage({
			payload,
			activityModuleId: params.moduleId,
			questionId: formData.questionId,
			targetPageId: formData.targetPageId,
			position: formData.position,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Question moved successfully",
		});
	},
);

const useMoveQuestionToPage = createMoveQuestionToPageActionRpc.createHook<typeof moveQuestionToPageAction>();

const updateQuestionScoringAction = createUpdateQuestionScoringActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdateQuestionScoring({
			payload,
			activityModuleId: params.moduleId,
			questionId: formData.questionId,
			scoring: formData.scoring,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Question scoring updated successfully",
		});
	},
);

const useUpdateQuestionScoring = createUpdateQuestionScoringActionRpc.createHook<typeof updateQuestionScoringAction>();

const updateMultipleChoiceQuestionAction =
	createUpdateMultipleChoiceQuestionActionRpc.createAction(
		async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const result = await tryUpdateMultipleChoiceQuestion({
				payload,
				activityModuleId: params.moduleId,
				questionId: formData.questionId,
				options: formData.options,
				nestedQuizId: formData.nestedQuizId,
				req: payloadRequest,
			});

			if (!result.ok) {
				return badRequest({
					success: false,
					error: result.error.message,
				});
			}

			return ok({
				success: true,
				message: "Multiple choice question updated successfully",
			});
		},
	);

const useUpdateMultipleChoiceQuestion =
	createUpdateMultipleChoiceQuestionActionRpc.createHook<
		typeof updateMultipleChoiceQuestionAction
	>();

const updateChoiceQuestionAction = createUpdateChoiceQuestionActionRpc.createAction(
	async ({ context, params, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);

		const result = await tryUpdateChoiceQuestion({
			payload,
			activityModuleId: params.moduleId,
			questionId: formData.questionId,
			options: formData.options,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				success: false,
				error: result.error.message,
			});
		}

		return ok({
			success: true,
			message: "Choice question updated successfully",
		});
	},
);

const useUpdateChoiceQuestion =
	createUpdateChoiceQuestionActionRpc.createHook<
		typeof updateChoiceQuestionAction
	>();

const updateShortAnswerQuestionAction =
	createUpdateShortAnswerQuestionActionRpc.createAction(
		async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const result = await tryUpdateShortAnswerQuestion({
				payload,
				activityModuleId: params.moduleId,
				questionId: formData.questionId,
				options: formData.options,
				nestedQuizId: formData.nestedQuizId,
				req: payloadRequest,
			});

			if (!result.ok) {
				return badRequest({
					success: false,
					error: result.error.message,
				});
			}

			return ok({
				success: true,
				message: "Short answer question updated successfully",
			});
		},
	);

const useUpdateShortAnswerQuestion =
	createUpdateShortAnswerQuestionActionRpc.createHook<
		typeof updateShortAnswerQuestionAction
	>();

const updateLongAnswerQuestionAction =
	createUpdateLongAnswerQuestionActionRpc.createAction(
		async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const result = await tryUpdateLongAnswerQuestion({
				payload,
				activityModuleId: params.moduleId,
				questionId: formData.questionId,
				options: formData.options,
				nestedQuizId: formData.nestedQuizId,
				req: payloadRequest,
			});

			if (!result.ok) {
				return badRequest({
					success: false,
					error: result.error.message,
				});
			}

			return ok({
				success: true,
				message: "Long answer question updated successfully",
			});
		},
	);

const useUpdateLongAnswerQuestion =
	createUpdateLongAnswerQuestionActionRpc.createHook<
		typeof updateLongAnswerQuestionAction
	>();

const updateFillInTheBlankQuestionAction =
	createUpdateFillInTheBlankQuestionActionRpc.createAction(
		async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const result = await tryUpdateFillInTheBlankQuestion({
				payload,
				activityModuleId: params.moduleId,
				questionId: formData.questionId,
				options: formData.options,
				nestedQuizId: formData.nestedQuizId,
				req: payloadRequest,
			});

			if (!result.ok) {
				return badRequest({
					success: false,
					error: result.error.message,
				});
			}

			return ok({
				success: true,
				message: "Fill-in-the-blank question updated successfully",
			});
		},
	);

const useUpdateFillInTheBlankQuestion =
	createUpdateFillInTheBlankQuestionActionRpc.createHook<
		typeof updateFillInTheBlankQuestionAction
	>();

const updateRankingQuestionAction =
	createUpdateRankingQuestionActionRpc.createAction(
		async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const result = await tryUpdateRankingQuestion({
				payload,
				activityModuleId: params.moduleId,
				questionId: formData.questionId,
				options: formData.options,
				nestedQuizId: formData.nestedQuizId,
				req: payloadRequest,
			});

			if (!result.ok) {
				return badRequest({
					success: false,
					error: result.error.message,
				});
			}

			return ok({
				success: true,
				message: "Ranking question updated successfully",
			});
		},
	);

const useUpdateRankingQuestion =
	createUpdateRankingQuestionActionRpc.createHook<
		typeof updateRankingQuestionAction
	>();

const updateSingleSelectionMatrixQuestionAction =
	createUpdateSingleSelectionMatrixQuestionActionRpc.createAction(
		async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const result = await tryUpdateSingleSelectionMatrixQuestion({
				payload,
				activityModuleId: params.moduleId,
				questionId: formData.questionId,
				options: formData.options,
				nestedQuizId: formData.nestedQuizId,
				req: payloadRequest,
			});

			if (!result.ok) {
				return badRequest({
					success: false,
					error: result.error.message,
				});
			}

			return ok({
				success: true,
				message: "Single selection matrix question updated successfully",
			});
		},
	);

const useUpdateSingleSelectionMatrixQuestion =
	createUpdateSingleSelectionMatrixQuestionActionRpc.createHook<
		typeof updateSingleSelectionMatrixQuestionAction
	>();

const updateMultipleSelectionMatrixQuestionAction =
	createUpdateMultipleSelectionMatrixQuestionActionRpc.createAction(
		async ({ context, params, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);

			const result = await tryUpdateMultipleSelectionMatrixQuestion({
				payload,
				activityModuleId: params.moduleId,
				questionId: formData.questionId,
				options: formData.options,
				nestedQuizId: formData.nestedQuizId,
				req: payloadRequest,
			});

			if (!result.ok) {
				return badRequest({
					success: false,
					error: result.error.message,
				});
			}

			return ok({
				success: true,
				message: "Multiple selection matrix question updated successfully",
			});
		},
	);

const useUpdateMultipleSelectionMatrixQuestion =
	createUpdateMultipleSelectionMatrixQuestionActionRpc.createHook<
		typeof updateMultipleSelectionMatrixQuestionAction
	>();

interface DeleteActivityModuleProps {
	moduleId: number;
	hasLinkedCourses: boolean;
}

function DeleteActivityModule({
	moduleId,
	hasLinkedCourses,
}: DeleteActivityModuleProps) {
	const { submit: deleteModule, isLoading: isDeleting } =
		useDeleteActivityModule();

	const handleDelete = async () => {
		const confirmed = window.confirm(
			"Are you sure you want to delete this activity module? This action cannot be undone. The module must not be linked to any courses to be deleted.",
		);
		if (confirmed) {
			await deleteModule({
				values: {
					moduleId,
				},
			});
		}
	};

	return (
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
	);
}

const [action] = createActionMap({
	[Action.UpdatePage]: updatePageAction,
	[Action.UpdateWhiteboard]: updateWhiteboardAction,
	[Action.UpdateFile]: updateFileAction,
	[Action.UpdateAssignment]: updateAssignmentAction,
	[Action.UpdateQuiz]: updateQuizAction,
	[Action.UpdateDiscussion]: updateDiscussionAction,
	[Action.ToggleQuizType]: toggleQuizTypeAction,
	[Action.UpdateGlobalTimer]: updateGlobalTimerAction,
	[Action.UpdateNestedQuizTimer]: updateNestedQuizTimerAction,
	[Action.UpdateGradingConfig]: updateGradingConfigAction,
	[Action.AddQuizResource]: addQuizResourceAction,
	[Action.RemoveQuizResource]: removeQuizResourceAction,
	[Action.UpdateQuizResource]: updateQuizResourceAction,
	[Action.AddQuestion]: addQuestionAction,
	[Action.RemoveQuestion]: removeQuestionAction,
	[Action.UpdateQuestion]: updateQuestionAction,
	[Action.AddPage]: addPageAction,
	[Action.RemovePage]: removePageAction,
	[Action.AddNestedQuiz]: addNestedQuizAction,
	[Action.RemoveNestedQuiz]: removeNestedQuizAction,
	[Action.UpdateNestedQuizInfo]: updateNestedQuizInfoAction,
	[Action.ReorderNestedQuizzes]: reorderNestedQuizzesAction,
	[Action.UpdateContainerSettings]: updateContainerSettingsAction,
	[Action.UpdatePageInfo]: updatePageInfoAction,
	[Action.ReorderPages]: reorderPagesAction,
	[Action.MoveQuestionToPage]: moveQuestionToPageAction,
	[Action.UpdateQuestionScoring]: updateQuestionScoringAction,
	[Action.UpdateMultipleChoiceQuestion]: updateMultipleChoiceQuestionAction,
	[Action.UpdateChoiceQuestion]: updateChoiceQuestionAction,
	[Action.UpdateShortAnswerQuestion]: updateShortAnswerQuestionAction,
	[Action.UpdateLongAnswerQuestion]: updateLongAnswerQuestionAction,
	[Action.UpdateFillInTheBlankQuestion]: updateFillInTheBlankQuestionAction,
	[Action.UpdateRankingQuestion]: updateRankingQuestionAction,
	[Action.UpdateSingleSelectionMatrixQuestion]:
		updateSingleSelectionMatrixQuestionAction,
	[Action.UpdateMultipleSelectionMatrixQuestion]:
		updateMultipleSelectionMatrixQuestionAction,
});

export { action };

// Export hooks for v2 components
export {
	useUpdatePage,
	useUpdateWhiteboard,
	useUpdateFile,
	useUpdateAssignment,
	useUpdateQuiz,
	useUpdateDiscussion,
	useToggleQuizType,
	useUpdateGlobalTimer,
	useUpdateNestedQuizTimer,
	useUpdateGradingConfig,
	useAddQuizResource,
	useRemoveQuizResource,
	useUpdateQuizResource,
	useAddQuestion,
	useRemoveQuestion,
	useUpdateQuestion,
	useAddPage,
	useRemovePage,
	useAddNestedQuiz,
	useRemoveNestedQuiz,
	useUpdateNestedQuizInfo,
	useReorderNestedQuizzes,
	useUpdateContainerSettings,
	useUpdatePageInfo,
	useReorderPages,
	useMoveQuestionToPage,
	useUpdateQuestionScoring,
	useUpdateMultipleChoiceQuestion,
	useUpdateChoiceQuestion,
	useUpdateShortAnswerQuestion,
	useUpdateLongAnswerQuestion,
	useUpdateFillInTheBlankQuestion,
	useUpdateRankingQuestion,
	useUpdateSingleSelectionMatrixQuestion,
	useUpdateMultipleSelectionMatrixQuestion,
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
		files: {
			files: [] as File[],
			mediaIds: module.media?.map((m) => m.id) ?? [],
		},
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
			onSubmit={async (values) => {
				console.log(values);
				await updateFile({
					params: { moduleId: module.id },
					values: {
						title: values.title,
						description: values.description,
						fileMedia: [...values.files.mediaIds, ...values.files.files],
					},
				})
			}
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
						{module.type === "quiz" && <QuizFormV2 module={module} />}
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
