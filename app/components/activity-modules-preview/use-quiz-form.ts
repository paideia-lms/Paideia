import { useForm } from "@mantine/form";
import { useEffect, useRef, useState } from "react";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import type {
	NestedQuizConfig,
	Question,
	QuestionAnswer,
	QuizAnswers,
	RegularQuizConfig,
} from "../../../server/json/raw-quiz-config/v2";
import type { TypedQuestionAnswer } from "../../../server/json/raw-quiz-config/v2";

interface UseQuizFormOptions {
	quizConfig: RegularQuizConfig | NestedQuizConfig;
	readonly?: boolean;
	initialAnswers?: QuizAnswers;
	onAnswerSave?: (questionId: string, answer: TypedQuestionAnswer) => void;
	submissionId?: number;
}

interface UseQuizFormReturn {
	currentPageIndex: number;
	answers: QuizAnswers;
	form: ReturnType<typeof useForm<{ answers: QuizAnswers }>>;
	goToNextPage: () => void;
	goToPreviousPage: () => void;
	goToPage: (pageIndex: number) => void;
	setAnswer: (questionId: string, answer: QuestionAnswer) => void;
	getAnswer: (questionId: string) => QuestionAnswer | undefined;
	isFirstPage: boolean;
	isLastPage: boolean;
	flaggedQuestions: Set<string>;
	toggleFlag: (questionId: string) => void;
	isFlagged: (questionId: string) => boolean;
	readonly: boolean;
}

/**
 * Helper function to convert legacy QuestionAnswer to TypedQuestionAnswer
 */
function convertToTypedAnswer(
	question: Question,
	answer: QuestionAnswer,
): TypedQuestionAnswer {
	// Determine type based on question type and answer structure
	if (typeof answer === "string") {
		return {
			type: question.type as
				| "multiple-choice"
				| "short-answer"
				| "long-answer"
				| "article"
				| "whiteboard",
			value: answer,
		} as TypedQuestionAnswer;
	}
	if (Array.isArray(answer)) {
		return {
			type: question.type as "choice" | "ranking",
			value: answer,
		} as TypedQuestionAnswer;
	}
	if (typeof answer === "object") {
		return {
			type: question.type as
				| "fill-in-the-blank"
				| "single-selection-matrix"
				| "multiple-selection-matrix",
			value: answer,
		} as TypedQuestionAnswer;
	}
	// Fallback (should not happen)
	return { type: "short-answer", value: String(answer) };
}

/**
 * Helper function to find question by ID in quiz config
 */
function findQuestionById(
	config: RegularQuizConfig | NestedQuizConfig,
	questionId: string,
): Question | null {
	if ("pages" in config) {
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

export function useQuizForm({
	quizConfig,
	readonly = false,
	initialAnswers = {},
	onAnswerSave,
	submissionId,
}: UseQuizFormOptions): UseQuizFormReturn {
	const [currentPageIndex, setCurrentPageIndex] = useState(0);
	const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(
		new Set(),
	);

	const form = useForm<{ answers: QuizAnswers }>({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			answers: initialAnswers,
		},
	});

	const answers = useFormWatchForceUpdate(form, "answers");

	// Debounce timer ref for answer saving
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}
		};
	}, []);

	const goToNextPage = () => {
		if (quizConfig.pages && currentPageIndex < quizConfig.pages.length - 1) {
			setCurrentPageIndex((prev) => prev + 1);
		}
	};

	const goToPreviousPage = () => {
		if (currentPageIndex > 0) {
			setCurrentPageIndex((prev) => prev - 1);
		}
	};

	const goToPage = (pageIndex: number) => {
		if (
			quizConfig.pages &&
			pageIndex >= 0 &&
			pageIndex < quizConfig.pages.length
		) {
			setCurrentPageIndex(pageIndex);
		}
	};

	const setAnswer = (questionId: string, answer: QuestionAnswer) => {
		form.setFieldValue(`answers.${questionId}`, answer);

		// Save answer if onAnswerSave callback is provided and submissionId exists
		if (onAnswerSave && submissionId && !readonly) {
			// Find the question to determine its type
			const question = findQuestionById(quizConfig, questionId);
			if (question) {
				// Convert to TypedQuestionAnswer
				const typedAnswer = convertToTypedAnswer(question, answer);

				// Clear existing timer
				if (saveTimerRef.current) {
					clearTimeout(saveTimerRef.current);
				}

				// Debounce the save (500ms delay)
				saveTimerRef.current = setTimeout(() => {
					onAnswerSave(questionId, typedAnswer);
				}, 500);
			}
		}
	};

	const getAnswer = (questionId: string): QuestionAnswer | undefined => {
		return answers[questionId];
	};

	const toggleFlag = (questionId: string) => {
		setFlaggedQuestions((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(questionId)) {
				newSet.delete(questionId);
			} else {
				newSet.add(questionId);
			}
			return newSet;
		});
	};

	const isFlagged = (questionId: string): boolean => {
		return flaggedQuestions.has(questionId);
	};

	const isFirstPage = currentPageIndex === 0;
	const isLastPage = quizConfig.pages
		? currentPageIndex === quizConfig.pages.length - 1
		: false;

	return {
		currentPageIndex,
		answers,
		form,
		goToNextPage,
		goToPreviousPage,
		goToPage,
		setAnswer,
		getAnswer,
		isFirstPage,
		isLastPage,
		flaggedQuestions,
		toggleFlag,
		isFlagged,
		readonly,
	};
}
