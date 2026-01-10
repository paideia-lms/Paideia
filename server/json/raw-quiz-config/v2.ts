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

// Answer types for each question type (legacy format for backward compatibility)
export type QuestionAnswer =
	| string // multiple-choice, short-answer, long-answer, article
	| string[] // choice, ranking
	| Record<string, string>; // fill-in-the-blank, single-selection-matrix, multiple-selection-matrix

// Quiz Answers (legacy format)
export type QuizAnswers = Record<string, QuestionAnswer>;

// Discriminated union type for type-safe answer handling
export type TypedQuestionAnswer =
	| { type: "multiple-choice"; value: string } // Selected option key
	| { type: "short-answer"; value: string }
	| { type: "long-answer"; value: string }
	| { type: "article"; value: string } // HTML content
	| { type: "choice"; value: string[] } // Array of selected option keys
	| { type: "ranking"; value: string[] } // Array of item keys in order
	| { type: "fill-in-the-blank"; value: Record<string, string> } // Map of blank ID to answer
	| { type: "single-selection-matrix"; value: Record<string, string> } // Map of row key to column key
	| { type: "multiple-selection-matrix"; value: Record<string, string> } // Map of row key to column key
	| { type: "whiteboard"; value: string }; // JSON string of Excalidraw data

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
	gradingConfig: {
		enabled?: boolean;
		passingScore?: number;
		showScoreToStudent?: boolean;
		showCorrectAnswers?: boolean;
	};
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
 * - Validates that pages references valid page IDs
 */
export interface AddQuizResourceArgs {
	config: QuizConfig;
	resource: {
		id: string;
		title?: string;
		content: string;
		pages: string[];
	};
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

	const quizResource: QuizResource = {
		id: resource.id,
		title: resource.title,
		content: resource.content,
		pages: resource.pages,
	};

