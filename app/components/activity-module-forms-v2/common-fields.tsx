import type { UpdateModuleFormApi } from '../../hooks/use-form-context';

interface CommonFieldsProps {
    form: UpdateModuleFormApi;
}

/**
 * Common fields shared across all activity module forms
 * Includes: title, status, requirePassword, accessPassword
 */
export function CommonFields({ form }: CommonFieldsProps) {
    return (
        <>
            {/* Title Field */}
            <form.AppField name="title">
                {(field) => (
                    <field.TextInputField
                        label="Title"
                        placeholder="Enter module title"
                        required
                        withAsterisk
                    />
                )}
            </form.AppField>

            {/* Status Field */}
            <form.AppField name="status">
                {(field) => (
                    <field.SelectField
                        label="Status"
                        placeholder="Select status"
                        data={[
                            { value: 'draft', label: 'Draft' },
                            { value: 'published', label: 'Published' },
                            { value: 'archived', label: 'Archived' },
                        ]}
                    />
                )}
            </form.AppField>

            {/* Require Password Checkbox */}
            <form.AppField name="requirePassword">
                {(field) => (
                    <field.CheckboxField label="Require password to access" />
                )}
            </form.AppField>

            {/* Conditional Access Password Field */}
            <form.Subscribe selector={(state) => state.values.requirePassword}>
                {(requirePassword) =>
                    requirePassword ? (
                        <form.AppField name="accessPassword">
                            {(field) => (
                                <field.TextInputField
                                    label="Access Password"
                                    placeholder="Enter access password"
                                />
                            )}
                        </form.AppField>
                    ) : null
                }
            </form.Subscribe>
        </>
    );
}

