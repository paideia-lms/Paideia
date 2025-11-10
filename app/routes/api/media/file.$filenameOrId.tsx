import { globalContextKey } from "server/contexts/global-context";
import {
	tryGetMediaBufferFromFilename,
	tryGetMediaBufferFromId,
} from "server/internal/media-management";
import type { Route } from "./+types/file.$filenameOrId";

export const loader = async ({ params, context, request }: Route.LoaderArgs) => {
	const filenameOrId = params.filenameOrId;

	if (!filenameOrId) {
		return new Response("Filename or ID is required", { status: 400 });
	}

	const payload = context.get(globalContextKey).payload;
	const s3Client = context.get(globalContextKey).s3Client;

	// Check if download is requested via query parameter
	const url = new URL(request.url);
	const isDownload = url.searchParams.get("download") === "true";

	// Determine if the parameter is an ID (numeric) or filename
	const isId = /^\d+$/.test(filenameOrId);

	// Get media record and buffer from S3
	const result = isId
		? await tryGetMediaBufferFromId(payload, s3Client, {
			id: filenameOrId,
			depth: 0,
		})
		: await tryGetMediaBufferFromFilename(payload, s3Client, {
			filename: filenameOrId,
			depth: 0,
		});

	if (!result.ok) {
		console.error("Failed to get media buffer:", result.error.message);
		return new Response("File not found", { status: 404 });
	}

	const { media, buffer } = result.value;

	// Use content type from database
	const contentType = media.mimeType || "application/octet-stream";

	// Build headers
	const headers: HeadersInit = {
		"Content-Type": contentType,
		"Content-Length": buffer.length.toString(),
		"Cache-Control": "public, max-age=31536000, immutable",
	};

	// Add download header if download is requested
	if (isDownload && media.filename) {
		headers["Content-Disposition"] = `attachment; filename="${media.filename}"`;
	}

	// Return the file with appropriate headers
	// Convert Buffer to Uint8Array for Response
	return new Response(Uint8Array.from(buffer), {
		status: 200,
		headers,
	});
};
