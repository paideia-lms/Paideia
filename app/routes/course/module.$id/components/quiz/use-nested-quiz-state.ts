import { useState } from "react";
import type {
	NestedQuizConfig,
	QuizAnswers,
	QuizConfig,
} from "server/json/raw-quiz-config/v2";
import { isContainerQuiz } from "server/json/raw-quiz-config/v2";

interface UseNestedQuizStateOptions {
	quizConfig: QuizConfig;
	initialAnswers?: QuizAnswers;
}

interface UseNestedQuizStateReturn {
	currentNestedQuizId: string | null;
	completedQuizIds: Set<string>;
	activeNestedQuiz: NestedQuizConfig | null;

	startNestedQuiz: (quizId: string) => void;
	completeNestedQuiz: (quizId: string) => void;
	exitToContainer: () => void;

	isQuizCompleted: (quizId: string) => boolean;
	isQuizAccessible: (quizId: string) => boolean;
	canAccessQuiz: (quiz: NestedQuizConfig) => boolean;

	allQuizzesCompleted: boolean;
	completionProgress: number; // 0-100
}

export function useNestedQuizState({
	quizConfig,
	initialAnswers,
}: UseNestedQuizStateOptions): UseNestedQuizStateReturn {
	const [currentNestedQuizId, setCurrentNestedQuizId] = useState<string | null>(
		null,
	);
	const [completedQuizIds, setCompletedQuizIds] = useState<Set<string>>(
		new Set(),
	);

	// Get the active nested quiz if one is selected
	const activeNestedQuiz =
		currentNestedQuizId && isContainerQuiz(quizConfig)
			? (quizConfig.nestedQuizzes?.find((q) => q.id === currentNestedQuizId) ??
				null)
			: null;

	// Helper function to check if a quiz is completed based on initialAnswers
	const isQuizCompletedFromInitialAnswers = (quizId: string): boolean => {
		if (!isContainerQuiz(quizConfig) || !initialAnswers) {
			return false;
		}

		const quiz = quizConfig.nestedQuizzes?.find((q) => q.id === quizId);
		if (!quiz || !quiz.pages) {
			return false;
		}

		// Check if all questions in the quiz have answers in initialAnswers
		for (const page of quiz.pages) {
			for (const question of page.questions) {
				if (
					initialAnswers[question.id] === undefined ||
					initialAnswers[question.id] === null
				) {
					return false;
				}
			}
		}

		return true;
	};

	const startNestedQuiz = (quizId: string) => {
		if (isContainerQuiz(quizConfig)) {
			const quiz = quizConfig.nestedQuizzes?.find((q) => q.id === quizId);
			if (quiz && canAccessQuiz(quiz)) {
				setCurrentNestedQuizId(quizId);
			}
		}
	};

	const completeNestedQuiz = (quizId: string) => {
		setCompletedQuizIds((prev) => {
			const newSet = new Set(prev);
			newSet.add(quizId);
			return newSet;
		});
		setCurrentNestedQuizId(null);
	};

	const exitToContainer = () => {
		setCurrentNestedQuizId(null);
	};

	const isQuizCompleted = (quizId: string): boolean => {
		// Check both state and initialAnswers
		return (
			completedQuizIds.has(quizId) || isQuizCompletedFromInitialAnswers(quizId)
		);
	};

	const isQuizAccessible = (quizId: string): boolean => {
		if (!isContainerQuiz(quizConfig)) {
			return false;
		}

		const nestedQuizzes = quizConfig.nestedQuizzes ?? [];
		const quiz = nestedQuizzes.find((q) => q.id === quizId);
		if (!quiz) {
			return false;
		}

		return canAccessQuiz(quiz);
	};

	const canAccessQuiz = (quiz: NestedQuizConfig): boolean => {
		if (!isContainerQuiz(quizConfig)) {
			return false;
		}

		const nestedQuizzes = quizConfig.nestedQuizzes ?? [];

		// If already completed (either in state or initialAnswers), always accessible for review
		if (
			completedQuizIds.has(quiz.id) ||
			isQuizCompletedFromInitialAnswers(quiz.id)
		) {
			return true;
		}

		// If sequential order is required
		if (quizConfig.sequentialOrder) {
			const quizIndex = nestedQuizzes.findIndex((q) => q.id === quiz.id);
			if (quizIndex === -1) {
				return false;
			}

			// First quiz is always accessible
			if (quizIndex === 0) {
				return true;
			}

			// Check if all previous quizzes are completed
			for (let i = 0; i < quizIndex; i++) {
				const prevQuizId = nestedQuizzes[i]!.id;
				if (
					!completedQuizIds.has(prevQuizId) &&
					!isQuizCompletedFromInitialAnswers(prevQuizId)
				) {
					return false;
				}
			}

			return true;
		}

		// Free order - all uncompleted quizzes are accessible
		return true;
	};

	const allQuizzesCompleted = isContainerQuiz(quizConfig)
		? (quizConfig.nestedQuizzes?.length ?? 0) === completedQuizIds.size
		: false;

	const completionProgress =
		isContainerQuiz(quizConfig) && quizConfig.nestedQuizzes
			? Math.round(
					(completedQuizIds.size / quizConfig.nestedQuizzes.length) * 100,
				)
			: 0;

	return {
		currentNestedQuizId,
		completedQuizIds,
		activeNestedQuiz,
		startNestedQuiz,
		completeNestedQuiz,
		exitToContainer,
		isQuizCompleted,
		isQuizAccessible,
		canAccessQuiz,
		allQuizzesCompleted,
		completionProgress,
	};
}
