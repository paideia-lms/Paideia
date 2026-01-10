import {
	ActionIcon,
	Button,
	Checkbox,
	Group,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useUpdateChoiceQuestion } from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface ChoiceOptionsFormProps {
	moduleId: number;
	question: Extract<Question, { type: "choice" }>;
	nestedQuizId?: string;
}

export function ChoiceOptionsForm({
	moduleId,
	question,
	nestedQuizId,
}: ChoiceOptionsFormProps) {
	const { submit: updateQuestionOptions, isLoading } =
		useUpdateChoiceQuestion();

	const form = useForm({
		initialValues: {
			options: question.options,
			correctAnswers: question.correctAnswers || [],
		},
	});

	const optionKeys = Object.keys(form.values.options);

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateQuestionOptions({
					params: { moduleId },
					values: {
						questionId: question.id,
						options: {
							options: values.options,
							correctAnswers: values.correctAnswers,
						},
						nestedQuizId,
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={5}>Answer Options (Multiple Selection)</Title>
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
							checked={form.values.correctAnswers.includes(key)}
							onChange={(e) => {
								const current = form.values.correctAnswers;
								if (e.currentTarget.checked) {
									form.setFieldValue("correctAnswers", [...current, key]);
								} else {
									form.setFieldValue(
										"correctAnswers",
										current.filter((k) => k !== key),
									);
								}
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
								form.setFieldValue(
									"correctAnswers",
									form.values.correctAnswers.filter((k) => k !== key),
								);
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
	);
}
