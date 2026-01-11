import { Alert, Group, Paper, Stack, Text } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import { useState } from "react";
import type {
    QuizAnswers,
    QuizConfig,
} from "server/json/raw-quiz-config/v2";
import { NestedQuizSelector } from "./nested-quiz-selector";
import { useNestedQuizState } from "./use-nested-quiz-state";
import {
    SingleQuizPreview,
    TimerDisplay,
} from "./quiz-attempt-component";

interface ContainerQuizAttemptComponentProps {
    quizConfig: QuizConfig;
    submissionId: number;
    onSubmit?: () => void;
    remainingTime?: number;
    initialAnswers?: QuizAnswers;
    currentPageIndex: number | undefined;
    moduleLinkId?: number;
    flaggedQuestions?: Array<{ questionId: string }>;
    readonly?: boolean;
}

export function ContainerQuizAttemptComponent({
    quizConfig,
    submissionId,
    onSubmit,
    remainingTime,
    initialAnswers,
    currentPageIndex,
    moduleLinkId,
    flaggedQuestions = [],
    readonly = false,
}: ContainerQuizAttemptComponentProps) {
    const [isParentTimerExpired, setIsParentTimerExpired] = useState(false);

    // For container quizzes, use nested quiz state
    const nestedQuizState = useNestedQuizState({
        quizConfig,
        initialAnswers,
    });

    const handleParentTimerExpire = () => {
        setIsParentTimerExpired(true);
        // If in a nested quiz when parent expires, force exit
        if (nestedQuizState.currentNestedQuizId) {
            nestedQuizState.exitToContainer();
        }
    };

    // Check if viewing a completed nested quiz (readonly mode)
    const isViewingCompletedQuiz =
        nestedQuizState.currentNestedQuizId !== null &&
        nestedQuizState.isQuizCompleted(nestedQuizState.currentNestedQuizId);

    return (
        <Stack gap="md">
            {/* Parent Timer (always visible if exists) */}
            {quizConfig.globalTimer && (
                <Paper withBorder p="md" radius="sm">
                    <Group justify="space-between">
                        <Text size="sm" fw={500}>
                            Overall Time Limit
                        </Text>
                        <TimerDisplay
                            key={`parent-timer-${remainingTime ?? quizConfig.globalTimer}`}
                            initialTime={quizConfig.globalTimer}
                            remainingTime={remainingTime}
                            onExpire={handleParentTimerExpire}
                        />
                    </Group>
                </Paper>
            )}

            {/* Parent Timer Expired Warning */}
            {isParentTimerExpired && (
                <Alert color="red" title="Time Expired" icon={<IconClock size={20} />}>
                    The overall time limit has expired. All quizzes are now locked.
                </Alert>
            )}

            {/* Nested Quiz Timer (only when inside a nested quiz) */}
            {nestedQuizState.activeNestedQuiz?.globalTimer &&
                !isViewingCompletedQuiz && (
                    <Paper withBorder p="md" radius="sm" bg="blue.0">
                        <Group justify="space-between">
                            <Text size="sm" fw={500}>
                                Current Quiz Time
                            </Text>
                            <TimerDisplay
                                key={`nested-timer-${remainingTime ?? nestedQuizState.activeNestedQuiz.globalTimer}`}
                                initialTime={nestedQuizState.activeNestedQuiz.globalTimer}
                                remainingTime={remainingTime}
                                onExpire={() => {
                                    // Nested timer expired - this will be handled by SingleQuizPreview
                                }}
                            />
                        </Group>
                    </Paper>
                )}

            {/* Content: Either selector or nested quiz */}
            {nestedQuizState.currentNestedQuizId === null ? (
                <NestedQuizSelector
                    quizConfig={quizConfig}
                    completedQuizIds={nestedQuizState.completedQuizIds}
                    onStartQuiz={nestedQuizState.startNestedQuiz}
                    canAccessQuiz={nestedQuizState.canAccessQuiz}
                    isQuizCompleted={nestedQuizState.isQuizCompleted}
                    completionProgress={nestedQuizState.completionProgress}
                    isParentTimerExpired={isParentTimerExpired}
                />
            ) : nestedQuizState.activeNestedQuiz ? (
                <SingleQuizPreview
                    quizConfig={nestedQuizState.activeNestedQuiz}
                    readonly={readonly || isViewingCompletedQuiz}
                    moduleLinkId={moduleLinkId}
                    initialAnswers={
                        isViewingCompletedQuiz && initialAnswers
                            ? (() => {
                                // Extract answers for this specific nested quiz from initialAnswers
                                const nestedQuizAnswers: QuizAnswers = {};
                                const activeQuiz = nestedQuizState.activeNestedQuiz;
                                if (activeQuiz?.pages) {
                                    for (const page of activeQuiz.pages) {
                                        for (const question of page.questions) {
                                            const answer = initialAnswers[question.id];
                                            if (answer !== undefined && answer !== null) {
                                                nestedQuizAnswers[question.id] = answer;
                                            }
                                        }
                                    }
                                }
                                return nestedQuizAnswers;
                            })()
                            : undefined
                    }
                    onSubmit={() => {
                        if (nestedQuizState.currentNestedQuizId) {
                            // For nested quizzes, we still need to handle completion differently
                            // This is a simplified version - nested quiz handling may need more work
                            if (onSubmit) {
                                onSubmit();
                            }
                        }
                    }}
                    submissionId={submissionId}
                    onExit={nestedQuizState.exitToContainer}
                    disableInteraction={isParentTimerExpired}
                    remainingTime={remainingTime}
                    grading={quizConfig.grading}
                    currentPageIndex={currentPageIndex}
                    flaggedQuestions={
                        nestedQuizState.currentNestedQuizId
                            ? (() => {
                                // Filter flagged questions to only include those for the current nested quiz
                                // For nested quizzes, question IDs are prefixed with nestedQuizId:questionId
                                const nestedQuizId = nestedQuizState.currentNestedQuizId;
                                const prefix = `${nestedQuizId}:`;
                                return flaggedQuestions.filter((f) =>
                                    f.questionId.startsWith(prefix),
                                ).map((f) => ({
                                    // Remove the prefix to get the actual question ID for the nested quiz
                                    questionId: f.questionId.replace(prefix, ""),
                                }));
                            })()
                            : []
                    }
                />
            ) : null}
        </Stack>
    );
}
