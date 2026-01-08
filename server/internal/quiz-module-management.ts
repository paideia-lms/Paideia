import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "app/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";
import { Result } from "typescript-result";
import {
	interceptPayloadError,
	stripDepth,
} from "./utils/internal-function-utils";
import { tryGetActivityModuleById } from "./activity-module-management";
import {
	addNestedQuiz,
	addPage,
	addQuestion,
	addQuizResource,
	moveQuestionToPage,
	removeNestedQuiz,
	removePage,
	removeQuestion,
	removeQuizResource,
	reorderNestedQuizzes,
	reorderPages,
	toggleQuizType,
	updateContainerSettings,
	updateGlobalTimer,
	updateGradingConfig,
	updateNestedQuizInfo,
	updateNestedQuizTimer,
	updatePageInfo,
	updateQuestion,
	updateQuestionScoring,
	updateQuizInfo,
	updateQuizResource,
	type ContainerQuizConfig,
	type GradingConfig,
	type NestedQuizConfig,
	type Question,
	type QuizPage,
	type QuizResource,
} from "server/json/raw-quiz-config/v2";
import type { LatestQuizConfig } from "server/json/raw-quiz-config/version-resolver";

/**
 * Toggle quiz type between "regular" and "container"
 */
export interface ToggleQuizTypeArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	newType: "regular" | "container";
}

export function tryToggleQuizType(args: ToggleQuizTypeArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				newType,
			} = args;

			// Get the activity module
			const activityModule = await tryGetActivityModuleById({
				payload,
				id: activityModuleId,
				req,
				overrideAccess,
			}).getOrThrow();

			// Assert it's a quiz module
			if (activityModule.type !== "quiz") {
				throw new InvalidArgumentError(
					`Activity module with id '${activityModuleId}' is not a quiz module`,
				);
			}

			// Apply the toggleQuizType utility function
			const updatedConfig = toggleQuizType({
				config: activityModule.rawQuizConfig,
				newType,
			});

			const updatedQuiz = await payload
				.update({
					collection: "quizzes",
					id: activityModule.quizId,
					data: {
						rawQuizConfig: updatedConfig,
					},
					req,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">())
				.then((quiz) => {
					return {
						...quiz,
						rawQuizConfig: quiz.rawQuizConfig as unknown as LatestQuizConfig,
					};
				})
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryToggleQuizType",
						args: { payload, req, overrideAccess },
					});
					throw error;
				});

			return updatedQuiz;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to toggle quiz type", { cause: error }),
	);
}

/**
 * Helper function to get activity module, assert it's a quiz, and get quiz ID
 */
async function getQuizModuleAndId(
	payload: Parameters<typeof tryGetActivityModuleById>[0]["payload"],
	activityModuleId: number,
	req: Parameters<typeof tryGetActivityModuleById>[0]["req"],
	overrideAccess: boolean,
) {
	const activityModule = await tryGetActivityModuleById({
		payload,
		id: activityModuleId,
		req,
		overrideAccess,
	}).getOrThrow();

	if (activityModule.type !== "quiz") {
		throw new InvalidArgumentError(
			`Activity module with id '${activityModuleId}' is not a quiz module`,
		);
	}

	return {
		activityModule,
		quizId: activityModule.quizId,
		rawQuizConfig: activityModule.rawQuizConfig,
	};
}

/**
 * Helper function to update quiz config and return result
 */
async function updateQuizConfigAndReturn(
	payload: Parameters<typeof tryGetActivityModuleById>[0]["payload"],
	quizId: number,
	updatedConfig: LatestQuizConfig,
	req: Parameters<typeof tryGetActivityModuleById>[0]["req"],
	overrideAccess: boolean,
	functionNamePrefix: string,
) {
	const updatedQuiz = await payload
		.update({
			collection: "quizzes",
			id: quizId,
			data: {
				rawQuizConfig: updatedConfig,
			},
			req,
			overrideAccess,
			depth: 0,
		})
		.then(stripDepth<0, "update">())
		.then((quiz) => {
			return {
				...quiz,
				rawQuizConfig: quiz.rawQuizConfig as unknown as LatestQuizConfig,
			};
		})
		.catch((error) => {
			interceptPayloadError({
				error,
				functionNamePrefix,
				args: { payload, req, overrideAccess },
			});
			throw error;
		});

	return updatedQuiz;
}

/**
 * Update global timer for a quiz
 */
export interface UpdateGlobalTimerArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	seconds: number | undefined;
}

