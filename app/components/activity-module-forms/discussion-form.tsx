import {
	Button,
	Input,
	NumberInput,
	Select,
	Stack,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";
import type { DiscussionFormInitialValues as EditDiscussionFormInitialValues } from "app/routes/user/module/edit-setting";
import type { DiscussionFormInitialValues as NewDiscussionFormInitialValues } from "app/routes/user/module/new";
import type { Simplify, UnionToIntersection } from "type-fest";

type DiscussionFormData = Simplify<
	UnionToIntersection<
		NewDiscussionFormInitialValues | EditDiscussionFormInitialValues
	>
>;

interface DiscussionFormProps {
	initialValues?: Partial<DiscussionFormData>;
	onSubmit: (values: DiscussionFormData) => void;
	isLoading?: boolean;
}

export function DiscussionForm({
	initialValues,
	onSubmit,
	isLoading,
}: DiscussionFormProps) {
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title ?? "",
			description: initialValues?.description ?? "",
			status: initialValues?.status ?? "draft",
			discussionInstructions: initialValues?.discussionInstructions ?? "",
			discussionDueDate: initialValues?.discussionDueDate ?? null,
			discussionRequireThread: initialValues?.discussionRequireThread ?? false,
			discussionRequireReplies:
				initialValues?.discussionRequireReplies ?? false,
			discussionMinReplies: initialValues?.discussionMinReplies ?? 1,
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

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
	form: UseFormReturnType<DiscussionFormData>;
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
	form: UseFormReturnType<DiscussionFormData>;
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
