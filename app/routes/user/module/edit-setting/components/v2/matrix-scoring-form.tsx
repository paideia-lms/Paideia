import { Button, NumberInput, Select, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useUpdateQuestionScoring } from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface MatrixScoringFormProps {
	moduleId: number;
	question: Question;
	scoring: Extract<Question["scoring"], { type: "matrix" }>;
	nestedQuizId?: string;
}

export function MatrixScoringForm({
	moduleId,
	question,
	scoring,
	nestedQuizId,
}: MatrixScoringFormProps) {
	const { submit: updateQuestionScoring, isLoading } =
		useUpdateQuestionScoring();

	const form = useForm({
		initialValues: {
			mode: scoring.mode,
			maxPoints: scoring.maxPoints,
			pointsPerRow: scoring.pointsPerRow,
		},
	});

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateQuestionScoring({
					params: { moduleId },
					values: {
						questionId: question.id,
						scoring: {
							type: "matrix",
							mode: values.mode,
							maxPoints: values.maxPoints,
							pointsPerRow: values.pointsPerRow,
						},
						nestedQuizId,
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={5}>Scoring</Title>
				<Select
					{...form.getInputProps("mode")}
					label="Scoring Mode"
					data={[
						{ value: "all-or-nothing", label: "All or Nothing (per row)" },
						{ value: "partial", label: "Partial Credit (per row)" },
					]}
				/>
				<NumberInput
					{...form.getInputProps("maxPoints")}
					label="Maximum Points"
					min={0}
				/>
				<NumberInput
					{...form.getInputProps("pointsPerRow")}
					label="Points Per Row"
					min={0}
					step={0.1}
				/>
				<Button type="submit" loading={isLoading}>
					Save Scoring
				</Button>
			</Stack>
		</form>
	);
}
