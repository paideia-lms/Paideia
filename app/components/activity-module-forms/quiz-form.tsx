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
import { useEffect, useState } from "react";
import type { QuizConfig } from "~/components/activity-modules-preview/quiz-config.types";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { CommonFields } from "./common-fields";
import {
	ContainerQuizBuilder,
	RegularQuizBuilder,
} from "./quiz-builder-v2";

// Quiz Type Selector
interface QuizTypeSelectorProps {
	value: "regular" | "container";
	onChange: (value: "regular" | "container") => void;
}

function QuizTypeSelector({ value, onChange }: QuizTypeSelectorProps) {
	return (
		<Select
			label="Quiz Type"
			description="Choose between a regular quiz or a container quiz with multiple quizzes"
			value={value}
			onChange={(val) => onChange(val as "regular" | "container")}
			data={[
				{ value: "regular", label: "Regular Quiz" },
				{ value: "container", label: "Container Quiz (Multiple Quizzes)" },
			]}
		/>
	);
}

interface QuizFormProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
}

export function QuizForm({ form }: QuizFormProps) {
	// Get current rawQuizConfig from form, or initialize with default
	const currentRawQuizConfig = form.getValues().rawQuizConfig;

	// Track quiz type (regular vs container)
	const [quizType, setQuizType] = useState<"regular" | "container">(() => {
		if (currentRawQuizConfig) {
			return currentRawQuizConfig.nestedQuizzes &&
				currentRawQuizConfig.nestedQuizzes.length > 0
				? "container"
				: "regular";
		}
		return "regular";
	});

	// Initialize quiz config if it doesn't exist
	// biome-ignore lint/correctness/useExhaustiveDependencies: initialization only needs to run once on mount
	useEffect(() => {
		if (!currentRawQuizConfig) {
			const initialConfig: QuizConfig = {
				id: `quiz-${Date.now()}`,
				title: form.getValues().title || "New Quiz",
				pages: [],
			};
			form.setFieldValue("rawQuizConfig", initialConfig);
		}
	}, []);

	const handleQuizTypeChange = (newType: "regular" | "container") => {
		setQuizType(newType);

		// Transform config when switching types
		const currentConfig = form.getValues().rawQuizConfig;
		if (!currentConfig) return;

		if (newType === "regular") {
			// Convert container to regular: flatten nested quizzes into pages
			const newConfig: QuizConfig = {
				...currentConfig,
				pages: currentConfig.nestedQuizzes
					? currentConfig.nestedQuizzes.flatMap((nq) => nq.pages)
					: currentConfig.pages || [],
				nestedQuizzes: undefined,
				sequentialOrder: undefined,
			};
			form.setFieldValue("rawQuizConfig", newConfig);
		} else {
			// Convert regular to container: wrap pages in a nested quiz
			const newConfig: QuizConfig = {
				...currentConfig,
				nestedQuizzes: [
					{
						id: `nested-${Date.now()}`,
						title: "Quiz Section 1",
						pages: currentConfig.pages || [],
					},
				],
				pages: undefined,
				sequentialOrder: false,
			};
			form.setFieldValue("rawQuizConfig", newConfig);
		}
	};

	const handleQuizConfigChange = (updated: QuizConfig) => {
		form.setFieldValue("rawQuizConfig", updated);
	};

	const currentConfig = form.getValues().rawQuizConfig;

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

			<Divider my="xl" />

			<Title order={3}>Visual Quiz Builder</Title>

			<QuizTypeSelector value={quizType} onChange={handleQuizTypeChange} />

			{currentConfig && quizType === "regular" && (
				<RegularQuizBuilder
					config={currentConfig}
					onChange={handleQuizConfigChange}
				/>
			)}

			{currentConfig && quizType === "container" && (
				<ContainerQuizBuilder
					config={currentConfig}
					onChange={handleQuizConfigChange}
				/>
			)}
		</Stack>
	);
}
