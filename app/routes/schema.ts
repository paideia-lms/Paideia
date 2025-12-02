import type { Simplify } from "type-fest";
import { z } from "zod";
import { pickBy } from "es-toolkit";

export const descriptionImageKeySchema = z.templateLiteral([
	"description-image-",
	z.number(),
]);
export const descriptionImageSchema = z.record(
	descriptionImageKeySchema,
	z.file(),
);

export type DescriptionImageSchema = z.infer<typeof descriptionImageSchema>;
export const descriptionImagePreviewKeySchema = z.templateLiteral([
	"description-image-",
	z.number(),
	"-preview",
]);
export const descriptionImagePreviewSchema = z.record(
	descriptionImagePreviewKeySchema,
	z.string(),
);

export type DescriptionImagePreviewSchema = z.infer<
	typeof descriptionImagePreviewSchema
>;

export const baseInputSchema = z.looseObject({
	title: z.string().min(1, "Title is required").optional(),
	slug: z
		.string()
		.min(1, "Slug is required")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must contain only lowercase letters, numbers, and hyphens",
		)
		.optional(),
	thumbnail: z.file().nullish(),
	description: z.string().min(1, "Description is required").optional(),
	status: z.enum(["draft", "published", "archived"]).optional(),
	category: z.coerce.number().nullish(),
	redirectTo: z
		.union([z.string(), z.null()])
		.optional()
		.refine(
			(val) => {
				// Allow null/undefined
				if (!val || val === null) return true;
				// Must be a relative path (starts with /) and not an absolute URL
				return (
					val.startsWith("/") &&
					!val.startsWith("http://") &&
					!val.startsWith("https://") &&
					!val.startsWith("//")
				);
			},
			{
				message:
					"Redirect path must be a relative path starting with '/' and cannot be an absolute URL",
			},
		),
});

export const inputSchema = baseInputSchema
	.refine((data) => {
		// pick the keys of baseInputSchema.shape from data
		const newData = pickBy(
			data,
			(_, key) => descriptionImageKeySchema.safeParse(key).success,
		);
		return descriptionImageSchema.safeParse(newData).success;
	})
	.refine((data) => {
		// pick the keys of descriptionImagePreviewSchema.shape from data
		const newData = pickBy(
			data,
			(_, key) => descriptionImagePreviewKeySchema.safeParse(key).success,
		);
		return descriptionImagePreviewSchema.safeParse(newData).success;
	});

export type InputSchema = Simplify<
	z.infer<typeof inputSchema> &
		DescriptionImageSchema &
		DescriptionImagePreviewSchema
>;
