import { Group, Paper, Stack, Title } from "@mantine/core";
import type { QuizPage } from "./types";
import { QuestionForm } from "./question-form";
import { AddQuestionForm } from "./add-question-form";
import { RemoveQuestionButton } from "./remove-question-button";

interface QuestionsListProps {
    moduleId: number;
    page: QuizPage;
    pageIndex: number;
    nestedQuizId?: string;
}

export function QuestionsList({
    moduleId,
    page,
    nestedQuizId,
}: QuestionsListProps) {
    const questions = page.questions || [];

    return (
        <Paper withBorder p="md" radius="md">
            <Stack gap="md">
                <Title order={5}>Questions</Title>

                <AddQuestionForm moduleId={moduleId} pageId={page.id} nestedQuizId={nestedQuizId} />

                {questions.length === 0 ? (
                    <Paper withBorder p="xl" radius="md">
                        <p>No questions yet. Add a question above.</p>
                    </Paper>
                ) : (
                    <Stack gap="md">
                        {questions.map((question, index) => (
                            <Group key={question.id} align="flex-start" wrap="nowrap">
                                <div style={{ flex: 1 }}>
                                    <QuestionForm
                                        moduleId={moduleId}
                                        question={question}
                                        questionIndex={index}
                                        nestedQuizId={nestedQuizId}
                                    />
                                </div>
                                <RemoveQuestionButton
                                    moduleId={moduleId}
                                    questionId={question.id}
                                    nestedQuizId={nestedQuizId}
                                />
                            </Group>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
}
