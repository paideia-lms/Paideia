import { Button, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useUpdateNestedQuizInfo } from "app/routes/user/module/edit-setting/route";
import type { NestedQuizConfig } from "./types";
import { useFormWithSyncedInitialValues } from "app/utils/form-utils";

interface UpdateNestedQuizInfoFormProps {
	moduleId: number;
	nestedQuiz: NestedQuizConfig;
}

export function UpdateNestedQuizInfoForm({
	moduleId,
	nestedQuiz,
}: UpdateNestedQuizInfoFormProps) {
	const { submit: updateNestedQuizInfo, isLoading: isUpdatingInfo } =
		useUpdateNestedQuizInfo();

	const initialValues = {
		title: nestedQuiz.title,
		description: nestedQuiz.description || "",
	};

	const form = useForm({
		initialValues,
	});

	useFormWithSyncedInitialValues(form, initialValues);

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateNestedQuizInfo({
					params: { moduleId },
					values: {
						nestedQuizId: nestedQuiz.id,
						updates: {
							title: values.title,
							description: values.description,
						},
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={5}>Quiz Information</Title>
				<TextInput
					{...form.getInputProps("title")}
					label="Quiz Title"
					required
				/>
				<Textarea
					{...form.getInputProps("description")}
					label="Description"
					minRows={2}
				/>
				<Button
					type="submit"
					loading={isUpdatingInfo}
					disabled={!form.isDirty()}
				>
					Save Quiz Information
				</Button>
			</Stack>
		</form>
	);
}
