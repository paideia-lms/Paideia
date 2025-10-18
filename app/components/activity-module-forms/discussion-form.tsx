import { Checkbox, NumberInput, Stack, Textarea, Title } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { UseFormReturnType } from "@mantine/form";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
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

			<Textarea
				{...form.getInputProps("discussionInstructions")}
				key={form.key("discussionInstructions")}
				label="Instructions"
				placeholder="Enter discussion instructions"
				minRows={3}
			/>

			<DateTimePicker
				{...form.getInputProps("discussionDueDate")}
				key={form.key("discussionDueDate")}
				label="Due Date"
				placeholder="Select due date"
			/>

			<Checkbox
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

			{form.getValues().discussionRequireReplies && (
				<NumberInput
					{...form.getInputProps("discussionMinReplies")}
					key={form.key("discussionMinReplies")}
					label="Minimum Replies"
					placeholder="Enter minimum number of replies"
					min={1}
				/>
			)}
		</Stack>
	);
}
