import * as cheerio from "cheerio";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";

export interface ParseMediaFromHtmlResult {
	ids: number[];
	filenames: string[];
}

/**
 * Parses HTML content to extract media file references
 * Finds all <img> tags with src attributes pointing to /api/media/file/:filenameOrId
 * Returns both numeric IDs and filenames found in HTML
 * Does not resolve filenames to IDs - that should be done separately if needed
 */
export const tryParseMediaFromHtml = Result.wrap(
	(html: string): ParseMediaFromHtmlResult => {
		if (!html || html.trim().length === 0) {
			return {
				ids: [],
				filenames: [],
			};
		}

		// Parse HTML with cheerio
		const $ = cheerio.load(html);
		const images = $("img");
		const mediaIds = new Set<number>();
		const mediaFilenames = new Set<string>();

		// Extract media references from image src attributes
		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			const src = $(img).attr("src");

			if (!src) {
				continue;
			}

			// Check if src matches /api/media/file/:filenameOrId pattern
			const mediaFileMatch = src.match(/\/api\/media\/file\/([^?#]+)/);
			if (!mediaFileMatch) {
				continue;
			}

			const filenameOrId = mediaFileMatch[1];

			// Try to parse as number (media ID)
			const parsedId = Number.parseInt(filenameOrId, 10);
			if (!Number.isNaN(parsedId)) {
				mediaIds.add(parsedId);
			} else {
				// Otherwise, treat as filename
				mediaFilenames.add(filenameOrId);
			}
		}

		return {
			ids: Array.from(mediaIds),
			filenames: Array.from(mediaFilenames),
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to parse media from HTML", {
			cause: error,
		}),
);
