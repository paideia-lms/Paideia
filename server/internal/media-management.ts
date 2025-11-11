import "@total-typescript/ts-reset";
import type { S3Client } from "@aws-sdk/client-s3";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Payload, PayloadRequest } from "payload";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	NonExistingMediaError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { envVars } from "../env";
import type { Media } from "../payload-types";

export interface CreateMediaArgs {
	file: Buffer;
	filename: string;
	mimeType: string;
	alt?: string;
	caption?: string;
	userId: number;
	transactionID?: string | number;
}

export interface CreateMediaResult {
	media: Media;
}

/**
 * Creates a new media record
 *
 * This function:
 * 1. Validates required fields
 * 2. Creates a media record with file metadata
 * 3. Uses transactions to ensure atomicity
 */
export const tryCreateMedia = Result.wrap(
	async (
		payload: Payload,
		args: CreateMediaArgs,
	): Promise<CreateMediaResult> => {
		const {
			file,
			filename,
			mimeType,
			alt,
			caption,
			userId,
			transactionID: providedTransactionID,
		} = args;

		// Validate required fields
		if (!file) {
			throw new InvalidArgumentError("File is required");
		}

		if (!filename || filename.trim() === "") {
			throw new InvalidArgumentError("Filename is required");
		}

		if (!mimeType || mimeType.trim() === "") {
			throw new InvalidArgumentError("MIME type is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Use provided transaction or create a new one
		const shouldManageTransaction = !providedTransactionID;
		const transactionID =
			providedTransactionID || (await payload.db.beginTransaction());

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Create media record using Payload's upload functionality
			const media = await payload.create({
				collection: "media",
				data: {
					alt: alt || null,
					caption: caption || null,
					createdBy: userId,
				},
				file: {
					data: file,
					name: filename,
					size: file.length,
					mimetype: mimeType,
				},
				req: { transactionID },
			});

			// Commit transaction only if we created it
			if (shouldManageTransaction) {
				await payload.db.commitTransaction(transactionID);
			}

			return {
				media,
			};
		} catch (error) {
			// Rollback transaction only if we created it
			if (shouldManageTransaction) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create media", {
			cause: error,
		}),
);

export interface GetMediaByIdArgs {
	id: number | string;
	depth?: number;
	transactionID?: string | number;
}

export interface GetMediaByFilenameArgs {
	filename: string;
	depth?: number;
	transactionID?: string | number;
}

export interface GetMediaBufferFromFilenameArgs {
	filename: string;
	depth?: number;
}

export interface GetMediaBufferFromFilenameResult {
	media: Media;
	buffer: Buffer;
}

/**
 * Get a media record by ID
 *
 * This function fetches a media record by its ID with optional depth control
 * for relationships
 */
export const tryGetMediaById = Result.wrap(
	async (payload: Payload, args: GetMediaByIdArgs): Promise<Media> => {
		const { id, depth = 1 } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Media ID is required");
		}

		// Fetch the media record
		const mediaResult = await payload.find({
			collection: "media",
			where: {
				and: [
					{
						id: { equals: id },
					},
				],
			},
			depth,
		});

		const media = mediaResult.docs[0];

		if (!media) {
			throw new NonExistingMediaError(`Media with id '${id}' not found`);
		}

		return media;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get media", {
			cause: error,
		}),
);

/**
 * Get a media record by filename
 *
 * This function fetches a media record by its filename with optional depth control
 * for relationships
 */
export const tryGetMediaByFilename = Result.wrap(
	async (payload: Payload, args: GetMediaByFilenameArgs): Promise<Media> => {
		const { filename, depth = 1, transactionID } = args;

		// Validate filename
		if (!filename || filename.trim() === "") {
			throw new InvalidArgumentError("Filename is required");
		}

		// Fetch the media record
		const mediaResult = await payload.find({
			collection: "media",
			where: {
				filename: { equals: filename },
			},
			depth,
			req: transactionID ? { transactionID } : undefined,
		});

		const media = mediaResult.docs[0];

		if (!media) {
			throw new NonExistingMediaError(
				`Media with filename '${filename}' not found`,
			);
		}

		return media;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get media by filename", {
			cause: error,
		}),
);

