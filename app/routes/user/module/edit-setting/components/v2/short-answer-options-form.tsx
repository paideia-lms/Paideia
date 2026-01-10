import { Button, Stack, Textarea, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useUpdateShortAnswerQuestion } from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface ShortAnswerOptionsFormProps {
	moduleId: number;
	question: Extract<Question, { type: "short-answer" }>;
	nestedQuizId?: string;
}

export function ShortAnswerOptionsForm({
	moduleId,
	question,
	nestedQuizId,
}: ShortAnswerOptionsFormProps) {
	const { submit: updateQuestionOptions, isLoading } =
		useUpdateShortAnswerQuestion();

	const form = useForm({
		initialValues: {
			correctAnswer: question.correctAnswer || "",
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateQuestionOptions({
					params: { moduleId },
					values: {
						questionId: question.id,
						options: {
							correctAnswer: values.correctAnswer,
						},
						nestedQuizId,
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={5}>Correct Answer</Title>
				<Textarea
					{...form.getInputProps("correctAnswer")}
					label="Correct Answer (optional)"
					description="For automatic grading (exact match)"
					minRows={2}
				/>
				<Button type="submit" loading={isLoading}>
					Save Answer
				</Button>
			</Stack>
		</form>
	);
}
