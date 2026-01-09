import { Button, Paper, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useAddNestedQuiz,
} from "app/routes/user/module/edit-setting/route";

interface AddNestedQuizFormProps {
	moduleId: number;
}

export function AddNestedQuizForm({
	moduleId,
}: AddNestedQuizFormProps) {
	const { submit: addNestedQuiz, isLoading } = useAddNestedQuiz();

	const form = useForm({
		initialValues: {},
	});

	return (
		<Paper withBorder p="md" radius="md">
			<form
				onSubmit={form.onSubmit(() => {
					addNestedQuiz({
						params: { moduleId },
						values: {},
					});
					form.reset();
				})}
			>
				<Stack gap="md">
					<Title order={4}>Add Quiz</Title>
					<TextInput
						{...form.getInputProps("title")}
						label="Quiz Title"
						placeholder="e.g., Quiz 1"
					/>
					<Button type="submit" loading={isLoading}>
						Add Quiz
					</Button>
				</Stack>
			</form>
		</Paper>
	);
}
