/**
 * Utility functions for handling media streaming with HTTP Range request support
 */

/**
 * Parse Range header from request
 * Supports formats: "bytes=start-end", "bytes=start-", "bytes=-suffix"
 *
 * @param rangeHeader - The Range header value from the request
 * @param fileSize - The total size of the file in bytes
 * @returns Parsed range with start and end positions, or null if invalid
 */
export function parseRangeHeader(
	rangeHeader: string | null,
	fileSize: number,
): { start: number; end: number } | null {
	if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
		return null;
	}

	const range = rangeHeader.slice(6); // Remove "bytes=" prefix
	const parts = range.split("-");

	if (parts.length !== 2) {
		return null;
	}

	const startStr = parts[0]!;
	const endStr = parts[1];

	// Handle suffix range: "bytes=-suffix"
	if (!startStr && endStr) {
		const suffix = Number.parseInt(endStr, 10);
		if (Number.isNaN(suffix) || suffix <= 0) {
			return null;
		}
		const start = Math.max(0, fileSize - suffix);
		return { start, end: fileSize - 1 };
	}

	// Handle start range: "bytes=start-" or "bytes=start-end"
	const start = Number.parseInt(startStr, 10);
	if (Number.isNaN(start) || start < 0 || start >= fileSize) {
		return null;
	}

	let end: number;
	if (!endStr) {
		// Open-ended range: "bytes=start-"
		end = fileSize - 1;
	} else {
		end = Number.parseInt(endStr, 10);
		if (Number.isNaN(end) || end < start || end >= fileSize) {
			end = fileSize - 1;
		}
	}

	return { start, end };
}

/**
 * Builds HTTP headers for media streaming responses
 *
 * @param contentType - The MIME type of the media file
 * @param contentLength - The length of the content being sent
 * @param contentRange - Optional Content-Range header value for partial content
 * @param filename - Optional filename for Content-Disposition header (for downloads)
 * @returns Headers object for the HTTP response
 */
export function buildMediaStreamHeaders(
	contentType: string,
	contentLength: number,
	contentRange?: string,
	filename?: string,
): HeadersInit {
	const headers: Record<string, string> = {
		"Content-Type": contentType,
		"Content-Length": contentLength.toString(),
		"Cache-Control": "public, max-age=31536000, immutable",
		"Accept-Ranges": "bytes",
	};

	if (contentRange) {
		headers["Content-Range"] = contentRange;
	}

	if (filename) {
		headers["Content-Disposition"] = `attachment; filename="${filename}"`;
	}

	return headers;
}
