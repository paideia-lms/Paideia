import { MIME_TYPES } from "@mantine/dropzone";
import {
	IconFile,
	IconFileText,
	IconFileTypeBmp,
	IconFileTypeCss,
	IconFileTypeCsv,
	IconFileTypeDoc,
	IconFileTypeDocx,
	IconFileTypeHtml,
	IconFileTypeJpg,
	IconFileTypeJs,
	IconFileTypeJsx,
	IconFileTypePdf,
	IconFileTypePhp,
	IconFileTypePng,
	IconFileTypePpt,
	IconFileTypeRs,
	IconFileTypeSql,
	IconFileTypeSvg,
	IconFileTypeTs,
	IconFileTypeTsx,
	IconFileTypeTxt,
	IconFileTypeVue,
	IconFileTypeXls,
	IconFileTypeXml,
	IconFileZip,
	IconPhoto,
} from "@tabler/icons-react";
import mime from "mime";

export interface FileTypeOption {
	value: string;
	label: string;
	extension: string;
	mimeType: string;
}

export interface FileType {
	extension: string;
	mimeType: string;
}

/**
 * Strongly typed MIME types constant
 * Uses MIME_TYPES from @mantine/dropzone where available,
 * otherwise uses mime.getType() with fallback to string literals
 */
export const MimeTypes = {
	// Images - from Mantine
	png: MIME_TYPES.png,
	gif: MIME_TYPES.gif,
	jpeg: MIME_TYPES.jpeg,
	svg: MIME_TYPES.svg,
	webp: MIME_TYPES.webp,
	// Documents - from Mantine
	pdf: MIME_TYPES.pdf,
	doc: MIME_TYPES.doc,
	docx: MIME_TYPES.docx,
	xls: MIME_TYPES.xls,
	xlsx: MIME_TYPES.xlsx,
	ppt: MIME_TYPES.ppt,
	pptx: MIME_TYPES.pptx,
	csv: MIME_TYPES.csv,
	// Archives - from Mantine
	zip: MIME_TYPES.zip,
	// Video - from Mantine
	mp4: MIME_TYPES.mp4,
	// Text files - using mime with fallback
	txt: (mime.getType(".txt") || "text/plain") as "text/plain",
	md: (mime.getType(".md") || "text/markdown") as "text/markdown",
	json: (mime.getType(".json") || "application/json") as "application/json",
	xml: (mime.getType(".xml") || "application/xml") as "application/xml",
	yaml: (mime.getType(".yaml") || "text/yaml") as "text/yaml",
	yml: (mime.getType(".yml") || "text/yaml") as "text/yaml",
	html: (mime.getType(".html") || "text/html") as "text/html",
	css: (mime.getType(".css") || "text/css") as "text/css",
	javascript: (mime.getType(".js") ||
		"application/javascript") as "application/javascript",
	// Video - additional formats
	webm: (mime.getType(".webm") || "video/webm") as "video/webm",
	avi: (mime.getType(".avi") || "video/x-msvideo") as "video/x-msvideo",
	mov: (mime.getType(".mov") || "video/quicktime") as "video/quicktime",
	mkv: (mime.getType(".mkv") || "video/x-matroska") as "video/x-matroska",
	// Audio
	mp3: (mime.getType(".mp3") || "audio/mpeg") as "audio/mpeg",
	wav: (mime.getType(".wav") || "audio/wav") as "audio/wav",
	ogg: (mime.getType(".ogg") || "audio/ogg") as "audio/ogg",
	aac: (mime.getType(".aac") || "audio/aac") as "audio/aac",
	m4a: (mime.getType(".m4a") || "audio/mp4") as "audio/mp4",
	flac: (mime.getType(".flac") || "audio/flac") as "audio/flac",
} as const;

/**
 * Default allowed file types for assignment submissions
 * These are used as fallback when no specific file types are configured
 */
export const DEFAULT_ALLOWED_FILE_TYPES: FileType[] = [
	{ extension: ".pdf", mimeType: MimeTypes.pdf },
	{ extension: ".docx", mimeType: MimeTypes.docx },
	{ extension: ".png", mimeType: MimeTypes.png },
	{ extension: ".jpeg", mimeType: MimeTypes.jpeg },
	{ extension: ".svg", mimeType: MimeTypes.svg },
	{ extension: ".webp", mimeType: MimeTypes.webp },
	{ extension: ".txt", mimeType: MimeTypes.txt },
	{ extension: ".md", mimeType: MimeTypes.md },
];

/**
 * Preset file type options for assignment configuration
 * Users can select from these common file types
 */
