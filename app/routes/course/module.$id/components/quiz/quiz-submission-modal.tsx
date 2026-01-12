import {
    Button,
    Code,
    Group,
    Modal,
    ScrollArea,
    Stack,
    Text,
} from "@mantine/core";
import { forwardRef, useImperativeHandle, useState } from "react";
import type { QuizAnswers } from "server/json/raw-quiz-config/v2";
import { useMarkQuizAttemptAsComplete, type Route } from "../../route";
import { createRouteComponent } from "~/utils/create-route-component";

interface MarkCompleteButtonProps {
    submissionId: number;
    onComplete: () => void;
}

const MarkCompleteButton = createRouteComponent<Route.ComponentProps, MarkCompleteButtonProps>(
    (props, { loaderData }) => {
        const { submissionId, onComplete } = props;
        const { params: { moduleLinkId } } = loaderData;
        const { submit: markQuizAttemptAsComplete, isLoading: isMarkingQuizAttemptAsComplete } = useMarkQuizAttemptAsComplete();

        return (
            <Button
                onClick={async () => {
                    await markQuizAttemptAsComplete({
                        values: {
                            submissionId: submissionId,
                        },
                        params: {
                            moduleLinkId: moduleLinkId,
                        },
                    });
                    onComplete();
                }}
                disabled={isMarkingQuizAttemptAsComplete}
                loading={isMarkingQuizAttemptAsComplete}
            >
                Confirm Submission
            </Button>
        );
    }
);

export interface QuizSubmissionModalHandle {
    open: () => void;
}

interface QuizSubmissionModalProps {
    submissionId?: number;
    answers?: QuizAnswers;
    onSubmit?: () => void;
}

export const QuizSubmissionModal = forwardRef<
    QuizSubmissionModalHandle,
    QuizSubmissionModalProps
>(({ submissionId, answers, onSubmit }, ref) => {
    const [opened, setOpened] = useState(false);

    useImperativeHandle(ref, () => ({
        open: () => {
            setOpened(true);
        },
    }));

    return (
        <Modal
            opened={opened}
            onClose={() => setOpened(false)}
            title="Review Your Answers"
            size="lg"
        >
            <Stack gap="md">
                <Text>Please review your answers before submitting the quiz.</Text>

                <Text size="sm" fw={500}>
                    Your Answers:
                </Text>

                <ScrollArea h={400}>
                    <Code block>{JSON.stringify(answers, null, 2)}</Code>
                </ScrollArea>

                <Group justify="flex-end" gap="sm">
                    <Button
                        variant="default"
                        onClick={() => setOpened(false)}
                    >
                        Cancel
                    </Button>
                    {submissionId ? (
                        <MarkCompleteButton
                            submissionId={submissionId}
                            onComplete={() => setOpened(false)}
                        />
                    ) : (
                        <Button
                            onClick={() => {
                                if (onSubmit) {
                                    onSubmit();
                                }
                                setOpened(false);
                            }}
                        >
                            Confirm Submission
                        </Button>
                    )}
                </Group>
            </Stack>
        </Modal>
    );
});

QuizSubmissionModal.displayName = "QuizSubmissionModal";
