import type { FileUploadHandler } from "@remix-run/form-data-parser";
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
	parseFormData,
} from "@remix-run/form-data-parser";

// Cache the result of whether parseFormData works
// This is checked once at runtime on the first real request and then reused
let parseFormDataAvailable: boolean | null = null;

/**
 * Creates a FileUpload-like object from a native File and field name.
 * This adapter allows the upload handler to work with both parseFormData
 * and native FormData APIs.
 */
function createFileUploadLike(
	file: File,
	fieldName: string,
): {
	fieldName: string;
	name: string;
	type: string;
	size: number;
	lastModified: number;
	webkitRelativePath: string;
	arrayBuffer: () => Promise<ArrayBuffer>;
	stream: () => ReadableStream<Uint8Array>;
	text: () => Promise<string>;
	slice: (start?: number, end?: number, contentType?: string) => Blob;
	bytes: () => Promise<Uint8Array>;
	json: () => Promise<unknown>;
	formData: () => Promise<FormData>;
} {
	return {
		fieldName,
		name: file.name,
		type: file.type,
		size: file.size,
		lastModified: file.lastModified,
		webkitRelativePath: file.webkitRelativePath,
		arrayBuffer: () => file.arrayBuffer(),
		stream: () => file.stream(),
		text: () => file.text(),
		slice: (start?: number, end?: number, contentType?: string) =>
			file.slice(start, end, contentType),
		bytes: async () => new Uint8Array(await file.arrayBuffer()),
		json: async () => JSON.parse(await file.text()),
		formData: async () => {
			const fd = new FormData();
			fd.append("file", file);
			return fd;
		},
	};
}

export interface ParseFormDataOptions {
	maxFileSize?: number;
	maxFiles?: number;
}

/**
 * Parse form data with automatic fallback to Bun's native FormData API.
 *
 * This function first tries to use @remix-run/form-data-parser which works
 * in development mode. If that fails (e.g., in Bun's compiled binary mode),
 * it falls back to using Bun's native request.formData() API.
 *
 * @param request - The incoming Request object
 * @param uploadHandler - Handler function that processes file uploads
 * @param options - Options for file size and count limits
 * @returns FormData with file entries replaced by their IDs from the handler
 * @throws MaxFileSizeExceededError if a file exceeds maxFileSize
 * @throws MaxFilesExceededError if the number of files exceeds maxFiles
 */
export async function parseFormDataWithFallback(
	request: Request,
	uploadHandler: FileUploadHandler,
	options?: ParseFormDataOptions,
): Promise<FormData> {
	const { maxFileSize, maxFiles } = options || {};
	// If we've already determined parseFormData doesn't work, skip it
	if (parseFormDataAvailable === false) {
		// Use Bun's native FormData API (compiled mode)
		return await processWithNativeFormData(
			request,
			uploadHandler,
			maxFileSize,
			maxFiles,
		);
	}

	// If we haven't tested yet, clone the request before trying parseFormData
	// This way we have a backup if parseFormData fails and consumes the body
	const requestToUse =
		parseFormDataAvailable === null ? request.clone() : request;

	// Try parseFormData first (if not yet tested, or if we know it works)
	try {
		const parseOptions: { maxFileSize?: number; maxFiles?: number } = {};
		if (maxFileSize !== undefined) {
			parseOptions.maxFileSize = maxFileSize;
		}
		if (maxFiles !== undefined) {
			parseOptions.maxFiles = maxFiles;
		}

		// parseFormData has two overloads:
		// 1. parseFormData(request, uploadHandler?)
		// 2. parseFormData(request, options?, uploadHandler?)
		const result =
			Object.keys(parseOptions).length > 0
				? await parseFormData(requestToUse, parseOptions, uploadHandler)
				: await parseFormData(requestToUse, uploadHandler);

		// If we got here, parseFormData works - cache the result
		if (parseFormDataAvailable === null) {
			parseFormDataAvailable = true;
		}

		return result;
	} catch (error) {
		// Re-throw MaxFileSizeExceededError and MaxFilesExceededError
		if (
			error instanceof MaxFileSizeExceededError ||
			error instanceof MaxFilesExceededError
		) {
			throw error;
		}

		// Check if this is the expected error from compiled mode
		if (
			error instanceof TypeError &&
			(error.message.includes("undefined is not a function") ||
				error.message.includes("readStream") ||
				error.message.includes("stream") ||
				error.message.includes("locked"))
		) {
			// parseFormData doesn't work - cache the result and use fallback
			parseFormDataAvailable = false;

			// Use the original request (if we cloned, the clone is consumed, so use original)
			const fallbackRequest =
				requestToUse === request ? request.clone() : request;
			return await processWithNativeFormData(
				fallbackRequest,
				uploadHandler,
				maxFileSize,
				maxFiles,
			);
		}

		// If it's a different error, re-throw it (not our problem)
		throw error;
	}
}

/**
 * Processes form data using Bun's native FormData API.
 * This is used as a fallback when parseFormData doesn't work.
 *
 * @param request - The incoming Request object
 * @param uploadHandler - Handler function that processes file uploads
 * @param maxFileSize - Maximum file size in bytes (optional)
 * @param maxFiles - Maximum number of files (optional)
 * @throws MaxFileSizeExceededError if a file exceeds maxFileSize
 * @throws MaxFilesExceededError if the number of files exceeds maxFiles
 */
async function processWithNativeFormData(
	request: Request,
	uploadHandler: FileUploadHandler,
	maxFileSize?: number,
	maxFiles?: number,
): Promise<FormData> {
	const formData = await request.formData();
	const newFormData = new FormData();

	let fileCount = 0;

	// Process each entry in the form data
	for (const [fieldName, value] of formData.entries()) {
		// If the value is a File, process it through the upload handler
		// Check if it's a File by checking for File properties
		if (
			typeof value === "object" &&
			value !== null &&
			"name" in value &&
			"size" in value &&
			"type" in value
		) {
			// Check maxFiles limit
			if (maxFiles !== undefined) {
				fileCount++;
				if (fileCount > maxFiles) {
					throw new MaxFilesExceededError(maxFiles);
				}
			}

			// Create a FileUpload-like object from the native File
			const file = value as File;

			// Check maxFileSize limit
			if (maxFileSize !== undefined && file.size > maxFileSize) {
				throw new MaxFileSizeExceededError(maxFileSize);
			}

			const fileUploadLike = createFileUploadLike(
				file,
				fieldName,
			) as Parameters<FileUploadHandler>[0];

			// Call the upload handler with the FileUpload-like object
			const result = await uploadHandler(fileUploadLike);

			// Replace the file with the returned ID (as string)
			if (result !== undefined && result !== null) {
				newFormData.append(fieldName, String(result));
			}
		} else {
			// For non-file entries (strings), copy them as-is
			newFormData.append(fieldName, value);
		}
	}

	return newFormData;
}
