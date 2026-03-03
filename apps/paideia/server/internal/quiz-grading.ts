import type { LatestQuizConfig } from "server/json/raw-quiz-config/version-resolver";
import {
	getQuestionPoints,
	type Question,
	type RegularQuizConfig,
} from "server/json/raw-quiz-config/v2";

/**
 * Answer format for quiz grading
 */
export interface QuizAnswer {
	questionId: string;
	questionText: string;
	questionType:
		| "multiple_choice"
		| "true_false"
		| "short_answer"
		| "essay"
		| "fill_blank";
	selectedAnswer?: string | null;
	multipleChoiceAnswers?: Array<{
		option: string;
		isSelected: boolean;
	}>;
}

/**
 * Result for a single question grading
 */
export interface QuestionGradingResult {
	questionId: string;
	questionText: string;
	questionType: string;
	pointsEarned: number;
	maxPoints: number;
	isCorrect: boolean;
	feedback: string;
	correctAnswer?: string | null;
	explanation?: string | null;
}

/**
 * Overall quiz grading result
 */
export interface QuizGradingResult {
	totalScore: number;
	maxScore: number;
	percentage: number;
	questionResults: QuestionGradingResult[];
	feedback: string;
}

/**
 * Maps v2 question types to legacy question types for compatibility
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
		case "fill-in-the-blank":
			return "fill_blank";
		default:
			return "essay"; // Default fallback
	}
}

/**
 * Extracts correct answer string from v2 question format
 */
function getCorrectAnswerString(question: Question): string | null {
	switch (question.type) {
		case "multiple-choice": {
			const q = question as Extract<Question, { type: "multiple-choice" }>;
			if (q.correctAnswer) {
				const optionLabel = q.options[q.correctAnswer];
				if (optionLabel) {
					return optionLabel;
				}
				return q.correctAnswer;
			}
			return null;
		}
		case "choice": {
			const q = question as Extract<Question, { type: "choice" }>;
			if (q.correctAnswers && q.correctAnswers.length > 0) {
				return q.correctAnswers
					.map((key) => q.options[key])
					.filter(Boolean)
					.join(", ");
			}
			return null;
		}
		case "short-answer": {
			const q = question as Extract<Question, { type: "short-answer" }>;
			return q.correctAnswer || null;
		}
		case "long-answer": {
			const q = question as Extract<Question, { type: "long-answer" }>;
			return q.correctAnswer || null;
		}
		case "fill-in-the-blank": {
			const q = question as Extract<Question, { type: "fill-in-the-blank" }>;
			if (q.correctAnswers) {
				return Object.values(q.correctAnswers).join(", ");
			}
			return null;
		}
		default:
			return null;
	}
}

/**
 * Extracts all questions from a quiz config
 */
function extractQuestionsFromConfig(config: LatestQuizConfig): Question[] {
	const allQuestions: Question[] = [];

	if ("type" in config && config.type === "regular") {
		const regularConfig = config as RegularQuizConfig;
		for (const page of regularConfig.pages || []) {
			for (const question of page.questions || []) {
				allQuestions.push(question);
			}
		}
	} else if ("type" in config && config.type === "container") {
		// Container quiz - extract from nested quizzes
		for (const nested of config.nestedQuizzes || []) {
			for (const page of nested.pages || []) {
				for (const question of page.questions || []) {
					allQuestions.push(question);
				}
			}
		}
	}

	return allQuestions;
}

/**
 * Pure function to calculate quiz grade based on rawQuizConfig and answers
 * This function has no dependencies on Payload CMS and can be tested independently
 */
