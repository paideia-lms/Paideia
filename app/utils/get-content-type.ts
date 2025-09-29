export enum ContentType {
	JSON = "application/json",
	URLENCODED_FORM = "application/x-www-form-urlencoded",
	MULTIPART = "multipart/form-data",
}

/**
 * Map over all the keys to create a new object
 */
export const mapValues = <
	TValue,
	TKey extends string | number | symbol,
	TNewValue,
>(
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

	if (contentType && contentType.includes("application/json")) {
		return {
			contentType: ContentType.JSON,
			data: await request.clone().json(),
		};
	} else if (
		contentType &&
		contentType.includes("application/x-www-form-urlencoded")
	) {
		const text = await request.clone().text();
		const formData = await request.clone().formData();
		return {
			contentType: ContentType.URLENCODED_FORM,
			data: Object.fromEntries(new URLSearchParams(text)),
			text,
			formData,
		};
	} else if (contentType && contentType.includes("multipart/form-data")) {
		const formData = await request.clone().formData();
		const f = Object.fromEntries(formData);
		// since the values of form must be string, we need to try json parse the value
		const data = mapValues(f, (value, key) => {
			try {
				return JSON.parse(value as string);
			} catch (e) {
				return value;
			}
		});

		return {
			contentType: ContentType.MULTIPART,
			data: data,
			formData,
		};
	} else {
		throw new Error("Unsupported content type");
	}
};