/**
 * Get a media record by filename and fetch the file buffer from S3
 *
 * This function:
 * 1. Validates the filename
 * 2. Fetches the media record from the database
 * 3. Fetches the file buffer from S3 storage
 * 4. Returns both the media record and the buffer
 */
export const tryGetMediaBufferFromFilename = Result.wrap(
	async (
		payload: Payload,
		s3Client: S3Client,
		args: GetMediaBufferFromFilenameArgs,
	): Promise<GetMediaBufferFromFilenameResult> => {
		const { filename, depth = 0 } = args;

		// Validate filename
		if (!filename || filename.trim() === "") {
			throw new InvalidArgumentError("Filename is required");
		}

		// First, get the media record from the database
		const mediaResult = await tryGetMediaByFilename(payload, {
			filename,
			depth,
		});

		if (!mediaResult.ok) {
			throw mediaResult.error;
		}

		const media = mediaResult.value;

		// Fetch the file from S3
		const command = new GetObjectCommand({
			Bucket: envVars.S3_BUCKET.value,
			Key: filename,
		});

		const response = await s3Client.send(command);

		if (!response.Body) {
			throw new NonExistingMediaError(`File not found in storage: ${filename}`);
		}

		// Convert the stream to a buffer
		const chunks: Uint8Array[] = [];
		// @ts-expect-error - Body is a stream in Node.js
		for await (const chunk of response.Body) {
			chunks.push(chunk);
		}
		const buffer = Buffer.concat(chunks);

		return {
			media,
			buffer,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get media buffer from filename", {
			cause: error,
		}),
);

export interface GetMediaBufferFromIdArgs {
	id: number | string;
	depth?: number;
}

export interface GetMediaBufferFromIdResult {
	media: Media;
	buffer: Buffer;
}

export interface GetMediaStreamFromFilenameArgs {
	filename: string;
	depth?: number;
	range?: { start: number; end?: number };
}

export interface GetMediaStreamFromFilenameResult {
	media: Media;
	stream: ReadableStream<Uint8Array>;
	contentLength: number;
	contentRange?: string;
}

export interface GetMediaStreamFromIdArgs {
	id: number | string;
	depth?: number;
	range?: { start: number; end?: number };
}

export interface GetMediaStreamFromIdResult {
	media: Media;
	stream: ReadableStream<Uint8Array>;
	contentLength: number;
	contentRange?: string;
}

/**
 * Get a media record by ID and fetch the file buffer from S3
 *
 * This function:
 * 1. Validates the ID
 * 2. Fetches the media record from the database
 * 3. Fetches the file buffer from S3 storage using the filename from the media record
 * 4. Returns both the media record and the buffer
 */
export const tryGetMediaBufferFromId = Result.wrap(
	async (
		payload: Payload,
		s3Client: S3Client,
		args: GetMediaBufferFromIdArgs,
	): Promise<GetMediaBufferFromIdResult> => {
		const { id, depth = 0 } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Media ID is required");
		}

		// First, get the media record from the database
		const mediaResult = await tryGetMediaById(payload, {
			id,
			depth,
		});

		if (!mediaResult.ok) {
			throw mediaResult.error;
		}

		const media = mediaResult.value;

		// Fetch the file from S3 using the filename from the media record
		if (!media.filename) {
			throw new NonExistingMediaError(
				`Media with id '${id}' has no associated filename`,
			);
		}

		const command = new GetObjectCommand({
			Bucket: envVars.S3_BUCKET.value,
			Key: media.filename,
		});

		const response = await s3Client.send(command);

		if (!response.Body) {
			throw new NonExistingMediaError(
				`File not found in storage: ${media.filename}`,
			);
		}

		// Convert the stream to a buffer
		const chunks: Uint8Array[] = [];
		for await (const chunk of response.Body) {
			chunks.push(chunk);
		}
		const buffer = Buffer.concat(chunks);

		return {
			media,
			buffer,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get media buffer from id", {
			cause: error,
		}),
);

