import { Button, NumberInput, Paper, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
    useUpdateQuestionScoring,
} from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface ManualScoringFormProps {
    moduleId: number;
    question: Question;
    scoring: Extract<Question["scoring"], { type: "manual" }>;
    nestedQuizId?: string;
}

export function ManualScoringForm({
    moduleId,
    question,
    scoring,
    nestedQuizId,
}: ManualScoringFormProps) {
    const { submit: updateQuestionScoring, isLoading } = useUpdateQuestionScoring();

    const form = useForm({
        initialValues: {
            maxPoints: scoring.maxPoints,
        },
    });

    return (
        <Paper withBorder p="md" radius="md">
            <form
                onSubmit={form.onSubmit((values) => {
                    updateQuestionScoring({
                        params: { moduleId },
                        values: {
                            questionId: question.id,
                            scoring: {
                                type: "manual",
                                maxPoints: values.maxPoints,
                            },
                            nestedQuizId,
                        },
                    });
                })}
            >
                <Stack gap="md">
                    <Title order={5}>Scoring</Title>
                    <NumberInput
                        {...form.getInputProps("maxPoints")}
                        label="Maximum Points"
                        description="Maximum points for manual grading"
                        min={0}
                    />
                    <Button type="submit" loading={isLoading}>
                        Save Scoring
                    </Button>
                </Stack>
            </form>
        </Paper>
    );
}
