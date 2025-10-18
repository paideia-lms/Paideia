import { NumberInput, Select, Stack, Textarea, Title } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { UseFormReturnType } from "@mantine/form";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { CommonFields } from "./common-fields";

interface QuizFormProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
}

export function QuizForm({ form }: QuizFormProps) {
	return (
		<Stack gap="md">
			<CommonFields form={form} />

			<Textarea
				{...form.getInputProps("description")}
				key={form.key("description")}
				label="Description"
				placeholder="Enter module description"
				minRows={3}
			/>

			<Title order={4} mt="md">
				Quiz Settings
			</Title>

			<Textarea
				{...form.getInputProps("quizInstructions")}
				key={form.key("quizInstructions")}
				label="Instructions"
				placeholder="Enter quiz instructions"
				minRows={3}
			/>

			<DateTimePicker
				{...form.getInputProps("quizDueDate")}
				key={form.key("quizDueDate")}
				label="Due Date"
				placeholder="Select due date"
			/>

			<NumberInput
				{...form.getInputProps("quizMaxAttempts")}
				key={form.key("quizMaxAttempts")}
				label="Max Attempts"
				placeholder="Enter max attempts"
				min={1}
			/>

			<NumberInput
				{...form.getInputProps("quizPoints")}
				key={form.key("quizPoints")}
				label="Total Points"
				placeholder="Enter total points"
				min={0}
			/>

			<NumberInput
				{...form.getInputProps("quizTimeLimit")}
				key={form.key("quizTimeLimit")}
				label="Time Limit (minutes)"
				placeholder="Enter time limit in minutes"
				min={1}
			/>

			<Select
				{...form.getInputProps("quizGradingType")}
				key={form.key("quizGradingType")}
				label="Grading Type"
				data={[
					{ value: "automatic", label: "Automatic" },
					{ value: "manual", label: "Manual" },
				]}
			/>
		</Stack>
	);
}
