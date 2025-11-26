import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetMediaStreamFromId } from "server/internal/media-management";
import { tryFindUserById } from "server/internal/user-management";
import type { Route } from "./+types/user.$id.avatar";

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

export const loader = async ({
	params,
	context,
	request,
}: Route.LoaderArgs) => {
	const userId = params.id;

	if (!userId) {
		return new Response("User ID is required", { status: 400 });
	}

	const userIdNum = Number.parseInt(userId, 10);
	if (Number.isNaN(userIdNum)) {
		return new Response("Invalid user ID", { status: 400 });
	}

	const payload = context.get(globalContextKey).payload;
	const s3Client = context.get(globalContextKey).s3Client;

	// Try to get user from context if available (optional for avatar access)
	const userSession = context.get(userContextKey);
	const currentUser = userSession?.isAuthenticated
		? userSession.effectiveUser || userSession.authenticatedUser
		: null;

	// Prepare user object for internal functions
	// Normalize avatar to ID if it's an object
	const requestUser = currentUser
		? {
				...currentUser,
				avatar:
					typeof currentUser.avatar === "object" && currentUser.avatar !== null
						? currentUser.avatar.id
						: currentUser.avatar,
				collection: "users" as const,
			}
		: null;

	// Fetch user with avatar populated (depth 1 to get avatar object)
	const userResult = await tryFindUserById({
		payload,
		userId: userIdNum,
		user: requestUser,
		req: request,
	});

	if (!userResult.ok) {
		console.error("Failed to find user:", userResult.error.message);
		return new Response("User not found", { status: 404 });
	}

	const user = userResult.value;

	// Check if user has an avatar
	if (!user.avatar) {
		return new Response("User has no avatar", { status: 404 });
	}

	// Extract avatar media ID
	// Avatar can be an object (when depth > 0) or just an ID (when depth = 0)
	const avatarMediaId = user.avatar;

	// Parse Range header if present (we'll get file size from the media record)
	const rangeHeader = request.headers.get("Range");

	// Get media stream (without range first to get file size)
	let result = await tryGetMediaStreamFromId({
		payload,
		s3Client,
		id: avatarMediaId,
		user: requestUser,
		req: request,
	});

	if (!result.ok) {
		console.error("Failed to get media stream:", result.error.message);
		return new Response("Avatar file not found", { status: 404 });
	}

	const media = result.value.media;
	const fileSize = media.filesize || 0;

	// Parse range header now that we have file size
	const range = rangeHeader ? parseRangeHeader(rangeHeader, fileSize) : null;

	// If range is requested and different from full file, fetch with range
	if (range && (range.start > 0 || range.end < fileSize - 1)) {
		result = await tryGetMediaStreamFromId({
			payload,
			s3Client,
			id: avatarMediaId,
			range,
			user: requestUser,
		});

		if (!result.ok) {
			console.error(
				"Failed to get media stream with range:",
				result.error.message,
			);
			return new Response("Avatar file not found", { status: 404 });
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

		return new Response(stream, {
			status: 206,
			headers,
		});
	}

	// Full file request (200 OK)
	return new Response(stream, {
		status: 200,
		headers,
	});
};
