import type { Payload, PayloadRequest, TextareaField } from "payload";
import { Result } from "typescript-result";
import { tryParseMediaFromHtml } from "../../internal/utils/parse-media-from-html";
import {
	type BaseInternalFunctionArgs,
	interceptPayloadError,
	stripDepth,
} from "@paideia/shared";
import { replaceBase64MediaWithMediaUrlsV2 } from "../../internal/utils/replace-base64-images";
import type { Simplify } from "type-fest";

// function richTextContent<T extends TextareaField>(o: T) {
// 	return [
// 		o satisfies T,
// 		{
// 			name: `${o.name}Media`,
// 			type: "relationship",
// 			relationTo: "media",
// 			hasMany: true,
// 			label: `${o.label} Media`,
// 		},
// 	] as const;
// }

/**
 * Creates a rich text field configuration WITH automatic beforeChange hook.
 *
 * This is a convenience function that combines:
 * - The textarea field (with hook defined ON THE FIELD)
 * - The media relationship field
 *
 * @param o - The textarea field configuration (name, type, label, etc.)
 * @param alt - Alt text to use for images found in this field's content
 *
 * @example
 * ```typescript
 * // In a collection config:
 * fields: [
 *   ...richTextContentWithHook({
 *     name: "content",
 *     type: "textarea",
 *     label: "Content",
 *   }, "Note content image")
 * ]
 * ```
 *
 * =============================================================================
 * COLLECTION HOOK vs FIELD HOOK - Choosing the Right Approach
 * =============================================================================
 *
 * There are THREE ways to use this functionality:
 *
 * ---- METHOD 1: Collection Hook (recommended for most cases) ----
 * Use: richTextContent() + collection-level hooks
 *
 * Pros:
 * + Single hook processes ALL rich text fields in the collection
 * + Easier to maintain - one place to update logic
 * + Better performance - one hook call per operation
 * + Works automatically with any create/update operation
 *
 * Cons:
 * - All fields use the same hook configuration
 * - Less granular control per field
 *
 * Example:
 * ```typescript
 * // In collection config:
 * hooks: {
 *   beforeChange: [
 *     createRichTextBeforeChangeHook({
 *       fields: [
 *         { key: 'description', alt: 'Course description image' },
 *         { key: 'summary', alt: 'Course summary image' }
 *       ]
 *     })
 *   ]
 * },
 * fields: [
 *   ...richTextContent({ name: 'description', type: 'textarea' }),
 *   ...richTextContent({ name: 'summary', type: 'textarea' }),
 * ]
 * ```
 *
 * ---- METHOD 2: Field Hook (richTextContentWithHook) ----
 * Use: richTextContentWithHook() - returns fields with hook DEFINED ON EACH FIELD
 *
 * This creates a field that has the beforeChange hook directly on the field itself,
 * similar to Payload's field-level hooks:
 * ```typescript
 * {
 *   name: 'title',
 *   type: 'text',
 *   hooks: {
 *     beforeChange: [{ value, siblingData, operation } => { ... }]
 *   }
 * }
 * ```
 *
 * Pros:
 * + Self-contained - field and hook defined together
 * + Clear ownership - each field manages its own media processing
 * + Easy to copy/paste between collections
 * + Type-safe - field name is tied to the hook configuration
 * + Hook only runs when THIS SPECIFIC FIELD changes
 *
 * Cons:
 * - Multiple hooks (one per field) - slight performance overhead
 * - More verbose if you have many rich text fields
 * - Harder to update logic across all fields at once
 *
 * Example:
 * ```typescript
 * // In collection config - note: NO collection-level hooks needed:
 * fields: [
 *   ...richTextContentWithHook({
 *     name: "content",
 *     type: "textarea",
 *     label: "Content",
 *   }, "Note content image")
 * ]
 * ```
 *
 * The hook is embedded directly in the field configuration:
 * ```typescript
 * {
 *   name: "content",
 *   type: "textarea",
 *   hooks: {
 *     beforeChange: [{ data, req, siblingData, value, operation } => { ... }]
 *   }
 * }
 * ```
 *
 * ---- RECOMMENDATION ----
 * - Use Method 1 (collection hook) when:
 *   * You have multiple rich text fields
 *   * You want centralized logic
 *   * Performance is critical
 *
 * - Use Method 2 (field hook) when:
 *   * You have a single rich text field
 *   * You want self-contained field definitions
 *   * You copy/paste field configs between projects
 *   * You want hook to only run when THIS specific field changes
 *
 * =============================================================================
 */
