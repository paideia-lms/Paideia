import type { UseFormReturnType } from "@mantine/form";
import { useRef } from "react";

/**
 * Generic hook to sync form fields with initialValues when they change.
 * Useful for updating form after loader revalidation.
 *
 * @param form - The Mantine form instance
 * @param initialValues - The initial values object (can be partial)
 * @param fields - Array of field paths to watch and sync
 * 
    @deprecated use useFormWithSyncedInitialValues instead
 */

export function useSyncFormWithInitialValues<T extends Record<string, unknown>>(
    form: UseFormReturnType<T>,
    initialValues: Partial<T> | undefined,
    fields: Array<keyof T>
) {
    const prevInitialValuesRef = useRef(initialValues);

    // Check if initialValues changed and update form directly (safe to call during render)
    const currentInitialValues = initialValues;
    const prevInitialValues = prevInitialValuesRef.current;

    // Check each field for changes
    let hasChanges = false;
    for (const field of fields) {
        const currentValue = currentInitialValues?.[field];
        const prevValue = prevInitialValues?.[field];
        const fieldChanged = JSON.stringify(currentValue ?? null) !==
            JSON.stringify(prevValue ?? null);
        if (fieldChanged) {
            hasChanges = true;
            break;
        }
    }

    // Update form if any field changed
    if (hasChanges) {
        prevInitialValuesRef.current = currentInitialValues;
        if (currentInitialValues) {
            // Update only the specified fields
            for (const field of fields) {
                const value = currentInitialValues[field];
                if (value !== undefined) {
                    // Type assertion needed because form.setFieldValue expects specific path types
                    // but we're working with dynamic field paths at runtime
                    // @ts-expect-error - Dynamic field paths require runtime type checking
                    form.setFieldValue(field as string, value);
                }
            }
        }
    }
}
