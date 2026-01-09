import { Button, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useAddPage,
} from "app/routes/user/module/edit-setting/route";

interface AddPageFormProps {
	moduleId: number;
	nestedQuizId?: string;
}

export function AddPageForm({
	moduleId,
	nestedQuizId,
}: AddPageFormProps) {
	const { submit: addPage, isLoading } = useAddPage();

	const form = useForm({
		initialValues: {
			title: "",
		},
	});

	return (
		<form
			onSubmit={form.onSubmit(() => {
				addPage({
					params: { moduleId },
					values: {
						nestedQuizId,
					},
				});
				form.reset();
			})}
		>
			<Stack gap="md">
				<Title order={4}>Add Page</Title>
				<TextInput
					{...form.getInputProps("title")}
					label="Page Title"
					placeholder="e.g., Page 1"
				/>
				<Button type="submit" loading={isLoading}>
					Add Page
				</Button>
			</Stack>
		</form>
	);
}