export function richTextContentWithHook<T extends TextareaField>(
	o: T,
	alt: string,
) {
	const fieldName = o.name;

	return {
		fields: [
			{
				...o,
				hooks: {
					beforeChange: [
						async ({
							data,
							req,
							siblingData,
							value,
							operation,
							originalDoc,
						}: any) => {
							if (!data) {
								return value;
							}

							const result = await createRichTextHookHandler({
								data,
								req,
								operation,
								originalDoc,
								fields: [{ key: fieldName, alt }],
							});

							if (result !== data) {
								data[fieldName] = result[fieldName];
								const mediaFieldName = `${fieldName}Media`;
								siblingData[mediaFieldName] = result[mediaFieldName];
							}

							// Return processed value so validation runs on media URLs, not base64
							return result[fieldName] ?? value;
						},
					],
				},
			},
			{
				name: `${o.name}Media`,
				type: "relationship",
				relationTo: "media",
				hasMany: true,
				label: `${o.label} Media`,
			} as const,
		],
	};
}

export interface RichTextFieldConfig {
	key: string;
	alt: string;
}

export interface RichTextHookConfig {
	fields: RichTextFieldConfig[];
}

interface UserIdAndPayload {
	userId: number;
	payload: Payload;
}

export function extractUserIdAndPayload(args: {
	data: any;
	req?: any;
	operation?: string;
	originalDoc?: any;
}): UserIdAndPayload | undefined {
	const { data, req, operation, originalDoc } = args;

	if (req?.user?.id && req?.payload) {
		return { userId: req.user.id, payload: req.payload };
	}

	if (data.createdBy && typeof data.createdBy === "number" && req?.payload) {
		return { userId: data.createdBy, payload: req.payload };
	}

	if (
		operation === "update" &&
		originalDoc?.createdBy &&
		typeof originalDoc.createdBy === "number" &&
		req?.payload
	) {
		return { userId: originalDoc.createdBy, payload: req.payload };
	}

	return undefined;
}

export interface RichTextHookHandlerArgs {
	data: any;
	req?: any;
	operation?: string;
	originalDoc?: any;
	fields: RichTextFieldConfig[];
}

export async function createRichTextHookHandler(
	args: RichTextHookHandlerArgs,
): Promise<any> {
	const { data, req, operation, originalDoc, fields } = args;

	if (!data) {
		return data;
	}

	const userAndPayload = extractUserIdAndPayload({
		data,
		req,
		operation,
		originalDoc,
	});

	if (!userAndPayload) {
		return data;
	}

	const { userId, payload } = userAndPayload;

	const fieldsToProcess = fields.filter((field) => {
		return field.key in data && typeof data[field.key] === "string";
	});

	if (fieldsToProcess.length === 0) {
		return data;
	}

	const dataToProcess: Record<string, string> = {};
	for (const field of fieldsToProcess) {
		dataToProcess[field.key] = data[field.key];
	}

	const processedData = await processRichTextMediaV2({
		payload,
		userId,
		req,
		overrideAccess: true,
		data: dataToProcess,
		fields: fieldsToProcess,
	});

	return {
		...data,
		...processedData,
	};
}

/** 
 * @deprecated use richTextContentWithHook instead
 */
export function createRichTextBeforeChangeHook(config: RichTextHookConfig) {
	return async ({ data, req, operation, originalDoc }: any) => {
		return createRichTextHookHandler({
			data,
			req,
			operation,
			originalDoc,
			fields: config.fields,
		});
	};
}

export interface ExtractMediaIdsFromRichTextArgs
	extends BaseInternalFunctionArgs {
	payload: Payload;
	htmlContent: string[];
}

/**
 * Extracts media IDs from rich text HTML content.
 * Parses HTML to find media references, resolves filenames to IDs,
 * and returns an array of all unique media IDs found across all fields.
 * Supports multiple rich text fields in a single call.
 */
