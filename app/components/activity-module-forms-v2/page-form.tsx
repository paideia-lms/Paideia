import { Stack } from '@mantine/core';
import { CommonFields } from './common-fields';
import type { UpdateModuleFormApi } from '../../hooks/use-form-context';

type PageFormProps = {
    form: UpdateModuleFormApi;
};

/**
 * Page module form using Tanstack Form
 * Includes common fields, description, and rich text editor for content
 */
export function PageForm({ form }: PageFormProps) {
    return (
        <Stack gap="md">
            <CommonFields form={form} />

            {/* Description Field */}
            <form.AppField name="description">
                {(field) => (
                    <field.TextareaField
                        label="Description"
                        placeholder="Enter module description"
                        minRows={3}
                    />
                )}
            </form.AppField>

            {/* Page Content with Rich Text Editor */}
            <form.AppField name="pageContent">
                {(field) => (
                    <field.RichTextEditorField
                        label="Page Content"
                        placeholder="Enter page content..."
                    />
                )}
            </form.AppField>
        </Stack>
    );
}

