import { useState } from "react";
import type {
	NestedQuizConfig,
	QuizAnswers,
	QuizConfig,
} from "server/json/raw-quiz-config/types.v2";
import { isContainerQuiz } from "server/json/raw-quiz-config/types.v2";

interface UseNestedQuizStateOptions {
	quizConfig: QuizConfig;
}

interface UseNestedQuizStateReturn {
	currentNestedQuizId: string | null;
	completedQuizIds: Set<string>;
	activeNestedQuiz: NestedQuizConfig | null;
	submittedAnswers: Record<string, QuizAnswers>;

	startNestedQuiz: (quizId: string) => void;
	completeNestedQuiz: (quizId: string, answers: QuizAnswers) => void;
	exitToContainer: () => void;

	isQuizCompleted: (quizId: string) => boolean;
	isQuizAccessible: (quizId: string) => boolean;
	canAccessQuiz: (quiz: NestedQuizConfig) => boolean;

	allQuizzesCompleted: boolean;
	completionProgress: number; // 0-100
}

export function useNestedQuizState({
	quizConfig,
}: UseNestedQuizStateOptions): UseNestedQuizStateReturn {
	const [currentNestedQuizId, setCurrentNestedQuizId] = useState<string | null>(
		null,
	);
	const [completedQuizIds, setCompletedQuizIds] = useState<Set<string>>(
		new Set(),
	);
	const [submittedAnswers, setSubmittedAnswers] = useState<
		Record<string, QuizAnswers>
	>({});

	// Get the active nested quiz if one is selected
	const activeNestedQuiz =
		currentNestedQuizId && isContainerQuiz(quizConfig)
			? (quizConfig.nestedQuizzes?.find((q) => q.id === currentNestedQuizId) ??
				null)
			: null;

	const startNestedQuiz = (quizId: string) => {
		if (isContainerQuiz(quizConfig)) {
			const quiz = quizConfig.nestedQuizzes?.find((q) => q.id === quizId);
			if (quiz && canAccessQuiz(quiz)) {
				setCurrentNestedQuizId(quizId);
			}
		}
	};

	const completeNestedQuiz = (quizId: string, answers: QuizAnswers) => {
		setCompletedQuizIds((prev) => {
			const newSet = new Set(prev);
			newSet.add(quizId);
			return newSet;
		});
		setSubmittedAnswers((prev) => ({
			...prev,
			[quizId]: answers,
		}));
		setCurrentNestedQuizId(null);
	};

	const exitToContainer = () => {
		setCurrentNestedQuizId(null);
	};

	const isQuizCompleted = (quizId: string): boolean => {
		return completedQuizIds.has(quizId);
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

		// If already completed, always accessible for review
		if (completedQuizIds.has(quiz.id)) {
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
				if (!completedQuizIds.has(nestedQuizzes[i]!.id)) {
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
		submittedAnswers,
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
