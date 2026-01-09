import { Stack } from "@mantine/core";
import type { Route } from "../../+types/route";
import { ToggleQuizTypeForm } from "./toggle-quiz-type-form";
import { QuizInfoForm } from "./quiz-info-form";
import { GlobalTimerForm } from "./global-timer-form";
import { GradingConfigForm } from "./grading-config-form";
import { NestedQuizList } from "./nested-quiz-list";
import { PagesList } from "./pages-list";
import { ResourcesList } from "./resources-list";
import { ModuleInfoForm } from "./module-info-form";

interface QuizFormV2Props {
    module: Extract<
        Route.ComponentProps["loaderData"]["module"],
        { type: "quiz" }
    >;
}

export function QuizFormV2({ module }: QuizFormV2Props) {
    const rawQuizConfig = module.rawQuizConfig;
    const quizType = rawQuizConfig?.type ?? "regular";

    return (
        <Stack gap="lg">
            {/* Module-level fields */}
            <ModuleInfoForm module={module} />

            {/* Quiz Type Toggle */}
            <ToggleQuizTypeForm moduleId={module.id} currentType={quizType} />

            {/* Quiz Info */}
            {rawQuizConfig && (
                <QuizInfoForm moduleId={module.id} quizConfig={rawQuizConfig} />
            )}

            {/* Global Timer */}
            {rawQuizConfig && (
                <GlobalTimerForm moduleId={module.id} quizConfig={rawQuizConfig} />
            )}

            {/* Grading Config */}
            {rawQuizConfig && (
                <GradingConfigForm moduleId={module.id} quizConfig={rawQuizConfig} />
            )}

            {/* Regular Quiz: Pages and Resources */}
            {rawQuizConfig && quizType === "regular" && (
                <>
                    <ResourcesList
                        moduleId={module.id}
                        quizConfig={rawQuizConfig}
                        nestedQuizId={undefined}
                    />
                    <PagesList
                        moduleId={module.id}
                        quizConfig={rawQuizConfig}
                        nestedQuizId={undefined}
                    />
                </>
            )}

            {/* Container Quiz: Nested Quizzes */}
            {rawQuizConfig && quizType === "container" && (
                <NestedQuizList moduleId={module.id} quizConfig={rawQuizConfig} />
            )}
        </Stack>
    );
}