export function tryExtractMediaIdsFromRichText(
	args: ExtractMediaIdsFromRichTextArgs,
) {
	return Result.try(async () => {
		const { payload, htmlContent, req } = args;

		if (!htmlContent || htmlContent.length === 0) {
			return [];
		}

		// Collect all parsed IDs and filenames from all rich text fields
		const allParsedIds = new Set<number>();
		const allFilenames = new Set<string>();

		for (const content of htmlContent) {
			if (!content || content.trim().length === 0) {
				continue;
			}

			// Parse media from HTML content
			const mediaParseResult =
				await tryParseMediaFromHtml(content).getOrThrow();

			const { ids: parsedIds } = mediaParseResult;

			// Add to sets (automatically handles duplicates)
			for (const id of parsedIds) {
				allParsedIds.add(id);
			}
		}

		// Resolve all filenames to IDs in a single query

		const resolvedIds =
			allFilenames.size > 0
				? await payload
					.find({
						collection: "media",
						where: {
							filename: {
								in: Array.from(allFilenames),
							},
						},
						limit: allFilenames.size,
						depth: 0,
						pagination: false,
						// ! this is a server request
						overrideAccess: true,
						// @ts-ignore 
						req: req?.transactionID
							? { ...req, transactionID: req.transactionID }
							: req,
					})
					.then(stripDepth<0, "find">())
					.catch((error) => {
						interceptPayloadError({
							error,
							functionNamePrefix: "tryExtractMediaIdsFromRichText",
							args,
						});
						throw error;
					})
					.then((r) => r.docs?.map((doc) => doc.id) ?? [])
				: [];

		// Combine parsed IDs and resolved IDs, remove duplicates
		const allMediaIds = new Set([...allParsedIds, ...resolvedIds]);
		return Array.from(allMediaIds);
	});
}

export interface ProcessRichTextMediaV2Args<T extends Record<string, string>> {
	payload: Payload;
	userId: number;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	/**
	 * Data object containing rich text fields (string content only, no File fields required)
	 * Example: { description: "<p>Text with <img src='data:image/png;base64,...' /></p>" }
	 */
	data: T;
	/**
	 * Array of field names to process. Must be keys of T.
	 * Each field will have its base64 images replaced with media URLs.
	 */
	fields: {
		key: keyof T & string;
		alt: string;
	}[];
}

/**
 * Processes rich text content by parsing base64 images directly from HTML strings.
 * Creates media records from the base64 data, replaces them with media URLs,
 * and extracts media IDs for relationship fields.
 * Supports multiple rich text fields in a single call.
 *
 * This version does not require File fields or preview fields in the data object.
 * Base64 images are extracted directly from the HTML content.
 *
 * Returns an object that can be spread into payload update/create data, containing:
 * - Processed field values (e.g., `description: string`)
 * - Media relationship arrays (e.g., `descriptionMedia: number[]`)
 */
export const processRichTextMediaV2 = async <T extends Record<string, string>>(
	args: ProcessRichTextMediaV2Args<T>,
): Promise<ProcessRichTextMediaV2Result<T>> => {
	const { payload, userId, req, overrideAccess = false, data, fields } = args;

	const result: ProcessRichTextMediaV2Result<T> =
		{} as ProcessRichTextMediaV2Result<T>;

	// Process each field
	for (const field of fields) {
		const content = data[field.key];
		if (typeof content === "string" && content.trim().length > 0) {
			const processed = await replaceBase64MediaWithMediaUrlsV2({
				content,
				payload,
				userId,
				req,
				overrideAccess,
				alt: field.alt,
			});

			// @ts-ignore
			result[field.key] = processed.processedContent;

			// Extract media IDs from this field's processed content
			const mediaIds = await tryExtractMediaIdsFromRichText({
				payload,
				htmlContent: [processed.processedContent].filter(Boolean),
				req,
			}).getOrThrow();

			const fieldName = field.key as string;
			const mediaFieldName = `${fieldName}Media`;
			// @ts-ignore
			result[mediaFieldName] = mediaIds;
		} else if (content === undefined || content === null) {
			// @ts-ignore
			result[field.key] = undefined;
			const fieldName = field.key as string;
			const mediaFieldName = `${fieldName}Media`;
			// @ts-ignore
			result[mediaFieldName] = [];
		}
	}

	return result;
};

export type ProcessRichTextMediaV2Result<T extends Record<string, string>> =
	Simplify<
		{
			[K in keyof T]: string;
		} & {
			[K in `${keyof T & string}Media`]: number[];
		}
	>;
