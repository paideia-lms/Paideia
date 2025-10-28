import {
	Checkbox,
	Input,
	NumberInput,
	Stack,
	Textarea,
	Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";
import { CommonFields } from "./common-fields";

interface DiscussionFormProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
}

export function DiscussionForm({ form }: DiscussionFormProps) {
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
		</Stack>
	);
}

function InstructionsEditor({
	form,
}: {
	form: UseFormReturnType<ActivityModuleFormValues>;
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

function MinimumRepliesInput({
	form,
}: {
	form: UseFormReturnType<ActivityModuleFormValues>;
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
