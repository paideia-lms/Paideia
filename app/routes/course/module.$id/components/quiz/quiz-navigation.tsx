import {
    Box,
    Button,
    Group,
    Indicator,
    Paper,
    Stack,
    Text,
    Tooltip,
} from "@mantine/core";
import { IconFlag } from "@tabler/icons-react";
import { useRef } from "react";
import type {
    Question,
    QuestionAnswer,
    QuizAnswers,
} from "server/json/raw-quiz-config/v2";
import { useNuqsSearchParams } from "app/utils/search-params-utils";
import { loaderSearchParams } from "../../route";
import { QuizSubmissionModal, type QuizSubmissionModalHandle } from "./quiz-submission-modal";

/**
 * Helper function to check if a question is truly answered
 * For whiteboard questions, checks if elements array is non-empty
 */
function isQuestionAnswered(
    question: Question,
    value: QuestionAnswer | undefined,
): boolean {
    if (value === undefined || value === null) {
        return false;
    }

    // For whiteboard questions, check if elements array is non-empty
    if (question.type === "whiteboard") {
        if (typeof value !== "string" || value.trim() === "") {
            return false;
        }
        try {
            const data = JSON.parse(value) as { elements?: Array<{ isDeleted?: boolean }> };
            return (
                Array.isArray(data.elements) &&
                data.elements.length > 0 &&
                data.elements.filter((element) => !element.isDeleted).length > 0
            );
        } catch {
            return false;
        }
    }

    // For string values
    if (typeof value === "string") {
        return value.trim().length > 0;
    }

    // For array values (fill-in-the-blank, choice, ranking)
    if (Array.isArray(value)) {
        return value.length > 0 && value.some((v) => v && v.trim().length > 0);
    }

    // For object values (matrix questions)
    if (typeof value === "object") {
        return Object.keys(value).length > 0;
    }

    return true;
}

interface QuizNavigationProps {
    questionMap: Array<{
        questionId: string;
        questionNumber: number;
        pageIndex: number;
        questionIndex: number;
        prompt: string;
        question: Question;
    }>;
    answers: QuizAnswers;
    isFlagged: (questionId: string) => boolean;
    currentPageIndex: number;
    isDisabled: boolean;
}

export function QuizNavigation({
    questionMap,
    answers,
    isFlagged,
    currentPageIndex,
    isDisabled,
}: QuizNavigationProps) {
    const setSearchParams = useNuqsSearchParams(loaderSearchParams);

    return (
        <Paper withBorder p="md" radius="sm">
            <Stack gap="sm">
                <Text size="sm" fw={500}>
                    Question Navigation
                </Text>
                <Group gap="xs">
                    {questionMap.map((item) => {
                        const answerValue = answers[item.questionId];
                        const isAnswered = isQuestionAnswered(item.question, answerValue);
                        const isFlaggedValue = isFlagged(item.questionId);
                        const isCurrent = currentPageIndex === item.pageIndex;

                        return (
                            <Tooltip
                                key={item.questionId}
                                label={`Q${item.questionNumber}: ${item.prompt.slice(0, 50)}...`}
                            >
                                <Indicator
                                    inline
                                    label={<IconFlag size={10} />}
                                    size={16}
                                    disabled={!isFlaggedValue}
                                    color="red"
                                    offset={3}
                                >
                                    <Button
                                        size="compact-sm"
                                        variant={isAnswered ? "light" : "default"}
                                        color={isAnswered ? "green" : "gray"}
                                        onClick={() => {
                                            setSearchParams({ quizPageIndex: item.pageIndex });
                                        }}
                                        disabled={isDisabled}
                                        style={
                                            isCurrent
                                                ? {
                                                    borderWidth: 3,
                                                    borderStyle: "solid",
                                                    borderColor: "var(--mantine-color-blue-6)",
                                                }
                                                : undefined
                                        }
                                    >
                                        {item.questionNumber}
                                    </Button>
                                </Indicator>
                            </Tooltip>
                        );
                    })}
                </Group>
                <Group gap="md">
                    <Group gap="xs">
                        <Box
                            w={20}
                            h={20}
                            style={{
                                borderWidth: 3,
                                borderStyle: "solid",
                                borderColor: "var(--mantine-color-blue-6)",
                                borderRadius: "var(--mantine-radius-sm)",
                                backgroundColor: "transparent",
                            }}
                        />
                        <Text size="xs" c="dimmed">
                            Current
                        </Text>
                    </Group>
                    <Group gap="xs">
                        <Box
                            w={20}
                            h={20}
                            style={{
                                backgroundColor: "var(--mantine-color-green-light)",
                                borderRadius: "var(--mantine-radius-sm)",
                            }}
                        />
                        <Text size="xs" c="dimmed">
                            Answered
                        </Text>
                    </Group>
                    <Group gap="xs">
                        <IconFlag size={16} color="var(--mantine-color-red-6)" />
                        <Text size="xs" c="dimmed">
                            Flagged
                        </Text>
                    </Group>
                </Group>
            </Stack>
        </Paper>
    );
}

