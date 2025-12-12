import {
	Button,
	Input,
	NumberInput,
	Stack,
	Textarea,
	Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import type {
	ActivityModuleFormValues,
	DiscussionModuleFormValues,
} from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";
import { CommonFields } from "./common-fields";

interface DiscussionFormProps {
	initialValues?: Partial<DiscussionModuleFormValues>;
	onSubmit: (values: DiscussionModuleFormValues) => void;
	isLoading?: boolean;
}

export function DiscussionForm({
	initialValues,
	onSubmit,
	isLoading,
}: DiscussionFormProps) {
	const form = useForm<DiscussionModuleFormValues>({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title || "",
			description: initialValues?.description || "",
			type: "discussion" as const,
			status: initialValues?.status || "draft",
			discussionInstructions: initialValues?.discussionInstructions || "",
			discussionDueDate: initialValues?.discussionDueDate || null,
			discussionRequireThread: initialValues?.discussionRequireThread || false,
			discussionRequireReplies:
				initialValues?.discussionRequireReplies || false,
			discussionMinReplies: initialValues?.discussionMinReplies || 1,
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	return (
		<form onSubmit={form.onSubmit(onSubmit)}>
			<Stack gap="md">
				<CommonFields
					form={form as UseFormReturnType<ActivityModuleFormValues>}
				/>

				<Textarea
					{...form.getInputProps("description")}
					key={form.key("description")}
					label="Description"
					placeholder="Enter module description"
					minRows={3}
				/>

				<Title order={4} mt="md">
					Discussion Settings
				</Title>

				<InstructionsEditor form={form} />

				{/* TODO: move to course module specific settings */}
				{/* <DateTimePicker
				{...form.getInputProps("discussionDueDate")}
				key={form.key("discussionDueDate")}
				label="Due Date"
				placeholder="Select due date"
			/> */}

				{/* <Checkbox
				{...form.getInputProps("discussionRequireThread", {
					type: "checkbox",
				})}
				key={form.key("discussionRequireThread")}
				label="Require thread creation"
			/>

			<Checkbox
				{...form.getInputProps("discussionRequireReplies", {
					type: "checkbox",
				})}
				key={form.key("discussionRequireReplies")}
				label="Require replies"
			/>

			<MinimumRepliesInput form={form} /> */}

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}

function InstructionsEditor({
	form,
}: {
	form: UseFormReturnType<DiscussionModuleFormValues>;
}) {
	const instructions = useFormWatchForceUpdate(
		form,
		"discussionInstructions" as const,
	);

	return (
		<Input.Wrapper label="Instructions">
			<SimpleRichTextEditor
				content={instructions || ""}
				onChange={(content) => {
					form.setFieldValue("discussionInstructions" as const, content);
				}}
				placeholder="Enter discussion instructions..."
			/>
		</Input.Wrapper>
	);
}

function _MinimumRepliesInput({
	form,
}: {
	form: UseFormReturnType<DiscussionModuleFormValues>;
}) {
	useFormWatchForceUpdate(form, "discussionRequireReplies");
	const discussionRequireReplies = form.getValues().discussionRequireReplies;
	if (!discussionRequireReplies) return null;
	return (
		<NumberInput
			{...form.getInputProps("discussionMinReplies")}
			key={form.key("discussionMinReplies")}
			label="Minimum Replies"
			placeholder="Enter minimum number of replies"
			min={1}
		/>
	);
}