export const PRESET_FILE_TYPE_OPTIONS: FileTypeOption[] = [
	{
		value: "pdf",
		label: "PDF Document (.pdf)",
		extension: ".pdf",
		mimeType: MimeTypes.pdf,
	},
	{
		value: "docx",
		label: "Word Document (.docx)",
		extension: ".docx",
		mimeType: MimeTypes.docx,
	},
	{
		value: "doc",
		label: "Word Document - Legacy (.doc)",
		extension: ".doc",
		mimeType: MimeTypes.doc,
	},
	{
		value: "xlsx",
		label: "Excel Spreadsheet (.xlsx)",
		extension: ".xlsx",
		mimeType: MimeTypes.xlsx,
	},
	{
		value: "xls",
		label: "Excel Spreadsheet - Legacy (.xls)",
		extension: ".xls",
		mimeType: MimeTypes.xls,
	},
	{
		value: "pptx",
		label: "PowerPoint Presentation (.pptx)",
		extension: ".pptx",
		mimeType: MimeTypes.pptx,
	},
	{
		value: "ppt",
		label: "PowerPoint Presentation - Legacy (.ppt)",
		extension: ".ppt",
		mimeType: MimeTypes.ppt,
	},
	{
		value: "txt",
		label: "Text File (.txt)",
		extension: ".txt",
		mimeType: MimeTypes.txt,
	},
	{
		value: "md",
		label: "Markdown File (.md)",
		extension: ".md",
		mimeType: MimeTypes.md,
	},
	{
		value: "json",
		label: "JSON File (.json)",
		extension: ".json",
		mimeType: MimeTypes.json,
	},
	{
		value: "xml",
		label: "XML File (.xml)",
		extension: ".xml",
		mimeType: MimeTypes.xml,
	},
	{
		value: "yaml",
		label: "YAML File (.yaml)",
		extension: ".yaml",
		mimeType: MimeTypes.yaml,
	},
	{
		value: "yml",
		label: "YAML File (.yml)",
		extension: ".yml",
		mimeType: MimeTypes.yml,
	},
	{
		value: "csv",
		label: "CSV File (.csv)",
		extension: ".csv",
		mimeType: MimeTypes.csv,
	},
	{
		value: "png",
		label: "PNG Image (.png)",
		extension: ".png",
		mimeType: MimeTypes.png,
	},
	{
		value: "jpeg",
		label: "JPEG Image (.jpg, .jpeg)",
		extension: ".jpeg",
		mimeType: MimeTypes.jpeg,
	},
	{
		value: "gif",
		label: "GIF Image (.gif)",
		extension: ".gif",
		mimeType: MimeTypes.gif,
	},
	{
		value: "svg",
		label: "SVG Image (.svg)",
		extension: ".svg",
		mimeType: MimeTypes.svg,
	},
	{
		value: "webp",
		label: "WebP Image (.webp)",
		extension: ".webp",
		mimeType: MimeTypes.webp,
	},
	{
		value: "mp4",
		label: "MP4 Video (.mp4)",
		extension: ".mp4",
		mimeType: MimeTypes.mp4,
	},
	{
		value: "webm",
		label: "WebM Video (.webm)",
		extension: ".webm",
		mimeType: MimeTypes.webm,
	},
	{
		value: "avi",
		label: "AVI Video (.avi)",
		extension: ".avi",
		mimeType: MimeTypes.avi,
	},
	{
		value: "mov",
		label: "QuickTime Video (.mov)",
		extension: ".mov",
		mimeType: MimeTypes.mov,
	},
	{
		value: "mkv",
		label: "Matroska Video (.mkv)",
		extension: ".mkv",
		mimeType: MimeTypes.mkv,
	},
	{
		value: "mp3",
		label: "MP3 Audio (.mp3)",
		extension: ".mp3",
		mimeType: MimeTypes.mp3,
	},
	{
		value: "wav",
		label: "WAV Audio (.wav)",
		extension: ".wav",
		mimeType: MimeTypes.wav,
	},
	{
		value: "ogg",
		label: "OGG Audio (.ogg)",
		extension: ".ogg",
		mimeType: MimeTypes.ogg,
	},
	{
		value: "aac",
		label: "AAC Audio (.aac)",
		extension: ".aac",
		mimeType: MimeTypes.aac,
	},
	{
		value: "m4a",
		label: "M4A Audio (.m4a)",
		extension: ".m4a",
		mimeType: MimeTypes.m4a,
	},
	{
		value: "flac",
		label: "FLAC Audio (.flac)",
		extension: ".flac",
		mimeType: MimeTypes.flac,
	},
	{
		value: "zip",
		label: "ZIP Archive (.zip)",
		extension: ".zip",
		mimeType: MimeTypes.zip,
	},
];

/**
 * Get MIME types array from file type configurations
 * Used for Dropzone accept prop
 */
export function getMimeTypesArray(fileTypes?: FileType[] | null): string[] {
	if (!fileTypes || fileTypes.length === 0) {
		return DEFAULT_ALLOWED_FILE_TYPES.map((ft) => ft.mimeType);
	}
	return fileTypes.map((ft) => ft.mimeType);
}

/**
 * Get file type by preset value
 */
export function getFileTypeByValue(value: string): FileType | undefined {
	const preset = PRESET_FILE_TYPE_OPTIONS.find((opt) => opt.value === value);
	if (!preset) return undefined;
	return {
		extension: preset.extension,
		mimeType: preset.mimeType,
	};
}

