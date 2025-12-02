/**
 * Special marker used to represent null values in FormData.
 * This marker is extremely unlikely to be used by users.
 * If a user needs to send this exact string, they should JSON.stringify it
 * as part of an object, which will escape it properly.
 */
export const NULL_MARKER = "\0__FORM_NULL__\0";

/**
 * Converts FormData (including MyFormData) to a plain object.
 * Handles the special NULL_MARKER, JSON parsing, and preserves Files.
 * This function can be used on both client and server side.
 *
 * @param formData - The FormData instance to convert
 * @returns A plain object with parsed values
 */
export function convertMyFormDataToObject<T = Record<string, unknown>>(
	formData: FormData,
): T {
	const f = Object.fromEntries(formData);
	const data = Object.fromEntries(
		Object.entries(f)
			// Filter out the dummy field added for empty FormData
			.filter(([key]) => key !== "__empty__")
			.map(([key, value]) => {
				// Files should be preserved as-is
				if (value instanceof File) {
					return [key, value];
				}

				const stringValue = value as string;

				// Check if this is our null marker
				if (stringValue === NULL_MARKER) {
					return [key, null];
				}

				// Try to parse as JSON (handles objects, arrays, numbers, booleans, and JSON strings)
				// Falls back to original value if parsing fails
				try {
					const parsed = JSON.parse(stringValue);
					return [key, parsed];
				} catch {
					// Not valid JSON, return as string
					// This shouldn't happen if we're using MyFormData correctly,
					// but handle it gracefully
					return [key, stringValue];
				}
			}),
	) as T;
	return data;
}

export class MyFormData<
	T extends Record<
		string,
		Blob | string | object | boolean | number | null | undefined
	>,
> extends FormData {
	constructor(data: T) {
		super();
		let hasAnyField = false;

		for (const [key, value] of Object.entries(data)) {
			// Skip undefined values (don't append to FormData)
			if (value === undefined) {
				continue;
			}

			hasAnyField = true;

			// Send null as special marker to distinguish from undefined and string "null"
			if (value === null) {
				this.append(key, NULL_MARKER);
				continue;
			}

			// For strings, we need to handle the edge case where string is "null"
			// We JSON.stringify it to preserve it and distinguish from actual null
			if (typeof value === "string") {
				this.append(key, JSON.stringify(value));
				continue;
			}

			this.append(
				key,
				value instanceof Blob
					? value
					: typeof value === "object"
						? JSON.stringify(value)
						: typeof value === "boolean"
							? value.toString()
							: typeof value === "number"
								? value.toString()
								: value,
			);
		}

		// If FormData is empty (all values were undefined or object was empty),
		// add a dummy field to ensure the request is valid
		// This prevents "fail to fetch" errors when submitting empty FormData
		if (!hasAnyField) {
			this.append("__empty__", "true");
		}
	}

	json(): T {
		return convertMyFormDataToObject<T>(this);
	}
}
