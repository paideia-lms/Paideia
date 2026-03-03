import { Button, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import type { DiscussionFormInitialValues as EditDiscussionFormInitialValues } from "app/routes/user/module/edit-setting/route";
import type { DiscussionFormInitialValues as NewDiscussionFormInitialValues } from "app/routes/user/module/new";
import type { Simplify, UnionToIntersection } from "type-fest";
import { FormableSimpleRichTextEditor } from "../form-components/formable-simple-rich-text-editor";

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

				<FormableSimpleRichTextEditor
					form={form}
					key={form.key("discussionInstructions")}
					formKey={"discussionInstructions"}
					label="Instructions"
					placeholder="Enter discussion instructions..."
				/>

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}
