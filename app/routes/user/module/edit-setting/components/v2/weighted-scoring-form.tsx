import {
	Button,
	NumberInput,
	Paper,
	Select,
	Stack,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useUpdateQuestionScoring } from "app/routes/user/module/edit-setting/route";
import type { Question } from "./types";

interface WeightedScoringFormProps {
	moduleId: number;
	question: Question;
	scoring: Extract<Question["scoring"], { type: "weighted" }>;
	nestedQuizId?: string;
}

export function WeightedScoringForm({
	moduleId,
	question,
	scoring,
	nestedQuizId,
}: WeightedScoringFormProps) {
	const { submit: updateQuestionScoring, isLoading } =
		useUpdateQuestionScoring();

	const form = useForm({
		initialValues: {
			mode: scoring.mode,
			maxPoints: scoring.maxPoints,
			pointsPerCorrect:
				scoring.mode === "all-or-nothing" ? 0 : (scoring.pointsPerCorrect ?? 0),
			penaltyPerIncorrect:
				scoring.mode === "partial-with-penalty"
					? (scoring.penaltyPerIncorrect ?? 0)
					: 0,
		},
	});

	return (
		<Paper withBorder p="md" radius="md">
			<form
				onSubmit={form.onSubmit((values) => {
					if (values.mode === "all-or-nothing") {
						updateQuestionScoring({
							params: { moduleId },
							values: {
								questionId: question.id,
								scoring: {
									type: "weighted",
									mode: "all-or-nothing",
									maxPoints: values.maxPoints,
								},
								nestedQuizId,
							},
						});
					} else if (values.mode === "partial-with-penalty") {
						updateQuestionScoring({
							params: { moduleId },
							values: {
								questionId: question.id,
								scoring: {
									type: "weighted",
									mode: "partial-with-penalty",
									maxPoints: values.maxPoints,
									pointsPerCorrect: values.pointsPerCorrect,
									penaltyPerIncorrect: values.penaltyPerIncorrect,
								},
								nestedQuizId,
							},
						});
					} else {
						updateQuestionScoring({
							params: { moduleId },
							values: {
								questionId: question.id,
								scoring: {
									type: "weighted",
									mode: "partial-no-penalty",
									maxPoints: values.maxPoints,
									pointsPerCorrect: values.pointsPerCorrect,
								},
								nestedQuizId,
							},
						});
					}
				})}
			>
				<Stack gap="md">
					<Title order={5}>Scoring</Title>
					<Select
						{...form.getInputProps("mode")}
						label="Scoring Mode"
						data={[
							{ value: "all-or-nothing", label: "All or Nothing" },
							{
								value: "partial-with-penalty",
								label: "Partial Credit with Penalty",
							},
							{
								value: "partial-no-penalty",
								label: "Partial Credit without Penalty",
							},
						]}
					/>
					<NumberInput
						{...form.getInputProps("maxPoints")}
						label="Maximum Points"
						min={0}
					/>
					{form.values.mode !== "all-or-nothing" && (
						<NumberInput
							{...form.getInputProps("pointsPerCorrect")}
							label="Points Per Correct"
							min={0}
							step={0.1}
						/>
					)}
					{form.values.mode === "partial-with-penalty" && (
						<NumberInput
							{...form.getInputProps("penaltyPerIncorrect")}
							label="Penalty Per Incorrect"
							min={0}
							step={0.1}
						/>
					)}
					<Button type="submit" loading={isLoading}>
						Save Scoring
					</Button>
				</Stack>
			</form>
		</Paper>
	);
}
