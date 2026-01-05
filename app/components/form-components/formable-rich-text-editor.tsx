import type { UseFormReturnType } from "@mantine/form";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { RichTextEditor } from "../rich-text/rich-text-editor";
import type { FormPathValue } from "~/packages/@mantine/form/lib/paths.types";
import { Input } from "@mantine/core";

interface FormableRichTextEditorProps<T> {
    form: UseFormReturnType<T>;
    formKey: string;
    label: string;
    placeholder?: string;
}

/** 
 * This component is a wrapper around the RichTextEditor component that is used to edit the content of a form.
 * 
 * @usage 
 * 
 * ```
 * <FormableRichTextEditor form={form} formKey={form.key("content")} key={form.key("content")} label="Content" placeholder="Enter content" />
 * ```
 */
export function FormableRichTextEditor<T>({ form, formKey, label, placeholder }: FormableRichTextEditorProps<T>) {
    const content = useFormWatchForceUpdate(form, formKey);

    return (
        <Input.Wrapper label={label}>
            <RichTextEditor
                content={content as string || ""}
                onChange={(html) => {
                    form.setFieldValue(formKey, html as FormPathValue<T, string>);
                }}
                placeholder={placeholder}
            />
        </Input.Wrapper>
    );
}