/**
 * Convert preset values to FileType array
 */
export function presetValuesToFileTypes(values: string[]): FileType[] {
	return values
		.map((value) => getFileTypeByValue(value))
		.filter((ft): ft is FileType => ft !== undefined);
}

/**
 * Convert FileType array back to preset values
 * Returns empty array if no matches found
 */
export function fileTypesToPresetValues(
	fileTypes: Array<{ extension: string; mimeType: string }> | null | undefined,
): string[] {
	if (!fileTypes || fileTypes.length === 0) return [];

	const presetValues: string[] = [];
	for (const fileType of fileTypes) {
		const match = PRESET_FILE_TYPE_OPTIONS.find(
			(opt) => opt.mimeType === fileType.mimeType,
		);
		if (match) {
			presetValues.push(match.value);
		}
	}
	return presetValues;
}

// ============================================================================
// File Type Detection and Display Utilities
// ============================================================================

export type FileTypeCategory = "image" | "pdf" | "text" | "other";

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
	const parts = filename.split(".");
	return parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : "";
}

/**
 * Determine file type category based on filename and/or MIME type
 */
export function getFileType(
	filename?: string | null,
	mimeType?: string | null,
): FileTypeCategory {
	// Check MIME type first
	if (mimeType) {
		if (mimeType.startsWith("image/")) return "image";
		if (mimeType === "application/pdf") return "pdf";
		if (
			mimeType.startsWith("text/") ||
			mimeType === "application/json" ||
			mimeType === "application/xml"
		) {
			return "text";
		}
	}

	// Fallback to extension
	if (filename) {
		const ext = getFileExtension(filename);
		if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) {
			return "image";
		}
		if (ext === "pdf") return "pdf";
		if (
			["txt", "md", "json", "xml", "csv", "log", "yml", "yaml", "ini"].includes(
				ext,
			)
		) {
			return "text";
		}
	}

	return "other";
}

/**
 * Get appropriate icon component for a file based on type, filename, and MIME type
 */
export function getFileIcon(
	fileType: FileTypeCategory,
	filename?: string | null,
	mimeType?: string | null,
) {
	// If we have a filename, try to get a specific icon based on extension
	if (filename) {
		const ext = getFileExtension(filename).toLowerCase();
		switch (ext) {
			case "bmp":
				return IconFileTypeBmp;
			case "css":
				return IconFileTypeCss;
			case "csv":
				return IconFileTypeCsv;
			case "doc":
				return IconFileTypeDoc;
			case "docx":
				return IconFileTypeDocx;
			case "html":
			case "htm":
				return IconFileTypeHtml;
			case "jpg":
			case "jpeg":
				return IconFileTypeJpg;
			case "js":
				return IconFileTypeJs;
			case "jsx":
				return IconFileTypeJsx;
			case "pdf":
				return IconFileTypePdf;
			case "php":
				return IconFileTypePhp;
			case "png":
				return IconFileTypePng;
			case "ppt":
			case "pptx":
				return IconFileTypePpt;
			case "rs":
				return IconFileTypeRs;
			case "sql":
				return IconFileTypeSql;
			case "svg":
				return IconFileTypeSvg;
			case "ts":
				return IconFileTypeTs;
			case "tsx":
				return IconFileTypeTsx;
			case "txt":
				return IconFileTypeTxt;
			case "vue":
				return IconFileTypeVue;
			case "xls":
			case "xlsx":
				return IconFileTypeXls;
			case "xml":
				return IconFileTypeXml;
			case "zip":
				return IconFileZip;
		}
	}

	// Fallback to MIME type if available
	if (mimeType) {
		if (mimeType.startsWith("image/")) {
			// Use specific image icons if we can determine the type
			if (mimeType === "image/png") return IconFileTypePng;
			if (mimeType === "image/jpeg" || mimeType === "image/jpg")
				return IconFileTypeJpg;
			if (mimeType === "image/svg+xml") return IconFileTypeSvg;
			if (mimeType === "image/bmp") return IconFileTypeBmp;
			return IconPhoto;
		}
		if (mimeType === "application/pdf") return IconFileTypePdf;
		if (
			mimeType === "application/zip" ||
			mimeType === "application/x-zip-compressed"
		)
			return IconFileZip;
		if (
			mimeType.startsWith("text/") ||
			mimeType === "application/json" ||
			mimeType === "application/xml"
		) {
			return IconFileText;
		}
	}

	// Fallback to generic file type categories
	switch (fileType) {
		case "image":
			return IconPhoto;
		case "pdf":
			return IconFileTypePdf;
		case "text":
			return IconFileText;
		default:
			return IconFile;
	}
}

/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get human-readable label for file type
 */
export function getFileTypeLabel(fileType: FileTypeCategory): string {
	switch (fileType) {
		case "image":
			return "Image";
		case "pdf":
			return "PDF";
		case "text":
			return "Text";
		default:
			return "File";
	}
}
