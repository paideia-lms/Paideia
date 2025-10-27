import { Stack, Textarea, Title } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import type { ActivityModuleFormValues } from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { RichTextEditor } from "../rich-text-editor";
import { CommonFields } from "./common-fields";

interface PageFormProps {
	form: UseFormReturnType<ActivityModuleFormValues>;
}

export function PageForm({ form }: PageFormProps) {
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

			<div>
				<Title order={5} mb="xs">
					Page Content
				</Title>
				<PageContentEditor form={form} />
			</div>
		</Stack>
	);
}

function PageContentEditor({
	form,
}: {
	form: UseFormReturnType<ActivityModuleFormValues>;
}) {
	const pageContent = useFormWatchForceUpdate(form, "pageContent");
	return (
		<div>
			<RichTextEditor
				content={pageContent}
				placeholder="Enter page content..."
				onChange={(html) => {
					form.setFieldValue("pageContent", html);
				}}
			/>
		</div>
	);
}
