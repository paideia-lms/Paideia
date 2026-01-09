import {
	ActionIcon,
	Button,
	Group,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import {
	useUpdateRankingQuestion,
} from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface RankingOptionsFormProps {
	moduleId: number;
	question: Extract<Question, { type: "ranking" }>;
	nestedQuizId?: string;
}

export function RankingOptionsForm({
	moduleId,
	question,
	nestedQuizId,
}: RankingOptionsFormProps) {
	const { submit: updateQuestionOptions, isLoading } =
		useUpdateRankingQuestion();

	const form = useForm({
		initialValues: {
			items: question.items,
			correctOrder: question.correctOrder || [],
		},
	});

	const itemKeys = Object.keys(form.values.items);
	const orderedKeys = form.values.correctOrder.length > 0
		? form.values.correctOrder
		: itemKeys;

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateQuestionOptions({
					params: { moduleId },
					values: {
						questionId: question.id,
						options: {
							items: values.items,
							correctOrder: values.correctOrder,
						},
						nestedQuizId,
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={5}>Ranking Items</Title>
				<Group justify="space-between">
					<Text size="sm" fw={500}>
						Items (Drag to reorder in correct order)
					</Text>
					<Button
						size="compact-sm"
						variant="light"
						leftSection={<IconPlus size={14} />}
						type="button"
						onClick={() => {
							const nextKey = String.fromCharCode(97 + itemKeys.length);
							form.setFieldValue("items", {
								...form.values.items,
								[nextKey]: "",
							});
							form.setFieldValue("correctOrder", [...orderedKeys, nextKey]);
						}}
					>
						Add Item
					</Button>
				</Group>

				{orderedKeys.map((key, index) => (
					<Group key={key} gap="xs" wrap="nowrap">
						<Text size="sm" fw={500} style={{ minWidth: 30 }}>
							#{index + 1}
						</Text>
						<TextInput
							{...form.getInputProps(`items.${key}`)}
							placeholder={`Item ${key.toUpperCase()}`}
							style={{ flex: 1 }}
							size="sm"
						/>
						<ActionIcon
							color="red"
							variant="subtle"
							type="button"
							onClick={() => {
								const newItems = { ...form.values.items };
								delete newItems[key];
								form.setFieldValue("items", newItems);
								form.setFieldValue(
									"correctOrder",
									orderedKeys.filter((k) => k !== key),
								);
							}}
							disabled={itemKeys.length <= 2}
						>
							<IconTrash size={16} />
						</ActionIcon>
					</Group>
				))}

				<Button type="submit" loading={isLoading}>
					Save Ranking
				</Button>
			</Stack>
		</form>
	);
}
