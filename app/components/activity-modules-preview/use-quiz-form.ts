import { useForm } from "@mantine/form";
import { useState } from "react";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import type {
	NestedQuizConfig,
	QuestionAnswer,
	QuizAnswers,
	RegularQuizConfig,
} from "../../../server/json/raw-quiz-config/types.v2";

interface UseQuizFormOptions {
	quizConfig: RegularQuizConfig | NestedQuizConfig;
	readonly?: boolean;
	initialAnswers?: QuizAnswers;
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

export function useQuizForm({
	quizConfig,
	readonly = false,
	initialAnswers = {},
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
