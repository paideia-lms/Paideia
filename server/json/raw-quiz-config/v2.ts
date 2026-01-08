import type { Simplify } from "type-fest";

// Quiz Resource - HTML rich text that can persist across multiple pages
export interface QuizResource {
	id: string;
	title?: string;
	content: string; // HTML rich text (sanitized)
	pages: string[]; // Array of page IDs where this resource is visible
}

// Quiz Question Types
export type QuestionType =
	| "multiple-choice"
	| "short-answer"
	| "long-answer"
	| "article"
	| "fill-in-the-blank"
	| "choice"
	| "ranking"
	| "single-selection-matrix"
	| "multiple-selection-matrix"
	| "whiteboard";

// ============================================================================
// SCORING CONFIGURATIONS
// ============================================================================

/**
 * Simple scoring: All or nothing
 * Used for: Multiple Choice, Short Answer (exact match)
 */
export interface SimpleScoring {
	type: "simple";
	points: number; // Points for correct answer
}

/**
 * Weighted scoring for multiple selection questions
 * Used for: Choice (checkboxes), Fill-in-the-blank
 */
export type WeightedScoring =
	| {
			type: "weighted";
			mode: "all-or-nothing";
			maxPoints: number;
	  }
	| {
			type: "weighted";
			mode: "partial-with-penalty";
			maxPoints: number;
			pointsPerCorrect: number; // Points per correct selection
			penaltyPerIncorrect: number; // Points deducted per incorrect selection
	  }
	| {
			type: "weighted";
			mode: "partial-no-penalty";
			maxPoints: number;
			pointsPerCorrect: number; // Points per correct selection
	  };

/**
 * Rubric-based scoring
 * Used for: Article, Long Answer, Whiteboard
 */
export interface RubricScoring {
	type: "rubric";
	rubricId: number; // Reference to PaideiaRubricDefinition
	maxPoints: number; // Maximum possible points from rubric
}

/**
 * Manual scoring - instructor assigns points
 * Used for: Any subjective question
 */
export interface ManualScoring {
	type: "manual";
	maxPoints: number;
}

/**
 * Partial match scoring for text-based answers
 * Used for: Short Answer, Fill-in-the-blank
 */
export interface PartialMatchScoring {
	type: "partial-match";
	maxPoints: number;
	caseSensitive: boolean;
	matchThreshold: number; // 0-1, similarity threshold for partial credit
}

/**
 * Ranking scoring - points based on order correctness
 * Used for: Ranking questions
 */
export type RankingScoring =
	| {
			type: "ranking";
			mode: "exact-order";
			maxPoints: number;
	  }
	| {
			type: "ranking";
			mode: "partial-order";
			maxPoints: number;
			pointsPerCorrectPosition: number;
	  };

/**
 * Matrix scoring - points per row
 * Used for: Single/Multiple Selection Matrix
 */
export interface MatrixScoring {
	type: "matrix";
	maxPoints: number;
	pointsPerRow: number;
	mode: "all-or-nothing" | "partial"; // per row
}

/**
 * Union type for all scoring configurations
 */
export type ScoringConfig =
	| SimpleScoring
	| WeightedScoring
	| RubricScoring
	| ManualScoring
	| PartialMatchScoring
	| RankingScoring
	| MatrixScoring;

// ============================================================================
// QUESTION INTERFACES
// ============================================================================

// Base question interface with common fields
export interface BaseQuestion {
	id: string;
	type: QuestionType;
	prompt: string;
	feedback?: string; // Feedback to show after answering
	scoring?: ScoringConfig; // Scoring configuration (defaults based on question type if not provided)
}

// Multiple Choice Question (radio buttons)
export interface MultipleChoiceQuestion extends BaseQuestion {
	type: "multiple-choice";
	options: Record<string, string>; // key -> label (e.g., { a: "Option A", b: "Option B" })
	correctAnswer?: string; // The key of the correct option
}

// Short Answer Question (single line text input)
export interface ShortAnswerQuestion extends BaseQuestion {
	type: "short-answer";
	correctAnswer?: string;
}

// Long Answer Question (textarea)
export interface LongAnswerQuestion extends BaseQuestion {
	type: "long-answer";
	correctAnswer?: string;
}

// Article Question (rich text editor)
export interface ArticleQuestion extends BaseQuestion {
	type: "article";
	// No correct answer for article type
}

// Fill in the Blank Question
export interface FillInTheBlankQuestion extends BaseQuestion {
	type: "fill-in-the-blank";
	// Prompt contains {{blank_id}} markers for blanks
	// Each unique ID creates one answer field. Multiple {{blank_id}} with the same ID share the same answer.
	// e.g., "The capital of France is {{capital}} and the largest city is {{capital}}." (same answer: { capital: "Paris" })
	// e.g., "{{country}} has {{capital}} as its capital." (different answers: { country: "France", capital: "Paris" })
	correctAnswers?: Record<string, string>; // Map of blank ID to correct answer
}

// Choice Question (checkboxes - multiple selection)
export interface ChoiceQuestion extends BaseQuestion {
	type: "choice";
	options: Record<string, string>; // key -> label
	correctAnswers?: string[]; // Array of correct option keys
}

