import { Button, NumberInput, Paper, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
    useUpdateQuestionScoring,
} from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface SimpleScoringFormProps {
    moduleId: number;
    question: Question;
    scoring: Extract<Question["scoring"], { type: "simple" }>;
    nestedQuizId?: string;
}

export function SimpleScoringForm({
    moduleId,
    question,
    scoring,
    nestedQuizId,
}: SimpleScoringFormProps) {
    const { submit: updateQuestionScoring, isLoading } = useUpdateQuestionScoring();

    const form = useForm({
        initialValues: {
            points: scoring.points,
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
                                type: "simple",
                                points: values.points,
                            },
                            nestedQuizId,
                        },
                    });
                })}
            >
                <Stack gap="md">
                    <Title order={5}>Scoring</Title>
                    <NumberInput
                        {...form.getInputProps("points")}
                        label="Points"
                        description="Points awarded for correct answer"
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
