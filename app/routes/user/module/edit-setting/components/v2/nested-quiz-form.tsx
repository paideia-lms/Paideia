import { Stack } from "@mantine/core";
import { PagesList } from "./pages-list";
import { ResourcesList } from "./resources-list";
import type { NestedQuizConfig, QuizConfig } from "./types";
import { UpdateNestedQuizInfoForm } from "./update-nested-quiz-info-form";
import { UpdateNestedQuizTimerForm } from "./update-nested-quiz-timer-form";

interface NestedQuizFormProps {
	moduleId: number;
	nestedQuiz: NestedQuizConfig;
	nestedQuizIndex: number;
	parentQuizConfig: QuizConfig;
}

export function NestedQuizForm({
	moduleId,
	nestedQuiz,
	nestedQuizIndex,
	parentQuizConfig,
}: NestedQuizFormProps) {
	// Create a temporary regular config structure for PagesList and ResourcesList
	// Include the parent container quiz's grading config since nested quizzes inherit it
	const tempQuizConfig: QuizConfig = {
		version: "v2",
		type: "regular",
		id: nestedQuiz.id,
		title: nestedQuiz.title,
		pages: nestedQuiz.pages,
		resources: nestedQuiz.resources,
		globalTimer: nestedQuiz.globalTimer,
		grading: parentQuizConfig.type === "container" ? parentQuizConfig.grading : undefined,
	};

	return (
		<Stack gap="md">
			<UpdateNestedQuizInfoForm
				moduleId={moduleId}
				nestedQuiz={nestedQuiz}
			/>

			<UpdateNestedQuizTimerForm
				moduleId={moduleId}
				nestedQuiz={nestedQuiz}
			/>

			<ResourcesList
				moduleId={moduleId}
				quizConfig={tempQuizConfig}
				nestedQuizId={nestedQuiz.id}
			/>

			<PagesList
				moduleId={moduleId}
				quizConfig={tempQuizConfig}
				nestedQuizId={nestedQuiz.id}
			/>
		</Stack>
	);
}