/**
 * Get a media record by filename and fetch the file stream from S3
 *
 * This function:
 * 1. Validates the filename
 * 2. Fetches the media record from the database
 * 3. Fetches the file stream from S3 storage (with optional range support)
 * 4. Returns the media record, stream, content length, and optional content range
 */
export const tryGetMediaStreamFromFilename = Result.wrap(
	async (
		payload: Payload,
		s3Client: S3Client,
		args: GetMediaStreamFromFilenameArgs,
	): Promise<GetMediaStreamFromFilenameResult> => {
		const { filename, depth = 0, range } = args;

		// Validate filename
		if (!filename || filename.trim() === "") {
			throw new InvalidArgumentError("Filename is required");
		}

		// First, get the media record from the database
		const mediaResult = await tryGetMediaByFilename(payload, {
			filename,
			depth,
		});

		if (!mediaResult.ok) {
			throw mediaResult.error;
		}

		const media = mediaResult.value;
		const fileSize = media.filesize || 0;

		// Build GetObjectCommand with optional range
		const commandOptions: {
			Bucket: string;
			Key: string;
			Range?: string;
		} = {
			Bucket: envVars.S3_BUCKET.value,
			Key: filename,
		};

		if (range) {
			const end = range.end !== undefined ? range.end : fileSize - 1;
			commandOptions.Range = `bytes=${range.start}-${end}`;
		}

		const command = new GetObjectCommand(commandOptions);
		const response = await s3Client.send(command);

		if (!response.Body) {
			throw new NonExistingMediaError(`File not found in storage: ${filename}`);
		}

		// Get content length from response or media record
		const contentLength = response.ContentLength ?? fileSize;
		const contentRange = response.ContentRange;

		// Convert S3 stream to Web ReadableStream
		const s3Stream = response.Body as unknown as AsyncIterable<Uint8Array>;
		const stream = new ReadableStream({
			async start(controller) {
				try {
					for await (const chunk of s3Stream) {
						controller.enqueue(
							chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk),
						);
					}
					controller.close();
				} catch (error) {
					controller.error(error);
				}
			},
		});

		return {
			media,
			stream,
			contentLength,
			contentRange: contentRange || undefined,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get media stream from filename", {
			cause: error,
		}),
);

/**
 * Get a media record by ID and fetch the file stream from S3
 *
 * This function:
 * 1. Validates the ID
 * 2. Fetches the media record from the database
 * 3. Fetches the file stream from S3 storage using the filename (with optional range support)
 * 4. Returns the media record, stream, content length, and optional content range
 */
export const tryGetMediaStreamFromId = Result.wrap(
	async (
		payload: Payload,
		s3Client: S3Client,
		args: GetMediaStreamFromIdArgs,
	): Promise<GetMediaStreamFromIdResult> => {
		const { id, depth = 0, range } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Media ID is required");
		}

		// First, get the media record from the database
		const mediaResult = await tryGetMediaById(payload, {
			id,
			depth,
		});

		if (!mediaResult.ok) {
			throw mediaResult.error;
		}

		const media = mediaResult.value;

		// Fetch the file from S3 using the filename from the media record
		if (!media.filename) {
			throw new NonExistingMediaError(
				`Media with id '${id}' has no associated filename`,
			);
		}

		const fileSize = media.filesize || 0;

		// Build GetObjectCommand with optional range
		const commandOptions: {
			Bucket: string;
			Key: string;
			Range?: string;
		} = {
			Bucket: envVars.S3_BUCKET.value,
			Key: media.filename,
		};

		if (range) {
			const end = range.end !== undefined ? range.end : fileSize - 1;
			commandOptions.Range = `bytes=${range.start}-${end}`;
		}

		const command = new GetObjectCommand(commandOptions);
		const response = await s3Client.send(command);

		if (!response.Body) {
			throw new NonExistingMediaError(
				`File not found in storage: ${media.filename}`,
			);
		}

		// Get content length from response or media record
		const contentLength = response.ContentLength ?? fileSize;
		const contentRange = response.ContentRange;

		// Convert S3 stream to Web ReadableStream
		const s3Stream = response.Body as unknown as AsyncIterable<Uint8Array>;
		const stream = new ReadableStream({
			async start(controller) {
				try {
					for await (const chunk of s3Stream) {
						controller.enqueue(
							chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk),
						);
					}
					controller.close();
				} catch (error) {
					controller.error(error);
				}
			},
		});

		return {
			media,
			stream,
			contentLength,
			contentRange: contentRange || undefined,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get media stream from id", {
			cause: error,
		}),
);

