import {
	ActionIcon,
	Button,
	Group,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import {
	useUpdateSingleSelectionMatrixQuestion,
} from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface SingleSelectionMatrixOptionsFormProps {
	moduleId: number;
	question: Extract<Question, { type: "single-selection-matrix" }>;
	nestedQuizId?: string;
}

export function SingleSelectionMatrixOptionsForm({
	moduleId,
	question,
	nestedQuizId,
}: SingleSelectionMatrixOptionsFormProps) {
	const { submit: updateQuestionOptions, isLoading } =
		useUpdateSingleSelectionMatrixQuestion();

	const form = useForm({
		initialValues: {
			rows: question.rows,
			columns: question.columns,
			correctAnswers: question.correctAnswers || {},
		},
	});

	const rowKeys = Object.keys(form.values.rows);
	const columnKeys = Object.keys(form.values.columns);

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
						<Text size="sm" fw={500}>Rows</Text>
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
						<Text size="sm" fw={500}>Columns</Text>
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
									const newAnswers = { ...form.values.correctAnswers };
									for (const rowKey in newAnswers) {
										if (newAnswers[rowKey] === key) {
											delete newAnswers[rowKey];
										}
									}
									form.setFieldValue("correctAnswers", newAnswers);
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
						<Text size="sm" fw={500}>Correct Answers</Text>
						<Table striped highlightOnHover withTableBorder>
							<Table.Thead>
								<Table.Tr>
									<Table.Th />
									{columnKeys.map((colKey) => (
										<Table.Th key={colKey}>
											{form.values.columns[colKey] || colKey}
										</Table.Th>
									))}
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{rowKeys.map((rowKey) => (
									<Table.Tr key={rowKey}>
										<Table.Td fw={500}>
											{form.values.rows[rowKey] || rowKey}
										</Table.Td>
										{columnKeys.map((colKey) => (
											<Table.Td key={`${rowKey}-${colKey}`}>
												<input
													type="radio"
													name={`matrix-${rowKey}`}
													checked={form.values.correctAnswers[rowKey] === colKey}
													onChange={() => {
														form.setFieldValue("correctAnswers", {
															...form.values.correctAnswers,
															[rowKey]: colKey,
														});
													}}
												/>
											</Table.Td>
										))}
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
