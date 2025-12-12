import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetMediaStreamFromFilename,
	tryGetMediaStreamFromId,
} from "server/internal/media-management";
import type { Route } from "./+types/file.$filenameOrId";
import { createLocalReq } from "server/internal/utils/internal-function-utils";
import { badRequest, notFound } from "app/utils/responses";
import {
	buildMediaStreamHeaders,
	parseRangeHeader,
} from "~/utils/media-stream-utils";

export const loader = async ({
	params,
	context,
	request,
}: Route.LoaderArgs) => {
	const filenameOrId = params.filenameOrId;

	if (!filenameOrId) {
		return badRequest({ error: "Filename or ID is required" });
	}

	const payload = context.get(globalContextKey).payload;
	const s3Client = context.get(globalContextKey).s3Client;

	// Try to get user from context if available (optional for public media access)
	const userSession = context.get(userContextKey);
	const currentUser = userSession?.isAuthenticated
		? userSession.effectiveUser || userSession.authenticatedUser
		: null;

	const payloadRequest = createLocalReq({
		request,
		user: currentUser,
		context: { routerContext: context },
	});

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
				req: payloadRequest,
			})
		: await tryGetMediaStreamFromFilename({
				payload,
				s3Client,
				filename: filenameOrId,
				req: payloadRequest,
			});

	if (!result.ok) {
		console.error("Failed to get media stream:", result.error.message);
		return notFound({ error: "File not found" });
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
					range,
					req: payloadRequest,
				})
			: await tryGetMediaStreamFromFilename({
					payload,
					s3Client,
					filename: filenameOrId,
					range,
					req: payloadRequest,
				});

		if (!result.ok) {
			console.error(
				"Failed to get media stream with range:",
				result.error.message,
			);
			return notFound({ error: "File not found" });
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
		isDownload ? (media.filename ?? undefined) : undefined,
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
		status: 200,
		headers,
	});
};
