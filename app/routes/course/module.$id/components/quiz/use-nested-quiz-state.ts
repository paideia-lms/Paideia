import { useState } from "react";
import type {
	NestedQuizConfig,
	QuizConfig,
} from "server/json/raw-quiz-config/v2";

interface CompletedNestedQuiz {
	id: string;
	startedAt?: string | null;
	completedAt?: string | null;
}

interface UseNestedQuizStateOptions {
	quizConfig: QuizConfig;
	completedNestedQuizzes?: CompletedNestedQuiz[] | null;
}

interface UseNestedQuizStateReturn {
	currentNestedQuizId: string | null;
	completedQuizIds: Set<string>;
	activeNestedQuiz: NestedQuizConfig | null;

	startNestedQuiz: (quizId: string) => void;
	exitToContainer: () => void;
	isQuizCompleted: (quizId: string) => boolean;
	isQuizAccessible: (quizId: string) => boolean;
	canAccessQuiz: (quiz: NestedQuizConfig) => boolean;

	allQuizzesCompleted: boolean;
	completionProgress: number; // 0-100
}

export function useNestedQuizState({
	quizConfig,
	completedNestedQuizzes,
}: UseNestedQuizStateOptions): UseNestedQuizStateReturn {
	const [currentNestedQuizId, setCurrentNestedQuizId] = useState<string | null>(
		null,
	);

	const completedQuizIds = new Set<string>(
		completedNestedQuizzes?.map((completed) => completed.id) ?? [],
	);

	// Get the active nested quiz if one is selected
	const activeNestedQuiz =
		currentNestedQuizId && quizConfig.type === "container"
			? (quizConfig.nestedQuizzes?.find((q) => q.id === currentNestedQuizId) ??
				null)
			: null;

	const startNestedQuiz = (quizId: string) => {
		if (quizConfig.type === "container") {
			const quiz = quizConfig.nestedQuizzes?.find((q) => q.id === quizId);
			if (quiz && canAccessQuiz(quiz)) {
				setCurrentNestedQuizId(quizId);
			}
		}
	};

	const exitToContainer = () => {
		setCurrentNestedQuizId(null);
	};

	const isQuizCompleted = (quizId: string): boolean => {
		return completedQuizIds.has(quizId);
	};

	const isQuizAccessible = (quizId: string): boolean => {
		if (quizConfig.type !== "container") {
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
		if (quizConfig.type !== "container") {
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
				const prevQuizId = nestedQuizzes[i]!.id;
				if (!completedQuizIds.has(prevQuizId)) {
					return false;
				}
			}

			return true;
		}

		// Free order - all uncompleted quizzes are accessible
		return true;
	};

	const allQuizzesCompleted =
		quizConfig.type === "container"
			? (quizConfig.nestedQuizzes?.length ?? 0) === completedQuizIds.size
			: false;

	const completionProgress =
		quizConfig.type === "container" && quizConfig.nestedQuizzes
			? Math.round(
					(completedQuizIds.size / quizConfig.nestedQuizzes.length) * 100,
				)
			: 0;

	return {
		currentNestedQuizId,
		completedQuizIds,
		activeNestedQuiz,
		startNestedQuiz,
		exitToContainer,
		isQuizCompleted,
		isQuizAccessible,
		canAccessQuiz,
		allQuizzesCompleted,
		completionProgress,
	};
}
