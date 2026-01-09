import { Button, Paper, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useUpdatePageInfo,
} from "app/routes/user/module/edit-setting/route";
import type { QuizPage } from "./types";
import { QuestionsList } from "./questions-list";

interface PageFormProps {
	moduleId: number;
	page: QuizPage;
	pageIndex: number;
	nestedQuizId?: string;
}

export function PageForm({
	moduleId,
	page,
	pageIndex,
	nestedQuizId,
}: PageFormProps) {
	const { submit: updatePageInfo, isLoading } = useUpdatePageInfo();

	const form = useForm({
		initialValues: {
			title: page.title,
		},
	});

	return (
		<Paper withBorder p="md" radius="md">
			<Stack gap="md">
				<Title order={5}>Page {pageIndex + 1}</Title>

				<form
					onSubmit={form.onSubmit((values) => {
						updatePageInfo({
							params: { moduleId },
							values: {
								pageId: page.id,
								updates: { title: values.title },
								nestedQuizId,
							},
						});
					})}
				>
					<Stack gap="md">
						<TextInput
							{...form.getInputProps("title")}
							label="Page Title"
							required
						/>
						<Button type="submit" loading={isLoading}>
							Save Page Title
						</Button>
					</Stack>
				</form>

				<QuestionsList
					moduleId={moduleId}
					page={page}
					pageIndex={pageIndex}
					nestedQuizId={nestedQuizId}
				/>
			</Stack>
		</Paper>
	);
}
