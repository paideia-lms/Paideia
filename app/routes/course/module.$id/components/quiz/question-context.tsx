import type {
	GradingConfig,
	Question,
	QuestionAnswer,
} from "server/json/raw-quiz-config/v2";
import { constate } from "app/utils/constate";
import { useRegularQuizAttemptContext } from "./quiz-attempt-component";

/**
 * Context for individual question data.
 * Each QuestionCard is wrapped with its own QuestionContextProvider.
 */
interface QuestionContextProps {
	/**
	 * The question configuration
	 */
	question: Question;
	/**
	 * Display number for the question (e.g., 1, 2, 3...)
	 */
	questionNumber: number;
	/**
	 * Current answer value for this question
	 */
	answer: QuestionAnswer | undefined;
	/**
	 * Whether this question is flagged for review
	 */
	isFlagged: boolean;
	/**
	 * Submission ID for saving answers
	 */
	submissionId: number;
	/**
	 * Grading configuration (if grading is enabled)
	 */
	grading?: GradingConfig;
}

/**
 * Question context provider and hook.
 * Provides all data needed for rendering a single question card.
 */
const [QuestionContextProvider, useQuestionContext] = constate(
	(props: QuestionContextProps) => {
		// Get readonly, isDisabled, moduleLinkId, quizPageIndex, and nestedQuizId from parent context
		const {
			readonly,
			isDisabled,
			moduleLinkId,
			quizPageIndex,
			nestedQuizId,
		} = useRegularQuizAttemptContext();

		return {
			...props,
			readonly,
			isDisabled,
			moduleLinkId,
			quizPageIndex,
			nestedQuizId,
		};
	},
);

export { QuestionContextProvider, useQuestionContext };
export type { QuestionContextProps };
