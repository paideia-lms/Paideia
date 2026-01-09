import { Button, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useUpdateFillInTheBlankQuestion,
} from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";
import { parseFillInTheBlank } from "~/utils/fill-in-the-blank-utils";

interface FillInTheBlankOptionsFormProps {
	moduleId: number;
	question: Extract<Question, { type: "fill-in-the-blank" }>;
	nestedQuizId?: string;
}

export function FillInTheBlankOptionsForm({
	moduleId,
	question,
	nestedQuizId,
}: FillInTheBlankOptionsFormProps) {
	const { submit: updateQuestionOptions, isLoading } =
		useUpdateFillInTheBlankQuestion();

	const parsed = parseFillInTheBlank(question.prompt || "");
	const form = useForm({
		initialValues: {
			correctAnswers: question.correctAnswers || {},
		},
	});

	return (
		<Paper withBorder p="md" radius="md">
			<form
				onSubmit={form.onSubmit((values) => {
					updateQuestionOptions({
						params: { moduleId },
						values: {
							questionId: question.id,
							options: {
								correctAnswers: values.correctAnswers,
							},
							nestedQuizId,
						},
					});
				})}
			>
				<Stack gap="md">
					<Title order={5}>Correct Answers for Blanks</Title>
					<Text size="sm" c="dimmed">
						Use <code>{"{{blank_id}}"}</code> in the prompt to mark blank positions.
					</Text>
					{parsed.uniqueBlankIds.length > 0 ? (
						<Stack gap="xs">
							{parsed.uniqueBlankIds.map((blankId) => (
								<TextInput
									key={blankId}
									{...form.getInputProps(`correctAnswers.${blankId}`)}
									label={`Blank: ${blankId}`}
									placeholder={`Answer for ${blankId}`}
								/>
							))}
						</Stack>
					) : (
						<Text size="sm" c="dimmed">
							Add {"{{blank_id}}"} markers to the prompt above
						</Text>
					)}
					<Button type="submit" loading={isLoading}>
						Save Answers
					</Button>
				</Stack>
			</form>
		</Paper>
	);
}
