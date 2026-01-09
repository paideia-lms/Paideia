import { Button, NumberInput, Paper, Select, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
    useUpdateQuestionScoring,
} from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface RankingScoringFormProps {
    moduleId: number;
    question: Question;
    scoring: Extract<Question["scoring"], { type: "ranking" }>;
    nestedQuizId?: string;
}

export function RankingScoringForm({
    moduleId,
    question,
    scoring,
    nestedQuizId,
}: RankingScoringFormProps) {
    const { submit: updateQuestionScoring, isLoading } = useUpdateQuestionScoring();

    const form = useForm({
        initialValues: {
            mode: scoring.mode,
            maxPoints: scoring.maxPoints,
            pointsPerCorrectPosition: scoring.mode === "exact-order" ? 0 : scoring.pointsPerCorrectPosition ?? 0,
        },
    });

    return (
        <Paper withBorder p="md" radius="md">
            <form
                onSubmit={form.onSubmit((values) => {
                    if (values.mode === "exact-order") {
                        updateQuestionScoring({
                            params: { moduleId },
                            values: {
                                questionId: question.id,
                                scoring: {
                                    type: "ranking",
                                    mode: "exact-order",
                                    maxPoints: values.maxPoints,
                                },
                                nestedQuizId,
                            },
                        });
                    } else {
                        updateQuestionScoring({
                            params: { moduleId },
                            values: {
                                questionId: question.id,
                                scoring: {
                                    type: "ranking",
                                    mode: "partial-order",
                                    maxPoints: values.maxPoints,
                                    pointsPerCorrectPosition: values.pointsPerCorrectPosition,
                                },
                                nestedQuizId,
                            },
                        });
                    }
                })}
            >
                <Stack gap="md">
                    <Title order={5}>Scoring</Title>
                    <Select
                        {...form.getInputProps("mode")}
                        label="Scoring Mode"
                        data={[
                            { value: "exact-order", label: "Exact Order Required" },
                            { value: "partial-order", label: "Partial Credit Per Position" },
                        ]}
                    />
                    <NumberInput
                        {...form.getInputProps("maxPoints")}
                        label="Maximum Points"
                        min={0}
                    />
                    {form.values.mode === "partial-order" && (
                        <NumberInput
                            {...form.getInputProps("pointsPerCorrectPosition")}
                            label="Points Per Correct Position"
                            min={0}
                            step={0.1}
                        />
                    )}
                    <Button type="submit" loading={isLoading}>
                        Save Scoring
                    </Button>
                </Stack>
            </form>
        </Paper>
    );
}
