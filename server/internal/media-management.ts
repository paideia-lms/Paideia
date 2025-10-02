import "@total-typescript/ts-reset";
import type { Payload } from "payload";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	NonExistingMediaError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Media } from "../payload-types";

export interface CreateMediaArgs {
	file: Buffer;
	filename: string;
	mimeType: string;
	alt?: string;
	caption?: string;
	userId: number;
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
		const { file, filename, mimeType, alt, caption, userId } = args;

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

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

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
				},
				file: {
					data: file,
					name: filename,
					size: file.length,
					mimetype: mimeType,
				},
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return {
				media,
			};
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
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
			where: where as Record<string, any>, // Type assertion for Payload's where clause
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
	id: number;
	userId: number;
}

/**
 * Deletes a media record
 *
 * This function:
 * 1. Validates the media record exists
 * 2. Deletes the media record
 * 3. Uses transactions to ensure atomicity
 */
export const tryDeleteMedia = Result.wrap(
	async (payload: Payload, args: DeleteMediaArgs): Promise<Media> => {
		const { id, userId } = args;

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

			// Delete the media record
			await payload.delete({
				collection: "media",
				id,
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return media;
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
