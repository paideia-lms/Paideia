import {
    Button,
    Paper,
    Stack,
    Textarea,
    Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
    useUpdateQuestion,
} from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";
import { QuestionOptionsForm } from "./question-options-form";
import { QuestionScoringForm } from "./question-scoring-form";

interface QuestionFormProps {
    moduleId: number;
    question: Question;
    questionIndex: number;
    nestedQuizId?: string;
}

export function QuestionForm({
    moduleId,
    question,
    questionIndex,
    nestedQuizId,
}: QuestionFormProps) {
    const { submit: updateQuestion, isLoading: isUpdating } = useUpdateQuestion();

    const questionForm = useForm({
        initialValues: {
            prompt: question.prompt,
            feedback: question.feedback || "",
        },
    });

    const getQuestionTypeLabel = (type: Question["type"]): string => {
        const labels: Record<Question["type"], string> = {
            "multiple-choice": "Multiple Choice",
            "short-answer": "Short Answer",
            "long-answer": "Long Answer",
            article: "Article",
            "fill-in-the-blank": "Fill in the Blank",
            choice: "Choice (Multiple Selection)",
            ranking: "Ranking",
            "single-selection-matrix": "Single Selection Matrix",
            "multiple-selection-matrix": "Multiple Selection Matrix",
            whiteboard: "Whiteboard",
        };
        return labels[type];
    };

    return (
        <Paper withBorder p="md" radius="md">
            <Stack gap="md">
                <Title order={6}>
                    Question {questionIndex + 1}: {getQuestionTypeLabel(question.type)}
                </Title>

                <form
                    onSubmit={questionForm.onSubmit((values) => {
                        updateQuestion({
                            params: { moduleId },
                            values: {
                                questionId: question.id,
                                updates: {
                                    prompt: values.prompt,
                                    feedback: values.feedback,
                                },
                                nestedQuizId,
                            },
                        });
                    })}
                >
                    <Stack gap="md">
                        <Textarea
                            {...questionForm.getInputProps("prompt")}
                            label="Question Prompt"
                            minRows={2}
                            required
                        />

                        <Textarea
                            {...questionForm.getInputProps("feedback")}
                            label="Feedback (optional)"
                            description="Shown to students after answering"
                            minRows={2}
                        />

                        <Button type="submit" loading={isUpdating}>
                            Save Question
                        </Button>
                    </Stack>
                </form>

                <QuestionOptionsForm
                    moduleId={moduleId}
                    question={question}
                    nestedQuizId={nestedQuizId}
                />

                <QuestionScoringForm
                    moduleId={moduleId}
                    question={question}
                    nestedQuizId={nestedQuizId}
                />
            </Stack>
        </Paper>
    );
}
