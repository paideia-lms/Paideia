import { Stack, Title } from '@mantine/core';
import { CommonFields } from './common-fields';
import type { FormApi } from './use-form-context';

type AssignmentFormProps = {
    form: FormApi;
};

/**
 * Assignment module form using Tanstack Form
 * Includes common fields, description, and assignment-specific settings
 */
export function AssignmentForm({ form }: AssignmentFormProps) {
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

            <Title order={4} mt="md">
                Assignment Settings
            </Title>

            {/* Instructions Field */}
            <form.AppField name="assignmentInstructions">
                {(field) => (
                    <field.TextareaField
                        label="Instructions"
                        placeholder="Enter assignment instructions"
                        minRows={3}
                    />
                )}
            </form.AppField>

            {/* Due Date Field */}
            <form.AppField name="assignmentDueDate">
                {(field) => (
                    <field.DateTimePickerField
                        label="Due Date"
                        placeholder="Select due date"
                    />
                )}
            </form.AppField>

            {/* Max Attempts Field */}
            <form.AppField name="assignmentMaxAttempts">
                {(field) => (
                    <field.NumberInputField
                        label="Max Attempts"
                        placeholder="Enter max attempts"
                        min={1}
                    />
                )}
            </form.AppField>

            {/* Allow Late Submissions Checkbox */}
            <form.AppField name="assignmentAllowLateSubmissions">
                {(field) => <field.CheckboxField label="Allow late submissions" />}
            </form.AppField>

            {/* Require Text Submission Checkbox */}
            <form.AppField name="assignmentRequireTextSubmission">
                {(field) => <field.CheckboxField label="Require text submission" />}
            </form.AppField>

            {/* Require File Submission Checkbox */}
            <form.AppField name="assignmentRequireFileSubmission">
                {(field) => <field.CheckboxField label="Require file submission" />}
            </form.AppField>
        </Stack>
    );
}

