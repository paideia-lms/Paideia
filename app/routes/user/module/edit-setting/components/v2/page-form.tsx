import { Paper, Stack, Title } from "@mantine/core";
import type { QuizConfig, QuizPage } from "./types";
import { QuestionsList } from "./questions-list";
import { UpdatePageInfoForm } from "./update-page-info-form";

interface PageFormProps {
	moduleId: number;
	page: QuizPage;
	pageIndex: number;
	quizConfig: QuizConfig;
	nestedQuizId?: string;
}

export function PageForm({
	moduleId,
	page,
	pageIndex,
	quizConfig,
	nestedQuizId,
}: PageFormProps) {
	return (
		<Paper withBorder p="md" radius="md">
			<Stack gap="md">
				<Title order={5}>Page {pageIndex + 1}</Title>

				<UpdatePageInfoForm
					moduleId={moduleId}
					page={page}
					nestedQuizId={nestedQuizId}
				/>

				<QuestionsList
					moduleId={moduleId}
					page={page}
					pageIndex={pageIndex}
					quizConfig={quizConfig}
					nestedQuizId={nestedQuizId}
				/>
			</Stack>
		</Paper>
	);
}
