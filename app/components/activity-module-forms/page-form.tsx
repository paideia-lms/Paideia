import { Button, Stack, Textarea, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import type { UseFormReturnType } from "@mantine/form";
import type { ActivityModuleFormValues, PageModuleFormValues } from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { CommonFields } from "./common-fields";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";

interface PageFormProps {
	initialValues?: Partial<PageModuleFormValues>;
	onSubmit: (values: PageModuleFormValues) => void;
	isLoading?: boolean;
}

export function PageForm({ initialValues, onSubmit, isLoading }: PageFormProps) {
	const form = useForm<PageModuleFormValues>({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title || "",
			description: initialValues?.description || "",
			type: "page" as const,
			status: initialValues?.status || "draft",
			pageContent: initialValues?.pageContent || "",
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});


	return (
		<form onSubmit={form.onSubmit(onSubmit)}>
			<Stack gap="md">
				<CommonFields form={form as UseFormReturnType<ActivityModuleFormValues>} />

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
	form: UseFormReturnType<PageModuleFormValues>;
}) {
	const pageContent = useFormWatchForceUpdate(form, "pageContent");
	return (
		<div>
			<SimpleRichTextEditor
				content={pageContent}
				placeholder="Enter page content..."
				onChange={(html) => {
					form.setFieldValue("pageContent", html);
				}}
			/>
		</div>
	);
}
