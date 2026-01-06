import type { UseFormReturnType } from "@mantine/form";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { SimpleRichTextEditor } from "../rich-text/simple-rich-text-editor";
import type { FormPathValue, Path } from "node_modules/@mantine/form/lib/paths.types";
import { Input } from "@mantine/core";

interface FormableSimpleRichTextEditorProps<T> {
	form: UseFormReturnType<T>;
	formKey: Path<T>;
	label: string;
	placeholder: string;
}

/** 
 * This component is a wrapper around the SimpleRichTextEditor component that is used to edit the content of a form.
 * 
 * @usage 
 * 
 * ```
 * <FormableSimpleRichTextEditor form={form} formKey={form.key("content")} key={form.key("content")} label="Content" placeholder="Enter content" />
 * ```
 */
export function FormableSimpleRichTextEditor<T>({ form, formKey, label, placeholder }: FormableSimpleRichTextEditorProps<T>) {
	const instructions = useFormWatchForceUpdate(form, formKey);

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
