import type { Payload, PayloadRequest } from "payload";
import { Result } from "typescript-result";
import type { Simplify } from "type-fest";
import { transformError, UnknownError } from "~/utils/error";
import { tryParseMediaFromHtml } from "server/internal/utils/parse-media-from-html";
import { stripDepth } from "server/internal/utils/internal-function-utils";
import { tryCreateMedia } from "server/internal/media-management";
import { replaceBase64ImagesWithMediaUrls } from "~/utils/replace-base64-images";
import type { UploadedMediaInfo } from "~/utils/upload-handler";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";

export function richTextContent<
	T extends { type: "textarea"; name: string; label: string },
>(o: T) {
	return [
		o,
		{
			name: `${o.name}Media`,
			type: "relationship",
			relationTo: "media",
			hasMany: true,
			label: `${o.label} Media`,
		},
	] as const;
}

export type RichTextContent<T extends string> = Simplify<
	{
		// Mapped type for the REQUIRED string property
		[P in T]?: string;
	} & {
		// Mapped type for OPTIONAL File/string properties using Template Literals
		[P in `${T}-image-${number}`]?: File;
	} & {
		[P in `${T}-image-${number}-preview`]?: string;
	}
>;

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
export const tryExtractMediaIdsFromRichText = Result.wrap(
	async (args: ExtractMediaIdsFromRichTextArgs): Promise<number[]> => {
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
			const mediaParseResult = tryParseMediaFromHtml(content);
			if (!mediaParseResult.ok) {
				throw mediaParseResult.error;
			}

			const { ids: parsedIds, filenames } = mediaParseResult.value;

			// Add to sets (automatically handles duplicates)
			for (const id of parsedIds) {
				allParsedIds.add(id);
			}
			for (const filename of filenames) {
				allFilenames.add(filename);
			}
		}

		// Resolve all filenames to IDs in a single query
		let resolvedIds: number[] = [];
		if (allFilenames.size > 0) {
			try {
				const mediaResult = await payload
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
					.then(stripDepth<0, "find">());

				resolvedIds = mediaResult.docs.map((doc) => doc.id);
			} catch (error) {
				// If media lookup fails, log warning but continue
				console.warn(`Failed to resolve media filenames to IDs:`, error);
			}
		}

		// Combine parsed IDs and resolved IDs, remove duplicates
		const allMediaIds = new Set([...allParsedIds, ...resolvedIds]);
		return Array.from(allMediaIds);
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to extract media IDs from rich text", {
			cause: error,
		}),
);

export interface ProcessRichTextMediaArgs<T extends Record<string, unknown>> {
	payload: Payload;
	userId: number;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	/**
	 * Data object containing rich text fields and their associated image File fields
	 * Example: { description: "...", "description-image-0": File, "description-image-0-preview": "..." }
	 */
	data: T;
	/**
	 * Array of field names to process. Must be keys of T.
	 * Each field will have its base64 images replaced with media URLs.
	 */
	fields: (keyof T & string)[];
	/**
	 * Alt text for created media records
	 */
	alt?: string;
}

export interface ProcessRichTextMediaResult<T extends Record<string, unknown>> {
	/**
	 * Processed data with base64 images replaced by media URLs for each field
	 */
	processedData: Partial<Record<keyof T, string | undefined>>;
	/**
	 * Information about uploaded media records
	 */
	uploadedMedia: UploadedMediaInfo[];
}

/**
 * Processes rich text content with file uploads.
 * Creates media records for all {field}-image-* File fields,
 * and replaces base64 images in content with media URLs.
 * Supports multiple rich text fields in a single call.
 *
 * we cannot use Result.wrap because otherwise it will not be a generic function
 */
export const processRichTextMedia = async <T extends Record<string, unknown>>(
	args: ProcessRichTextMediaArgs<T>,
): Promise<ProcessRichTextMediaResult<T>> => {
	const {
		payload,
		userId,
		req,
		overrideAccess = false,
		data,
		fields,
		alt = "Rich text image",
	} = args;

	const transactionInfo = await handleTransactionId(payload, req);

	return transactionInfo.tx(async ({ reqWithTransaction }) => {
		// Collect all image fields and their associated previews for all specified fields
		const allImageFields: Array<{
			fieldPrefix: string;
			fieldName: string;
			file: File;
		}> = [];
		const previewMap = new Map<string, string>();

		for (const fieldPrefix of fields) {
			// Find all image fields for this field prefix
			const imageFields = Object.entries(data)
				.filter(
					([key, value]) =>
						key.startsWith(`${fieldPrefix as string}-image-`) &&
						!key.includes("-preview") &&
						value instanceof File,
				)
				.map(([key, value]) => ({
					fieldPrefix,
					fieldName: key,
					file: value as File,
				}));

			// Sort by index to maintain order
			imageFields.sort((a, b) => {
				const indexA = Number.parseInt(
					a.fieldName.replace(`${fieldPrefix}-image-`, ""),
					10,
				);
				const indexB = Number.parseInt(
					b.fieldName.replace(`${fieldPrefix}-image-`, ""),
					10,
				);
				return indexA - indexB;
			});

			allImageFields.push(...imageFields);

			// Collect preview data for this field prefix
			for (const imageField of imageFields) {
				const previewKey = `${imageField.fieldName}-preview`;
				previewMap.set(
					previewKey,
					// base 64 of the image that starts with data:image/
					await imageField.file
						.arrayBuffer()
						.then(Buffer.from)
						.then((base64) => base64.toString("base64"))
						.then((base64) => base64.substring(0, 100)),
				);
			}
		}

		// Create media records for all image fields
		const uploadedMedia: UploadedMediaInfo[] = [];
		// ! for some reason we have to use for loop but not promise.all, otherwise it will fail
		for (const { fieldName, file } of allImageFields) {
			const { media } = await tryCreateMedia({
				payload,
				file: await file.arrayBuffer().then(Buffer.from),
				filename: file.name || fieldName,
				mimeType: file.type || "image/png",
				alt,
				userId,
				req: reqWithTransaction,
				overrideAccess,
			}).getOrThrow();

			const mediaId = media.id;
			const filename = media.filename ?? file.name;

			uploadedMedia.push({
				fieldName,
				mediaId,
				filename,
			});
		}

		// Process each field's content
		const processedData: Partial<Record<keyof T, string | undefined>> = {};
		for (const fieldPrefix of fields) {
			const content = data[fieldPrefix];
			if (typeof content === "string") {
				// Filter uploadedMedia to only include images for this field
				const fieldUploadedMedia = uploadedMedia.filter((media) =>
					media.fieldName.startsWith(`${fieldPrefix}-image-`),
				);

				processedData[fieldPrefix] = replaceBase64ImagesWithMediaUrls(
					content,
					fieldUploadedMedia,
					previewMap,
				);
			} else if (content === undefined || content === null) {
				processedData[fieldPrefix] = undefined;
			}
		}

		return {
			processedData,
			uploadedMedia,
		};
	});
};
