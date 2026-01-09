import { Button, Paper, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useUpdateQuiz } from "app/routes/user/module/edit-setting/route";
import type { Route } from "../../+types/route";

interface ModuleInfoFormProps {
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "quiz" }
	>;
}

export function ModuleInfoForm({ module }: ModuleInfoFormProps) {
	const { submit: updateQuiz, isLoading } = useUpdateQuiz();
	const rawQuizConfig = module.rawQuizConfig;

	const form = useForm({
		initialValues: {
			title: module.title,
			description: module.description || "",
			quizInstructions: module.instructions || "",
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateQuiz({
					params: { moduleId: module.id },
					values: {
						title: values.title,
						description: values.description,
						quizInstructions: values.quizInstructions,
						rawQuizConfig: rawQuizConfig ?? undefined,
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={4}>Module Information</Title>
				<TextInput
					{...form.getInputProps("title")}
					label="Title"
					required
				/>
				<Textarea
					{...form.getInputProps("description")}
					label="Description"
					minRows={3}
					autosize
				/>
				<Textarea
					{...form.getInputProps("quizInstructions")}
					label="Quiz Instructions"
					minRows={3}
					autosize
				/>
				<Button type="submit" loading={isLoading}>
					Save Module Information
				</Button>
			</Stack>
		</form>
	);
}
