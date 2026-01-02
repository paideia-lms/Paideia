import { z } from "zod";
import type { RouteId, RouteParams } from "app/utils/routes-utils";
import type { Simplify } from "type-fest";

export const paramsSchema = {
	id: z.coerce.number(),
	mediaId: z.coerce.number(),
	noteId: z.coerce.number(),
	moduleId: z.coerce.number(),
	courseId: z.coerce.number(),
	moduleLinkId: z.coerce.number(),
	sectionId: z.coerce.number(),
	"*": z.string().optional(),
};

export type ParamsType = {
	[key in keyof typeof paramsSchema]: z.infer<(typeof paramsSchema)[key]>;
};

export function parseParams(params: Record<string, string | undefined>) {
	const entries: Record<string, string | number | undefined> =
		Object.fromEntries(Object.entries(params));

	for (const [key, value] of Object.entries(entries)) {
		const schema = paramsSchema[key as keyof typeof paramsSchema];
		if (schema) {
			entries[key] = schema.parse(value);
		}
	}

	return entries as Partial<ParamsType>;
}

/**
 * Converts route params (string types) to type-safe params (number/string based on schema)
 * while preserving optionality.
 *
 * For example:
 * - `{ id?: string | undefined }` becomes `{ id?: number | undefined }`
 * - The optional `?` is preserved
 */
export type TypeSafeRouteParams<T extends RouteId> = Simplify<{
	[K in keyof RouteParams<T>]: K extends keyof ParamsType
		? ParamsType[K]
		: RouteParams<T>[K];
}>;

// Example usage:
// type Test = TypeSafeRouteParams<"routes/user/profile">;
// If RouteParams<"routes/user/profile"> is { id?: string | undefined }
// Then Test will be { id?: number | undefined }
