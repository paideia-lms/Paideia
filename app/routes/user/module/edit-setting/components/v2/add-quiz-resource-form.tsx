import { Button, Paper, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useAddQuizResource,
} from "app/routes/user/module/edit-setting/route";
import type { QuizResource } from "./types";

interface AddQuizResourceFormProps {
	moduleId: number;
	nestedQuizId?: string;
}

export function AddQuizResourceForm({
	moduleId,
	nestedQuizId,
}: AddQuizResourceFormProps) {
	const { submit: addQuizResource, isLoading } = useAddQuizResource();

	const form = useForm({
		initialValues: {
			title: "",
			content: "",
			pages: [] as string[],
		},
	});

	return (
		<Paper withBorder p="md" radius="md">
			<form
				onSubmit={form.onSubmit((values) => {
					const newResource: QuizResource = {
						id: `resource-${Date.now()}`,
						title: values.title,
						content: values.content,
						pages: values.pages,
					};
					addQuizResource({
						params: { moduleId },
						values: {
							resource: newResource,
							nestedQuizId,
						},
					});
					form.reset();
				})}
			>
				<Stack gap="md">
					<Title order={4}>Add Resource</Title>
					<TextInput
						{...form.getInputProps("title")}
						label="Resource Title (optional)"
						placeholder="e.g., Reference Material"
					/>
					<Button type="submit" loading={isLoading}>
						Add Resource
					</Button>
				</Stack>
			</form>
		</Paper>
	);
}
