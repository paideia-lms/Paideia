/**
 * Default allowed file types for assignment submissions.
 * Kept in sync with apps/paideia/app/utils/file-types.ts DEFAULT_ALLOWED_FILE_TYPES.
 * Backend-only module to avoid pulling in Mantine/Tabler dependencies.
 */
export interface FileType {
	extension: string;
	mimeType: string;
}

export const DEFAULT_ALLOWED_FILE_TYPES: FileType[] = [
	{ extension: ".pdf", mimeType: "application/pdf" },
	{
		extension: ".docx",
		mimeType:
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	},
	{ extension: ".png", mimeType: "image/png" },
	{ extension: ".jpeg", mimeType: "image/jpeg" },
	{ extension: ".svg", mimeType: "image/svg+xml" },
	{ extension: ".webp", mimeType: "image/webp" },
	{ extension: ".txt", mimeType: "text/plain" },
	{ extension: ".md", mimeType: "text/markdown" },
];
