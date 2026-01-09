import {
	ActionIcon,
	Button,
	Checkbox,
	Group,
	Paper,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import {
	useUpdateMultipleChoiceQuestion,
} from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface MultipleChoiceOptionsFormProps {
	moduleId: number;
	question: Extract<Question, { type: "multiple-choice" }>;
	nestedQuizId?: string;
}

export function MultipleChoiceOptionsForm({
	moduleId,
	question,
	nestedQuizId,
}: MultipleChoiceOptionsFormProps) {
	const { submit: updateQuestionOptions, isLoading } =
		useUpdateMultipleChoiceQuestion();

	const form = useForm({
		initialValues: {
			options: question.options,
			correctAnswer: question.correctAnswer,
		},
	});

	const optionKeys = Object.keys(form.values.options);

	return (
		<Paper withBorder p="md" radius="md">
			<form
				onSubmit={form.onSubmit((values) => {
					updateQuestionOptions({
						params: { moduleId },
						values: {
							questionId: question.id,
							options: {
								options: values.options,
								correctAnswer: values.correctAnswer,
							},
							nestedQuizId,
						},
					});
				})}
			>
				<Stack gap="md">
					<Title order={5}>Answer Options</Title>
					<Group justify="space-between">
						<Text size="sm" fw={500}>
							Options
						</Text>
						<Button
							size="compact-sm"
							variant="light"
							leftSection={<IconPlus size={14} />}
							type="button"
							onClick={() => {
								const nextKey = String.fromCharCode(97 + optionKeys.length);
								form.setFieldValue("options", {
									...form.values.options,
									[nextKey]: "",
								});
							}}
						>
							Add Option
						</Button>
					</Group>

					{optionKeys.map((key) => (
						<Group key={key} gap="xs" wrap="nowrap">
							<TextInput
								{...form.getInputProps(`options.${key}`)}
								placeholder={`Option ${key.toUpperCase()}`}
								style={{ flex: 1 }}
								size="sm"
							/>
							<Checkbox
								label="Correct"
								checked={form.values.correctAnswer === key}
								onChange={(e) => {
									form.setFieldValue(
										"correctAnswer",
										e.currentTarget.checked ? key : undefined,
									);
								}}
							/>
							<ActionIcon
								color="red"
								variant="subtle"
								type="button"
								onClick={() => {
									const newOptions = { ...form.values.options };
									delete newOptions[key];
									form.setFieldValue("options", newOptions);
									if (form.values.correctAnswer === key) {
										form.setFieldValue("correctAnswer", undefined);
									}
								}}
								disabled={optionKeys.length <= 2}
							>
								<IconTrash size={16} />
							</ActionIcon>
						</Group>
					))}

					<Button type="submit" loading={isLoading}>
						Save Options
					</Button>
				</Stack>
			</form>
		</Paper>
	);
}
