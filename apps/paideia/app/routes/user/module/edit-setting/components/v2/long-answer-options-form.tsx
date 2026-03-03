import { Button, Stack, Textarea, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useUpdateLongAnswerQuestion } from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface LongAnswerOptionsFormProps {
	moduleId: number;
	question: Extract<Question, { type: "long-answer" }>;
	nestedQuizId?: string;
}

export function LongAnswerOptionsForm({
	moduleId,
	question,
	nestedQuizId,
}: LongAnswerOptionsFormProps) {
	const { submit: updateQuestionOptions, isLoading } =
		useUpdateLongAnswerQuestion();

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
				<Title order={5}>Sample/Expected Answer</Title>
				<Textarea
					{...form.getInputProps("correctAnswer")}
					label="Sample/Expected Answer (optional)"
					description="For reference purposes (requires manual grading)"
					minRows={3}
				/>
				<Button type="submit" loading={isLoading}>
					Save Answer
				</Button>
			</Stack>
		</form>
	);
}
