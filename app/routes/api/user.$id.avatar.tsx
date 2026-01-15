import { globalContextKey } from "server/contexts/global-context";
import { tryGetMediaStreamFromId } from "server/internal/media-management";
import { tryFindUserById } from "server/internal/user-management";
import type { Route } from "./+types/user.$id.avatar";
import { badRequest, notFound } from "app/utils/responses";
import {
	buildMediaStreamHeaders,
	parseRangeHeader,
} from "~/utils/media-stream-utils";
import { typeCreateLoader } from "app/utils/loader-utils";

const createLoader = typeCreateLoader<Route.LoaderArgs>();
const createRouteLoader = createLoader({});

/**
 * ! we are return error rather than throwing error because this a non component route
 */
export const loader = createRouteLoader(
	async ({ params, context, request }) => {
		const userId = params.id;

		if (!userId) {
			return badRequest({ error: "User ID is required" });
		}

		const { payload, payloadRequest, s3Client } = context.get(globalContextKey);

		// Fetch user with avatar populated (depth 1 to get avatar object)
		const userResult = await tryFindUserById({
			payload,
			userId: params.id,
			req: payloadRequest,
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

		// Parse Range header if present (we'll get file size from the media record)
		const rangeHeader = request.headers.get("Range");

		// Get media stream (without range first to get file size)
		let result = await tryGetMediaStreamFromId({
			payload,
			s3Client,
			id: user.avatar,
			req: payloadRequest,
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
				id: user.avatar,
				range,
				req: payloadRequest,
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
	},
);
