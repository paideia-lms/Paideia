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

// Base question interface with common fields
export interface BaseQuestion {
    id: string;
    type: QuestionType;
    prompt: string;
    feedback?: string; // Feedback to show after answering
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

// Quiz Configuration
export interface QuizConfig {
    id: string;
    title: string;
    pages: QuizPage[];
    resources?: QuizResource[]; // Optional resources (HTML rich text)
    showImmediateFeedback: boolean;
    globalTimer?: number; // Timer in seconds for the entire quiz
}

// Answer types for each question type
export type QuestionAnswer =
    | string // multiple-choice, short-answer, long-answer, article
    | string[] // fill-in-the-blank, choice, ranking
    | Record<string, string>; // single-selection-matrix, multiple-selection-matrix

// Quiz Answers
export type QuizAnswers = Record<string, QuestionAnswer>;

