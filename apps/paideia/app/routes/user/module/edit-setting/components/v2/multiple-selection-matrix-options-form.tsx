import {
	ActionIcon,
	Button,
	Group,
	MultiSelect,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useUpdateMultipleSelectionMatrixQuestion } from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface MultipleSelectionMatrixOptionsFormProps {
	moduleId: number;
	question: Extract<Question, { type: "multiple-selection-matrix" }>;
	nestedQuizId?: string;
}

export function MultipleSelectionMatrixOptionsForm({
	moduleId,
	question,
	nestedQuizId,
}: MultipleSelectionMatrixOptionsFormProps) {
	const { submit: updateQuestionOptions, isLoading } =
		useUpdateMultipleSelectionMatrixQuestion();

	// Convert correctAnswers from Record<string, string> to Record<string, string[]>
	// The question type has Record<string, string> but the update function expects Record<string, string[]>
	const initialCorrectAnswers: Record<string, string[]> =
		question.correctAnswers
			? (Object.fromEntries(
					Object.entries(question.correctAnswers).map(([key, value]) => [
						key,
						Array.isArray(value) ? (value as string[]) : [value as string],
					]),
				) as Record<string, string[]>)
			: {};

	const form = useForm<{
		rows: Record<string, string>;
		columns: Record<string, string>;
		correctAnswers: Record<string, string[]>;
	}>({
		initialValues: {
			rows: question.rows,
			columns: question.columns,
			correctAnswers: initialCorrectAnswers,
		},
	});

	const rowKeys = Object.keys(form.values.rows);
	const columnKeys = Object.keys(form.values.columns);
	const columnData = columnKeys.map((key) => ({
		value: key,
		label: form.values.columns[key] || key,
	}));

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateQuestionOptions({
					params: { moduleId },
					values: {
						questionId: question.id,
						options: {
							rows: values.rows,
							columns: values.columns,
							correctAnswers: values.correctAnswers,
						},
						nestedQuizId,
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={5}>Matrix Configuration</Title>
				<Stack gap="xs">
					<Group justify="space-between">
						<Text size="sm" fw={500}>
							Rows
						</Text>
						<Button
							size="compact-sm"
							variant="light"
							leftSection={<IconPlus size={14} />}
							type="button"
							onClick={() => {
								const nextKey = `row-${rowKeys.length + 1}`;
								form.setFieldValue("rows", {
									...form.values.rows,
									[nextKey]: "",
								});
							}}
						>
							Add Row
						</Button>
					</Group>
					{rowKeys.map((key) => (
						<Group key={key} gap="xs" wrap="nowrap">
							<TextInput
								{...form.getInputProps(`rows.${key}`)}
								placeholder="Row label"
								style={{ flex: 1 }}
								size="sm"
							/>
							<ActionIcon
								color="red"
								variant="subtle"
								type="button"
								onClick={() => {
									const newRows = { ...form.values.rows };
									delete newRows[key];
									form.setFieldValue("rows", newRows);
									const newAnswers = { ...form.values.correctAnswers };
									delete newAnswers[key];
									form.setFieldValue("correctAnswers", newAnswers);
								}}
								disabled={rowKeys.length <= 1}
							>
								<IconTrash size={16} />
							</ActionIcon>
						</Group>
					))}
				</Stack>

				<Stack gap="xs">
					<Group justify="space-between">
						<Text size="sm" fw={500}>
							Columns
						</Text>
						<Button
							size="compact-sm"
							variant="light"
							leftSection={<IconPlus size={14} />}
							type="button"
							onClick={() => {
								const nextKey = `col-${columnKeys.length + 1}`;
								form.setFieldValue("columns", {
									...form.values.columns,
									[nextKey]: "",
								});
							}}
						>
							Add Column
						</Button>
					</Group>
					{columnKeys.map((key) => (
						<Group key={key} gap="xs" wrap="nowrap">
							<TextInput
								{...form.getInputProps(`columns.${key}`)}
								placeholder="Column label"
								style={{ flex: 1 }}
								size="sm"
							/>
							<ActionIcon
								color="red"
								variant="subtle"
								type="button"
								onClick={() => {
									const newColumns = { ...form.values.columns };
									delete newColumns[key];
									form.setFieldValue("columns", newColumns);
								}}
								disabled={columnKeys.length <= 1}
							>
								<IconTrash size={16} />
							</ActionIcon>
						</Group>
					))}
				</Stack>

				{rowKeys.length > 0 && columnKeys.length > 0 && (
					<Stack gap="xs">
						<Text size="sm" fw={500}>
							Correct Answers
						</Text>
						<Table striped highlightOnHover withTableBorder>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Question</Table.Th>
									<Table.Th>Answer</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{rowKeys.map((rowKey) => (
									<Table.Tr key={rowKey}>
										<Table.Td fw={500}>
											{form.values.rows[rowKey] || rowKey}
										</Table.Td>
										<Table.Td>
											<MultiSelect
												value={form.values.correctAnswers[rowKey] || []}
												onChange={(val) => {
													const updated = { ...form.values.correctAnswers };
													if (val.length > 0) {
														updated[rowKey] = val;
													} else {
														delete updated[rowKey];
													}
													form.setFieldValue("correctAnswers", updated);
												}}
												data={columnData}
												placeholder="Select correct answers"
												clearable
												size="sm"
											/>
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Stack>
				)}

				<Button type="submit" loading={isLoading}>
					Save Matrix
				</Button>
			</Stack>
		</form>
	);
}
