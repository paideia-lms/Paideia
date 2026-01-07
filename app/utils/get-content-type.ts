export enum ContentType {
	JSON = "application/json",
	URLENCODED_FORM = "application/x-www-form-urlencoded",
	MULTIPART = "multipart/form-data",
}

/**
 * Map over all the keys to create a new object
 */
const mapValues = <TValue, TKey extends string | number | symbol, TNewValue>(
	obj: Record<TKey, TValue>,
	mapFunc: (value: TValue, key: TKey) => TNewValue,
): Record<TKey, TNewValue> => {
	const keys = Object.keys(obj) as TKey[];
	return keys.reduce(
		(acc, key) => {
			acc[key] = mapFunc(obj[key], key);
			return acc;
		},
		{} as Record<TKey, TNewValue>,
	);
};

export const getDataAndContentTypeFromRequest = async (request: Request) => {
	const contentType = request.headers.get("Content-Type");

	if (contentType?.includes("application/json")) {
		return {
			contentType: ContentType.JSON,
			data: await request.clone().json(),
		};
	} else if (contentType?.includes("application/x-www-form-urlencoded")) {
		const text = await request.clone().text();
		const formData = await request.clone().formData();
		return {
			contentType: ContentType.URLENCODED_FORM,
			data: Object.fromEntries(new URLSearchParams(text)),
			text,
			formData,
		};
	} else if (contentType?.includes("multipart/form-data")) {
		// ! when using form, this only works if the form has no file data
		const formData = await request.clone().formData();
		const data = convertFormDataToObject(formData);

		return {
			contentType: ContentType.MULTIPART,
			data: data,
			formData,
		};
	} else {
		throw new Error("Unsupported content type");
	}
};

export function convertFormDataToObject(formData: FormData) {
	const f = Object.fromEntries(formData);
	const data = mapValues(f, (value, _key) => {
		// Files should be preserved as-is
		if (value instanceof File) {
			return value;
		}

		// Try to parse as JSON (handles objects, arrays, numbers, booleans)
		// Falls back to original value if parsing fails (plain strings)
		try {
			return JSON.parse(value as string);
		} catch (_e) {
			return value;
		}
	});
	return data;
}