interface QuizNavigationButtonsProps {
    readonly?: boolean;
    onExit?: () => void;
    isFirstPage: boolean;
    isLastPage: boolean;
    currentPageIndex: number;
    isDisabled: boolean;
    onSubmit: () => void;
    isGlobalTimerExpired: boolean;
    submissionId?: number;
    moduleLinkId?: number;
    answers?: QuizAnswers;
}

export function QuizNavigationButtons({
    readonly = false,
    onExit,
    isFirstPage,
    isLastPage,
    currentPageIndex,
    isDisabled,
    onSubmit,
    isGlobalTimerExpired,
    submissionId,
    moduleLinkId,
    answers,
}: QuizNavigationButtonsProps) {
    const setSearchParams = useNuqsSearchParams(loaderSearchParams);
    const modalRef = useRef<QuizSubmissionModalHandle>(null);

    return (
        <>
            <Group justify="space-between" mt="md">
                {readonly ? (
                    <>
                        {onExit && (
                            <Button variant="default" onClick={onExit}>
                                Exit
                            </Button>
                        )}
                        <div style={{ flex: 1 }} />
                        <Group gap="sm">
                            <Button
                                variant="default"
                                onClick={() => {
                                    setSearchParams({ quizPageIndex: currentPageIndex - 1 });
                                }}
                                disabled={isFirstPage}
                            >
                                Previous
                            </Button>
                            <Button
                                onClick={() => {
                                    setSearchParams({ quizPageIndex: currentPageIndex + 1 });
                                }}
                                disabled={isLastPage}
                            >
                                Next
                            </Button>
                        </Group>
                    </>
                ) : (
                    <>
                        <Button
                            variant="default"
                            onClick={() => {
                                setSearchParams({ quizPageIndex: currentPageIndex - 1 });
                            }}
                            disabled={isFirstPage || isDisabled}
                        >
                            Previous
                        </Button>

                        {isLastPage ? (
                            isGlobalTimerExpired ? (
                                <Button
                                    onClick={() => modalRef.current?.open()}
                                    disabled={isDisabled}
                                >
                                    View Results
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => modalRef.current?.open()}
                                    disabled={isDisabled || readonly}
                                >
                                    Submit Quiz
                                </Button>
                            )
                        ) : (
                            <Button
                                onClick={() => {
                                    setSearchParams({ quizPageIndex: currentPageIndex + 1 });
                                }}
                                disabled={isDisabled}
                            >
                                Next
                            </Button>
                        )}
                    </>
                )}
            </Group>

            <QuizSubmissionModal
                ref={modalRef}
                submissionId={submissionId}
                moduleLinkId={moduleLinkId}
                answers={answers}
                onSubmit={onSubmit}
            />
        </>
    );
}
