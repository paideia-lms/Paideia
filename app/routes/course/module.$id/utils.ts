import { createLoader, parseAsString } from "nuqs/server";
import type { CourseModuleContext } from "server/contexts/course-module-context";
import type {
	Question,
	QuizAnswers,
	QuizConfig,
} from "server/json/raw-quiz-config.types.v2";
import { isRegularQuiz } from "server/json/raw-quiz-config.types.v2";

export const courseModuleSearchParams = {
	action: parseAsString.withDefault(""),
	showQuiz: parseAsString.withDefault(""),
	threadId: parseAsString.withDefault(""),
	replyTo: parseAsString.withDefault(""),
};

export const loadSearchParams = createLoader(courseModuleSearchParams);

// Helper to format dates consistently on the server
const formatDateForDisplay = (dateString: string) => {
	const date = new Date(dateString);
	return date.toLocaleString("en-US", {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

// Helper to format module settings with date strings
export const formatModuleSettingsForDisplay = (
	moduleSettings: CourseModuleContext["moduleLinkSettings"],
) => {
	if (!moduleSettings?.settings) return null;

	const settings = moduleSettings.settings;
	const now = new Date();

	if (settings.type === "assignment") {
		return {
			type: "assignment" as const,
			name: settings.name,
			dates: [
				settings.allowSubmissionsFrom && {
					label: "Available from",
					value: formatDateForDisplay(settings.allowSubmissionsFrom),
					isOverdue: false,
				},
				settings.dueDate && {
					label: "Due",
					value: formatDateForDisplay(settings.dueDate),
					isOverdue: new Date(settings.dueDate) < now,
				},
				settings.cutoffDate && {
					label: "Final deadline",
					value: formatDateForDisplay(settings.cutoffDate),
					isOverdue: new Date(settings.cutoffDate) < now,
				},
			].filter(Boolean),
		};
	}

	if (settings.type === "quiz") {
		return {
			type: "quiz" as const,
			name: settings.name,
			dates: [
				settings.openingTime && {
					label: "Opens",
					value: formatDateForDisplay(settings.openingTime),
					isOverdue: false,
				},
				settings.closingTime && {
					label: "Closes",
					value: formatDateForDisplay(settings.closingTime),
					isOverdue: new Date(settings.closingTime) < now,
				},
			].filter(Boolean),
		};
	}

	if (settings.type === "discussion") {
		return {
			type: "discussion" as const,
			name: settings.name,
			dates: [
				settings.dueDate && {
					label: "Due",
					value: formatDateForDisplay(settings.dueDate),
					isOverdue: new Date(settings.dueDate) < now,
				},
				settings.cutoffDate && {
					label: "Final deadline",
					value: formatDateForDisplay(settings.cutoffDate),
					isOverdue: new Date(settings.cutoffDate) < now,
				},
			].filter(Boolean),
		};
	}

	return null;
};

/**
 * Transform QuizAnswers from quiz preview format to submission format
 */
export function transformQuizAnswersToSubmissionFormat(
	quizConfig: QuizConfig,
	answers: QuizAnswers,
): Array<{
	questionId: string;
	questionText: string;
	questionType:
		| "multiple_choice"
		| "true_false"
		| "short_answer"
		| "essay"
		| "fill_blank";
	selectedAnswer?: string;
	multipleChoiceAnswers?: Array<{
		option: string;
		isSelected: boolean;
	}>;
}> {
	const result: Array<{
		questionId: string;
		questionText: string;
		questionType:
			| "multiple_choice"
			| "true_false"
			| "short_answer"
			| "essay"
			| "fill_blank";
		selectedAnswer?: string;
		multipleChoiceAnswers?: Array<{
			option: string;
			isSelected: boolean;
		}>;
	}> = [];

	// Helper to map question type from quiz config to submission format
	const mapQuestionType = (
		type: Question["type"],
	):
		| "multiple_choice"
		| "true_false"
		| "short_answer"
		| "essay"
		| "fill_blank" => {
		switch (type) {
			case "multiple-choice":
				return "multiple_choice";
			case "short-answer":
				return "short_answer";
			case "long-answer":
			case "article":
				return "essay";
			case "fill-in-the-blank":
				return "fill_blank";
			case "choice":
				return "multiple_choice";
			case "ranking":
			case "single-selection-matrix":
			case "multiple-selection-matrix":
			case "whiteboard":
				// These types don't have direct mapping, use essay as fallback
				return "essay";
			default:
				return "essay";
		}
	};

	// Get all questions from quiz config
	const questions: Question[] = [];
	if (isRegularQuiz(quizConfig)) {
		for (const page of quizConfig.pages || []) {
			questions.push(...page.questions);
		}
	} else {
		// For container quizzes, we'd need to handle nested quizzes
		// For now, we'll only handle regular quizzes
	}

	// Transform each answer
	for (const [questionId, answerValue] of Object.entries(answers)) {
		const question = questions.find((q) => q.id === questionId);
		if (!question) continue;

		const questionType = mapQuestionType(question.type);
		const submissionAnswer: {
			questionId: string;
			questionText: string;
			questionType:
				| "multiple_choice"
				| "true_false"
				| "short_answer"
				| "essay"
				| "fill_blank";
			selectedAnswer?: string;
			multipleChoiceAnswers?: Array<{
				option: string;
				isSelected: boolean;
			}>;
		} = {
			questionId,
			questionText: question.prompt,
			questionType,
		};

		// Handle different answer value types
		if (typeof answerValue === "string") {
			// Single string answer (multiple-choice, short-answer, long-answer, article)
			if (
				question.type === "multiple-choice" ||
				question.type === "short-answer"
			) {
				submissionAnswer.selectedAnswer = answerValue;
			} else {
				// For long-answer and article, store as selectedAnswer
				submissionAnswer.selectedAnswer = answerValue;
			}
		} else if (Array.isArray(answerValue)) {
			// Array answer (fill-in-the-blank, choice, ranking)
			if (question.type === "choice" && "options" in question) {
				// For choice questions, create multipleChoiceAnswers
				const options = question.options;
				submissionAnswer.multipleChoiceAnswers = Object.keys(options).map(
					(optionKey) => ({
						option: optionKey,
						isSelected: answerValue.includes(optionKey),
					}),
				);
			} else {
				// For other array types, join as comma-separated string
				submissionAnswer.selectedAnswer = answerValue.join(", ");
			}
		} else if (typeof answerValue === "object" && answerValue !== null) {
			// Object answer (fill-in-the-blank with blanks, matrix questions)
			if (question.type === "fill-in-the-blank") {
				// Join object values as comma-separated string
				submissionAnswer.selectedAnswer = Object.values(answerValue).join(", ");
			} else {
				// For matrix questions, stringify the object
				submissionAnswer.selectedAnswer = JSON.stringify(answerValue);
			}
		}

		result.push(submissionAnswer);
	}

	return result;
}