export interface GetAllMediaArgs {
	limit?: number;
	page?: number;
	depth?: number;
	sort?: string;
	where?: Record<string, unknown>;
}

/**
 * Gets all media records with pagination and filtering
 *
 * This function fetches media records with optional pagination, sorting, and filtering
 */
export const tryGetAllMedia = Result.wrap(
	async (
		payload: Payload,
		args: GetAllMediaArgs = {},
	): Promise<{
		docs: Media[];
		totalDocs: number;
		limit: number;
		totalPages: number;
		page: number;
		pagingCounter: number;
		hasPrevPage: boolean;
		hasNextPage: boolean;
		prevPage: number | null;
		nextPage: number | null;
	}> => {
		const {
			limit = 10,
			page = 1,
			depth = 1,
			sort = "-createdAt",
			where = {},
		} = args;

		// Validate pagination parameters
		if (limit <= 0) {
			throw new InvalidArgumentError("Limit must be greater than 0");
		}

		if (page <= 0) {
			throw new InvalidArgumentError("Page must be greater than 0");
		}

		// Fetch media records
		const mediaResult = await payload.find({
			collection: "media",
			// @ts-expect-error - Dynamic where clause type
			where,
			depth,
			limit,
			page,
			sort,
		});

		return {
			docs: mediaResult.docs,
			totalDocs: mediaResult.totalDocs,
			limit: mediaResult.limit || limit,
			totalPages: mediaResult.totalPages || 0,
			page: mediaResult.page || page,
			pagingCounter: mediaResult.pagingCounter || 0,
			hasPrevPage: mediaResult.hasPrevPage || false,
			hasNextPage: mediaResult.hasNextPage || false,
			prevPage: mediaResult.prevPage || null,
			nextPage: mediaResult.nextPage || null,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get all media", {
			cause: error,
		}),
);

export interface UpdateMediaArgs {
	id: number;
	alt?: string;
	caption?: string;
	userId: number;
}

/**
 * Updates a media record's metadata
 *
 * This function:
 * 1. Validates the media record exists
 * 2. Updates the alt text and caption
 * 3. Uses transactions to ensure atomicity
 */
