import {
	Divider,
	NumberInput,
	Select,
	Stack,
	Textarea,
	Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { UseFormReturnType } from "@mantine/form";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { CommonFields } from "./common-fields";
import { ContainerQuizBuilder, RegularQuizBuilder } from "./quiz-builder-v2";

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
				autosize
			/>
			{/* 
			<Title order={4} mt="md">
				Legacy Quiz Settings (Optional)
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

			<Divider my="xl" /> */}

			<QuizBuilder form={form} />
		</Stack>
	);
}

function QuizBuilder({
	form,
}: {
	form: UseFormReturnType<ActivityModuleFormValues>;
}) {
	// Watch the quiz type from form
	const quizType = useFormWatchForceUpdate(form, "rawQuizConfig.type");

	const handleQuizTypeChange = (newType: "regular" | "container") => {
		if (quizType === newType) return;

		const config = form.getValues().rawQuizConfig ?? {
			version: "v2",
			type: "regular",
			id: "",
			title: "",
			pages: [],
			resources: [],
			globalTimer: undefined,
		};

		if (newType === "regular") {
			// Convert container to regular
			const newConfig: QuizConfig = {
				version: "v2",
				type: "regular",
				id: config.id,
				title: config.title,
				pages:
					config.type === "container"
						? config.nestedQuizzes.flatMap((nq) => nq.pages)
						: [],
				resources: config.type === "regular" ? config.resources : undefined,
				globalTimer: config.globalTimer,
				grading: config.grading,
			};
			form.setFieldValue("rawQuizConfig", newConfig);
		} else {
			// Convert regular to container
			const newConfig: QuizConfig = {
				version: "v2",
				type: "container",
				id: config.id,
				title: config.title,
				nestedQuizzes: [
					{
						id: `nested-${Date.now()}`,
						title: "Quiz Section 1",
						pages: config.type === "regular" ? config.pages : [],
						resources: config.type === "regular" ? config.resources : undefined,
					},
				],
				sequentialOrder: false,
				globalTimer: config.globalTimer,
				grading: config.grading,
			};
			form.setFieldValue("rawQuizConfig", newConfig);
		}
	};

	return (
		<>
			<Title order={3}>Visual Quiz Builder</Title>

			<Select
				label="Quiz Type"
				description="Choose between a regular quiz or a container quiz with multiple quizzes"
				value={quizType}
				onChange={(val) => handleQuizTypeChange(val as "regular" | "container")}
				data={[
					{ value: "regular", label: "Regular Quiz" },
					{ value: "container", label: "Container Quiz (Multiple Quizzes)" },
				]}
			/>

			{quizType === "regular" && <RegularQuizBuilder form={form} />}

			{quizType === "container" && <ContainerQuizBuilder form={form} />}
		</>
	);
}
