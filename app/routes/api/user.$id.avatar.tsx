import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryGetMediaStreamFromId } from "server/internal/media-management";
import { tryFindUserById } from "server/internal/user-management";
import type { Route } from "./+types/user.$id.avatar";
import { createLocalReq } from "server/internal/utils/internal-function-utils";
import { badRequest, notFound, ok, partialContent } from "app/utils/responses";
import {
	buildMediaStreamHeaders,
	parseRangeHeader,
} from "~/utils/media-stream-utils";

/**
 * ! we are return error rather than throwing error because this a non component route
 */
export const loader = async ({
	params,
	context,
	request,
}: Route.LoaderArgs) => {
	const userId = params.id;

	if (!userId) {
		return badRequest({ error: "User ID is required" });
	}

	const userIdNum = Number.parseInt(userId, 10);
	if (Number.isNaN(userIdNum)) {
		return badRequest({ error: "Invalid user ID" });
	}

	const payload = context.get(globalContextKey).payload;
	const s3Client = context.get(globalContextKey).s3Client;

	// Try to get user from context if available (optional for avatar access)
	const userSession = context.get(userContextKey);
	const currentUser = userSession?.isAuthenticated
		? userSession.effectiveUser || userSession.authenticatedUser
		: null;

	// Fetch user with avatar populated (depth 1 to get avatar object)
	const userResult = await tryFindUserById({
		payload,
		userId: userIdNum,
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
	});

	if (!userResult.ok) {
		console.error("Failed to find user:", userResult.error.message);
		return notFound({ error: "User not found" });
	}

	const user = userResult.value;

	// Check if user has an avatar
	if (!user.avatar) {
		return notFound({ error: "User has no avatar" });
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
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
	});

	if (!result.ok) {
		console.error("Failed to get media stream:", result.error.message);
		return notFound({ error: "Avatar file not found" });
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
			req: createLocalReq({
				request,
				user: currentUser,
				context: { routerContext: context },
			}),
		});

		if (!result.ok) {
			console.error(
				"Failed to get media stream with range:",
				result.error.message,
			);
			return notFound({ error: "Avatar file not found" });
		}
	}

	const { stream, contentLength, contentRange } = result.value;

	// Use content type from database
	const contentType = media.mimeType || "application/octet-stream";

	// Build headers
	const headers = buildMediaStreamHeaders(
		contentType,
		contentLength,
		contentRange,
	);

	// Handle Range request (206 Partial Content)
	if (range && contentRange) {
		return new Response(stream, {
			status: 206,
			headers,
		});
	}

	// Full file request (200 OK)
	return new Response(stream, {
		headers,
	});
};
