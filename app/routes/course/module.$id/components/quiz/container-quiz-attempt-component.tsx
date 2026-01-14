import { Alert, Group, Paper, Stack, Text } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import { NestedQuizSelector } from "./nested-quiz-selector";
import { RegularQuizAttemptComponent, useContainerQuizAttemptContext, RegularQuizAttemptContextProvider } from "./quiz-attempt-component";
import { TimerDisplay } from "app/components/timer-display";
import { NestedQuizContextProvider } from "./nested-quiz-context";

export function ContainerQuizAttemptComponent() {
    const {
        quizConfig,
        submission,
        remainingTime,
        nestedQuizId,
    } = useContainerQuizAttemptContext();
    // const [isParentTimerExpired, setIsParentTimerExpired] = useState(false);
    const isParentTimerExpired = false;

    // Use submission.completedNestedQuizzes directly to ensure we get the latest data after revalidation
    const completedNestedQuizzes = submission.completedNestedQuizzes ?? [];

    // Check if viewing a completed nested quiz (readonly mode)
    // A nested quiz is "completed" only if it has a completedAt value
    const isViewingCompletedNestedQuiz =
        nestedQuizId !== null &&
        submission.completedNestedQuizzes?.some(
            (q) => q.nestedQuizId === nestedQuizId && q.completedAt !== null && q.completedAt !== undefined,
        );
    const isInProgress = submission.status === "in_progress";


    const activeNestedQuiz = nestedQuizId ? quizConfig.nestedQuizzes?.find((q) => q.id === nestedQuizId) ?? null : null;

    return (
        <NestedQuizContextProvider
            quizConfig={quizConfig}
            activeNestedQuiz={activeNestedQuiz}
            nestedQuizId={nestedQuizId}
            completedNestedQuizzes={completedNestedQuizzes}
            isParentTimerExpired={isParentTimerExpired}
            remainingTime={remainingTime}
            submissionId={submission.id}
            readonly={submission.status !== "in_progress"}
        >
            <Stack gap="md">
                {/* Parent Timer (always visible if exists) */}
                {isInProgress && !isViewingCompletedNestedQuiz && quizConfig.globalTimer && (
                    <Paper withBorder p="md" radius="sm">
                        <Group justify="space-between">
                            <Text size="sm" fw={500}>
                                Overall Time Limit
                            </Text>
                            <TimerDisplay
                                key={`parent-timer-${remainingTime ?? quizConfig.globalTimer}`}
                                initialTime={quizConfig.globalTimer}
                                remainingTime={remainingTime}
                                onExpire={() => {
                                    // Parent timer expired - this will be handled by SingleQuizPreview
                                    console.log("Parent timer expired");
                                }}
                            />
                        </Group>
                    </Paper>
                )}

                {/* Parent Timer Expired Warning */}
                {isInProgress && !isViewingCompletedNestedQuiz && isParentTimerExpired && (
                    <Alert
                        color="red"
                        title="Time Expired"
                        icon={<IconClock size={20} />}
                    >
                        The overall time limit has expired. All quizzes are now locked.
                    </Alert>
                )}

                {/* Nested Quiz Timer (only when inside a nested quiz) */}
                {isInProgress && !isViewingCompletedNestedQuiz && activeNestedQuiz?.globalTimer &&
                    !isViewingCompletedNestedQuiz && (
                        <Paper withBorder p="md" radius="sm" bg="blue.0">
                            <Group justify="space-between">
                                <Text size="sm" fw={500}>
                                    Current Quiz Time
                                </Text>
                                <TimerDisplay
                                    key={`nested-timer-${remainingTime ?? activeNestedQuiz.globalTimer}`}
                                    initialTime={activeNestedQuiz.globalTimer}
                                    remainingTime={remainingTime}
                                    onExpire={() => {
                                        // Nested timer expired - this will be handled by SingleQuizPreview
                                    }}
                                />
                            </Group>
                        </Paper>
                    )}

                {/* Content: Either selector or nested quiz */}
                {nestedQuizId === null ? (
                    <NestedQuizSelector />
                ) : activeNestedQuiz ? (
                    <RegularQuizAttemptContextProvider
                        quizConfig={activeNestedQuiz}
                        submission={submission}
                        remainingTime={remainingTime}
                        disableInteraction={isParentTimerExpired}
                    >
                        <RegularQuizAttemptComponent
                            grading={quizConfig.grading}
                        />
                    </RegularQuizAttemptContextProvider>
                ) : null}
            </Stack>
        </NestedQuizContextProvider>
    );
}
