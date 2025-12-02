import * as cheerio from "cheerio";
import { href } from "react-router";
import type { UploadedMediaInfo } from "./upload-handler";

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
