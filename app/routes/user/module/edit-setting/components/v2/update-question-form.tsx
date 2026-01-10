import { Button, Stack, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useUpdateQuestion } from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface UpdateQuestionFormProps {
	moduleId: number;
	question: Question;
	nestedQuizId?: string;
}

export function UpdateQuestionForm({
	moduleId,
	question,
	nestedQuizId,
}: UpdateQuestionFormProps) {
	const { submit: updateQuestion, isLoading: isUpdating } = useUpdateQuestion();

	const form = useForm({
		initialValues: {
			prompt: question.prompt,
			feedback: question.feedback || "",
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateQuestion({
					params: { moduleId },
					values: {
						questionId: question.id,
						updates: {
							prompt: values.prompt,
							feedback: values.feedback,
						},
						nestedQuizId,
					},
				});
			})}
		>
			<Stack gap="md">
				<Textarea
					{...form.getInputProps("prompt")}
					label="Question Prompt"
					minRows={2}
					required
				/>

				<Textarea
					{...form.getInputProps("feedback")}
					label="Feedback (optional)"
					description="Shown to students after answering"
					minRows={2}
				/>

				<Button type="submit" loading={isUpdating}>
					Save Question
				</Button>
			</Stack>
		</form>
	);
}
