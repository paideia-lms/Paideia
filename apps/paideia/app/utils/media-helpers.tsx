import { IconFile, IconPhoto } from "@tabler/icons-react";

/**
 * Returns an icon component based on the MIME type
 */
export function getFileIcon(mimeType: string | null | undefined) {
	if (mimeType?.startsWith("image/")) {
		return <IconPhoto size={48} />;
	}
	return <IconFile size={48} />;
}

/**
 * Checks if the MIME type is an image
 */
export function isImage(mimeType: string | null | undefined): boolean {
	if (!mimeType) return false;
	return mimeType.startsWith("image/");
}

/**
 * Checks if the MIME type is an audio file
 */
export function isAudio(mimeType: string | null | undefined): boolean {
	if (!mimeType) return false;
	return mimeType.startsWith("audio/");
}

/**
 * Checks if the MIME type is a video file
 */
export function isVideo(mimeType: string | null | undefined): boolean {
	if (!mimeType) return false;
	return mimeType.startsWith("video/");
}

/**
 * Checks if the MIME type is a PDF file
 */
export function isPdf(mimeType: string | null | undefined): boolean {
	if (!mimeType) return false;
	return mimeType === "application/pdf";
}

/** MIME types for text-based files that can be previewed */
const TEXT_MIME_TYPES = new Set([
	"text/plain",
	"text/markdown",
	"text/html",
	"text/css",
	"text/javascript",
	"text/xml",
	"application/json",
	"application/xml",
	"application/yaml",
	"application/x-yaml",
	"text/x-python",
	"text/x-sh",
	"application/x-sh",
]);

/**
 * Checks if the MIME type is a text-based file (.txt, .md, .json, etc.)
 */
export function isText(mimeType: string | null | undefined): boolean {
	if (!mimeType) return false;
	return mimeType.startsWith("text/") || TEXT_MIME_TYPES.has(mimeType);
}

/**
 * Infers CodeHighlight language from filename extension
 */
export function getTextPreviewLanguage(
	filename: string | null | undefined,
): string {
	if (!filename) return "plaintext";
	const ext = filename.split(".").pop()?.toLowerCase();
	const langMap: Record<string, string> = {
		md: "markdown",
		json: "json",
		xml: "xml",
		yaml: "yaml",
		yml: "yaml",
		html: "html",
		htm: "html",
		css: "css",
		js: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		ts: "typescript",
		tsx: "tsx",
		mts: "typescript",
		cts: "typescript",
		py: "python",
		sh: "bash",
		bash: "bash",
	};
	return langMap[ext ?? ""] ?? "plaintext";
}

/**
 * Checks if the MIME type can be previewed (image, audio, video, PDF, or text)
 */
export function canPreview(mimeType: string | null | undefined): boolean {
	if (!mimeType) return false;
	return (
		isImage(mimeType) ||
		isAudio(mimeType) ||
		isVideo(mimeType) ||
		isPdf(mimeType) ||
		isText(mimeType)
	);
}

/**
 * Returns a color for a media type (used in charts)
 */
export function getTypeColor(type: string): string {
	const colorMap: Record<string, string> = {
		image: "blue",
		video: "red",
		audio: "green",
		pdf: "orange",
		text: "cyan",
		document: "indigo",
		spreadsheet: "teal",
		presentation: "pink",
		archive: "gray",
		other: "dark",
	};
	return colorMap[type] || "gray";
}
