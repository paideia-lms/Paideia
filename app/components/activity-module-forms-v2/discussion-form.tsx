import { Stack, Title } from '@mantine/core';
import { CommonFields } from './common-fields';
import type { FormApi } from './use-form-context';

type DiscussionFormProps = {
    form: FormApi;
};

/**
 * Discussion module form using Tanstack Form
 * Includes common fields, description, and discussion-specific settings
 */
export function DiscussionForm({ form }: DiscussionFormProps) {
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
                Discussion Settings
            </Title>

            {/* Instructions Field */}
            <form.AppField name="discussionInstructions">
                {(field) => (
                    <field.TextareaField
                        label="Instructions"
                        placeholder="Enter discussion instructions"
                        minRows={3}
                    />
                )}
            </form.AppField>

            {/* Due Date Field */}
            <form.AppField name="discussionDueDate">
                {(field) => (
                    <field.DateTimePickerField
                        label="Due Date"
                        placeholder="Select due date"
                    />
                )}
            </form.AppField>

            {/* Require Thread Checkbox */}
            <form.AppField name="discussionRequireThread">
                {(field) => <field.CheckboxField label="Require thread creation" />}
            </form.AppField>

            {/* Require Replies Checkbox */}
            <form.AppField name="discussionRequireReplies">
                {(field) => <field.CheckboxField label="Require replies" />}
            </form.AppField>

            {/* Conditional Minimum Replies Field */}
            <form.Subscribe selector={(state) => state.values.discussionRequireReplies}>
                {(requireReplies) =>
                    requireReplies ? (
                        <form.AppField name="discussionMinReplies">
                            {(field) => (
                                <field.NumberInputField
                                    label="Minimum Replies"
                                    placeholder="Enter minimum number of replies"
                                    min={1}
                                />
                            )}
                        </form.AppField>
                    ) : null
                }
            </form.Subscribe>
        </Stack>
    );
}

