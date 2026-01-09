import { Paper, Stack, Title } from "@mantine/core";
import type { QuizConfig, QuizPage } from "./types";
import { QuestionsList } from "./questions-list";
import { UpdatePageInfoForm } from "./update-page-info-form";
import { RemovePageButton } from "./remove-page-button";

interface PageFormProps {
	moduleId: number;
	page: QuizPage;
	pageIndex: number;
	quizConfig: QuizConfig;
	totalPages: number;
	nestedQuizId?: string;
}

export function PageForm({
	moduleId,
	page,
	pageIndex,
	quizConfig,
	nestedQuizId,
	totalPages,
}: PageFormProps) {

	return (
		<Stack gap="md">
			<Title order={5}>Page {pageIndex + 1}

				<RemovePageButton
					moduleId={moduleId}
					pageId={page.id}
					nestedQuizId={nestedQuizId}
					disabled={totalPages <= 1}
				/>
			</Title>

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
	);
}
