import { globalContextKey } from "server/contexts/global-context";
import { tryGetMediaBufferFromFilename } from "server/internal/media-management";
import type { Route } from "./+types/file.$filename";

export const loader = async ({ params, context }: Route.LoaderArgs) => {
	const filename = params.filename;

	if (!filename) {
		return new Response("Filename is required", { status: 400 });
	}

	const payload = context.get(globalContextKey).payload;
	const s3Client = context.get(globalContextKey).s3Client;

	// Get media record and buffer from S3
	const result = await tryGetMediaBufferFromFilename(payload, s3Client, {
		filename,
		depth: 0,
	});

	if (!result.ok) {
		console.error("Failed to get media buffer:", result.error.message);
		return new Response("File not found", { status: 404 });
	}

	const { media, buffer } = result.value;

	// Use content type from database
	const contentType = media.mimeType || "application/octet-stream";

	// Return the file with appropriate headers
	// Convert Buffer to Uint8Array for Response
	return new Response(Uint8Array.from(buffer), {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Content-Length": buffer.length.toString(),
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
};
