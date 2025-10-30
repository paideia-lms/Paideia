import { MIME_TYPES } from "@mantine/dropzone";

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
 * Default allowed file types for assignment submissions
 * These are used as fallback when no specific file types are configured
 */
export const DEFAULT_ALLOWED_FILE_TYPES: FileType[] = [
	{ extension: ".pdf", mimeType: MIME_TYPES.pdf },
	{ extension: ".docx", mimeType: MIME_TYPES.docx },
	{ extension: ".png", mimeType: MIME_TYPES.png },
	{ extension: ".jpeg", mimeType: MIME_TYPES.jpeg },
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
		mimeType: MIME_TYPES.pdf,
	},
	{
		value: "docx",
		label: "Word Document (.docx)",
		extension: ".docx",
		mimeType: MIME_TYPES.docx,
	},
	{
		value: "doc",
		label: "Word Document - Legacy (.doc)",
		extension: ".doc",
		mimeType: MIME_TYPES.doc,
	},
	{
		value: "xlsx",
		label: "Excel Spreadsheet (.xlsx)",
		extension: ".xlsx",
		mimeType: MIME_TYPES.xlsx,
	},
	{
		value: "xls",
		label: "Excel Spreadsheet - Legacy (.xls)",
		extension: ".xls",
		mimeType: MIME_TYPES.xls,
	},
	{
		value: "pptx",
		label: "PowerPoint Presentation (.pptx)",
		extension: ".pptx",
		mimeType: MIME_TYPES.pptx,
	},
	{
		value: "ppt",
		label: "PowerPoint Presentation - Legacy (.ppt)",
		extension: ".ppt",
		mimeType: MIME_TYPES.ppt,
	},
	{
		value: "txt",
		label: "Text File (.txt)",
		extension: ".txt",
		mimeType: "text/plain",
	},
	{
		value: "csv",
		label: "CSV File (.csv)",
		extension: ".csv",
		mimeType: MIME_TYPES.csv,
	},
	{
		value: "png",
		label: "PNG Image (.png)",
		extension: ".png",
		mimeType: MIME_TYPES.png,
	},
	{
		value: "jpeg",
		label: "JPEG Image (.jpg, .jpeg)",
		extension: ".jpeg",
		mimeType: MIME_TYPES.jpeg,
	},
	{
		value: "gif",
		label: "GIF Image (.gif)",
		extension: ".gif",
		mimeType: MIME_TYPES.gif,
	},
	{
		value: "svg",
		label: "SVG Image (.svg)",
		extension: ".svg",
		mimeType: MIME_TYPES.svg,
	},
	{
		value: "webp",
		label: "WebP Image (.webp)",
		extension: ".webp",
		mimeType: MIME_TYPES.webp,
	},
	{
		value: "mp4",
		label: "MP4 Video (.mp4)",
		extension: ".mp4",
		mimeType: MIME_TYPES.mp4,
	},
	{
		value: "zip",
		label: "ZIP Archive (.zip)",
		extension: ".zip",
		mimeType: MIME_TYPES.zip,
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
