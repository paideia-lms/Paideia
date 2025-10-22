import { Stack, Title } from '@mantine/core';
import { useState } from 'react';
import { RichTextEditor } from '../rich-text-editor';
import { CommonFields } from './common-fields';
import type { FormApi } from './use-form-context';

type PageFormProps = {
    form: FormApi;
};

/**
 * Page module form using Tanstack Form
 * Includes common fields, description, and rich text editor for content
 */
export function PageForm({ form }: PageFormProps) {
    const [htmlContent, setHtmlContent] = useState(form.state.values.pageContent);

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
            <div>
                <Title order={5} mb="xs">
                    Page Content
                </Title>
                <form.AppField name="pageContent">
                    {(field) => (
                        <RichTextEditor
                            content={htmlContent}
                            placeholder="Enter page content..."
                            onChange={(html) => {
                                setHtmlContent(html);
                                field.handleChange(html);
                            }}
                        />
                    )}
                </form.AppField>
            </div>
        </Stack>
    );
}