// Ranking Question (drag and drop to order items)
export interface RankingQuestion extends BaseQuestion {
	type: "ranking";
	items: Record<string, string>; // key -> label
	correctOrder?: string[]; // Array of keys in correct order
}

// Single Selection Matrix (2D grid with radio buttons)
export interface SingleSelectionMatrixQuestion extends BaseQuestion {
	type: "single-selection-matrix";
	rows: Record<string, string>; // row key -> row label
	columns: Record<string, string>; // column key -> column label
	correctAnswers?: Record<string, string>; // Map of row key to selected column key
}

// Multiple Selection Matrix (2D grid with select dropdowns)
export interface MultipleSelectionMatrixQuestion extends BaseQuestion {
	type: "multiple-selection-matrix";
	rows: Record<string, string>; // row key -> row label
	columns: Record<string, string>; // column key -> column label
	correctAnswers?: Record<string, string>; // Map of row key to selected column key
}

// Whiteboard Question (Excalidraw drawing canvas)
export interface WhiteboardQuestion extends BaseQuestion {
	type: "whiteboard";
	// Stores the Excalidraw JSON data
}

// Union type of all question types
export type Question =
	| MultipleChoiceQuestion
	| ShortAnswerQuestion
	| LongAnswerQuestion
	| ArticleQuestion
	| FillInTheBlankQuestion
	| ChoiceQuestion
	| RankingQuestion
	| SingleSelectionMatrixQuestion
	| MultipleSelectionMatrixQuestion
	| WhiteboardQuestion;

// Quiz Page
export interface QuizPage {
	id: string;
	title: string;
	questions: Question[];
}

// Grading configuration
export interface GradingConfig {
	enabled: boolean; // Whether grading is enabled
	passingScore?: number; // Minimum score to pass (percentage 0-100)
	showScoreToStudent?: boolean; // Show score immediately after submission
	showCorrectAnswers?: boolean; // Show correct answers after submission
}

// Nested Quiz Configuration (always has pages, never more nesting)
export interface NestedQuizConfig {
	id: string;
	title: string;
	description?: string;
	pages: QuizPage[];
	resources?: QuizResource[]; // Optional resources (HTML rich text)
	globalTimer?: number; // Timer in seconds for the nested quiz
	// grading?: GradingConfig; // Grading configuration for this nested quiz
}

// Regular Quiz Configuration - has pages directly
export interface RegularQuizConfig {
	version: "v2";
	type: "regular";
	id: string;
	title: string;
	pages: QuizPage[];
	resources?: QuizResource[]; // Optional resources (HTML rich text)
	globalTimer?: number; // Timer in seconds for the entire quiz
	grading?: GradingConfig; // Grading configuration for the quiz
}

// Container Quiz Configuration - contains nested quizzes
export interface ContainerQuizConfig {
	version: "v2";
	type: "container";
	id: string;
	title: string;
	nestedQuizzes: NestedQuizConfig[];
	sequentialOrder?: boolean; // If true, nested quizzes must be completed in order
	globalTimer?: number; // Timer in seconds for the entire quiz (parent timer)
	grading?: GradingConfig; // Grading configuration for the quiz
}

// Quiz Configuration - discriminated union of regular and container quizzes
export type QuizConfig = Simplify<RegularQuizConfig | ContainerQuizConfig>;

// Answer types for each question type
export type QuestionAnswer =
	| string // multiple-choice, short-answer, long-answer, article
	| string[] // choice, ranking
	| Record<string, string>; // fill-in-the-blank, single-selection-matrix, multiple-selection-matrix

// Quiz Answers
export type QuizAnswers = Record<string, QuestionAnswer>;

// Type guard: Check if a quiz is a container quiz with nested quizzes
export function isContainerQuiz(
	config: QuizConfig,
): config is ContainerQuizConfig {
	return config.type === "container";
}

