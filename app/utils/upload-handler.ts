import { Glob } from "bun";
import type { FileUpload, FileUploadHandler } from "@remix-run/form-data-parser";
import type { Payload, PayloadRequest, TypedUser } from "payload";
import { Result } from "typescript-result";
import { tryCreateMedia } from "server/internal/media-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import { commitTransactionIfCreated, rollbackTransactionIfCreated } from "server/internal/utils/handle-transaction-id";
import { parseFormDataWithFallback } from "./parse-form-data-with-fallback";
import { transformError, UnknownError } from "./error";

export interface MediaUploadFieldConfig {
    /**
     * Field name pattern to match. Can be:
     * - Glob pattern string (e.g., "avatar", "image-*", "logo{Light,Dark}", etc.)
     *   Uses Bun's native Glob implementation for pattern matching
     * - Custom matcher function for complex matching logic
     */
    fieldName: string | ((fieldName: string) => boolean);
    /**
     * Alt text for the media. Can be a string or a function that receives the fieldName and filename and returns alt text
     */
    alt?: string | ((fieldName: string, filename: string) => string);
    /**
     * Optional callback when media is uploaded for this field
     */
    onUpload?: (fieldName: string, mediaId: number, filename: string) => void;
}

export interface MediaUploadConfig {
    payload: Payload;
    userId: number;
    user: TypedUser;
    req: Partial<PayloadRequest>;
    fields: MediaUploadFieldConfig[];
    /**
     * Optional callback to validate the file before uploading
     */
    validateFile?: (fileUpload: FileUpload) => void | Promise<void>;
}

export interface UploadedMediaInfo {
    fieldName: string;
    mediaId: number;
    filename: string;
}

/**
 * Creates a FileUploadHandler that processes file uploads and creates media records.
 *
 * @param config - Configuration for the upload handler
 * @param uploadedMedia - Optional array to track uploaded media info
 * @returns A FileUploadHandler function
 */
export function createMediaUploadHandler(
    config: MediaUploadConfig,
    uploadedMedia?: UploadedMediaInfo[],
): FileUploadHandler {
    const { payload, userId, user, req, fields, validateFile } = config;

    return async (fileUpload: FileUpload) => {
        // Find matching field configuration
        let matchedField: MediaUploadFieldConfig | undefined;
        for (const field of fields) {
            const fieldName = fileUpload.fieldName;
            if (typeof field.fieldName === "string") {
                // Use Bun's Glob for pattern matching
                const glob = new Glob(field.fieldName);
                if (glob.match(fieldName)) {
                    matchedField = field;
                    break;
                }
            } else if (field.fieldName(fieldName)) {
                matchedField = field;
                break;
            }
        }

        if (!matchedField) {
            return undefined;
        }

        // Validate file if validator provided
        if (validateFile) {
            await validateFile(fileUpload);
        }

        // Convert FileUpload to Buffer
        const arrayBuffer = await fileUpload.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Get alt text
        const alt =
            typeof matchedField.alt === "function"
                ? matchedField.alt(fileUpload.fieldName, fileUpload.name)
                : matchedField.alt;

        // Create media record
        const mediaResult = await tryCreateMedia({
            payload,
            file: fileBuffer,
            filename: fileUpload.name,
            mimeType: fileUpload.type || "application/octet-stream",
            alt,
            userId,
            user,
            req,
        });

        if (!mediaResult.ok) {
            throw mediaResult.error;
        }

        const mediaId = mediaResult.value.media.id;
        const filename = mediaResult.value.media.filename ?? fileUpload.name;

        // Track uploaded media if array provided
        if (uploadedMedia) {
            uploadedMedia.push({
                fieldName: fileUpload.fieldName,
                mediaId,
                filename,
            });
        }

        // Call onUpload callback if provided
        if (matchedField.onUpload) {
            matchedField.onUpload(fileUpload.fieldName, mediaId, filename);
        }

        // Return as string (FileUploadHandler expects string, not number)
        return String(mediaId);
    };
}

export interface ParseFormDataWithMediaUploadOptions {
    payload: Payload;
    request: Request;
    userId: number;
    user: TypedUser;
    req?: Partial<PayloadRequest>;
    maxFileSize?: number;
    maxFiles?: number;
    fields: MediaUploadFieldConfig[];
    validateFile?: (fileUpload: FileUpload) => void | Promise<void>;
}

export interface ParseFormDataWithMediaUploadResult {
    formData: FormData;
    uploadedMedia: UploadedMediaInfo[];
}

/**
 * Parses form data with media upload handling. This function:
 * - Uses handleTransactionId to manage transactions
 * - Creates an upload handler using the provided configuration
 * - Calls parseFormDataWithFallback
 * - Returns the parsed FormData and uploaded media info
 * - If a transaction was created by this function, it commits on success and rolls back on error
 *
 * Note: If you provide a transaction via req.transactionID, you are responsible for commit/rollback.
 * If this function creates a transaction, it handles commit/rollback automatically.
 *
 * @param options - Configuration options
 * @returns Result containing parsed FormData and uploaded media information
 */
export const tryParseFormDataWithMediaUpload = Result.wrap(
    async (
        options: ParseFormDataWithMediaUploadOptions,
    ): Promise<ParseFormDataWithMediaUploadResult> => {
        const {
            payload,
            request,
            userId,
            user,
            req,
            maxFileSize,
            maxFiles,
            fields,
            validateFile,
        } = options;

        // Handle transaction ID using the same pattern as internal functions
        const transactionInfo = await handleTransactionId(payload, req);

        try {
            const uploadedMedia: UploadedMediaInfo[] = [];

            const uploadHandler = createMediaUploadHandler(
                {
                    payload,
                    userId,
                    user,
                    req: transactionInfo.reqWithTransaction,
                    fields,
                    validateFile,
                },
                uploadedMedia,
            );

            const formData = await parseFormDataWithFallback(
                request,
                uploadHandler,
                {
                    ...(maxFileSize !== undefined && { maxFileSize }),
                    ...(maxFiles !== undefined && { maxFiles }),
                },
            );

            // Commit transaction only if we created it
            await commitTransactionIfCreated(payload, transactionInfo);

            return {
                formData,
                uploadedMedia,
            };
        } catch (error) {
            // Rollback transaction only if we created it
            await rollbackTransactionIfCreated(payload, transactionInfo);
            throw error;
        }
    },
    (error) =>
        transformError(error) ??
        new UnknownError("Failed to parse form data with media upload", {
            cause: error,
        }),
);


