import type { LatestQuizConfig } from "server/json/raw-quiz-config/version-resolver";
import type {
	Question,
	TypedQuestionAnswer,
} from "server/json/raw-quiz-config/v2";
import type { QuizSubmission } from "server/payload-types";
import { InvalidArgumentError } from "~/utils/error";
import type { QuizAnswers } from "server/json/raw-quiz-config/v2";

/**
 * Database answer format (from QuizSubmission.answers)
 */
type DatabaseAnswer = NonNullable<QuizSubmission["answers"]>[number];

/**
 * Maps v2 question types to legacy question types for database storage
 */
function mapV2QuestionTypeToLegacy(
	type: Question["type"],
): "multiple_choice" | "true_false" | "short_answer" | "essay" | "fill_blank" {
	switch (type) {
		case "multiple-choice":
			return "multiple_choice";
		case "choice":
			return "multiple_choice"; // Choice questions are treated as multiple choice
		case "short-answer":
			return "short_answer";
		case "long-answer":
			return "essay";
		case "article":
			return "essay";
		case "fill-in-the-blank":
			return "fill_blank";
		case "ranking":
			return "multiple_choice"; // Ranking stored as multiple choice format
		case "single-selection-matrix":
			return "fill_blank"; // Matrix stored as fill_blank format (JSON)
		case "multiple-selection-matrix":
			return "fill_blank"; // Matrix stored as fill_blank format (JSON)
		case "whiteboard":
			return "essay"; // Whiteboard stored as essay format (JSON string)
		default:
			return "essay"; // Default fallback
	}
}

/**
 * Extracts question text from question object
 */
function getQuestionText(question: Question): string {
	return question.prompt || "";
}

/**
 * Converts TypedQuestionAnswer discriminated union to database format
 * @param question - The question object (used for type validation and text extraction)
 * @param answer - The typed answer to convert
 * @param questionId - The full question ID (may include nested quiz prefix, e.g., "nestedQuizId:questionId")
 */
export function convertQuestionAnswerToDatabaseFormat(
	question: Question,
	answer: TypedQuestionAnswer,
	questionId?: string,
): DatabaseAnswer {
	// Validate answer type matches question type
	if (answer.type !== question.type) {
		throw new InvalidArgumentError(
			`Answer type "${answer.type}" does not match question type "${question.type}"`,
		);
	}

	const questionType = mapV2QuestionTypeToLegacy(question.type);
	const questionText = getQuestionText(question);

	// Use provided questionId if available (for nested quizzes), otherwise use question.id
	const finalQuestionId = questionId ?? (question.id?.toString() || "");

	// Convert based on answer type
	switch (answer.type) {
		case "multiple-choice":
		case "short-answer":
		case "long-answer":
		case "article":
		case "whiteboard": {
			// String values go to selectedAnswer
			return {
				questionId: finalQuestionId,
				questionText,
				questionType,
				selectedAnswer: answer.value,
			};
		}

		case "choice":
		case "ranking": {
			// Array values go to multipleChoiceAnswers
			return {
				questionId: finalQuestionId,
				questionText,
				questionType,
				multipleChoiceAnswers: answer.value.map((option) => ({
					option,
					isSelected: true,
				})),
			};
		}

		case "fill-in-the-blank":
		case "single-selection-matrix":
		case "multiple-selection-matrix": {
			// Record values go to selectedAnswer as JSON string
			return {
				questionId: finalQuestionId,
				questionText,
				questionType,
				selectedAnswer: JSON.stringify(answer.value),
			};
		}

		default: {
			const _exhaustive: never = answer;
			throw new InvalidArgumentError(
				`Unsupported answer type: ${(_exhaustive as TypedQuestionAnswer).type}`,
			);
		}
	}
}

/**
 * Reconstructs TypedQuestionAnswer from database format
 */
