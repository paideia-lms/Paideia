import { useForm } from "@mantine/form";
import { useState } from "react";
import type { QuestionAnswer, QuizAnswers, QuizConfig } from "./quiz-config.types";

interface UseQuizFormReturn {
    currentPageIndex: number;
    answers: QuizAnswers;
    form: ReturnType<typeof useForm<{ answers: QuizAnswers }>>;
    goToNextPage: () => void;
    goToPreviousPage: () => void;
    goToPage: (pageIndex: number) => void;
    setAnswer: (questionId: string, answer: QuestionAnswer) => void;
    getAnswer: (questionId: string) => QuestionAnswer | undefined;
    isFirstPage: boolean;
    isLastPage: boolean;
    flaggedQuestions: Set<string>;
    toggleFlag: (questionId: string) => void;
    isFlagged: (questionId: string) => boolean;
}

export function useQuizForm(quizConfig: QuizConfig): UseQuizFormReturn {
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(
        new Set(),
    );

    const form = useForm<{ answers: QuizAnswers }>({
        mode: "uncontrolled",
        initialValues: {
            answers: {},
        },
    });

    const goToNextPage = () => {
        if (currentPageIndex < quizConfig.pages.length - 1) {
            setCurrentPageIndex((prev) => prev + 1);
        }
    };

    const goToPreviousPage = () => {
        if (currentPageIndex > 0) {
            setCurrentPageIndex((prev) => prev - 1);
        }
    };

    const goToPage = (pageIndex: number) => {
        if (pageIndex >= 0 && pageIndex < quizConfig.pages.length) {
            setCurrentPageIndex(pageIndex);
        }
    };

    const setAnswer = (questionId: string, answer: QuestionAnswer) => {
        form.setFieldValue(`answers.${questionId}`, answer);
    };

    const getAnswer = (questionId: string): QuestionAnswer | undefined => {
        return form.getValues().answers[questionId];
    };

    const toggleFlag = (questionId: string) => {
        setFlaggedQuestions((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(questionId)) {
                newSet.delete(questionId);
            } else {
                newSet.add(questionId);
            }
            return newSet;
        });
    };

    const isFlagged = (questionId: string): boolean => {
        return flaggedQuestions.has(questionId);
    };

    const isFirstPage = currentPageIndex === 0;
    const isLastPage = currentPageIndex === quizConfig.pages.length - 1;

    return {
        currentPageIndex,
        answers: form.getValues().answers,
        form,
        goToNextPage,
        goToPreviousPage,
        goToPage,
        setAnswer,
        getAnswer,
        isFirstPage,
        isLastPage,
        flaggedQuestions,
        toggleFlag,
        isFlagged,
    };
}

