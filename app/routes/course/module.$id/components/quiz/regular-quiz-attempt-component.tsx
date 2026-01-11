import type {
    GradingConfig,
    QuizAnswers,
    RegularQuizConfig,
} from "server/json/raw-quiz-config/v2";
import { SingleQuizPreview } from "./quiz-attempt-component";

interface RegularQuizAttemptComponentProps {
    quizConfig: RegularQuizConfig;
    submissionId: number;
    onSubmit?: () => void;
    remainingTime?: number;
    initialAnswers?: QuizAnswers;
    currentPageIndex: number | undefined;
    moduleLinkId?: number;
    flaggedQuestions?: Array<{ questionId: string }>;
    readonly?: boolean;
}

export function RegularQuizAttemptComponent({
    quizConfig,
    submissionId,
    onSubmit,
    remainingTime,
    initialAnswers,
    currentPageIndex,
    moduleLinkId,
    flaggedQuestions = [],
    readonly = false,
}: RegularQuizAttemptComponentProps) {
    return (
        <SingleQuizPreview
            quizConfig={quizConfig}
            readonly={readonly}
            onSubmit={onSubmit}
            remainingTime={remainingTime}
            grading={quizConfig.grading}
            initialAnswers={initialAnswers}
            submissionId={submissionId}
            currentPageIndex={currentPageIndex}
            moduleLinkId={moduleLinkId}
            flaggedQuestions={flaggedQuestions}
        />
    );
}