// Type guard: Check if a quiz is a regular quiz with pages
export function isRegularQuiz(config: QuizConfig): config is RegularQuizConfig {
	return config.type === "regular";
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the maximum points for a question based on its scoring configuration
 */
export function getQuestionPoints(question: Question): number {
	if (!question.scoring) {
		return 1; // Default
	}

	switch (question.scoring.type) {
		case "simple":
			return question.scoring.points;
		case "weighted":
		case "rubric":
		case "manual":
		case "partial-match":
		case "ranking":
		case "matrix":
			return question.scoring.maxPoints;
		default:
			return 1;
	}
}

/**
 * Get a human-readable description of the scoring logic
 */
export function getScoringDescription(scoring?: ScoringConfig): string {
	if (!scoring) {
		return "1 point";
	}

	switch (scoring.type) {
		case "simple":
			return `${scoring.points} ${scoring.points === 1 ? "point" : "points"}`;

		case "weighted":
			if (scoring.mode === "all-or-nothing") {
				return `${scoring.maxPoints} points (all or nothing)`;
			}
			if (scoring.mode === "partial-with-penalty") {
				return `Up to ${scoring.maxPoints} points (${scoring.pointsPerCorrect} per correct, -${scoring.penaltyPerIncorrect} per incorrect)`;
			}
			return `Up to ${scoring.maxPoints} points (${scoring.pointsPerCorrect} per correct, no penalty)`;

		case "rubric":
			return `Up to ${scoring.maxPoints} points (rubric-based)`;

		case "manual":
			return `Up to ${scoring.maxPoints} points (manual grading)`;

		case "partial-match":
			return `Up to ${scoring.maxPoints} points (${scoring.caseSensitive ? "case-sensitive" : "case-insensitive"}, ${Math.round(scoring.matchThreshold * 100)}% match threshold)`;

		case "ranking":
			if (scoring.mode === "exact-order") {
				return `${scoring.maxPoints} points (exact order required)`;
			}
			return `Up to ${scoring.maxPoints} points (${scoring.pointsPerCorrectPosition} per correct position)`;

		case "matrix":
			if (scoring.mode === "all-or-nothing") {
				return `${scoring.maxPoints} points (${scoring.pointsPerRow} per row, all or nothing)`;
			}
			return `Up to ${scoring.maxPoints} points (${scoring.pointsPerRow} per row, partial credit)`;

		default:
			return "1 point";
	}
}

/**
 * Calculate total points for a quiz
 */
export function calculateTotalPoints(
	config: QuizConfig | NestedQuizConfig,
): number {
	if ("type" in config) {
		// QuizConfig (discriminated union)
		if (config.type === "regular") {
			return config.pages.reduce((total, page) => {
				return (
					total +
					page.questions.reduce((pageTotal, question) => {
						return pageTotal + getQuestionPoints(question);
					}, 0)
				);
			}, 0);
		}
		// Container quiz - sum all nested quizzes
		if (config.type === "container") {
			return config.nestedQuizzes.reduce((total, nested) => {
				return total + calculateTotalPoints(nested);
			}, 0);
		}
	} else {
		// NestedQuizConfig
		return config.pages.reduce((total, page) => {
			return (
				total +
				page.questions.reduce((pageTotal, question) => {
					return pageTotal + getQuestionPoints(question);
				}, 0)
			);
		}, 0);
	}
	return 0;
}

/**
 * Get default scoring config for a question type
 */
export function getDefaultScoring(questionType: QuestionType): ScoringConfig {
	switch (questionType) {
		case "multiple-choice":
		case "short-answer":
			return { type: "simple", points: 1 };

		case "choice":
			return {
				type: "weighted",
				maxPoints: 1,
				mode: "all-or-nothing",
			};

		case "fill-in-the-blank":
			return {
				type: "weighted",
				maxPoints: 1,
				mode: "partial-no-penalty",
				pointsPerCorrect: 1,
			};

		case "ranking":
			return {
				type: "ranking",
				maxPoints: 1,
				mode: "exact-order",
			};

		case "single-selection-matrix":
		case "multiple-selection-matrix":
			return {
				type: "matrix",
				maxPoints: 1,
				pointsPerRow: 1,
				mode: "partial",
			};

		case "long-answer":
		case "article":
		case "whiteboard":
			return { type: "manual", maxPoints: 1 };

		default:
			return { type: "simple", points: 1 };
	}
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Error thrown when quiz configuration validation fails
 */
export class QuizConfigValidationError extends Error {
	readonly name = "QuizConfigValidationError";
	constructor(message: string) {
		super(message);
	}
}

/**
 * Error thrown when a quiz element (page, question, resource, nested quiz) is not found
 */
export class QuizElementNotFoundError extends Error {
	readonly name = "QuizElementNotFoundError";
	constructor(message: string) {
		super(message);
	}
}

// ============================================================================
// UTILITY FUNCTIONS FOR QUIZ CONFIG MANIPULATION
// ============================================================================

/**
 * Toggle quiz type between "regular" and "container"
 * - Converting to container: wraps pages into a single nested quiz
 * - Converting to regular: flattens all nested quizzes into pages
 * - Preserves: id, title, globalTimer, grading
 * - Resources: container type cannot have resources at root level
 */
export interface ToggleQuizTypeArgs {
	config: QuizConfig;
	newType: "regular" | "container";
}

export function toggleQuizType({
	config,
	newType,
}: ToggleQuizTypeArgs): QuizConfig {
	if (config.type === newType) {
		return config; // No change needed
	}

	if (newType === "container") {
		// Convert regular to container
		if (config.type !== "regular") {
			throw new QuizConfigValidationError(
				"Can only convert regular quiz to container",
			);
		}

		return {
			version: "v2",
			type: "container",
			id: config.id,
			title: config.title,
			nestedQuizzes: [
				{
					id: `nested-${Date.now()}`,
					title: "Quiz Section 1",
					pages: config.pages,
					resources: config.resources,
					globalTimer: undefined,
				},
			],
			sequentialOrder: false,
			globalTimer: config.globalTimer,
			grading: config.grading,
		};
	}

	// Convert container to regular
	if (config.type !== "container") {
		throw new QuizConfigValidationError(
			"Can only convert container quiz to regular",
		);
	}

	// Flatten all nested quizzes into pages
	const allPages: QuizPage[] = [];
	for (const nested of config.nestedQuizzes) {
		allPages.push(...nested.pages);
	}

	return {
		version: "v2",
		type: "regular",
		id: config.id,
		title: config.title,
		pages: allPages,
		resources: undefined, // Container doesn't have root-level resources
		globalTimer: config.globalTimer,
		grading: config.grading,
	};
}

/**
 * Update global timer for a quiz
 * - Validation: seconds must be >= 0
 * - For container quiz: globalTimer must be >= sum of all nested quiz timers (if they exist)
 */
export interface UpdateGlobalTimerArgs {
	config: QuizConfig;
	seconds: number | undefined;
}

export function updateGlobalTimer({
	config,
	seconds,
}: UpdateGlobalTimerArgs): QuizConfig {
	// Validate seconds
	if (seconds !== undefined && seconds < 0) {
		throw new QuizConfigValidationError(
			"Global timer must be greater than or equal to 0",
		);
	}

	// For container quiz, validate against nested timers
	if (config.type === "container" && seconds !== undefined) {
		const sumOfNestedTimers = config.nestedQuizzes.reduce((sum, nested) => {
			return sum + (nested.globalTimer ?? 0);
		}, 0);

		if (sumOfNestedTimers > 0 && seconds < sumOfNestedTimers) {
			throw new QuizConfigValidationError(
				`Global timer (${seconds}s) must be greater than or equal to the sum of nested quiz timers (${sumOfNestedTimers}s)`,
			);
		}
	}

	return {
		...config,
		globalTimer: seconds,
	};
}

/**
 * Update nested quiz timer
 * - Only applicable for container quizzes
 * - Validation: seconds must be >= 0
 * - Validation: sum of all nested timers must be <= parent global timer (if parent timer exists)
 */
export interface UpdateNestedQuizTimerArgs {
	config: QuizConfig;
	nestedQuizId: string;
	seconds: number | undefined;
}

export function updateNestedQuizTimer({
	config,
	nestedQuizId,
	seconds,
}: UpdateNestedQuizTimerArgs): QuizConfig {
	if (config.type !== "container") {
		throw new QuizConfigValidationError(
			"updateNestedQuizTimer can only be called on container quizzes",
		);
	}

	// Validate seconds
	if (seconds !== undefined && seconds < 0) {
		throw new QuizConfigValidationError(
			"Nested quiz timer must be greater than or equal to 0",
		);
	}

	// Find the nested quiz
	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	// Create updated nested quizzes array
	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...updatedNestedQuizzes[nestedIndex]!,
		globalTimer: seconds,
	};

	// Validate against parent timer if it exists
	if (config.globalTimer !== undefined && config.globalTimer > 0) {
		const sumOfNestedTimers = updatedNestedQuizzes.reduce((sum, nested) => {
			return sum + (nested.globalTimer ?? 0);
		}, 0);

		if (sumOfNestedTimers > config.globalTimer) {
			throw new QuizConfigValidationError(
				`Sum of nested quiz timers (${sumOfNestedTimers}s) must be less than or equal to parent global timer (${config.globalTimer}s)`,
			);
		}
	}

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Update grading configuration
 * - Validates passingScore is between 0-100 if provided
 * - Works for both regular and container quizzes
 */
export interface UpdateGradingConfigArgs {
	config: QuizConfig;
	gradingConfig: Partial<GradingConfig>;
}

export function updateGradingConfig({
	config,
	gradingConfig,
}: UpdateGradingConfigArgs): QuizConfig {
	// Validate passing score if provided
	if (
		gradingConfig.passingScore !== undefined &&
		(gradingConfig.passingScore < 0 || gradingConfig.passingScore > 100)
	) {
		throw new QuizConfigValidationError(
			"Passing score must be between 0 and 100",
		);
	}

	// Merge with existing grading config
	const updatedGrading: GradingConfig = {
		...config.grading,
		...gradingConfig,
		enabled: gradingConfig.enabled ?? config.grading?.enabled ?? false,
	};

	return {
		...config,
		grading: updatedGrading,
	};
}

/**
 * Add a quiz resource
 * - For regular quiz: adds to root resources
 * - For container quiz root: throws error (resources only allowed in nested quizzes)
 * - For nested quiz: provide nestedQuizId
 * - Validates that resource.pages references valid page IDs
 */
export interface AddQuizResourceArgs {
	config: QuizConfig;
	resource: QuizResource;
	nestedQuizId?: string;
}

export function addQuizResource({
	config,
	resource,
	nestedQuizId,
}: AddQuizResourceArgs): QuizConfig {
	if (config.type === "container" && !nestedQuizId) {
		throw new QuizConfigValidationError(
			"Cannot add resources to container quiz root. Resources must be added to nested quizzes.",
		);
	}

	if (config.type === "regular") {
		// Validate page IDs
		const validPageIds = new Set(config.pages.map((p) => p.id));
		const invalidPageIds = resource.pages.filter(
			(pid) => !validPageIds.has(pid),
		);
		if (invalidPageIds.length > 0) {
			throw new QuizConfigValidationError(
				`Invalid page IDs in resource: ${invalidPageIds.join(", ")}`,
			);
		}

		return {
			...config,
			resources: [...(config.resources ?? []), resource],
		};
	}

	// Container quiz - add to nested quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;

	// Validate page IDs
	const validPageIds = new Set(nestedQuiz.pages.map((p) => p.id));
	const invalidPageIds = resource.pages.filter((pid) => !validPageIds.has(pid));
	if (invalidPageIds.length > 0) {
		throw new QuizConfigValidationError(
			`Invalid page IDs in resource: ${invalidPageIds.join(", ")}`,
		);
	}

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		resources: [...(nestedQuiz.resources ?? []), resource],
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Remove a quiz resource by ID
 * - For nested quiz: provide nestedQuizId
 * - Returns config unchanged if resourceId not found
 */
export interface RemoveQuizResourceArgs {
	config: QuizConfig;
	resourceId: string;
	nestedQuizId?: string;
}

export function removeQuizResource({
	config,
	resourceId,
	nestedQuizId,
}: RemoveQuizResourceArgs): QuizConfig {
	if (config.type === "regular") {
		const resources = config.resources ?? [];
		const filtered = resources.filter((r) => r.id !== resourceId);

		// No change if resource not found
		if (filtered.length === resources.length) {
			return config;
		}

		return {
			...config,
			resources: filtered,
		};
	}

	// Container quiz - remove from nested quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;
	const resources = nestedQuiz.resources ?? [];
	const filtered = resources.filter((r) => r.id !== resourceId);

	// No change if resource not found
	if (filtered.length === resources.length) {
		return config;
	}

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		resources: filtered,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Update a quiz resource
 * - For nested quiz: provide nestedQuizId
 * - Validates page IDs if pages array is updated
 * - Throws error if resource not found
 */
export interface UpdateQuizResourceArgs {
	config: QuizConfig;
	resourceId: string;
	updates: Partial<Omit<QuizResource, "id">>;
	nestedQuizId?: string;
}

export function updateQuizResource({
	config,
	resourceId,
	updates,
	nestedQuizId,
}: UpdateQuizResourceArgs): QuizConfig {
	if (config.type === "regular") {
		const resources = config.resources ?? [];
		const resourceIndex = resources.findIndex((r) => r.id === resourceId);

		if (resourceIndex === -1) {
			throw new QuizElementNotFoundError(
				`Resource with id '${resourceId}' not found`,
			);
		}

		const updatedResource = {
			...resources[resourceIndex]!,
			...updates,
		};

		// Validate page IDs if pages are updated
		if (updates.pages) {
			const validPageIds = new Set(config.pages.map((p) => p.id));
			const invalidPageIds = updates.pages.filter(
				(pid) => !validPageIds.has(pid),
			);
			if (invalidPageIds.length > 0) {
				throw new QuizConfigValidationError(
					`Invalid page IDs in resource: ${invalidPageIds.join(", ")}`,
				);
			}
		}

		const updatedResources = [...resources];
		updatedResources[resourceIndex] = updatedResource;

		return {
			...config,
			resources: updatedResources,
		};
	}

	// Container quiz - update in nested quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;
	const resources = nestedQuiz.resources ?? [];
	const resourceIndex = resources.findIndex((r) => r.id === resourceId);

	if (resourceIndex === -1) {
		throw new QuizElementNotFoundError(
			`Resource with id '${resourceId}' not found`,
		);
	}

	const updatedResource = {
		...resources[resourceIndex]!,
		...updates,
	};

	// Validate page IDs if pages are updated
	if (updates.pages) {
		const validPageIds = new Set(nestedQuiz.pages.map((p) => p.id));
		const invalidPageIds = updates.pages.filter(
			(pid) => !validPageIds.has(pid),
		);
		if (invalidPageIds.length > 0) {
			throw new QuizConfigValidationError(
				`Invalid page IDs in resource: ${invalidPageIds.join(", ")}`,
			);
		}
	}

	const updatedResources = [...resources];
	updatedResources[resourceIndex] = updatedResource;

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		resources: updatedResources,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Add a question to a specific page
 * - For nested quiz: provide nestedQuizId
 * - Adds to end of page if position not provided
 * - Generates default ID if question.id not provided
 * - Throws error if page not found
 */
export interface AddQuestionArgs {
	config: QuizConfig;
	pageId: string;
	question: Question;
	position?: number;
	nestedQuizId?: string;
}

export function addQuestion({
	config,
	pageId,
	question,
	position,
	nestedQuizId,
}: AddQuestionArgs): QuizConfig {
	// Generate ID if not provided
	const questionWithId: Question = question.id
		? question
		: { ...question, id: `question-${Date.now()}` };

	if (config.type === "regular") {
		const pageIndex = config.pages.findIndex((p) => p.id === pageId);
		if (pageIndex === -1) {
			throw new QuizElementNotFoundError(`Page with id '${pageId}' not found`);
		}

		const page = config.pages[pageIndex]!;
		const questions = [...page.questions];

		// Insert at position or end
		if (
			position !== undefined &&
			position >= 0 &&
			position <= questions.length
		) {
			questions.splice(position, 0, questionWithId);
		} else {
			questions.push(questionWithId);
		}

		const updatedPages = [...config.pages];
		updatedPages[pageIndex] = {
			...page,
			questions,
		};

		return {
			...config,
			pages: updatedPages,
		};
	}

	// Container quiz - add to nested quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;
	const pageIndex = nestedQuiz.pages.findIndex((p) => p.id === pageId);
	if (pageIndex === -1) {
		throw new QuizElementNotFoundError(`Page with id '${pageId}' not found`);
	}

	const page = nestedQuiz.pages[pageIndex]!;
	const questions = [...page.questions];

	// Insert at position or end
	if (position !== undefined && position >= 0 && position <= questions.length) {
		questions.splice(position, 0, questionWithId);
	} else {
		questions.push(questionWithId);
	}

	const updatedPages = [...nestedQuiz.pages];
	updatedPages[pageIndex] = {
		...page,
		questions,
	};

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		pages: updatedPages,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Remove a question by ID from any page
 * - For nested quiz: provide nestedQuizId
 * - Returns config unchanged if questionId not found
 */
export interface RemoveQuestionArgs {
	config: QuizConfig;
	questionId: string;
	nestedQuizId?: string;
}

export function removeQuestion({
	config,
	questionId,
	nestedQuizId,
}: RemoveQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const filtered = page.questions.filter((q) => q.id !== questionId);
			if (filtered.length !== page.questions.length) {
				found = true;
			}
			return {
				...page,
				questions: filtered,
			};
		});

		// No change if question not found
		if (!found) {
			return config;
		}

		return {
			...config,
			pages: updatedPages,
		};
	}

	// Container quiz - remove from nested quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;
	let found = false;
	const updatedPages = nestedQuiz.pages.map((page) => {
		const filtered = page.questions.filter((q) => q.id !== questionId);
		if (filtered.length !== page.questions.length) {
			found = true;
		}
		return {
			...page,
			questions: filtered,
		};
	});

	// No change if question not found
	if (!found) {
		return config;
	}

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		pages: updatedPages,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Update a question by ID
 * - For nested quiz: provide nestedQuizId
 * - Deep merges updates with existing question
 * - Throws error if question not found
 */
export interface UpdateQuestionArgs {
	config: QuizConfig;
	questionId: string;
	updates: Partial<Question>;
	nestedQuizId?: string;
}

export function updateQuestion({
	config,
	questionId,
	updates,
	nestedQuizId,
}: UpdateQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					found = true;
					return { ...q, ...updates, id: q.id } as Question; // Preserve original ID
				}
				return q;
			});
			return {
				...page,
				questions,
			};
		});

		if (!found) {
			throw new QuizElementNotFoundError(
				`Question with id '${questionId}' not found`,
			);
		}

		return {
			...config,
			pages: updatedPages,
		};
	}

	// Container quiz - update in nested quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;
	let found = false;
	const updatedPages = nestedQuiz.pages.map((page) => {
		const questions = page.questions.map((q) => {
			if (q.id === questionId) {
				found = true;
				return { ...q, ...updates, id: q.id } as Question; // Preserve original ID
			}
			return q;
		});
		return {
			...page,
			questions,
		};
	});

	if (!found) {
		throw new QuizElementNotFoundError(
			`Question with id '${questionId}' not found`,
		);
	}

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		pages: updatedPages,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Add a new page
 * - For nested quiz: provide nestedQuizId
 * - Adds to end if position not provided
 * - Generates default ID and title if not provided
 */
