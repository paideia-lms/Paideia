import {
	Button,
	Select,
	Stack,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import type { QuizConfig } from "server/json/raw-quiz-config/types.v2";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { CommonFields } from "./common-fields";
import { ContainerQuizBuilder, RegularQuizBuilder } from "./quiz-builder-v2";
import type { QuizFormInitialValues as EditQuizFormInitialValues } from "app/routes/user/module/edit-setting";
import type { QuizFormInitialValues as NewQuizFormInitialValues } from "app/routes/user/module/new";
import type { Simplify, UnionToIntersection } from "type-fest";

type QuizFormData = Simplify<
	UnionToIntersection<NewQuizFormInitialValues | EditQuizFormInitialValues>
>;

interface QuizFormProps {
	initialValues?: Partial<QuizFormData>;
	onSubmit: (values: QuizFormData) => void;
	isLoading?: boolean;
}

const useQuizForm = (initialValues: Partial<QuizFormData> | undefined) => {
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title ?? "",
			description: initialValues?.description ?? "",
			status: initialValues?.status ?? "draft",
			quizInstructions: initialValues?.quizInstructions ?? "",
			quizPoints: initialValues?.quizPoints ?? 100,
			quizTimeLimit: initialValues?.quizTimeLimit ?? 60,
			quizGradingType: initialValues?.quizGradingType ?? "automatic",
			rawQuizConfig: initialValues?.rawQuizConfig ?? null,
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	return form;
};

export type UseQuizFormReturnType = ReturnType<typeof useQuizForm>;

export function QuizForm({
	initialValues,
	onSubmit,
	isLoading,
}: QuizFormProps) {
	const form = useQuizForm(initialValues);

	return (
		<form onSubmit={form.onSubmit(onSubmit)}>
			<Stack gap="md">
				<TextInput
					{...form.getInputProps("title")}
					key={form.key("title")}
					label="Title"
					placeholder="Enter module title"
					required
					withAsterisk
				/>

				<Select
					{...form.getInputProps("status")}
					key={form.key("status")}
					label="Status"
					placeholder="Select status"
					data={[
						{ value: "draft", label: "Draft" },
						{ value: "published", label: "Published" },
						{ value: "archived", label: "Archived" },
					]}
				/>
				<Textarea
					{...form.getInputProps("description")}
					key={form.key("description")}
					label="Description"
					placeholder="Enter module description"
					minRows={3}
					autosize
				/>

				<QuizBuilder form={form} />

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}

function QuizBuilder({ form }: { form: UseFormReturnType<QuizFormData> }) {
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
