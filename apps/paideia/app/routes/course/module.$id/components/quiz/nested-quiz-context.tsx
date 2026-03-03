import type {
	ContainerQuizConfig,
	NestedQuizConfig,
} from "@paideia/paideia-backend";
import { constate } from "app/utils/ui/constate";
import { useLoaderData } from "react-router";
import type { Route } from "../../route";

/**
 * Completed nested quiz information
 */
interface CompletedNestedQuiz {
	nestedQuizId: string;
	startedAt?: string | null;
	completedAt?: string | null;
}

/**
 * Context for nested quiz state management in container quizzes.
 * Provides all data needed for nested quiz selection and navigation.
 */
interface NestedQuizContextProps {
	/**
	 * The container quiz configuration
	 */
	quizConfig: ContainerQuizConfig;
	/**
	 * Currently active nested quiz (if viewing one)
	 */
	activeNestedQuiz: NestedQuizConfig | null;
	/**
	 * Active nested quiz ID from URL
	 */
	nestedQuizId: string | null;
	/**
	 * List of completed or in-progress nested quizzes.
	 * A quiz is "completed" if it has a completedAt value.
	 * A quiz is "in-progress" if it has startedAt but no completedAt.
	 */
	completedNestedQuizzes: CompletedNestedQuiz[];
	/**
	 * Whether the parent timer has expired
	 */
	isParentTimerExpired: boolean;
	/**
	 * Remaining time for nested quiz (in seconds)
	 */
	remainingTime?: number;
	/**
	 * Submission ID for the quiz attempt
	 */
	submissionId: number;
	/**
	 * Whether in readonly mode (viewing completed submission)
	 */
	readonly: boolean;
}

/**
 * Nested quiz context provider and hook.
 * Provides all data needed for nested quiz management in container quizzes.
 */
const [NestedQuizContextProvider, useNestedQuizContext] = constate(
	(props: NestedQuizContextProps) => {
		// Get moduleLinkId from loader data
		const loaderData = useLoaderData<Route.ComponentProps["loaderData"]>();
		const moduleLinkId = loaderData.params.moduleLinkId;

		// Note: completedNestedQuizzes includes both completed AND in-progress nested quizzes
		// A quiz is only "completed" if it has a completedAt value
		// If completedAt is null/undefined, the quiz is in progress

		// Compute completed quiz IDs (only those with completedAt set)
		const completedQuizIds = new Set<string>(
			props.completedNestedQuizzes
				.filter(
					(quiz) => quiz.completedAt !== null && quiz.completedAt !== undefined,
				)
				.map((completed) => completed.nestedQuizId),
		);

		// Compute in-progress quiz IDs (those with startedAt but no completedAt)
		const inProgressQuizIds = new Set<string>(
			props.completedNestedQuizzes
				.filter(
					(quiz) =>
						quiz.startedAt !== null &&
						quiz.startedAt !== undefined &&
						(quiz.completedAt === null || quiz.completedAt === undefined),
				)
				.map((quiz) => quiz.nestedQuizId),
		);

		// Compute completion progress (0-100) - only count truly completed quizzes
		const nestedQuizzes = props.quizConfig.nestedQuizzes ?? [];
		const completionProgress =
			nestedQuizzes.length > 0
				? Math.round((completedQuizIds.size / nestedQuizzes.length) * 100)
				: 0;

		// Check if all quizzes are completed
		const allQuizzesCompleted = completedQuizIds.size === nestedQuizzes.length;

		return {
			...props,
			moduleLinkId,
			completedQuizIds: Array.from(completedQuizIds), // Convert Set to Array for easier use
			inProgressQuizIds: Array.from(inProgressQuizIds), // Convert Set to Array for easier use
			completionProgress,
			allQuizzesCompleted,
			nestedQuizzes, // Expose nested quizzes for components to use
		};
	},
);

export { NestedQuizContextProvider, useNestedQuizContext };
export type { NestedQuizContextProps, CompletedNestedQuiz };
