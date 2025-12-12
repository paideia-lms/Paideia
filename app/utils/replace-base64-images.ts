import * as cheerio from "cheerio";
import { href } from "react-router";
import type { Payload, PayloadRequest } from "payload";
import { tryCreateMedia } from "server/internal/media-management";
import type { UploadedMediaInfo } from "./upload-handler";
import mime from "mime";

/**
 * Replaces base64 image sources in HTML content with actual media URLs.
 *
 * This function matches uploaded media files to base64 images by comparing
 * the first 100 characters of the base64 data URI with preview data stored
 * in the form data.
 *
 * @param content - HTML content that may contain base64 image sources
 * @param uploadedMedia - Array of uploaded media information
 * @param formData - FormData containing preview data for matching
 * @returns HTML content with base64 images replaced by media URLs
 */
export function replaceBase64ImagesWithMediaUrls(
	content: string,
	uploadedMedia: UploadedMediaInfo[],
	formData: FormData,
): string;
/**
 * Replaces base64 image sources in HTML content with actual media URLs.
 *
 * This function matches uploaded media files to base64 images by comparing
 * the first 100 characters of the base64 data URI with preview data provided
 * directly as a map.
 *
 * @param content - HTML content that may contain base64 image sources
 * @param uploadedMedia - Array of uploaded media information
 * @param previewMap - Map or Record of field names to preview strings
 * @returns HTML content with base64 images replaced by media URLs
 */
export function replaceBase64ImagesWithMediaUrls(
	content: string,
	uploadedMedia: UploadedMediaInfo[],
	previewMap: Map<string, string> | Record<string, string>,
): string;
export function replaceBase64ImagesWithMediaUrls(
	content: string,
	uploadedMedia: UploadedMediaInfo[],
	formDataOrPreviewMap: FormData | Map<string, string> | Record<string, string>,
): string {
	if (uploadedMedia.length === 0) {
		return content;
	}

	// Build a map of base64 prefix to filename
	const base64ToFilename = new Map<string, string>();

	uploadedMedia.forEach((media) => {
		const previewKey = `${media.fieldName}-preview`;
		let preview: string | undefined;

		if (formDataOrPreviewMap instanceof FormData) {
			preview = formDataOrPreviewMap.get(previewKey) as string | undefined;
		} else if (formDataOrPreviewMap instanceof Map) {
			preview = formDataOrPreviewMap.get(previewKey);
		} else {
			preview = formDataOrPreviewMap[previewKey];
		}

		if (preview) {
			const base64Prefix = preview.substring(0, 100);
			base64ToFilename.set(base64Prefix, media.filename);
		}
	});

	const $ = cheerio.load(content);
	const images = $("img");

	images.each((_i, img) => {
		const src = $(img).attr("src");
		if (src?.startsWith("data:image")) {
			// Find matching uploaded media by comparing base64 prefix
			const base64Prefix = src.substring(0, 100);
			const filename = base64ToFilename.get(base64Prefix);

			if (filename) {
				// Replace with actual media URL
				const mediaUrl = href("/api/media/file/:filenameOrId", {
					filenameOrId: filename,
				});
				$(img).attr("src", mediaUrl);
			}
		}
	});

	// Return the inner HTML of the body (all child nodes, excluding the body tag itself)
	return (
		$("body")
			.contents()
			.toArray()
			.map((el) => $.html(el))
			.join("") ?? ""
	);
}

export interface ReplaceBase64MediaWithMediaUrlsV2Args {
	content: string;
	payload: Payload;
	userId: number;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	alt?: string;
}

export interface ReplaceBase64MediaWithMediaUrlsV2Result {
	processedContent: string;
	uploadedMedia: UploadedMediaInfo[];
}

/**
 * Replaces base64 media sources in HTML content with actual media URLs.
 * This version automatically creates media records from base64 media found in the content.
 * Supports any mime type (images, videos, audio, etc.) in img, video, audio, and source elements.
 *
 * @param args - Configuration for processing base64 media
 * @returns Processed HTML content with base64 media replaced by media URLs, and information about uploaded media
 */
