import { Stack } from "@mantine/core";
import type { Route } from "../../+types/route";
import { ToggleQuizTypeForm } from "./toggle-quiz-type-form";
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

	return (
		<Stack gap="lg">
			{/* Module-level fields */}
			<ModuleInfoForm module={module} />

			{/* Quiz Type Toggle */}
			<ToggleQuizTypeForm
				moduleId={module.id}
				currentType={rawQuizConfig?.type ?? "regular"}
			/>

			{/* Global Timer */}
			{rawQuizConfig && (
				<GlobalTimerForm moduleId={module.id} quizConfig={rawQuizConfig} />
			)}

			{/* Grading Config */}
			{rawQuizConfig && (
				<GradingConfigForm moduleId={module.id} quizConfig={rawQuizConfig} />
			)}

			{/* Regular Quiz: Pages and Resources */}
			{rawQuizConfig && rawQuizConfig.type === "regular" && (
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
			{rawQuizConfig && rawQuizConfig.type === "container" && (
				<NestedQuizList moduleId={module.id} quizConfig={rawQuizConfig} />
			)}
		</Stack>
	);
}