export interface AddPageArgs {
	config: QuizConfig;
	page: Partial<QuizPage> & { questions?: Question[] };
	position?: number;
	nestedQuizId?: string;
}

export function addPage({
	config,
	page,
	position,
	nestedQuizId,
}: AddPageArgs): QuizConfig {
	// Generate ID and title if not provided
	const newPage: QuizPage = {
		id: page.id ?? `page-${Date.now()}`,
		title: page.title ?? "New Page",
		questions: page.questions ?? [],
	};

	if (config.type === "regular") {
		const pages = [...config.pages];

		// Insert at position or end
		if (position !== undefined && position >= 0 && position <= pages.length) {
			pages.splice(position, 0, newPage);
		} else {
			pages.push(newPage);
		}

		return {
			...config,
			pages,
		};
	}

	// Container quiz - add to nested quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;
	const pages = [...nestedQuiz.pages];

	// Insert at position or end
	if (position !== undefined && position >= 0 && position <= pages.length) {
		pages.splice(position, 0, newPage);
	} else {
		pages.push(newPage);
	}

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		pages,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Remove a page by ID
 * - For nested quiz: provide nestedQuizId
 * - Moves questions to previous page if not the first page
 * - Throws error if trying to remove the last remaining page
 */
export interface RemovePageArgs {
	config: QuizConfig;
	pageId: string;
	nestedQuizId?: string;
}

export function removePage({
	config,
	pageId,
	nestedQuizId,
}: RemovePageArgs): QuizConfig {
	if (config.type === "regular") {
		if (config.pages.length <= 1) {
			throw new QuizConfigValidationError(
				"Cannot remove the last remaining page",
			);
		}

		const pageIndex = config.pages.findIndex((p) => p.id === pageId);
		if (pageIndex === -1) {
			throw new QuizElementNotFoundError(`Page with id '${pageId}' not found`);
		}

		const page = config.pages[pageIndex]!;
		const pages = [...config.pages];

		// Move questions to previous page if not the first page
		if (pageIndex > 0) {
			const previousPage = pages[pageIndex - 1]!;
			pages[pageIndex - 1] = {
				...previousPage,
				questions: [...previousPage.questions, ...page.questions],
			};
		}

		// Remove the page
		pages.splice(pageIndex, 1);

		return {
			...config,
			pages,
		};
	}

	// Container quiz - remove from nested quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;

	if (nestedQuiz.pages.length <= 1) {
		throw new QuizConfigValidationError(
			"Cannot remove the last remaining page",
		);
	}

	const pageIndex = nestedQuiz.pages.findIndex((p) => p.id === pageId);
	if (pageIndex === -1) {
		throw new QuizElementNotFoundError(`Page with id '${pageId}' not found`);
	}

	const page = nestedQuiz.pages[pageIndex]!;
	const pages = [...nestedQuiz.pages];

	// Move questions to previous page if not the first page
	if (pageIndex > 0) {
		const previousPage = pages[pageIndex - 1]!;
		pages[pageIndex - 1] = {
			...previousPage,
			questions: [...previousPage.questions, ...page.questions],
		};
	}

	// Remove the page
	pages.splice(pageIndex, 1);

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		pages,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

// ============================================================================
// ADDITIONAL CONSOLIDATED UTILITY FUNCTIONS
// ============================================================================

/**
 * Add a new nested quiz to a container quiz
 */
export interface AddNestedQuizArgs {
	config: QuizConfig;
	nestedQuiz: Partial<NestedQuizConfig> & { id: string };
	position?: number;
}

export function addNestedQuiz({
	config,
	nestedQuiz,
	position,
}: AddNestedQuizArgs): QuizConfig {
	if (config.type !== "container") {
		throw new QuizConfigValidationError(
			"addNestedQuiz can only be called on container quizzes",
		);
	}

	const newNestedQuiz: NestedQuizConfig = {
		title: nestedQuiz.title ?? "New Quiz",
		description: nestedQuiz.description,
		globalTimer: nestedQuiz.globalTimer,
		pages: nestedQuiz.pages ?? [],
		resources: nestedQuiz.resources,
		id: nestedQuiz.id,
	};

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	if (
		position !== undefined &&
		position >= 0 &&
		position <= updatedNestedQuizzes.length
	) {
		updatedNestedQuizzes.splice(position, 0, newNestedQuiz);
	} else {
		updatedNestedQuizzes.push(newNestedQuiz);
	}

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Remove a nested quiz from a container quiz
 * Cannot remove if it's the last nested quiz
 */
export interface RemoveNestedQuizArgs {
	config: QuizConfig;
	nestedQuizId: string;
}

export function removeNestedQuiz({
	config,
	nestedQuizId,
}: RemoveNestedQuizArgs): QuizConfig {
	if (config.type !== "container") {
		throw new QuizConfigValidationError(
			"removeNestedQuiz can only be called on container quizzes",
		);
	}

	if (config.nestedQuizzes.length <= 1) {
		throw new QuizConfigValidationError(
			"Cannot remove the last nested quiz. Container must have at least one nested quiz.",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	return {
		...config,
		nestedQuizzes: config.nestedQuizzes.filter((nq) => nq.id !== nestedQuizId),
	};
}

/**
 * Update nested quiz metadata (title, description, etc.)
 */
export interface UpdateNestedQuizInfoArgs {
	config: QuizConfig;
	nestedQuizId: string;
	updates: Partial<Pick<NestedQuizConfig, "title" | "description">>;
}

export function updateNestedQuizInfo({
	config,
	nestedQuizId,
	updates,
}: UpdateNestedQuizInfoArgs): QuizConfig {
	if (config.type !== "container") {
		throw new QuizConfigValidationError(
			"updateNestedQuizInfo can only be called on container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...updatedNestedQuizzes[nestedIndex]!,
		...updates,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Reorder nested quizzes in a container
 */
export interface ReorderNestedQuizzesArgs {
	config: QuizConfig;
	nestedQuizIds: string[];
}

export function reorderNestedQuizzes({
	config,
	nestedQuizIds,
}: ReorderNestedQuizzesArgs): QuizConfig {
	if (config.type !== "container") {
		throw new QuizConfigValidationError(
			"reorderNestedQuizzes can only be called on container quizzes",
		);
	}

	// Validate that all IDs exist and match
	if (nestedQuizIds.length !== config.nestedQuizzes.length) {
		throw new QuizConfigValidationError(
			"nestedQuizIds must contain all nested quiz IDs",
		);
	}

	const quizMap = new Map(config.nestedQuizzes.map((nq) => [nq.id, nq]));
	const reorderedQuizzes: NestedQuizConfig[] = [];

	for (const id of nestedQuizIds) {
		const quiz = quizMap.get(id);
		if (!quiz) {
			throw new QuizElementNotFoundError(
				`Nested quiz with id '${id}' not found`,
			);
		}
		reorderedQuizzes.push(quiz);
	}

	return {
		...config,
		nestedQuizzes: reorderedQuizzes,
	};
}

/**
 * Update container quiz settings (sequentialOrder, etc.)
 */
export interface UpdateContainerSettingsArgs {
	config: QuizConfig;
	settings: Partial<Pick<ContainerQuizConfig, "sequentialOrder">>;
}

export function updateContainerSettings({
	config,
	settings,
}: UpdateContainerSettingsArgs): QuizConfig {
	if (config.type !== "container") {
		throw new QuizConfigValidationError(
			"updateContainerSettings can only be called on container quizzes",
		);
	}

	return {
		...config,
		...settings,
	};
}

/**
 * Update quiz top-level metadata (title)
 */
export interface UpdateQuizInfoArgs {
	config: QuizConfig;
	updates: Partial<Pick<QuizConfig, "title">>;
}

export function updateQuizInfo({
	config,
	updates,
}: UpdateQuizInfoArgs): QuizConfig {
	return {
		...config,
		...updates,
	};
}

/**
 * Update page metadata (title)
 */
export interface UpdatePageInfoArgs {
	config: QuizConfig;
	pageId: string;
	updates: Partial<Pick<QuizPage, "title">>;
	nestedQuizId?: string;
}

export function updatePageInfo({
	config,
	pageId,
	updates,
	nestedQuizId,
}: UpdatePageInfoArgs): QuizConfig {
	if (config.type === "regular") {
		const pageIndex = config.pages.findIndex((p) => p.id === pageId);
		if (pageIndex === -1) {
			throw new QuizElementNotFoundError(`Page with id '${pageId}' not found`);
		}

		const updatedPages = [...config.pages];
		updatedPages[pageIndex] = {
			...updatedPages[pageIndex]!,
			...updates,
		};

		return {
			...config,
			pages: updatedPages,
		};
	}

	// Container quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;
	const pageIndex = nestedQuiz.pages.findIndex((p) => p.id === pageId);
	if (pageIndex === -1) {
		throw new QuizElementNotFoundError(`Page with id '${pageId}' not found`);
	}

	const updatedPages = [...nestedQuiz.pages];
	updatedPages[pageIndex] = {
		...updatedPages[pageIndex]!,
		...updates,
	};

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		pages: updatedPages,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Reorder pages within a quiz
 */
export interface ReorderPagesArgs {
	config: QuizConfig;
	pageIds: string[];
	nestedQuizId?: string;
}

export function reorderPages({
	config,
	pageIds,
	nestedQuizId,
}: ReorderPagesArgs): QuizConfig {
	if (config.type === "regular") {
		// Validate all page IDs exist and match
		if (pageIds.length !== config.pages.length) {
			throw new QuizConfigValidationError("pageIds must contain all page IDs");
		}

		const pageMap = new Map(config.pages.map((p) => [p.id, p]));
		const reorderedPages: QuizPage[] = [];

		for (const id of pageIds) {
			const page = pageMap.get(id);
			if (!page) {
				throw new QuizElementNotFoundError(`Page with id '${id}' not found`);
			}
			reorderedPages.push(page);
		}

		return {
			...config,
			pages: reorderedPages,
		};
	}

	// Container quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = config.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = config.nestedQuizzes[nestedIndex]!;

	// Validate all page IDs exist and match
	if (pageIds.length !== nestedQuiz.pages.length) {
		throw new QuizConfigValidationError("pageIds must contain all page IDs");
	}

	const pageMap = new Map(nestedQuiz.pages.map((p) => [p.id, p]));
	const reorderedPages: QuizPage[] = [];

	for (const id of pageIds) {
		const page = pageMap.get(id);
		if (!page) {
			throw new QuizElementNotFoundError(`Page with id '${id}' not found`);
		}
		reorderedPages.push(page);
	}

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		pages: reorderedPages,
	};

	return {
		...config,
		nestedQuizzes: updatedNestedQuizzes,
	};
}

/**
 * Move a question to a different page
 */
export interface MoveQuestionToPageArgs {
	config: QuizConfig;
	questionId: string;
	targetPageId: string;
	position?: number;
	nestedQuizId?: string;
}

export function moveQuestionToPage({
	config,
	questionId,
	targetPageId,
	position,
	nestedQuizId,
}: MoveQuestionToPageArgs): QuizConfig {
	// First find the question from the original config
	let questionToMove: Question | null = null;

	if (config.type === "regular") {
		for (const page of config.pages) {
			const question = page.questions.find((q) => q.id === questionId);
			if (question) {
				questionToMove = question;
				break;
			}
		}
	} else {
		const nestedQuiz = nestedQuizId
			? config.nestedQuizzes.find((nq) => nq.id === nestedQuizId)
			: null;

		if (nestedQuiz) {
			for (const page of nestedQuiz.pages) {
				const question = page.questions.find((q) => q.id === questionId);
				if (question) {
					questionToMove = question;
					break;
				}
			}
		}
	}

	if (!questionToMove) {
		throw new QuizElementNotFoundError(
			`Question with id '${questionId}' not found`,
		);
	}

	// Remove the question
	const configAfterRemove = removeQuestion({
		config,
		questionId,
		nestedQuizId,
	});

	// Add it to the target page
	return addQuestion({
		config: configAfterRemove,
		pageId: targetPageId,
		question: questionToMove,
		position,
		nestedQuizId,
	});
}

/**
 * Update question scoring configuration
 */
export interface UpdateQuestionScoringArgs {
	config: QuizConfig;
	questionId: string;
	scoring: Question["scoring"];
	nestedQuizId?: string;
}

export function updateQuestionScoring({
	config,
	questionId,
	scoring,
	nestedQuizId,
}: UpdateQuestionScoringArgs): QuizConfig {
	return updateQuestion({
		config,
		questionId,
		updates: { scoring } as Partial<Question>,
		nestedQuizId,
	});
}

/**
 * Creates a default blank quiz configuration
 * Returns a regular quiz with a single empty page
 */
export function createDefaultQuizConfig(): RegularQuizConfig {
	return {
		version: "v2",
		type: "regular",
		id: `quiz-${Date.now()}`,
		title: "Untitled Quiz",
		pages: [
			{
				id: `page-${Date.now()}`,
				title: "Page 1",
				questions: [],
			},
		],
	};
}
