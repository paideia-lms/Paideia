import * as cheerio from "cheerio";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";

/**
 * Parses HTML content to extract media file references
 * Finds all <img> tags with src attributes pointing to /api/media/file/:id
 * Returns numeric IDs found in HTML
 */
export function tryParseMediaFromHtml(html: string) {
	return Result.try(
		() => {
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

			// Extract media references from image src attributes
			for (let i = 0; i < images.length; i++) {
				const img = images[i];
				const src = $(img).attr("src");

				if (!src) {
					continue;
				}

				// Check if src matches /api/media/file/:id pattern
				const mediaFileMatch = src.match(/\/api\/media\/file\/([^?#]+)/);
				if (!mediaFileMatch) {
					continue;
				}

				const mediaIdStr = mediaFileMatch[1]!;

				// Parse as number (media ID)
				const parsedId = Number.parseInt(mediaIdStr, 10);
				if (!Number.isNaN(parsedId)) {
					mediaIds.add(parsedId);
				}
			}

			return {
				ids: Array.from(mediaIds),
				filenames: [], // No longer used, kept for backward compatibility
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to parse media from HTML", {
				cause: error,
			}),
	);
}
