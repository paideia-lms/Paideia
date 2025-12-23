import type { Payload, PayloadRequest, TextareaField } from "payload";
import { Result } from "typescript-result";
import { tryParseMediaFromHtml } from "server/internal/utils/parse-media-from-html";
import {
	interceptPayloadError,
	stripDepth,
} from "server/internal/utils/internal-function-utils";
import { replaceBase64MediaWithMediaUrlsV2 } from "~/utils/replace-base64-images";
import type { Simplify } from "type-fest";

export function richTextContent<T extends TextareaField>(o: T) {
	return [
		o satisfies T,
		{
			name: `${o.name}Media`,
			type: "relationship",
			relationTo: "media",
			hasMany: true,
			label: `${o.label} Media`,
		},
	] as const;
}

export interface ExtractMediaIdsFromRichTextArgs {
	payload: Payload;
	htmlContent: string[];
	req?: Partial<PayloadRequest>;
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

			const { ids: parsedIds, filenames } = mediaParseResult;

			// Add to sets (automatically handles duplicates)
			for (const id of parsedIds) {
				allParsedIds.add(id);
			}
			for (const filename of filenames) {
				allFilenames.add(filename);
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
