import { Stack } from '@mantine/core';
import { CommonFields } from './common-fields';
import type { UpdateModuleFormApi } from '../../hooks/use-form-context';

type WhiteboardFormProps = {
    form: UpdateModuleFormApi;
    isLoading?: boolean;
};

/**
 * Whiteboard module form using Tanstack Form
 * Includes common fields, description, and Excalidraw canvas with built-in debouncing
 */
export function WhiteboardForm({ form, isLoading = false }: WhiteboardFormProps) {
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

            {/* Whiteboard Field with built-in debouncing via Tanstack Form listeners */}
            <form.AppField
                name="whiteboardContent"
            // listeners={{
            //     onChangeDebounceMs: 500, // 500ms debounce for whiteboard saves
            //     onChange: ({ value }) => {
            //         // Optional: Add side effects here after debounced change
            //         // e.g., show "saved" indicator, trigger autosave, etc.
            //         console.log('Whiteboard content saved (debounced)', value?.slice(0, 50));
            //         form.setFieldValue('whiteboardContent', value);
            //     },
            // }}
            >
                {(field) => <field.WhiteboardField label="Whiteboard Canvas" isLoading={isLoading} />}
            </form.AppField>
        </Stack>
    );
}

