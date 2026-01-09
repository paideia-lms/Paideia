import { Button, Paper, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useUpdateQuizInfo,
} from "app/routes/user/module/edit-setting/route";
import type { QuizConfig } from "./types";

interface QuizInfoFormProps {
	moduleId: number;
	quizConfig: QuizConfig;
}

export function QuizInfoForm({ moduleId, quizConfig }: QuizInfoFormProps) {
	const { submit: updateQuizInfo, isLoading } = useUpdateQuizInfo();

	const form = useForm({
		initialValues: {
			title: quizConfig.title,
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateQuizInfo({
					params: { moduleId },
					values: {
						updates: { title: values.title },
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={4}>Quiz Information</Title>
				<TextInput
					{...form.getInputProps("title")}
					label="Quiz Title"
					required
				/>
				<Button type="submit" loading={isLoading}>
					Save Quiz Information
				</Button>
			</Stack>
		</form>
	);
}
