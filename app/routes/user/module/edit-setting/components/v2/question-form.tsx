import {
    Paper,
    Stack,
    Title,
} from "@mantine/core";
import type { Question, QuizConfig } from "./types";
import { QuestionOptionsForm } from "./question-options-form";
import { QuestionScoringForm } from "./question-scoring-form";
import { UpdateQuestionForm } from "./update-question-form";

interface QuestionFormProps {
    moduleId: number;
    question: Question;
    questionIndex: number;
    quizConfig: QuizConfig;
    nestedQuizId?: string;
}

const QuestionTypeLabels: Record<Question["type"], string> = {
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

export function QuestionForm({
    moduleId,
    question,
    questionIndex,
    quizConfig,
    nestedQuizId,
}: QuestionFormProps) {


    return (
        <Paper withBorder p="md" radius="md">
            <Stack gap="md">
                <Title order={6}>
                    Question {questionIndex + 1}: {QuestionTypeLabels[question.type]}
                </Title>

                <UpdateQuestionForm
                    moduleId={moduleId}
                    question={question}
                    nestedQuizId={nestedQuizId}
                />

                <QuestionOptionsForm
                    moduleId={moduleId}
                    question={question}
                    nestedQuizId={nestedQuizId}
                />

                {quizConfig.grading?.enabled && (
                    <QuestionScoringForm
                        moduleId={moduleId}
                        question={question}
                        nestedQuizId={nestedQuizId}
                    />
                )}
            </Stack>
        </Paper>
    );
}
