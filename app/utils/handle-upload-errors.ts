import {
    MaxFileSizeExceededError,
    MaxFilesExceededError,
} from "@remix-run/form-data-parser";
import prettyBytes from "pretty-bytes";
import { badRequest } from "./responses";

/**
 * Handles errors related to file uploads and returns appropriate error responses.
 *
 * @param error - The error that occurred
 * @param maxFileSize - Maximum allowed file size in bytes
 * @param defaultMessage - Default error message if error type is unknown
 * @returns BadRequest response with appropriate error message
 */
export function handleUploadError(
    error: unknown,
    maxFileSize?: number,
    defaultMessage = "Failed to process upload",
) {
    if (error instanceof MaxFileSizeExceededError) {
        return badRequest({
            error: `File size exceeds maximum allowed size of ${prettyBytes(maxFileSize ?? 0)}`,
        });
    }

    if (error instanceof MaxFilesExceededError) {
        return badRequest({
            error: error.message,
        });
    }

    return badRequest({
        error: error instanceof Error ? error.message : defaultMessage,
    });
}

