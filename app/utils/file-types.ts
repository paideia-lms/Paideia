import { MIME_TYPES } from "@mantine/dropzone";
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