export function convertDatabaseAnswerToQuestionAnswer(
	question: Question,
	dbAnswer: DatabaseAnswer,
): TypedQuestionAnswer {
	const questionType = question.type;

	// Reconstruct based on question type and database format
	switch (questionType) {
		case "multiple-choice": {
			if (!dbAnswer.selectedAnswer) {
				throw new InvalidArgumentError(
					"Database answer missing selectedAnswer for multiple-choice question",
				);
			}
			return { type: "multiple-choice", value: dbAnswer.selectedAnswer };
		}

		case "short-answer": {
			if (!dbAnswer.selectedAnswer) {
				throw new InvalidArgumentError(
					"Database answer missing selectedAnswer for short-answer question",
				);
			}
			return { type: "short-answer", value: dbAnswer.selectedAnswer };
		}

		case "long-answer": {
			if (!dbAnswer.selectedAnswer) {
				throw new InvalidArgumentError(
					"Database answer missing selectedAnswer for long-answer question",
				);
			}
			return { type: "long-answer", value: dbAnswer.selectedAnswer };
		}

		case "article": {
			if (!dbAnswer.selectedAnswer) {
				throw new InvalidArgumentError(
					"Database answer missing selectedAnswer for article question",
				);
			}
			return { type: "article", value: dbAnswer.selectedAnswer };
		}

		case "choice": {
			if (!dbAnswer.multipleChoiceAnswers) {
				throw new InvalidArgumentError(
					"Database answer missing multipleChoiceAnswers for choice question",
				);
			}
			return {
				type: "choice",
				value: dbAnswer.multipleChoiceAnswers
					.filter((opt) => opt.isSelected)
					.map((opt) => opt.option),
			};
		}

		case "ranking": {
			if (!dbAnswer.multipleChoiceAnswers) {
				throw new InvalidArgumentError(
					"Database answer missing multipleChoiceAnswers for ranking question",
				);
			}
			return {
				type: "ranking",
				value: dbAnswer.multipleChoiceAnswers
					.filter((opt) => opt.isSelected)
					.map((opt) => opt.option),
			};
		}

		case "fill-in-the-blank": {
			if (!dbAnswer.selectedAnswer) {
				throw new InvalidArgumentError(
					"Database answer missing selectedAnswer for fill-in-the-blank question",
				);
			}
			try {
				const parsed = JSON.parse(dbAnswer.selectedAnswer) as Record<
					string,
					string
				>;
				return { type: "fill-in-the-blank", value: parsed };
			} catch {
				// If parsing fails, treat as single blank answer
				return {
					type: "fill-in-the-blank",
					value: { blank: dbAnswer.selectedAnswer },
				};
			}
		}

		case "single-selection-matrix": {
			if (!dbAnswer.selectedAnswer) {
				throw new InvalidArgumentError(
					"Database answer missing selectedAnswer for single-selection-matrix question",
				);
			}
			try {
				const parsed = JSON.parse(dbAnswer.selectedAnswer) as Record<
					string,
					string
				>;
				return { type: "single-selection-matrix", value: parsed };
			} catch {
				throw new InvalidArgumentError(
					"Invalid JSON format for single-selection-matrix answer",
				);
			}
		}

		case "multiple-selection-matrix": {
			if (!dbAnswer.selectedAnswer) {
				throw new InvalidArgumentError(
					"Database answer missing selectedAnswer for multiple-selection-matrix question",
				);
			}
			try {
				const parsed = JSON.parse(dbAnswer.selectedAnswer) as Record<
					string,
					string
				>;
				return { type: "multiple-selection-matrix", value: parsed };
			} catch {
				throw new InvalidArgumentError(
					"Invalid JSON format for multiple-selection-matrix answer",
				);
			}
		}

		case "whiteboard": {
			if (!dbAnswer.selectedAnswer) {
				throw new InvalidArgumentError(
					"Database answer missing selectedAnswer for whiteboard question",
				);
			}
			return { type: "whiteboard", value: dbAnswer.selectedAnswer };
		}

		default: {
			const _exhaustive: never = questionType;
			throw new InvalidArgumentError(
				`Unsupported question type: ${(_exhaustive as Question).type}`,
			);
		}
	}
}

/**
 * Finds a question in quiz config by questionId
 * Handles nested quiz question IDs (format: "nestedQuizId:questionId")
 */
export function findQuestionInConfig(
	config: LatestQuizConfig,
	questionId: string,
): Question | null {
	// Check if this is a nested quiz question (format: "nestedQuizId:questionId")
	const nestedMatch = questionId.match(/^(.+):(.+)$/);
	if (nestedMatch) {
		const [, nestedQuizId, actualQuestionId] = nestedMatch;
		// Find nested quiz
		if (config.type === "container") {
			const nestedQuiz = config.nestedQuizzes?.find(
				(nq) => nq.id === nestedQuizId,
			);
			if (!nestedQuiz) {
				return null;
			}
			// Search in nested quiz pages
			for (const page of nestedQuiz.pages || []) {
				for (const question of page.questions || []) {
					if (question.id?.toString() === actualQuestionId) {
						return question;
					}
				}
			}
		}
		return null;
	}

	// Regular quiz question
	if (config.type === "regular") {
		for (const page of config.pages || []) {
			for (const question of page.questions || []) {
				if (question.id?.toString() === questionId) {
					return question;
				}
			}
		}
	}

	return null;
}

/**
 * Type guard to check if answer type matches question type
 */
export function validateAnswerTypeMatchesQuestion(
	question: Question,
	answer: TypedQuestionAnswer,
): boolean {
	return answer.type === question.type;
}

/**
 * Converts database answers array to QuizAnswers format (Record<string, QuestionAnswer>)
 * This is used to load existing answers into the quiz preview component
 */
export function convertDatabaseAnswersToQuizAnswers(
	config: LatestQuizConfig,
	dbAnswers: NonNullable<QuizSubmission["answers"]>,
): QuizAnswers {
	const quizAnswers: QuizAnswers = {};

	for (const dbAnswer of dbAnswers) {
		// Find the question in the config
		const question = findQuestionInConfig(config, dbAnswer.questionId);
		if (!question) {
			// Skip if question not found (might be from a different version)
			continue;
		}

		// Convert to TypedQuestionAnswer first
		try {
			const typedAnswer = convertDatabaseAnswerToQuestionAnswer(
				question,
				dbAnswer,
			);

			// Convert TypedQuestionAnswer to legacy QuestionAnswer format
			// (string | string[] | Record<string, string>)
			switch (typedAnswer.type) {
				case "multiple-choice":
				case "short-answer":
				case "long-answer":
				case "article":
				case "whiteboard":
					quizAnswers[dbAnswer.questionId] = typedAnswer.value;
					break;
				case "choice":
				case "ranking":
					quizAnswers[dbAnswer.questionId] = typedAnswer.value;
					break;
				case "fill-in-the-blank":
				case "single-selection-matrix":
				case "multiple-selection-matrix":
					quizAnswers[dbAnswer.questionId] = typedAnswer.value;
					break;
			}
		} catch (error) {
			// Skip invalid answers
			continue;
		}
	}

	return quizAnswers;
}