export function tryUpdateGlobalTimer(args: UpdateGlobalTimerArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				seconds,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updateGlobalTimer({
				config: rawQuizConfig,
				seconds,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdateGlobalTimer",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update global timer", { cause: error }),
	);
}

/**
 * Update nested quiz timer
 */
export interface UpdateNestedQuizTimerArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	nestedQuizId: string;
	seconds: number | undefined;
}

export function tryUpdateNestedQuizTimer(args: UpdateNestedQuizTimerArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				nestedQuizId,
				seconds,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updateNestedQuizTimer({
				config: rawQuizConfig,
				nestedQuizId,
				seconds,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdateNestedQuizTimer",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update nested quiz timer", { cause: error }),
	);
}

/**
 * Update grading configuration
 */
export interface UpdateGradingConfigArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	gradingConfig: Partial<GradingConfig>;
}

export function tryUpdateGradingConfig(args: UpdateGradingConfigArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				gradingConfig,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updateGradingConfig({
				config: rawQuizConfig,
				gradingConfig,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdateGradingConfig",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update grading config", { cause: error }),
	);
}

/**
 * Add a quiz resource
 */
export interface AddQuizResourceArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	resource: QuizResource;
	nestedQuizId?: string;
}

export function tryAddQuizResource(args: AddQuizResourceArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				resource,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = addQuizResource({
				config: rawQuizConfig,
				resource,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryAddQuizResource",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to add quiz resource", { cause: error }),
	);
}

/**
 * Remove a quiz resource
 */
export interface RemoveQuizResourceArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	resourceId: string;
	nestedQuizId?: string;
}

export function tryRemoveQuizResource(args: RemoveQuizResourceArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				resourceId,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = removeQuizResource({
				config: rawQuizConfig,
				resourceId,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryRemoveQuizResource",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to remove quiz resource", { cause: error }),
	);
}

/**
 * Update a quiz resource
 */
export interface UpdateQuizResourceArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	resourceId: string;
	updates: Partial<Omit<QuizResource, "id">>;
	nestedQuizId?: string;
}

export function tryUpdateQuizResource(args: UpdateQuizResourceArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				resourceId,
				updates,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updateQuizResource({
				config: rawQuizConfig,
				resourceId,
				updates,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdateQuizResource",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update quiz resource", { cause: error }),
	);
}

/**
 * Add a question to a page
 */
export interface AddQuestionArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	pageId: string;
	question: Question;
	position?: number;
	nestedQuizId?: string;
}

export function tryAddQuestion(args: AddQuestionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				pageId,
				question,
				position,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = addQuestion({
				config: rawQuizConfig,
				pageId,
				question,
				position,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryAddQuestion",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to add question", { cause: error }),
	);
}

/**
 * Remove a question
 */
export interface RemoveQuestionArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	questionId: string;
	nestedQuizId?: string;
}

export function tryRemoveQuestion(args: RemoveQuestionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				questionId,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = removeQuestion({
				config: rawQuizConfig,
				questionId,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryRemoveQuestion",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to remove question", { cause: error }),
	);
}

/**
 * Update a question
 */
export interface UpdateQuestionArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	questionId: string;
	updates: Partial<Question>;
	nestedQuizId?: string;
}

export function tryUpdateQuestion(args: UpdateQuestionArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				questionId,
				updates,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updateQuestion({
				config: rawQuizConfig,
				questionId,
				updates,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdateQuestion",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update question", { cause: error }),
	);
}

/**
 * Add a page
 */
export interface AddPageArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	page: Partial<QuizPage> & { questions?: Question[] };
	position?: number;
	nestedQuizId?: string;
}

export function tryAddPage(args: AddPageArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				page,
				position,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = addPage({
				config: rawQuizConfig,
				page,
				position,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryAddPage",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to add page", { cause: error }),
	);
}

/**
 * Remove a page
 */
export interface RemovePageArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	pageId: string;
	nestedQuizId?: string;
}

export function tryRemovePage(args: RemovePageArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				pageId,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = removePage({
				config: rawQuizConfig,
				pageId,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryRemovePage",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to remove page", { cause: error }),
	);
}

/**
 * Add a nested quiz to a container quiz
 */
export interface AddNestedQuizArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	nestedQuiz: Partial<NestedQuizConfig> & { id: string };
	position?: number;
}

