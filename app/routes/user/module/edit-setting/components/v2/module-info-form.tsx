import { Button, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { useUpdateQuiz } from "app/routes/user/module/edit-setting/route";
import type { Route } from "../../+types/route";
import { useForm } from "@mantine/form";
import { useFormWithSyncedInitialValues } from "app/utils/form-utils";

interface ModuleInfoFormProps {
	module: Extract<
		Route.ComponentProps["loaderData"]["module"],
		{ type: "quiz" }
	>;
}

export function ModuleInfoForm({ module }: ModuleInfoFormProps) {
	const { submit: updateQuiz, isLoading } = useUpdateQuiz();

	const initialValues = {
		title: module.title,
		description: module.description || "",
		quizInstructions: module.instructions || "",
	};

	const form = useForm({
		initialValues,
	});

	useFormWithSyncedInitialValues(form, initialValues);

	return (
		<form
			onSubmit={form.onSubmit(async (values) => {
				await updateQuiz({
					params: { moduleId: module.id },
					values: {
						title: values.title,
						description: values.description,
						quizInstructions: values.quizInstructions,
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={4}>Module Information</Title>
				<TextInput {...form.getInputProps("title")} label="Title" required />
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
				<Button type="submit" loading={isLoading} disabled={!form.isDirty()}>
					Save Module Information
				</Button>
			</Stack>
		</form>
	);
}
