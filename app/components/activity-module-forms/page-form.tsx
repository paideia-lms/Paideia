import {
	Button,
	Group,
	Select,
	Stack,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import { type UseFormReturnType, useForm } from "@mantine/form";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { IconCode } from "@tabler/icons-react";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { useJsonFormMode } from "~/utils/use-json-form-mode";
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
	const { colorScheme } = useMantineColorScheme();

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
			title: (value: string) =>
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

function JsonEditor({
	defaultValue,
	onMount,
	colorScheme,
}: {
	defaultValue: string;
	onMount: OnMount;
	colorScheme: "light" | "dark" | "auto";
}) {
	return (
		<div>
			<Title order={5} mb="xs">
				JSON Editor
			</Title>
			<MonacoEditor
				height="400px"
				language="json"
				defaultValue={defaultValue}
				onMount={onMount}
				theme={colorScheme === "dark" ? "vs-dark" : "light"}
				options={{
					minimap: { enabled: false },
					scrollBeyondLastLine: false,
					fontSize: 14,
					lineNumbers: "on",
					readOnly: false,
					wordWrap: "on",
					codeLens: false,
					autoClosingBrackets: "always",
					autoClosingQuotes: "always",
					autoIndent: "full",
					formatOnPaste: true,
					formatOnType: true,
				}}
			/>
		</div>
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
