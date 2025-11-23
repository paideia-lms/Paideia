import "@total-typescript/ts-reset";
import type { S3Client } from "@aws-sdk/client-s3";
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	MediaInUseError,
	NonExistingMediaError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { envVars } from "../env";
import type { Media } from "../payload-types";
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "./utils/handle-transaction-id";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export type CreateMediaArgs = BaseInternalFunctionArgs & {
	file: Buffer;
	filename: string;
	mimeType: string;
	alt?: string;
	caption?: string;
	userId: number;
};

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
	async (args: CreateMediaArgs): Promise<CreateMediaResult> => {
		const {
			payload,
			file,
			filename,
			mimeType,
			alt,
			caption,
			userId,
			user = null,
			req,
			overrideAccess = false,
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

		const transactionInfo = await handleTransactionId(payload, req);

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
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return {
				media,
			};
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create media", {
			cause: error,
		}),
);

export type GetMediaByIdArgs = BaseInternalFunctionArgs & {
	id: number | string;
	depth?: number;
};

export type GetMediaByFilenameArgs = BaseInternalFunctionArgs & {
	filename: string;
	depth?: number;
};

export type GetMediaBufferFromFilenameArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
	filename: string;
	depth?: number;
};

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
	async (args: GetMediaByIdArgs): Promise<Media> => {
		const {
			payload,
			id,
			depth = 1,
			user = null,
			req,
			overrideAccess = false,
		} = args;

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
			user,
			req,
			overrideAccess,
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
	async (args: GetMediaByFilenameArgs): Promise<Media> => {
		const {
			payload,
			filename,
			depth = 1,
			user = null,
			req,
			overrideAccess = false,
		} = args;

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
			user,
			req,
			overrideAccess,
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
		args: GetMediaBufferFromFilenameArgs,
	): Promise<GetMediaBufferFromFilenameResult> => {
		const {
			payload,
			s3Client,
			filename,
			depth = 0,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate filename
		if (!filename || filename.trim() === "") {
			throw new InvalidArgumentError("Filename is required");
		}

		// First, get the media record from the database
		const mediaResult = await tryGetMediaByFilename({
			payload,
			filename,
			depth,
			user,
			req,
			overrideAccess,
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
		// @ts-expect-error
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

export type GetMediaBufferFromIdArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
	id: number | string;
	depth?: number;
};

export interface GetMediaBufferFromIdResult {
	media: Media;
	buffer: Buffer;
}

export type GetMediaStreamFromFilenameArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
	filename: string;
	depth?: number;
	range?: { start: number; end?: number };
};

export interface GetMediaStreamFromFilenameResult {
	media: Media;
	stream: ReadableStream<Uint8Array>;
	contentLength: number;
	contentRange?: string;
}

export type GetMediaStreamFromIdArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
	id: number | string;
	depth?: number;
	range?: { start: number; end?: number };
};

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
		args: GetMediaBufferFromIdArgs,
	): Promise<GetMediaBufferFromIdResult> => {
		const {
			payload,
			s3Client,
			id,
			depth = 0,
			user = null,
			overrideAccess = false,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Media ID is required");
		}

		// First, get the media record from the database
		const mediaResult = await tryGetMediaById({
			payload,
			id,
			depth,
			user,
			overrideAccess,
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
		args: GetMediaStreamFromFilenameArgs,
	): Promise<GetMediaStreamFromFilenameResult> => {
		const {
			payload,
			s3Client,
			filename,
			depth = 0,
			range,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate filename
		if (!filename || filename.trim() === "") {
			throw new InvalidArgumentError("Filename is required");
		}

		// First, get the media record from the database
		const mediaResult = await tryGetMediaByFilename({
			payload,
			filename,
			depth,
			user,
			req,
			overrideAccess,
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
		args: GetMediaStreamFromIdArgs,
	): Promise<GetMediaStreamFromIdResult> => {
		const {
			payload,
			s3Client,
			id,
			depth = 0,
			range,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Media ID is required");
		}

		// First, get the media record from the database
		const mediaResult = await tryGetMediaById({
			payload,
			id,
			depth,
			user,
			req,
			overrideAccess,
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

export type GetAllMediaArgs = BaseInternalFunctionArgs & {
	limit?: number;
	page?: number;
	depth?: number;
	sort?: string;
	where?: Record<string, unknown>;
};

/**
 * Gets all media records with pagination and filtering
 *
 * This function fetches media records with optional pagination, sorting, and filtering
 */
export const tryGetAllMedia = Result.wrap(
	async (args: GetAllMediaArgs) => {
		const {
			payload,
			limit = 10,
			page = 1,
			depth = 1,
			sort = "-createdAt",
			where = {},
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

		// Fetch media records
		const mediaResult = await payload.find({
			collection: "media",
			// @ts-expect-error - Dynamic where clause type
			where,
			depth,
			limit,
			page,
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
		new UnknownError("Failed to get all media", {
			cause: error,
		}),
);

export type UpdateMediaArgs = BaseInternalFunctionArgs & {
	id: number;
	alt?: string;
	caption?: string;
	userId: number;
};

/**
 * Updates a media record's metadata
 *
 * This function:
 * 1. Validates the media record exists
 * 2. Updates the alt text and caption
 * 3. Uses transactions to ensure atomicity
 */
export const tryUpdateMedia = Result.wrap(
	async (args: UpdateMediaArgs): Promise<Media> => {
		const {
			payload,
			id,
			alt,
			caption,
			userId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!id) {
			throw new InvalidArgumentError("Media ID is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Verify user exists
			const userRecord = await payload.findByID({
				collection: "users",
				id: userId,
				req: transactionInfo.reqWithTransaction,
			});

			if (!userRecord) {
				throw new InvalidArgumentError(`User with id '${userId}' not found`);
			}

			// Get the media record
			const media = await payload.findByID({
				collection: "media",
				id,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
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
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return updatedMedia;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update media", {
			cause: error,
		}),
);

export type DeleteMediaArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
	id: number | number[];
	userId: number;
};

export interface DeleteMediaResult {
	deletedMedia: Media[];
}

/**
 * Deletes one or more media records
 *
 * This function:
 * 1. Validates the media records exist
 * 2. Deletes the file(s) from S3 storage
 * 3. Deletes the media record(s) from the database
 * 4. Uses transactions to ensure atomicity
 */
export const tryDeleteMedia = Result.wrap(
	async (args: DeleteMediaArgs): Promise<DeleteMediaResult> => {
		const {
			payload,
			s3Client,
			id,
			userId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

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

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Get the media records before deletion
			const mediaResults = await payload.find({
				collection: "media",
				where: {
					id: {
						in: ids,
					},
				},
				limit: ids.length,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
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

			// Check if any media has usage before deletion
			const mediaWithUsage: Array<{ id: number; usages: number }> = [];
			for (const media of foundMedia) {
				const usagesResult = await tryFindMediaUsages({
					payload,
					mediaId: media.id,
					user,
					req: transactionInfo.reqWithTransaction,
					overrideAccess,
				});

				if (usagesResult.ok && usagesResult.value.totalUsages > 0) {
					mediaWithUsage.push({
						id: media.id,
						usages: usagesResult.value.totalUsages,
					});
				}
			}

			if (mediaWithUsage.length > 0) {
				const mediaIdsWithUsage = mediaWithUsage.map((m) => m.id).join(", ");
				const totalUsages = mediaWithUsage.reduce(
					(sum, m) => sum + m.usages,
					0,
				);
				throw new MediaInUseError(
					`Cannot delete media file(s) ${mediaIdsWithUsage} because ${totalUsages} usage${totalUsages !== 1 ? "s" : ""} found. Please remove all references before deleting.`,
				);
			}

			// Delete files from S3 first
			for (const media of foundMedia) {
				if (media.filename) {
					const deleteCommand = new DeleteObjectCommand({
						Bucket: envVars.S3_BUCKET.value,
						Key: media.filename,
					});

					await s3Client.send(deleteCommand);
				}
			}

			// Delete all media records from database
			for (const mediaId of ids) {
				await payload.delete({
					collection: "media",
					id: mediaId,
					user,
					req: transactionInfo.reqWithTransaction,
					overrideAccess,
				});
			}

			await commitTransactionIfCreated(payload, transactionInfo);

			return {
				deletedMedia: foundMedia,
			};
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete media", {
			cause: error,
		}),
);

export type GetMediaByMimeTypeArgs = BaseInternalFunctionArgs & {
	mimeType: string;
	limit?: number;
	page?: number;
	depth?: number;
};

/**
 * Gets media records filtered by MIME type
 *
 * This function fetches media records filtered by MIME type with pagination
 */
export const tryGetMediaByMimeType = Result.wrap(
	async (
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
		const {
			payload,
			mimeType,
			limit = 10,
			page = 1,
			depth = 1,
			user = null,
			req,
			overrideAccess = false,
		} = args;

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
		new UnknownError("Failed to get media by MIME type", {
			cause: error,
		}),
);

export type FindMediaByUserArgs = BaseInternalFunctionArgs & {
	userId: number;
	limit?: number;
	page?: number;
	depth?: number;
	sort?: string;
};

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

export type RenameMediaArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
	id: number | string;
	newFilename: string;
	userId: number;
};

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
	async (args: RenameMediaArgs): Promise<RenameMediaResult> => {
		const {
			payload,
			s3Client,
			id,
			newFilename,
			userId,
			user = null,
			req,
			overrideAccess = false,
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

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Get the media record
			const mediaResult = await tryGetMediaById({
				payload,
				id,
				depth: 0,
				overrideAccess,
			});

			if (!mediaResult.ok) {
				throw mediaResult.error;
			}

			const media = mediaResult.value;

			// Verify user exists
			const userRecord = await payload.findByID({
				collection: "users",
				id: userId,
				req: transactionInfo.reqWithTransaction,
			});

			if (!userRecord) {
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
				await commitTransactionIfCreated(payload, transactionInfo);
				return { media };
			}

			// Check if a media with the new filename already exists
			const existingMediaResult = await tryGetMediaByFilename({
				payload,
				filename: newFilename,
				depth: 0,
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
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
				user,
				req: transactionInfo.reqWithTransaction,
				overrideAccess,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return {
				media: updatedMedia,
			};
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to rename media", {
			cause: error,
		}),
);

export type GetUserMediaStatsArgs = BaseInternalFunctionArgs & {
	userId: number;
};

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
		const { payload, userId, user = null, req, overrideAccess = false } = args;

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

export type GetSystemMediaStatsArgs = BaseInternalFunctionArgs;

/**
 * Gets media drive statistics for the entire system
 *
 * This function:
 * 1. Fetches all media files in the system
 * 2. Calculates total count, total size, and media type counts
 * 3. Returns aggregated statistics
 */
export const tryGetSystemMediaStats = Result.wrap(
	async (
		args: GetSystemMediaStatsArgs,
	): Promise<{
		count: number;
		totalSize: number;
		mediaTypeCount: Record<string, number>;
	}> => {
		const { payload, user = null, req, overrideAccess = false } = args;

		// Fetch all media in the system (no pagination limit)
		const mediaResult = await payload.find({
			collection: "media",
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
		new UnknownError("Failed to get system media stats", {
			cause: error,
		}),
);

export interface OrphanedMediaFile {
	filename: string;
	size: number;
	lastModified?: Date;
}

export type GetOrphanedMediaArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
	limit?: number;
	page?: number;
};

export interface GetOrphanedMediaResult {
	files: OrphanedMediaFile[];
	totalFiles: number;
	totalSize: number;
	limit: number;
	page: number;
	totalPages: number;
	hasPrevPage: boolean;
	hasNextPage: boolean;
	prevPage: number | null;
	nextPage: number | null;
}

/**
 * Gets all media files in S3 that are not managed by the system (not in database)
 *
 * This function:
 * 1. Lists all files in S3 bucket
 * 2. Gets all media filenames from database
 * 3. Finds files in S3 that don't have a corresponding database record
 * 4. Returns paginated results with metadata
 */
export const tryGetOrphanedMedia = Result.wrap(
	async (args: GetOrphanedMediaArgs): Promise<GetOrphanedMediaResult> => {
		const {
			payload,
			s3Client,
			limit = 20,
			page = 1,
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

		// Get all filenames from database
		const allMediaResult = await payload.find({
			collection: "media",
			limit: 10000, // Large limit to get all media filenames
			depth: 0,
			user,
			req,
			overrideAccess,
		});

		const dbFilenames = new Set<string>();
		for (const media of allMediaResult.docs) {
			if (media.filename) {
				dbFilenames.add(media.filename);
			}
		}

		// List all objects in S3 (handle pagination)
		const s3Files: Array<{ Key: string; Size: number; LastModified?: Date }> =
			[];
		let continuationToken: string | undefined;

		do {
			const listCommand = new ListObjectsV2Command({
				Bucket: envVars.S3_BUCKET.value,
				ContinuationToken: continuationToken,
			});

			const listResponse = await s3Client.send(listCommand);

			if (listResponse.Contents) {
				for (const obj of listResponse.Contents) {
					if (obj.Key && obj.Size !== undefined) {
						s3Files.push({
							Key: obj.Key,
							Size: obj.Size,
							LastModified: obj.LastModified,
						});
					}
				}
			}

			continuationToken = listResponse.NextContinuationToken;
		} while (continuationToken);

		// Find orphaned files (in S3 but not in database)
		const orphanedFiles: OrphanedMediaFile[] = s3Files
			.filter((file) => !dbFilenames.has(file.Key))
			.map((file) => ({
				filename: file.Key,
				size: file.Size,
				lastModified: file.LastModified,
			}));

		// Sort by filename for consistent pagination
		orphanedFiles.sort((a, b) => a.filename.localeCompare(b.filename));

		// Calculate pagination
		const totalFiles = orphanedFiles.length;
		const totalPages = Math.ceil(totalFiles / limit);
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;
		const paginatedFiles = orphanedFiles.slice(startIndex, endIndex);

		// Calculate total size of all orphaned files
		const totalSize = orphanedFiles.reduce((sum, file) => sum + file.size, 0);

		return {
			files: paginatedFiles,
			totalFiles,
			totalSize,
			limit,
			page,
			totalPages,
			hasPrevPage: page > 1,
			hasNextPage: page < totalPages,
			prevPage: page > 1 ? page - 1 : null,
			nextPage: page < totalPages ? page + 1 : null,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get orphaned media", {
			cause: error,
		}),
);

export type GetAllOrphanedFilenamesArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
};

export interface GetAllOrphanedFilenamesResult {
	filenames: string[];
	totalSize: number;
}

/**
 * Gets all orphaned media filenames (without pagination)
 *
 * This function returns all filenames of orphaned files for bulk operations
 */
export const tryGetAllOrphanedFilenames = Result.wrap(
	async (
		args: GetAllOrphanedFilenamesArgs,
	): Promise<GetAllOrphanedFilenamesResult> => {
		const {
			payload,
			s3Client,
			user = null,
			req,
			overrideAccess = false,
		} = args;
		// Get all filenames from database
		const allMediaResult = await payload.find({
			collection: "media",
			limit: 10000, // Large limit to get all media filenames
			depth: 0,
			user,
			req,
			overrideAccess,
		});

		const dbFilenames = new Set<string>();
		for (const media of allMediaResult.docs) {
			if (media.filename) {
				dbFilenames.add(media.filename);
			}
		}

		// List all objects in S3 (handle pagination)
		const s3Files: Array<{ Key: string; Size: number }> = [];
		let continuationToken: string | undefined;

		do {
			const listCommand = new ListObjectsV2Command({
				Bucket: envVars.S3_BUCKET.value,
				ContinuationToken: continuationToken,
			});

			const listResponse = await s3Client.send(listCommand);

			if (listResponse.Contents) {
				for (const obj of listResponse.Contents) {
					if (obj.Key && obj.Size !== undefined) {
						s3Files.push({
							Key: obj.Key,
							Size: obj.Size,
						});
					}
				}
			}

			continuationToken = listResponse.NextContinuationToken;
		} while (continuationToken);

		// Find orphaned files (in S3 but not in database)
		const orphanedFiles = s3Files.filter((file) => !dbFilenames.has(file.Key));

		// Calculate total size
		const totalSize = orphanedFiles.reduce((sum, file) => sum + file.Size, 0);

		return {
			filenames: orphanedFiles.map((file) => file.Key),
			totalSize,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get all orphaned filenames", {
			cause: error,
		}),
);

export interface PruneAllOrphanedMediaResult {
	deletedCount: number;
	deletedFiles: string[];
	errors: Array<{ filename: string; error: string }>;
}

/**
 * Prunes all orphaned media files from S3
 *
 * This function:
 * 1. Gets all filenames from database
 * 2. Lists all files in S3
 * 3. Identifies orphaned files (in S3 but not in database)
 * 4. Deletes all orphaned files from S3 in batches
 * 5. Returns results with any errors
 */
export type PruneAllOrphanedMediaArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
};

export const tryPruneAllOrphanedMedia = Result.wrap(
	async (
		args: PruneAllOrphanedMediaArgs,
	): Promise<PruneAllOrphanedMediaResult> => {
		const {
			payload,
			s3Client,
			user = null,
			req,
			overrideAccess = false,
		} = args;
		// Get all filenames from database
		const allMediaResult = await payload.find({
			collection: "media",
			limit: 10000, // Large limit to get all media filenames
			depth: 0,
			user,
			req,
			overrideAccess,
		});

		const dbFilenames = new Set<string>();
		for (const media of allMediaResult.docs) {
			if (media.filename) {
				dbFilenames.add(media.filename);
			}
		}

		// List all objects in S3 (handle pagination)
		const s3Files: Array<{ Key: string }> = [];
		let continuationToken: string | undefined;

		do {
			const listCommand = new ListObjectsV2Command({
				Bucket: envVars.S3_BUCKET.value,
				ContinuationToken: continuationToken,
			});

			const listResponse = await s3Client.send(listCommand);

			if (listResponse.Contents) {
				for (const obj of listResponse.Contents) {
					if (obj.Key) {
						s3Files.push({
							Key: obj.Key,
						});
					}
				}
			}

			continuationToken = listResponse.NextContinuationToken;
		} while (continuationToken);

		// Find orphaned files (in S3 but not in database)
		const orphanedFilenames = s3Files
			.filter((file) => !dbFilenames.has(file.Key))
			.map((file) => file.Key);

		if (orphanedFilenames.length === 0) {
			return {
				deletedCount: 0,
				deletedFiles: [],
				errors: [],
			};
		}

		// Delete files from S3 in batches (S3 allows up to 1000 objects per request)
		const batchSize = 1000;
		const deletedFiles: string[] = [];
		const errors: Array<{ filename: string; error: string }> = [];

		for (let i = 0; i < orphanedFilenames.length; i += batchSize) {
			const batch = orphanedFilenames.slice(i, i + batchSize);

			const deleteCommand = new DeleteObjectsCommand({
				Bucket: envVars.S3_BUCKET.value,
				Delete: {
					Objects: batch.map((filename) => ({ Key: filename })),
				},
			});

			try {
				const deleteResponse = await s3Client.send(deleteCommand);

				if (deleteResponse.Deleted) {
					for (const deleted of deleteResponse.Deleted) {
						if (deleted.Key) {
							deletedFiles.push(deleted.Key);
						}
					}
				}

				if (deleteResponse.Errors) {
					for (const error of deleteResponse.Errors) {
						if (error.Key) {
							errors.push({
								filename: error.Key,
								error: error.Message || "Unknown error",
							});
						}
					}
				}
			} catch {
				// If batch deletion fails, try individual deletions
				for (const filename of batch) {
					try {
						const singleDeleteCommand = new DeleteObjectCommand({
							Bucket: envVars.S3_BUCKET.value,
							Key: filename,
						});

						await s3Client.send(singleDeleteCommand);
						deletedFiles.push(filename);
					} catch (singleError) {
						errors.push({
							filename,
							error:
								singleError instanceof Error
									? singleError.message
									: "Unknown error",
						});
					}
				}
			}
		}

		return {
			deletedCount: deletedFiles.length,
			deletedFiles,
			errors,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to prune all orphaned media", {
			cause: error,
		}),
);

export type DeleteOrphanedMediaArgs = BaseInternalFunctionArgs & {
	s3Client: S3Client;
	filenames: string[];
};

export interface DeleteOrphanedMediaResult {
	deletedCount: number;
	deletedFiles: string[];
	errors: Array<{ filename: string; error: string }>;
}

/**
 * Deletes orphaned media files from S3
 *
 * This function:
 * 1. Validates that files are actually orphaned (not in database)
 * 2. Deletes files from S3 in batches
 * 3. Returns results with any errors
 */
export const tryDeleteOrphanedMedia = Result.wrap(
	async (args: DeleteOrphanedMediaArgs): Promise<DeleteOrphanedMediaResult> => {
		const {
			payload,
			s3Client,
			filenames,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!filenames || filenames.length === 0) {
			throw new InvalidArgumentError("At least one filename is required");
		}

		// Get all filenames from database to verify files are orphaned
		const allMediaResult = await payload.find({
			collection: "media",
			where: {
				filename: {
					in: filenames,
				},
			},
			limit: filenames.length,
			depth: 0,
			user,
			req,
			overrideAccess,
		});

		const dbFilenames = new Set<string>();
		for (const media of allMediaResult.docs) {
			if (media.filename) {
				dbFilenames.add(media.filename);
			}
		}

		// Filter out files that exist in database
		const orphanedFilenames = filenames.filter(
			(filename) => !dbFilenames.has(filename),
		);

		if (orphanedFilenames.length === 0) {
			throw new InvalidArgumentError(
				"All specified files exist in the database and cannot be deleted as orphaned files",
			);
		}

		// Delete files from S3 in batches (S3 allows up to 1000 objects per request)
		const batchSize = 1000;
		const deletedFiles: string[] = [];
		const errors: Array<{ filename: string; error: string }> = [];

		for (let i = 0; i < orphanedFilenames.length; i += batchSize) {
			const batch = orphanedFilenames.slice(i, i + batchSize);

			const deleteCommand = new DeleteObjectsCommand({
				Bucket: envVars.S3_BUCKET.value,
				Delete: {
					Objects: batch.map((filename) => ({ Key: filename })),
				},
			});

			try {
				const deleteResponse = await s3Client.send(deleteCommand);

				if (deleteResponse.Deleted) {
					for (const deleted of deleteResponse.Deleted) {
						if (deleted.Key) {
							deletedFiles.push(deleted.Key);
						}
					}
				}

				if (deleteResponse.Errors) {
					for (const error of deleteResponse.Errors) {
						if (error.Key) {
							errors.push({
								filename: error.Key,
								error: error.Message || "Unknown error",
							});
						}
					}
				}
			} catch {
				// If batch deletion fails, try individual deletions
				for (const filename of batch) {
					try {
						const singleDeleteCommand = new DeleteObjectCommand({
							Bucket: envVars.S3_BUCKET.value,
							Key: filename,
						});

						await s3Client.send(singleDeleteCommand);
						deletedFiles.push(filename);
					} catch (singleError) {
						errors.push({
							filename,
							error:
								singleError instanceof Error
									? singleError.message
									: "Unknown error",
						});
					}
				}
			}
		}

		return {
			deletedCount: deletedFiles.length,
			deletedFiles,
			errors,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete orphaned media", {
			cause: error,
		}),
);

export interface MediaUsage {
	collection: string;
	documentId: number;
	fieldPath: string; // e.g., "avatar", "thumbnail", "attachments.0.file"
}

export type FindMediaUsagesArgs = BaseInternalFunctionArgs & {
	mediaId: number | string;
};

export interface FindMediaUsagesResult {
	usages: MediaUsage[];
	totalUsages: number;
}

/**
 * Finds all usages of a media file across all collections
 *
 * This function:
 * 1. Validates that the media exists
 * 2. Searches through all collections that reference media
 * 3. Handles both direct relationship fields and array fields
 * 4. Returns all usages with collection name, document ID, and field path
 */
export const tryFindMediaUsages = Result.wrap(
	async (args: FindMediaUsagesArgs): Promise<FindMediaUsagesResult> => {
		const { payload, mediaId } = args;

		// Validate media ID
		if (!mediaId) {
			throw new InvalidArgumentError("Media ID is required");
		}

		// Normalize media ID to number for comparison
		const normalizedMediaId =
			typeof mediaId === "string" ? Number.parseInt(mediaId, 10) : mediaId;

		if (Number.isNaN(normalizedMediaId)) {
			throw new InvalidArgumentError("Invalid media ID format");
		}

		// Verify media exists
		const mediaResult = await tryGetMediaById({
			payload,
			id: mediaId,
			depth: 0,
			user: args.user,
			req: args.req,
			overrideAccess: args.overrideAccess ?? false,
		});

		if (!mediaResult.ok) {
			throw mediaResult.error;
		}

		// Helper function to extract media ID from logo field
		const getLogoId = (logo: unknown): number | null => {
			if (logo === null || logo === undefined) return null;
			if (typeof logo === "number") return logo;
			if (typeof logo === "object" && logo !== null && "id" in logo) {
				return typeof logo.id === "number" ? logo.id : null;
			}
			return null;
		};

		// Run all queries in parallel using Promise.all
		const [
			usersResult,
			coursesThumbnailResult,
			assignmentSubmissionsResult,
			discussionSubmissionsResult,
			notesResult,
			pagesResult,
			coursesMediaResult,
			appearanceSettings,
		] = await Promise.all([
			// Search users collection for avatar field
			payload.find({
				collection: "users",
				where: {
					avatar: {
						equals: normalizedMediaId,
					},
				},
				depth: 0,
				limit: 10000,
				user: args.user,
				req: args.req,
				overrideAccess: true,
			}),
			// Search courses collection for thumbnail field
			payload.find({
				collection: "courses",
				where: {
					thumbnail: {
						equals: normalizedMediaId,
					},
				},
				depth: 0,
				limit: 10000,
				user: args.user,
				req: args.req,
				overrideAccess: true,
			}),
			// Search assignment-submissions collection for attachments array
			payload.find({
				collection: "assignment-submissions",
				depth: 0,
				limit: 10000,
				user: args.user,
				req: args.req,
				overrideAccess: true,
			}),
			// Search discussion-submissions collection for attachments array
			payload.find({
				collection: "discussion-submissions",
				depth: 0,
				limit: 10000,
				user: args.user,
				req: args.req,
				overrideAccess: true,
			}),
			// Search notes collection for media array
			payload.find({
				collection: "notes",
				depth: 0,
				limit: 10000,
				user: args.user,
				req: args.req,
				overrideAccess: true,
			}),
			// Search pages collection for media array
			payload.find({
				collection: "pages",
				depth: 0,
				limit: 10000,
				user: args.user,
				req: args.req,
				overrideAccess: true,
			}),
			// Search courses collection for media array
			payload.find({
				collection: "courses",
				depth: 0,
				limit: 10000,
				user: args.user,
				req: args.req,
				overrideAccess: true,
			}),
			// Search appearance-settings global for logo fields
			payload.findGlobal({
				slug: "appearance-settings",
				user: args.user,
				req: args.req,
				overrideAccess: true,
			}),
		]);

		const usages: MediaUsage[] = [];

		// Process users collection results
		for (const user of usersResult.docs) {
			usages.push({
				collection: "users",
				documentId: user.id,
				fieldPath: "avatar",
			});
		}

		// Process courses collection thumbnail results
		for (const course of coursesThumbnailResult.docs) {
			usages.push({
				collection: "courses",
				documentId: course.id,
				fieldPath: "thumbnail",
			});
		}

		// Process assignment-submissions collection results
		for (const submission of assignmentSubmissionsResult.docs) {
			if (submission.attachments && Array.isArray(submission.attachments)) {
				for (let i = 0; i < submission.attachments.length; i++) {
					const attachment = submission.attachments[i];
					if (
						attachment &&
						typeof attachment === "object" &&
						"file" in attachment
					) {
						const fileId =
							typeof attachment.file === "number"
								? attachment.file
								: attachment.file?.id;
						if (fileId === normalizedMediaId) {
							usages.push({
								collection: "assignment-submissions",
								documentId: submission.id,
								fieldPath: `attachments.${i}.file`,
							});
						}
					}
				}
			}
		}

		// Process discussion-submissions collection results
		for (const submission of discussionSubmissionsResult.docs) {
			if (submission.attachments && Array.isArray(submission.attachments)) {
				for (let i = 0; i < submission.attachments.length; i++) {
					const attachment = submission.attachments[i];
					if (
						attachment &&
						typeof attachment === "object" &&
						"file" in attachment
					) {
						const fileId =
							typeof attachment.file === "number"
								? attachment.file
								: attachment.file?.id;
						if (fileId === normalizedMediaId) {
							usages.push({
								collection: "discussion-submissions",
								documentId: submission.id,
								fieldPath: `attachments.${i}.file`,
							});
						}
					}
				}
			}
		}

		// Process notes collection results
		for (const note of notesResult.docs) {
			if (note.media && Array.isArray(note.media)) {
				for (let i = 0; i < note.media.length; i++) {
					const mediaItem = note.media[i];
					const mediaId =
						typeof mediaItem === "number" ? mediaItem : mediaItem?.id;
					if (mediaId === normalizedMediaId) {
						usages.push({
							collection: "notes",
							documentId: note.id,
							fieldPath: `media.${i}`,
						});
					}
				}
			}
		}

		// Process pages collection results
		for (const page of pagesResult.docs) {
			if (page.media && Array.isArray(page.media)) {
				for (let i = 0; i < page.media.length; i++) {
					const mediaItem = page.media[i];
					const mediaId =
						typeof mediaItem === "number" ? mediaItem : mediaItem?.id;
					if (mediaId === normalizedMediaId) {
						usages.push({
							collection: "pages",
							documentId: page.id,
							fieldPath: `media.${i}`,
						});
					}
				}
			}
		}

		// Process courses collection media array results
		for (const course of coursesMediaResult.docs) {
			if (course.media && Array.isArray(course.media)) {
				for (let i = 0; i < course.media.length; i++) {
					const mediaItem = course.media[i];
					const mediaId =
						typeof mediaItem === "number" ? mediaItem : mediaItem?.id;
					if (mediaId === normalizedMediaId) {
						usages.push({
							collection: "courses",
							documentId: course.id,
							fieldPath: `media.${i}`,
						});
					}
				}
			}
		}

		// Process appearance-settings global results
		if (appearanceSettings) {
			// Check all 6 logo fields
			const logoFields = [
				{ field: "logoLight", fieldPath: "logoLight" },
				{ field: "logoDark", fieldPath: "logoDark" },
				{ field: "compactLogoLight", fieldPath: "compactLogoLight" },
				{ field: "compactLogoDark", fieldPath: "compactLogoDark" },
				{ field: "faviconLight", fieldPath: "faviconLight" },
				{ field: "faviconDark", fieldPath: "faviconDark" },
			] as const;

			for (const { field, fieldPath } of logoFields) {
				const logoId = getLogoId(
					appearanceSettings[field as keyof typeof appearanceSettings],
				);
				if (logoId === normalizedMediaId) {
					usages.push({
						collection: "appearance-settings",
						documentId: appearanceSettings.id,
						fieldPath,
					});
				}
			}
		}

		return {
			usages,
			totalUsages: usages.length,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find media usages", {
			cause: error,
		}),
);
