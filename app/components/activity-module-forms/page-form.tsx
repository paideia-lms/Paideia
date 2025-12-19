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
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";
import type { PageFormInitialValues as EditPageFormInitialValues } from "app/routes/user/module/edit-setting";
import type { PageFormInitialValues as NewPageFormInitialValues } from "app/routes/user/module/new";
import type { Simplify, UnionToIntersection } from "type-fest";

type PageFormData = Simplify<
	UnionToIntersection<NewPageFormInitialValues | EditPageFormInitialValues>
>;

interface PageFormProps {
	initialValues?: Partial<PageFormData>;
	onSubmit: (values: PageFormData) => void;
	isLoading?: boolean;
}

export function PageForm({
	initialValues,
	onSubmit,
	isLoading,
}: PageFormProps) {
	const form = useForm({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title ?? "",
			description: initialValues?.description ?? "",
			status: initialValues?.status ?? "draft",
			content: initialValues?.content ?? "",
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

				<div>
					<Title order={5} mb="xs">
						Page Content
					</Title>
					<PageContentEditor form={form} />
				</div>

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}

function PageContentEditor({
	form,
}: {
	form: UseFormReturnType<PageFormData>;
}) {
	const content = useFormWatchForceUpdate(form, "content");
	return (
		<div>
			<SimpleRichTextEditor
				content={content || ""}
				placeholder="Enter page content..."
				onChange={(html) => {
					form.setFieldValue("content", html);
				}}
			/>
		</div>
	);
}
