import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetMediaStreamFromFilename,
	tryGetMediaStreamFromId,
} from "server/internal/media-management";
import type { Route } from "./+types/file.$filenameOrId";

/**
 * Parse Range header from request
 * Supports formats: "bytes=start-end", "bytes=start-", "bytes=-suffix"
 */
function parseRangeHeader(
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

	const startStr = parts[0];
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

export const loader = async ({
	params,
	context,
	request,
}: Route.LoaderArgs) => {
	const filenameOrId = params.filenameOrId;

	if (!filenameOrId) {
		return new Response("Filename or ID is required", { status: 400 });
	}

	const payload = context.get(globalContextKey).payload;
	const s3Client = context.get(globalContextKey).s3Client;

	// Try to get user from context if available (optional for public media access)
	const userSession = context.get(userContextKey);
	const currentUser = userSession?.isAuthenticated
		? userSession.effectiveUser || userSession.authenticatedUser
		: null;

	// Prepare user object for internal functions
	// Normalize avatar to ID if it's an object
	const user = currentUser
		? {
				...currentUser,
				avatar:
					typeof currentUser.avatar === "object" && currentUser.avatar !== null
						? currentUser.avatar.id
						: currentUser.avatar,
				collection: "users" as const,
			}
		: null;

	// Check if download is requested via query parameter
	const url = new URL(request.url);
	const isDownload = url.searchParams.get("download") === "true";

	// Determine if the parameter is an ID (numeric) or filename
	const isId = /^\d+$/.test(filenameOrId);

	// Parse Range header if present (we'll get file size from the media record)
	const rangeHeader = request.headers.get("Range");

	// Get media stream (without range first to get file size, or with range if we can parse it)
	// For efficiency, we'll make one call and handle range parsing after getting media metadata
	let result = isId
		? await tryGetMediaStreamFromId({
				payload,
				s3Client,
				id: filenameOrId,
				depth: 0,
				user,
				req: request,
			})
		: await tryGetMediaStreamFromFilename({
				payload,
				s3Client,
				filename: filenameOrId,
				depth: 0,
				user,
				req: request,
			});

	if (!result.ok) {
		console.error("Failed to get media stream:", result.error.message);
		return new Response("File not found", { status: 404 });
	}

	const media = result.value.media;
	const fileSize = media.filesize || 0;

	// Parse range header now that we have file size
	const range = rangeHeader ? parseRangeHeader(rangeHeader, fileSize) : null;

	// If range is requested and different from full file, fetch with range
	if (range && (range.start > 0 || range.end < fileSize - 1)) {
		result = isId
			? await tryGetMediaStreamFromId({
					payload,
					s3Client,
					id: filenameOrId,
					depth: 0,
					range,
					user,
					req: request,
				})
			: await tryGetMediaStreamFromFilename({
					payload,
					s3Client,
					filename: filenameOrId,
					depth: 0,
					range,
					user,
					req: request,
				});

		if (!result.ok) {
			console.error(
				"Failed to get media stream with range:",
				result.error.message,
			);
			return new Response("File not found", { status: 404 });
		}
	}

	const { stream, contentLength, contentRange } = result.value;

	// Use content type from database
	const contentType = media.mimeType || "application/octet-stream";

	// Build headers
	const headers: HeadersInit = {
		"Content-Type": contentType,
		"Content-Length": contentLength.toString(),
		"Cache-Control": "public, max-age=31536000, immutable",
		"Accept-Ranges": "bytes",
	};

	// Handle Range request (206 Partial Content)
	if (range && contentRange) {
		headers["Content-Range"] = contentRange;
		headers["Content-Length"] = contentLength.toString();

		// Add download header if download is requested
		if (isDownload && media.filename) {
			headers["Content-Disposition"] =
				`attachment; filename="${media.filename}"`;
		}

		return new Response(stream, {
			status: 206,
			headers,
		});
	}

	// Full file request (200 OK)
	// Add download header if download is requested
	if (isDownload && media.filename) {
		headers["Content-Disposition"] = `attachment; filename="${media.filename}"`;
	}

	return new Response(stream, {
		status: 200,
		headers,
	});
};