export function calculateQuizGrade(
	rawQuizConfig: LatestQuizConfig,
	answers: QuizAnswer[],
): QuizGradingResult {
	// Extract all questions from pages
	const allQuestions = extractQuestionsFromConfig(rawQuizConfig);

	let totalScore = 0;
	let maxScore = 0;
	const questionResults: QuestionGradingResult[] = [];

	for (const question of allQuestions) {
		const maxPoints = getQuestionPoints(question);
		maxScore += maxPoints;

		// Find the corresponding answer
		const answer = answers.find(
			(a) => a.questionId === question.id?.toString(),
		);

		if (!answer) {
			// No answer provided
			const correctAnswerStr = getCorrectAnswerString(question);
			questionResults.push({
				questionId: question.id?.toString() || "",
				questionText: question.prompt,
				questionType: mapV2QuestionTypeToLegacy(question.type),
				pointsEarned: 0,
				maxPoints,
				isCorrect: false,
				feedback: "No answer provided",
				correctAnswer: correctAnswerStr !== null ? correctAnswerStr : null,
				explanation: question.feedback ?? null,
			});
			continue;
		}

		let pointsEarned = 0;
		let isCorrect = false;
		let feedback = "";

		// Grade based on question type
		switch (question.type) {
			case "multiple-choice": {
				const q = question as Extract<Question, { type: "multiple-choice" }>;
				const correctAnswer = q.correctAnswer;
				const selectedOptions =
					answer.multipleChoiceAnswers?.filter((opt) => opt.isSelected) || [];

				if (
					selectedOptions.length === 1 &&
					selectedOptions[0]?.option === correctAnswer
				) {
					pointsEarned = maxPoints;
					isCorrect = true;
					feedback = "Correct!";
				} else {
					const correctOptionLabel =
						correctAnswer && q.options[correctAnswer]
							? q.options[correctAnswer]
							: correctAnswer || "";
					feedback = `Incorrect. The correct answer is: ${correctOptionLabel}`;
				}
				break;
			}

			case "choice": {
				const q = question as Extract<Question, { type: "choice" }>;
				const correctAnswers = q.correctAnswers || [];

				// Handle both multipleChoiceAnswers and selectedAnswer formats
				let selectedKeys: string[] = [];
				if (
					answer.multipleChoiceAnswers &&
					answer.multipleChoiceAnswers.length > 0
				) {
					selectedKeys = answer.multipleChoiceAnswers
						.filter((opt) => opt.isSelected)
						.map((opt) => opt.option);
				} else if (answer.selectedAnswer) {
					// For true/false style questions answered with selectedAnswer
					selectedKeys = [answer.selectedAnswer];
				}

				// Check if all correct answers are selected and no incorrect ones
				const allCorrectSelected = correctAnswers.every((key) =>
					selectedKeys.includes(key),
				);
				const noIncorrectSelected = selectedKeys.every((key) =>
					correctAnswers.includes(key),
				);

				if (
					allCorrectSelected &&
					noIncorrectSelected &&
					selectedKeys.length === correctAnswers.length
				) {
					pointsEarned = maxPoints;
					isCorrect = true;
					feedback = "Correct!";
				} else {
					const correctLabels = correctAnswers
						.map((key) => q.options[key])
						.filter(Boolean)
						.join(", ");
					feedback = `Incorrect. The correct answer(s) were: ${correctLabels}`;
				}
				break;
			}

			case "short-answer": {
				const q = question as Extract<Question, { type: "short-answer" }>;
				const correctAnswer = q.correctAnswer?.toLowerCase().trim() || "";
				const selectedAnswer =
					answer.selectedAnswer?.toLowerCase().trim() || "";

				if (correctAnswer && correctAnswer === selectedAnswer) {
					pointsEarned = maxPoints;
					isCorrect = true;
					feedback = "Correct!";
				} else {
					feedback = `Incorrect. The correct answer is: ${q.correctAnswer || ""}`;
				}
				break;
			}

			case "long-answer": {
				// Long answers are typically graded manually, but we can provide partial credit based on length
				const answerLength = answer.selectedAnswer?.length || 0;
				if (answerLength > 100) {
					pointsEarned = Math.floor(maxPoints * 0.5); // 50% for having content
					feedback = "Essay submitted. Manual grading required.";
				} else {
					feedback =
						"Essay too short. Please provide a more detailed response.";
				}
				break;
			}

			case "fill-in-the-blank": {
				const q = question as Extract<Question, { type: "fill-in-the-blank" }>;
				// Fill-in-the-blank uses correctAnswers object, but for single answer we check selectedAnswer
				// This is a simplified check - full implementation would need to handle multiple blanks
				const correctAnswers = q.correctAnswers || {};
				const selectedAnswer =
					answer.selectedAnswer?.toLowerCase().trim() || "";
				const correctValues = Object.values(correctAnswers).map((v) =>
					v.toLowerCase().trim(),
				);

				if (
					correctValues.length > 0 &&
					correctValues.some((cv) => cv === selectedAnswer)
				) {
					pointsEarned = maxPoints;
					isCorrect = true;
					feedback = "Correct!";
				} else {
					const correctAnswerStr = Object.values(correctAnswers).join(", ");
					feedback = `Incorrect. The correct answer is: ${correctAnswerStr}`;
				}
				break;
			}

			default:
				feedback = "Question type not supported for automatic grading";
		}

		// Add feedback if available
		if (question.feedback && !isCorrect) {
			feedback += ` ${question.feedback}`;
		}

		totalScore += pointsEarned;

		questionResults.push({
			questionId: question.id?.toString() || "",
			questionText: question.prompt,
			questionType: mapV2QuestionTypeToLegacy(question.type),
			pointsEarned,
			maxPoints,
			isCorrect,
			feedback,
			correctAnswer: getCorrectAnswerString(question),
			explanation: question.feedback ?? null,
		});
	}

	// Round to 2 decimal places
	const percentage =
		maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 100) / 100 : 0;

	// Generate overall feedback
	const correctCount = questionResults.filter((q) => q.isCorrect).length;
	const totalQuestions = questionResults.length;

	// Generate report
	const overallFeedback = `Quiz completed! You scored ${totalScore}/${maxScore} points (${percentage}%). You got ${correctCount}/${totalQuestions} questions correct.`;

	return {
		totalScore,
		maxScore,
		percentage,
		questionResults,
		feedback: overallFeedback,
	};
}
