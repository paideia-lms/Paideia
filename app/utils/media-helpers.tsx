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

/**
 * Checks if the MIME type can be previewed (image, audio, video, or PDF)
 */
export function canPreview(mimeType: string | null | undefined): boolean {
	if (!mimeType) return false;
	return (
		isImage(mimeType) ||
		isAudio(mimeType) ||
		isVideo(mimeType) ||
		isPdf(mimeType)
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
