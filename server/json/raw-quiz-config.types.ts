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
	// Prompt contains {{blank}} markers for blanks
	// e.g., "The capital of France is {{blank}} and the largest city is {{blank}}."
	correctAnswers?: string[]; // Answers for each blank in order
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
	globalTimer?: number; // Timer in seconds for the nested quiz
	grading?: GradingConfig; // Grading configuration for this nested quiz
}

// Quiz Configuration - supports EITHER pages (regular) OR nestedQuizzes (container)
export interface QuizConfig {
	id: string;
	title: string;

	// Regular quiz structure
	pages?: QuizPage[];

	// Container quiz structure
	nestedQuizzes?: NestedQuizConfig[];
	sequentialOrder?: boolean; // If true, nested quizzes must be completed in order

	resources?: QuizResource[]; // Optional resources (HTML rich text)
	globalTimer?: number; // Timer in seconds for the entire quiz (parent timer)
	grading?: GradingConfig; // Grading configuration for the quiz
}

// Answer types for each question type
export type QuestionAnswer =
	| string // multiple-choice, short-answer, long-answer, article
	| string[] // fill-in-the-blank, choice, ranking
	| Record<string, string>; // single-selection-matrix, multiple-selection-matrix

// Quiz Answers
export type QuizAnswers = Record<string, QuestionAnswer>;

// Type guard: Check if a quiz is a container quiz with nested quizzes
export function isContainerQuiz(config: QuizConfig): boolean {
	return config.nestedQuizzes !== undefined && config.nestedQuizzes.length > 0;
}

// Type guard: Check if a quiz is a regular quiz with pages
export function isRegularQuiz(config: QuizConfig): boolean {
	return config.pages !== undefined && config.pages.length > 0;
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
	if ("pages" in config && config.pages) {
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

/**
 * Represents a Paideia Rubric Definition, used in advanced grading forms.
 * Corresponds to the data managed by gradingform_rubric_controller in Paideia.
 */
export interface PaideiaRubricDefinition {
	/** Unique identifier for the rubric. */
	id: number;
	/** Human-readable name or title of the rubric. */
	name: string;
	/** Optional detailed description of the rubric's purpose. */
	description?: string;
	/** Array of criteria that form the rubric's structure. */
	criteria: PaideiaRubricCriterion[];
	/** Status of the rubric (e.g., 'draft' or 'ready'). */
	status: "draft" | "ready";
	/** Timestamp of creation. */
	timecreated: number;
	/** Timestamp of last modification. */
	timemodified: number;
}

/**
 * Represents a single criterion within a rubric.
 * Each criterion has multiple levels for assessment.
 */
export interface PaideiaRubricCriterion {
	/** Unique identifier for the criterion. */
	id: number;
	/** Descriptive name of the criterion (e.g., "Organization"). */
	name: string;
	/** Detailed explanation of what the criterion assesses. */
	description: string;
	/** Array of levels associated with this criterion. */
	levels: PaideiaRubricLevel[];
	/** Sorting order for display (lower values appear first). */
	sortorder: number;
}

/**
 * Represents a performance level for a given criterion.
 * Levels define qualitative descriptions and associated scores.
 */
export interface PaideiaRubricLevel {
	/** Unique identifier for the level. */
	id: number;
	/** Qualitative description of this performance level. */
	definition: string;
	/** Numerical score assigned to this level (non-negative). */
	score: number;
	/** Sorting order for display within the criterion (left to right). */
	sortorder: number;
}

/**
 * Represents a filled instance of a rubric for a specific submission (grading).
 * Corresponds to rubric_fillings in Paideia's grading data.
 */
export interface PaideiaRubricFilling {
	/** Unique identifier for the filling instance. */
	id: number;
	/** Foreign key to the rubric definition ID. */
	rubricid: number;
	/** ID of the instance (e.g., assignment submission). */
	instanceid: number;
	/** Array of criterion-level selections for this filling. */
	criterionlevel: { [criterionId: number]: number }; // Maps criterion ID to selected level ID
	/** Overall calculated score from the filling. */
	score: number;
	/** Timestamp when the filling was completed. */
	timecreated: number;
	/** Timestamp of last update to the filling. */
	timemodified: number;
}

/**
 * Represents optional remarks or feedback associated with a rubric filling.
 * Corresponds to rubric_filling_filled_levels in Paideia.
 */
export interface PaideiaRubricRemark {
	/** Unique identifier for the remark. */
	id: number;
	/** Foreign key to the filling ID. */
	fillingid: number;
	/** Foreign key to the criterion ID. */
	criterionid: number;
	/** Additional textual feedback for the criterion. */
	remark: string;
	/** Timestamp of the remark. */
	timemodified: number;
}