export async function replaceBase64MediaWithMediaUrlsV2(
	args: ReplaceBase64MediaWithMediaUrlsV2Args,
): Promise<ReplaceBase64MediaWithMediaUrlsV2Result> {
	const {
		content,
		payload,
		userId,
		req,
		overrideAccess = false,
		alt = "Rich text media",
	} = args;

	// Parse HTML content to find base64 media
	const $ = cheerio.load(content);

	// Collect all base64 media from various HTML elements
	const base64Media: Array<{
		element: ReturnType<typeof $>;
		attribute: string;
		fullMimeType: string;
		base64Data: string;
		fullDataUri: string;
	}> = [];

	// Find base64 data URIs in img, video, audio, and source elements
	const elementsToCheck = [
		{ selector: "img", attr: "src" },
		{ selector: "video", attr: "src" },
		{ selector: "audio", attr: "src" },
		{ selector: "source", attr: "src" },
	];

	for (const { selector, attr } of elementsToCheck) {
		$(selector).each((_index, el) => {
			const src = $(el).attr(attr);
			if (src?.startsWith("data:")) {
				// Parse data URI: data:{mimeType};base64,{data}
				const match = src.match(/^data:([^;]+);base64,(.+)$/);
				if (match?.[1] && match[2]) {
					const fullMimeType = match[1];
					const base64Data = match[2];

					base64Media.push({
						element: $(el),
						attribute: attr,
						fullMimeType,
						base64Data,
						fullDataUri: src,
					});
				}
			}
		});
	}

	if (base64Media.length === 0) {
		return {
			processedContent: content,
			uploadedMedia: [],
		};
	}

	// Create media records for all base64 media
	const uploadedMedia: UploadedMediaInfo[] = [];
	const base64ToFilename = new Map<string, string>();

	// ! for some reason we have to use for loop but not promise.all, otherwise it will fail
	for (const { fullMimeType, base64Data, fullDataUri } of base64Media) {
		// Convert base64 string to Buffer
		const fileBuffer = Buffer.from(base64Data, "base64");

		// Remove any parameters from mime type (e.g., "image/png;charset=utf-8" -> "image/png")
		const mimeTypeWithoutParams = fullMimeType.split(";")[0];
		if (!mimeTypeWithoutParams) {
			continue;
		}

		// Get file extension from mime type using mime library
		const extension = mime.getExtension(mimeTypeWithoutParams) || "bin";
		const uuid = crypto.randomUUID();
		const filename = `media-${uuid}.${extension}`;

		const { media } = await tryCreateMedia({
			payload,
			file: fileBuffer,
			filename,
			mimeType: mimeTypeWithoutParams, // Remove any parameters like charset
			alt,
			userId,
			req,
			overrideAccess,
		}).getOrThrow();

		const finalFilename = media.filename ?? filename;

		// Store mapping from base64 prefix to filename for replacement
		const base64Prefix = fullDataUri.substring(0, 100);
		base64ToFilename.set(base64Prefix, finalFilename);

		uploadedMedia.push({
			fieldName: filename, // Use filename as fieldName for consistency
			mediaId: media.id,
			filename: finalFilename,
		});
	}

	// Replace base64 media with media URLs
	for (const { element, attribute, fullDataUri } of base64Media) {
		const base64Prefix = fullDataUri.substring(0, 100);
		const filename = base64ToFilename.get(base64Prefix);

		if (filename) {
			// Replace with actual media URL
			const mediaUrl = href("/api/media/file/:filenameOrId", {
				filenameOrId: filename,
			});
			element.attr(attribute, mediaUrl);
		}
	}

	// Return the inner HTML of the body (all child nodes, excluding the body tag itself)
	const processedContent =
		$("body")
			.contents()
			.toArray()
			.map((el) => $.html(el))
			.join("") ?? "";

	return {
		processedContent,
		uploadedMedia,
	};
}
