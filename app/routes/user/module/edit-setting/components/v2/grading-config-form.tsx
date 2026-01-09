import { Button, Checkbox, NumberInput, Paper, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	useUpdateGradingConfig,
} from "app/routes/user/module/edit-setting/route";
import type { QuizConfig } from "./types";
import { useFormWithSyncedInitialValues } from "app/utils/form-utils";

interface GradingConfigFormProps {
	moduleId: number;
	quizConfig: QuizConfig;
}

export function GradingConfigForm({
	moduleId,
	quizConfig,
}: GradingConfigFormProps) {
	const { submit: updateGradingConfig, isLoading } = useUpdateGradingConfig();

	const grading = quizConfig.grading ?? { enabled: false };

	const initialValues = {
		enabled: grading.enabled ?? false,
		passingScore: grading.passingScore ?? undefined,
		showScoreToStudent: grading.showScoreToStudent ?? false,
		showCorrectAnswers: grading.showCorrectAnswers ?? false,
	};

	const form = useForm({
		initialValues,
	});

	useFormWithSyncedInitialValues(form, initialValues);

	return (
		<form
			onSubmit={form.onSubmit((values) => {
				updateGradingConfig({
					params: { moduleId },
					values: {
						gradingConfig: {
							enabled: values.enabled,
							passingScore: values.passingScore,
							showScoreToStudent: values.showScoreToStudent,
							showCorrectAnswers: values.showCorrectAnswers,
						},
					},
				});
			})}
		>
			<Stack gap="md">
				<Title order={4}>Grading Configuration</Title>
				<Checkbox
					{...form.getInputProps("enabled", { type: "checkbox" })}
					label="Enable Grading"
				/>
				{form.values.enabled && (
					<>
						<NumberInput
							{...form.getInputProps("passingScore")}
							label="Passing Score (%)"
							description="Minimum percentage to pass (0-100)"
							min={0}
							max={100}
						/>
						<Checkbox
							{...form.getInputProps("showScoreToStudent", {
								type: "checkbox",
							})}
							label="Show Score to Student Immediately"
						/>
						<Checkbox
							{...form.getInputProps("showCorrectAnswers", {
								type: "checkbox",
							})}
							label="Show Correct Answers After Submission"
						/>
					</>
				)}
				<Button type="submit" loading={isLoading} disabled={!form.isDirty()}>
					Save Grading Configuration
				</Button>
			</Stack>
		</form>
	);
}