	if (config.type === "regular") {
		// Validate page IDs
		const validPageIds = new Set(config.pages.map((p) => p.id));
		const invalidPageIds = quizResource.pages.filter(
			(pid) => !validPageIds.has(pid),
		);
		if (invalidPageIds.length > 0) {
			throw new QuizConfigValidationError(
				`Invalid page IDs in resource: ${invalidPageIds.join(", ")}`,
			);
		}

		return {
			...config,
			resources: [...(config.resources ?? []), quizResource],
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
	const invalidPageIds = quizResource.pages.filter(
		(pid) => !validPageIds.has(pid),
	);
	if (invalidPageIds.length > 0) {
		throw new QuizConfigValidationError(
			`Invalid page IDs in resource: ${invalidPageIds.join(", ")}`,
		);
	}

	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		resources: [...(nestedQuiz.resources ?? []), quizResource],
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
	updates: {
		title?: string;
		content?: string;
		pages?: string[];
	};
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
 * - Creates a blank question with default values based on questionType
 * - Throws error if page not found
 */
export interface AddQuestionArgs {
	config: QuizConfig;
	pageId: string;
	questionType: QuestionType;
	position?: number;
	nestedQuizId?: string;
}

/**
 * Create a default blank question based on question type
 */
function createDefaultQuestion(questionType: QuestionType): Question {
	const id = `question-${Date.now()}`;
	const defaultScoring = getDefaultScoring(questionType);

	switch (questionType) {
		case "multiple-choice":
			return {
				id,
				type: "multiple-choice",
				prompt: "",
				options: { a: "Option A", b: "Option B" },
				correctAnswer: "a",
				scoring: defaultScoring,
			};
		case "choice":
			return {
				id,
				type: "choice",
				prompt: "",
				options: { a: "Option A", b: "Option B" },
				correctAnswers: [],
				scoring: defaultScoring,
			};
		case "short-answer":
			return {
				id,
				type: "short-answer",
				prompt: "",
				correctAnswer: "",
				scoring: defaultScoring,
			};
		case "long-answer":
			return {
				id,
				type: "long-answer",
				prompt: "",
				correctAnswer: "",
				scoring: defaultScoring,
			};
		case "article":
			return {
				id,
				type: "article",
				prompt: "",
				scoring: defaultScoring,
			};
		case "fill-in-the-blank":
			return {
				id,
				type: "fill-in-the-blank",
				prompt: "",
				correctAnswers: {},
				scoring: defaultScoring,
			};
		case "ranking":
			return {
				id,
				type: "ranking",
				prompt: "",
				items: { a: "Item A", b: "Item B" },
				correctOrder: [],
				scoring: defaultScoring,
			};
		case "single-selection-matrix":
			return {
				id,
				type: "single-selection-matrix",
				prompt: "",
				rows: { "row-1": "Row 1" },
				columns: { "col-1": "Column 1", "col-2": "Column 2" },
				correctAnswers: {},
				scoring: defaultScoring,
			};
		case "multiple-selection-matrix":
			return {
				id,
				type: "multiple-selection-matrix",
				prompt: "",
				rows: { "row-1": "Row 1" },
				columns: { "col-1": "Column 1", "col-2": "Column 2" },
				correctAnswers: {},
				scoring: defaultScoring,
			};
		case "whiteboard":
			return {
				id,
				type: "whiteboard",
				prompt: "",
				scoring: defaultScoring,
			};
		default:
			return {
				id,
				type: "multiple-choice",
				prompt: "",
				options: { a: "Option A", b: "Option B" },
				correctAnswer: "a",
				scoring: defaultScoring,
			};
	}
}

export function addQuestion({
	config,
	pageId,
	questionType,
	position,
	nestedQuizId,
}: AddQuestionArgs): QuizConfig {
	const questionWithId = createDefaultQuestion(questionType);

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
 * - Only updates prompt and feedback (other fields updated via separate functions)
 * - Throws error if question not found
 */
export interface UpdateQuestionArgs {
	config: QuizConfig;
	questionId: string;
	updates: {
		prompt?: string;
		feedback?: string;
	};
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
					return {
						...q,
						prompt: updates.prompt ?? q.prompt,
						feedback: updates.feedback ?? q.feedback,
					};
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
				return {
					...q,
					prompt: updates.prompt ?? q.prompt,
					feedback: updates.feedback ?? q.feedback,
				};
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
 * Update multiple choice question options
 */
export interface UpdateMultipleChoiceQuestionArgs {
	config: QuizConfig;
	questionId: string;
	options: {
		options?: Record<string, string>;
		correctAnswer?: string;
	};
	nestedQuizId?: string;
}

export function updateMultipleChoiceQuestion({
	config,
	questionId,
	options,
	nestedQuizId,
}: UpdateMultipleChoiceQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					if (q.type !== "multiple-choice") {
						throw new QuizConfigValidationError(
							`Question with id '${questionId}' is not a multiple-choice question`,
						);
					}
					found = true;
					return {
						...q,
						...(options.options !== undefined && { options: options.options }),
						...(options.correctAnswer !== undefined && {
							correctAnswer: options.correctAnswer,
						}),
					};
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
				if (q.type !== "multiple-choice") {
					throw new QuizConfigValidationError(
						`Question with id '${questionId}' is not a multiple-choice question`,
					);
				}
				found = true;
				return {
					...q,
					...(options.options !== undefined && { options: options.options }),
					...(options.correctAnswer !== undefined && {
						correctAnswer: options.correctAnswer,
					}),
				};
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
 * Update choice question options
 */
export interface UpdateChoiceQuestionArgs {
	config: QuizConfig;
	questionId: string;
	options: {
		options?: Record<string, string>;
		correctAnswers?: string[];
	};
	nestedQuizId?: string;
}

export function updateChoiceQuestion({
	config,
	questionId,
	options,
	nestedQuizId,
}: UpdateChoiceQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					if (q.type !== "choice") {
						throw new QuizConfigValidationError(
							`Question with id '${questionId}' is not a choice question`,
						);
					}
					found = true;
					return {
						...q,
						...(options.options !== undefined && { options: options.options }),
						...(options.correctAnswers !== undefined && {
							correctAnswers: options.correctAnswers,
						}),
					};
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
				if (q.type !== "choice") {
					throw new QuizConfigValidationError(
						`Question with id '${questionId}' is not a choice question`,
					);
				}
				found = true;
				return {
					...q,
					...(options.options !== undefined && { options: options.options }),
					...(options.correctAnswers !== undefined && {
						correctAnswers: options.correctAnswers,
					}),
				};
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
 * Update short answer question options
 */
export interface UpdateShortAnswerQuestionArgs {
	config: QuizConfig;
	questionId: string;
	options: {
		correctAnswer?: string;
	};
	nestedQuizId?: string;
}

export function updateShortAnswerQuestion({
	config,
	questionId,
	options,
	nestedQuizId,
}: UpdateShortAnswerQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					if (q.type !== "short-answer") {
						throw new QuizConfigValidationError(
							`Question with id '${questionId}' is not a short-answer question`,
						);
					}
					found = true;
					return {
						...q,
						...(options.correctAnswer !== undefined && {
							correctAnswer: options.correctAnswer,
						}),
					};
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
				if (q.type !== "short-answer") {
					throw new QuizConfigValidationError(
						`Question with id '${questionId}' is not a short-answer question`,
					);
				}
				found = true;
				return {
					...q,
					...(options.correctAnswer !== undefined && {
						correctAnswer: options.correctAnswer,
					}),
				};
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
 * Update long answer question options
 */
export interface UpdateLongAnswerQuestionArgs {
	config: QuizConfig;
	questionId: string;
	options: {
		correctAnswer?: string;
	};
	nestedQuizId?: string;
}

export function updateLongAnswerQuestion({
	config,
	questionId,
	options,
	nestedQuizId,
}: UpdateLongAnswerQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					if (q.type !== "long-answer") {
						throw new QuizConfigValidationError(
							`Question with id '${questionId}' is not a long-answer question`,
						);
					}
					found = true;
					return {
						...q,
						...(options.correctAnswer !== undefined && {
							correctAnswer: options.correctAnswer,
						}),
					};
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
				if (q.type !== "long-answer") {
					throw new QuizConfigValidationError(
						`Question with id '${questionId}' is not a long-answer question`,
					);
				}
				found = true;
				return {
					...q,
					...(options.correctAnswer !== undefined && {
						correctAnswer: options.correctAnswer,
					}),
				};
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
 * Update fill-in-the-blank question options
 */
export interface UpdateFillInTheBlankQuestionArgs {
	config: QuizConfig;
	questionId: string;
	options: {
		correctAnswers?: Record<string, string>;
	};
	nestedQuizId?: string;
}

export function updateFillInTheBlankQuestion({
	config,
	questionId,
	options,
	nestedQuizId,
}: UpdateFillInTheBlankQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					if (q.type !== "fill-in-the-blank") {
						throw new QuizConfigValidationError(
							`Question with id '${questionId}' is not a fill-in-the-blank question`,
						);
					}
					found = true;
					return {
						...q,
						...(options.correctAnswers !== undefined && {
							correctAnswers: options.correctAnswers,
						}),
					};
				}
				return q;
			});
			return {
				...page,
				questions: questions as Question[],
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
				if (q.type !== "fill-in-the-blank") {
					throw new QuizConfigValidationError(
						`Question with id '${questionId}' is not a fill-in-the-blank question`,
					);
				}
				found = true;
				return {
					...q,
					...(options.correctAnswers !== undefined && {
						correctAnswers: options.correctAnswers,
					}),
				};
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
 * Update ranking question options
 */
export interface UpdateRankingQuestionArgs {
	config: QuizConfig;
	questionId: string;
	options: {
		items?: Record<string, string>;
		correctOrder?: string[];
	};
	nestedQuizId?: string;
}

export function updateRankingQuestion({
	config,
	questionId,
	options,
	nestedQuizId,
}: UpdateRankingQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					if (q.type !== "ranking") {
						throw new QuizConfigValidationError(
							`Question with id '${questionId}' is not a ranking question`,
						);
					}
					found = true;
					return {
						...q,
						...(options.items !== undefined && { items: options.items }),
						...(options.correctOrder !== undefined && {
							correctOrder: options.correctOrder,
						}),
					};
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
				if (q.type !== "ranking") {
					throw new QuizConfigValidationError(
						`Question with id '${questionId}' is not a ranking question`,
					);
				}
				found = true;
				return {
					...q,
					...(options.items !== undefined && { items: options.items }),
					...(options.correctOrder !== undefined && {
						correctOrder: options.correctOrder,
					}),
				};
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
 * Update single selection matrix question options
 */
export interface UpdateSingleSelectionMatrixQuestionArgs {
	config: QuizConfig;
	questionId: string;
	options: {
		rows?: Record<string, string>;
		columns?: Record<string, string>;
		correctAnswers?: Record<string, string>;
	};
	nestedQuizId?: string;
}

export function updateSingleSelectionMatrixQuestion({
	config,
	questionId,
	options,
	nestedQuizId,
}: UpdateSingleSelectionMatrixQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					if (q.type !== "single-selection-matrix") {
						throw new QuizConfigValidationError(
							`Question with id '${questionId}' is not a single-selection-matrix question`,
						);
					}
					found = true;
					return {
						...q,
						...(options.rows !== undefined && { rows: options.rows }),
						...(options.columns !== undefined && {
							columns: options.columns,
						}),
						...(options.correctAnswers !== undefined && {
							correctAnswers: options.correctAnswers,
						}),
					};
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
				if (q.type !== "single-selection-matrix") {
					throw new QuizConfigValidationError(
						`Question with id '${questionId}' is not a single-selection-matrix question`,
					);
				}
				found = true;
				return {
					...q,
					...(options.rows !== undefined && { rows: options.rows }),
					...(options.columns !== undefined && {
						columns: options.columns,
					}),
					...(options.correctAnswers !== undefined && {
						correctAnswers: options.correctAnswers,
					}),
				};
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
 * Update multiple selection matrix question options
 */
export interface UpdateMultipleSelectionMatrixQuestionArgs {
	config: QuizConfig;
	questionId: string;
	options: {
		rows?: Record<string, string>;
		columns?: Record<string, string>;
		correctAnswers?: Record<string, string[]>;
	};
	nestedQuizId?: string;
}

export function updateMultipleSelectionMatrixQuestion({
	config,
	questionId,
	options,
	nestedQuizId,
}: UpdateMultipleSelectionMatrixQuestionArgs): QuizConfig {
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					if (q.type !== "multiple-selection-matrix") {
						throw new QuizConfigValidationError(
							`Question with id '${questionId}' is not a multiple-selection-matrix question`,
						);
					}
					found = true;
					return {
						...q,
						...(options.rows !== undefined && { rows: options.rows }),
						...(options.columns !== undefined && {
							columns: options.columns,
						}),
						...(options.correctAnswers !== undefined && {
							correctAnswers: options.correctAnswers,
						}),
					};
				}
				return q;
			});
			return {
				...page,
				questions: questions as Question[],
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
				if (q.type !== "multiple-selection-matrix") {
					throw new QuizConfigValidationError(
						`Question with id '${questionId}' is not a multiple-selection-matrix question`,
					);
				}
				found = true;
				return {
					...q,
					...(options.rows !== undefined && { rows: options.rows }),
					...(options.columns !== undefined && {
						columns: options.columns,
					}),
					...(options.correctAnswers !== undefined && {
						correctAnswers: options.correctAnswers,
					}),
				};
			}
			return q;
		});
		return {
			...page,
			questions: questions as Question[],
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
 * Add a new blank page at the end
 * - For nested quiz: provide nestedQuizId
 * - Creates a blank page with default ID and title
 */
export interface AddPageArgs {
	config: QuizConfig;
	nestedQuizId?: string;
}

export function addPage({ config, nestedQuizId }: AddPageArgs): QuizConfig {
	// Generate ID and title
	const newPage: QuizPage = {
		id: `page-${Date.now()}`,
		title: "New Page",
		questions: [],
	};

	if (config.type === "regular") {
		return {
			...config,
			pages: [...config.pages, newPage],
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
	const updatedNestedQuizzes = [...config.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		pages: [...nestedQuiz.pages, newPage],
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
 * Add a new blank nested quiz to a container quiz at the end
 */
export interface AddNestedQuizArgs {
	config: QuizConfig;
}

export function addNestedQuiz({ config }: AddNestedQuizArgs): QuizConfig {
	if (config.type !== "container") {
		throw new QuizConfigValidationError(
			"addNestedQuiz can only be called on container quizzes",
		);
	}

	const newNestedQuiz: NestedQuizConfig = {
		id: `nested-${Date.now()}`,
		title: "New Quiz",
		pages: [
			{
				id: `page-${Date.now()}`,
				title: "Page 1",
				questions: [],
			},
		],
	};

	return {
		...config,
		nestedQuizzes: [...config.nestedQuizzes, newNestedQuiz],
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
	updates: {
		title?: string;
		description?: string;
	};
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
	settings: {
		sequentialOrder?: boolean;
	};
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
	updates: {
		title?: string;
	};
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
	updates: {
		title?: string;
	};
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
	// Note: moveQuestionToPage preserves the existing question, so we need to add it back manually
	// Since addQuestion now only accepts questionType, we need to manually insert the question
	if (configAfterRemove.type === "regular") {
		const pageIndex = configAfterRemove.pages.findIndex(
			(p) => p.id === targetPageId,
		);
		if (pageIndex === -1) {
			throw new QuizElementNotFoundError(
				`Page with id '${targetPageId}' not found`,
			);
		}

		const page = configAfterRemove.pages[pageIndex]!;
		const questions = [...page.questions];

		if (
			position !== undefined &&
			position >= 0 &&
			position <= questions.length
		) {
			questions.splice(position, 0, questionToMove);
		} else {
			questions.push(questionToMove);
		}

		const updatedPages = [...configAfterRemove.pages];
		updatedPages[pageIndex] = {
			...page,
			questions,
		};

		return {
			...configAfterRemove,
			pages: updatedPages,
		};
	}

	// Container quiz
	if (!nestedQuizId) {
		throw new QuizConfigValidationError(
			"nestedQuizId is required for container quizzes",
		);
	}

	const nestedIndex = configAfterRemove.nestedQuizzes.findIndex(
		(nq) => nq.id === nestedQuizId,
	);
	if (nestedIndex === -1) {
		throw new QuizElementNotFoundError(
			`Nested quiz with id '${nestedQuizId}' not found`,
		);
	}

	const nestedQuiz = configAfterRemove.nestedQuizzes[nestedIndex]!;
	const pageIndex = nestedQuiz.pages.findIndex((p) => p.id === targetPageId);
	if (pageIndex === -1) {
		throw new QuizElementNotFoundError(
			`Page with id '${targetPageId}' not found`,
		);
	}

	const page = nestedQuiz.pages[pageIndex]!;
	const questions = [...page.questions];

	if (position !== undefined && position >= 0 && position <= questions.length) {
		questions.splice(position, 0, questionToMove);
	} else {
		questions.push(questionToMove);
	}

	const updatedPages = [...nestedQuiz.pages];
	updatedPages[pageIndex] = {
		...page,
		questions,
	};

	const updatedNestedQuizzes = [...configAfterRemove.nestedQuizzes];
	updatedNestedQuizzes[nestedIndex] = {
		...nestedQuiz,
		pages: updatedPages,
	};

	return {
		...configAfterRemove,
		nestedQuizzes: updatedNestedQuizzes,
	};
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
	if (config.type === "regular") {
		let found = false;
		const updatedPages = config.pages.map((page) => {
			const questions = page.questions.map((q) => {
				if (q.id === questionId) {
					found = true;
					return {
						...q,
						scoring,
					};
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
				return {
					...q,
					scoring,
				};
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