export const tryUpdateMedia = Result.wrap(
	async (payload: Payload, args: UpdateMediaArgs): Promise<Media> => {
		const { id, alt, caption, userId } = args;

		// Validate required fields
		if (!id) {
			throw new InvalidArgumentError("Media ID is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Verify user exists
			const user = await payload.findByID({
				collection: "users",
				id: userId,
				req: { transactionID },
			});

			if (!user) {
				throw new InvalidArgumentError(`User with id '${userId}' not found`);
			}

			// Get the media record
			const media = await payload.findByID({
				collection: "media",
				id,
				req: { transactionID },
			});

			if (!media) {
				throw new NonExistingMediaError(`Media with id '${id}' not found`);
			}

			// Prepare update data
			const updateData: Partial<Media> = {};

			if (alt !== undefined) {
				updateData.alt = alt;
			}

			if (caption !== undefined) {
				updateData.caption = caption;
			}

			// Update the media record
			const updatedMedia = await payload.update({
				collection: "media",
				id,
				data: updateData,
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return updatedMedia;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update media", {
			cause: error,
		}),
);

export interface DeleteMediaArgs {
	id: number | number[];
	userId: number;
}

export interface DeleteMediaResult {
	deletedMedia: Media[];
}

/**
 * Deletes one or more media records
 *
 * This function:
 * 1. Validates the media records exist
 * 2. Deletes the media record(s)
 * 3. Uses transactions to ensure atomicity
 */
export const tryDeleteMedia = Result.wrap(
	async (
		payload: Payload,
		args: DeleteMediaArgs,
	): Promise<DeleteMediaResult> => {
		const { id, userId } = args;

		// Validate required fields
		if (!id) {
			throw new InvalidArgumentError("Media ID is required");
		}

		if (Array.isArray(id) && id.length === 0) {
			throw new InvalidArgumentError("At least one media ID is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Normalize to array
		const ids = Array.isArray(id) ? id : [id];

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Verify user exists
			const user = await payload.findByID({
				collection: "users",
				id: userId,
				req: { transactionID },
			});

			if (!user) {
				throw new InvalidArgumentError(`User with id '${userId}' not found`);
			}

			// Get the media records before deletion
			const mediaResults = await payload.find({
				collection: "media",
				where: {
					id: {
						in: ids,
					},
				},
				limit: ids.length,
				req: { transactionID },
			});

			const foundMedia = mediaResults.docs;

			if (foundMedia.length === 0) {
				throw new NonExistingMediaError(
					`No media records found with the provided IDs`,
				);
			}

			if (foundMedia.length !== ids.length) {
				const foundIds = foundMedia.map((m) => m.id);
				const missingIds = ids.filter((id) => !foundIds.includes(id));
				throw new NonExistingMediaError(
					`Media records not found: ${missingIds.join(", ")}`,
				);
			}

			// Delete all media records
			for (const mediaId of ids) {
				await payload.delete({
					collection: "media",
					id: mediaId,
					req: { transactionID },
				});
			}

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return {
				deletedMedia: foundMedia,
			};
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete media", {
			cause: error,
		}),
);

export interface GetMediaByMimeTypeArgs {
	mimeType: string;
	limit?: number;
	page?: number;
	depth?: number;
}

/**
 * Gets media records filtered by MIME type
 *
 * This function fetches media records filtered by MIME type with pagination
 */
export const tryGetMediaByMimeType = Result.wrap(
	async (
		payload: Payload,
		args: GetMediaByMimeTypeArgs,
	): Promise<{
		docs: Media[];
		totalDocs: number;
		limit: number;
		totalPages: number;
		page: number;
		pagingCounter: number;
		hasPrevPage: boolean;
		hasNextPage: boolean;
		prevPage: number | null;
		nextPage: number | null;
	}> => {
		const { mimeType, limit = 10, page = 1, depth = 1 } = args;

		// Validate MIME type
		if (!mimeType || mimeType.trim() === "") {
			throw new InvalidArgumentError("MIME type is required");
		}

		// Validate pagination parameters
		if (limit <= 0) {
			throw new InvalidArgumentError("Limit must be greater than 0");
		}

		if (page <= 0) {
			throw new InvalidArgumentError("Page must be greater than 0");
		}

		// Fetch media records filtered by MIME type
		const mediaResult = await payload.find({
			collection: "media",
			where: {
				mimeType: { equals: mimeType },
			},
			depth,
			limit,
			page,
			sort: "-createdAt",
		});

		return {
			docs: mediaResult.docs,
			totalDocs: mediaResult.totalDocs,
			limit: mediaResult.limit || limit,
			totalPages: mediaResult.totalPages || 0,
			page: mediaResult.page || page,
			pagingCounter: mediaResult.pagingCounter || 0,
			hasPrevPage: mediaResult.hasPrevPage || false,
			hasNextPage: mediaResult.hasNextPage || false,
			prevPage: mediaResult.prevPage || null,
			nextPage: mediaResult.nextPage || null,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get media by MIME type", {
			cause: error,
		}),
);

export interface FindMediaByUserArgs {
	payload: Payload;
	userId: number;
	limit?: number;
	page?: number;
	depth?: number;
	sort?: string;
	user?: unknown;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

/**
 * Finds media by user ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindMediaByUser = Result.wrap(
	async (
		args: FindMediaByUserArgs,
	): Promise<{
		docs: Media[];
		totalDocs: number;
		limit: number;
		totalPages: number;
		page: number;
		pagingCounter: number;
		hasPrevPage: boolean;
		hasNextPage: boolean;
		prevPage: number | null;
		nextPage: number | null;
	}> => {
		const {
			payload,
			userId,
			limit = 10,
			page = 1,
			depth = 1,
			sort = "-createdAt",
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate pagination parameters
		if (limit <= 0) {
			throw new InvalidArgumentError("Limit must be greater than 0");
		}

		if (page <= 0) {
			throw new InvalidArgumentError("Page must be greater than 0");
		}

		// Find media with access control
		const mediaResult = await payload.find({
			collection: "media",
			where: {
				createdBy: {
					equals: userId,
				},
			},
			limit,
			page,
			depth,
			sort,
			user,
			req,
			overrideAccess,
		});

		return {
			docs: mediaResult.docs,
			totalDocs: mediaResult.totalDocs,
			limit: mediaResult.limit || limit,
			totalPages: mediaResult.totalPages || 0,
			page: mediaResult.page || page,
			pagingCounter: mediaResult.pagingCounter || 0,
			hasPrevPage: mediaResult.hasPrevPage || false,
			hasNextPage: mediaResult.hasNextPage || false,
			prevPage: mediaResult.prevPage || null,
			nextPage: mediaResult.nextPage || null,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find media by user", {
			cause: error,
		}),
);

export interface RenameMediaArgs {
	id: number | string;
	newFilename: string;
	userId: number;
	transactionID?: string | number;
}

export interface RenameMediaResult {
	media: Media;
}

/**
 * Renames a media file in both S3 and the database
 *
 * This function:
 * 1. Validates the media record exists
 * 2. Copies the file in S3 with the new filename
 * 3. Deletes the old file from S3
 * 4. Updates the media record in the database
 * 5. Uses transactions to ensure atomicity
 */
export const tryRenameMedia = Result.wrap(
	async (
		payload: Payload,
		s3Client: S3Client,
		args: RenameMediaArgs,
	): Promise<RenameMediaResult> => {
		const {
			id,
			newFilename,
			userId,
			transactionID: providedTransactionID,
		} = args;

		// Validate required fields
		if (!id) {
			throw new InvalidArgumentError("Media ID is required");
		}

		if (!newFilename || newFilename.trim() === "") {
			throw new InvalidArgumentError("New filename is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Use provided transaction or create a new one
		const shouldManageTransaction = !providedTransactionID;
		const transactionID =
			providedTransactionID || (await payload.db.beginTransaction());

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Get the media record
			const mediaResult = await tryGetMediaById(payload, {
				id,
				depth: 0,
			});

			if (!mediaResult.ok) {
				throw mediaResult.error;
			}

			const media = mediaResult.value;

			// Verify user exists
			const user = await payload.findByID({
				collection: "users",
				id: userId,
				req: { transactionID },
			});

			if (!user) {
				throw new InvalidArgumentError(`User with id '${userId}' not found`);
			}

			// Check if media has a filename
			if (!media.filename) {
				throw new NonExistingMediaError(
					`Media with id '${id}' has no associated filename`,
				);
			}

			const oldFilename = media.filename;

			// If the new filename is the same as the old one, just return the media
			if (oldFilename === newFilename) {
				if (shouldManageTransaction) {
					await payload.db.commitTransaction(transactionID);
				}
				return { media };
			}

			// Check if a media with the new filename already exists
			const existingMediaResult = await tryGetMediaByFilename(payload, {
				filename: newFilename,
				depth: 0,
				transactionID,
			});

			if (existingMediaResult.ok) {
				throw new InvalidArgumentError(
					`A media file with filename '${newFilename}' already exists`,
				);
			}

			// Copy the file in S3 with the new filename
			const copyCommand = new CopyObjectCommand({
				Bucket: envVars.S3_BUCKET.value,
				CopySource: `${envVars.S3_BUCKET.value}/${oldFilename}`,
				Key: newFilename,
			});

			await s3Client.send(copyCommand);

			// Delete the old file from S3
			const deleteCommand = new DeleteObjectCommand({
				Bucket: envVars.S3_BUCKET.value,
				Key: oldFilename,
			});

			await s3Client.send(deleteCommand);

			// Update the media record in the database
			const updatedMedia = await payload.update({
				collection: "media",
				id,
				data: {
					filename: newFilename,
				},
				req: { transactionID },
			});

			// Commit transaction only if we created it
			if (shouldManageTransaction) {
				await payload.db.commitTransaction(transactionID);
			}

			return {
				media: updatedMedia,
			};
		} catch (error) {
			// Rollback transaction only if we created it
			if (shouldManageTransaction) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to rename media", {
			cause: error,
		}),
);

export interface GetUserMediaStatsArgs {
	payload: Payload;
	userId: number;
	user?: unknown;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

/**
 * Gets media drive statistics for a user
 *
 * This function:
 * 1. Fetches all media files for the user
 * 2. Calculates total count, total size, and media type counts
 * 3. Returns aggregated statistics
 */
export const tryGetUserMediaStats = Result.wrap(
	async (
		args: GetUserMediaStatsArgs,
	): Promise<{
		count: number;
		totalSize: number;
		mediaTypeCount: Record<string, number>;
	}> => {
		const {
			payload,
			userId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Fetch all media for the user (no pagination limit)
		const mediaResult = await payload.find({
			collection: "media",
			where: {
				createdBy: {
					equals: userId,
				},
			},
			limit: 10000, // Large limit to get all media
			depth: 0,
			user,
			req,
			overrideAccess,
		});

		const media = mediaResult.docs;

		// Calculate total count
		const count = mediaResult.totalDocs;

		// Calculate total size
		const totalSize = media.reduce((sum, file) => {
			return sum + (file.filesize || 0);
		}, 0);

		// Calculate media type counts
		const mediaTypeCount: Record<string, number> = {};

		for (const file of media) {
			const mimeType = file.mimeType || "unknown";
			let type = "other";

			if (mimeType.startsWith("image/")) {
				type = "image";
			} else if (mimeType.startsWith("video/")) {
				type = "video";
			} else if (mimeType.startsWith("audio/")) {
				type = "audio";
			} else if (mimeType === "application/pdf") {
				type = "pdf";
			} else if (
				mimeType.startsWith("text/") ||
				mimeType === "application/json" ||
				mimeType === "application/xml"
			) {
				type = "text";
			} else if (
				mimeType.includes("word") ||
				mimeType.includes("document") ||
				mimeType.includes("docx") ||
				mimeType.includes("doc")
			) {
				type = "document";
			} else if (
				mimeType.includes("spreadsheet") ||
				mimeType.includes("excel") ||
				mimeType.includes("xlsx") ||
				mimeType.includes("xls")
			) {
				type = "spreadsheet";
			} else if (
				mimeType.includes("presentation") ||
				mimeType.includes("powerpoint") ||
				mimeType.includes("pptx") ||
				mimeType.includes("ppt")
			) {
				type = "presentation";
			} else if (
				mimeType.includes("zip") ||
				mimeType.includes("archive") ||
				mimeType.includes("compressed")
			) {
				type = "archive";
			}

			mediaTypeCount[type] = (mediaTypeCount[type] || 0) + 1;
		}

		return {
			count,
			totalSize,
			mediaTypeCount,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user media stats", {
			cause: error,
		}),
);