export function tryAddNestedQuiz(args: AddNestedQuizArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				nestedQuiz,
				position,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = addNestedQuiz({
				config: rawQuizConfig,
				nestedQuiz,
				position,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryAddNestedQuiz",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to add nested quiz", { cause: error }),
	);
}

/**
 * Remove a nested quiz from a container quiz
 */
export interface RemoveNestedQuizArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	nestedQuizId: string;
}

export function tryRemoveNestedQuiz(args: RemoveNestedQuizArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = removeNestedQuiz({
				config: rawQuizConfig,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryRemoveNestedQuiz",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to remove nested quiz", { cause: error }),
	);
}

/**
 * Update nested quiz info (title, description)
 */
export interface UpdateNestedQuizInfoArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	nestedQuizId: string;
	updates: Partial<Pick<NestedQuizConfig, "title" | "description">>;
}

export function tryUpdateNestedQuizInfo(args: UpdateNestedQuizInfoArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				nestedQuizId,
				updates,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updateNestedQuizInfo({
				config: rawQuizConfig,
				nestedQuizId,
				updates,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdateNestedQuizInfo",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update nested quiz info", { cause: error }),
	);
}

/**
 * Reorder nested quizzes
 */
export interface ReorderNestedQuizzesArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	nestedQuizIds: string[];
}

export function tryReorderNestedQuizzes(args: ReorderNestedQuizzesArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				nestedQuizIds,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = reorderNestedQuizzes({
				config: rawQuizConfig,
				nestedQuizIds,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryReorderNestedQuizzes",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to reorder nested quizzes", { cause: error }),
	);
}

/**
 * Update container quiz settings
 */
export interface UpdateContainerSettingsArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	settings: Partial<Pick<ContainerQuizConfig, "sequentialOrder">>;
}

export function tryUpdateContainerSettings(args: UpdateContainerSettingsArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				settings,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updateContainerSettings({
				config: rawQuizConfig,
				settings,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdateContainerSettings",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update container settings", { cause: error }),
	);
}

/**
 * Update quiz info (title)
 */
export interface UpdateQuizInfoArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	updates: Partial<Pick<LatestQuizConfig, "title">>;
}

export function tryUpdateQuizInfo(args: UpdateQuizInfoArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				updates,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updateQuizInfo({
				config: rawQuizConfig,
				updates,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdateQuizInfo",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update quiz info", { cause: error }),
	);
}

/**
 * Update page info (title)
 */
export interface UpdatePageInfoArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	pageId: string;
	updates: Partial<Pick<QuizPage, "title">>;
	nestedQuizId?: string;
}

export function tryUpdatePageInfo(args: UpdatePageInfoArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				pageId,
				updates,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updatePageInfo({
				config: rawQuizConfig,
				pageId,
				updates,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdatePageInfo",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update page info", { cause: error }),
	);
}

/**
 * Reorder pages
 */
export interface ReorderPagesArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	pageIds: string[];
	nestedQuizId?: string;
}

export function tryReorderPages(args: ReorderPagesArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				pageIds,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = reorderPages({
				config: rawQuizConfig,
				pageIds,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryReorderPages",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to reorder pages", { cause: error }),
	);
}

/**
 * Move a question to a different page
 */
export interface MoveQuestionToPageArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	questionId: string;
	targetPageId: string;
	position?: number;
	nestedQuizId?: string;
}

export function tryMoveQuestionToPage(args: MoveQuestionToPageArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				questionId,
				targetPageId,
				position,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = moveQuestionToPage({
				config: rawQuizConfig,
				questionId,
				targetPageId,
				position,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryMoveQuestionToPage",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to move question to page", { cause: error }),
	);
}

/**
 * Update question scoring
 */
export interface UpdateQuestionScoringArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	questionId: string;
	scoring: Question["scoring"];
	nestedQuizId?: string;
}

export function tryUpdateQuestionScoring(args: UpdateQuestionScoringArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				activityModuleId,
				req,
				overrideAccess = false,
				questionId,
				scoring,
				nestedQuizId,
			} = args;

			const { rawQuizConfig, quizId } = await getQuizModuleAndId(
				payload,
				activityModuleId,
				req,
				overrideAccess,
			);

			const updatedConfig = updateQuestionScoring({
				config: rawQuizConfig,
				questionId,
				scoring,
				nestedQuizId,
			});

			return updateQuizConfigAndReturn(
				payload,
				quizId,
				updatedConfig,
				req,
				overrideAccess,
				"tryUpdateQuestionScoring",
			);
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update question scoring", { cause: error }),
	);
}
