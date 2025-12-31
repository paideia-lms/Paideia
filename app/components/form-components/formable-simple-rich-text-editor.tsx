import type { UseFormReturnType } from "@mantine/form";  
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";
import type { FormPathValue } from "~/packages/@mantine/form/lib/paths.types";
import { Input } from "@mantine/core";

interface FormableSimpleRichTextEditorProps<T> {
	form: UseFormReturnType<T>;
	formKey: string;
	label: string;
	placeholder: string;
}

export function FormableSimpleRichTextEditor<T>({ form, formKey, label, placeholder }: FormableSimpleRichTextEditorProps<T>) {
	const instructions = useFormWatchForceUpdate(form, formKey );

	return (
		<Input.Wrapper label={label}>
			<SimpleRichTextEditor
				content={instructions as string || ""}
				onChange={(content) => {
					form.setFieldValue(formKey, content as FormPathValue<T, string>);
				}}
				placeholder={placeholder}
			/>
		</Input.Wrapper>
	);
}
