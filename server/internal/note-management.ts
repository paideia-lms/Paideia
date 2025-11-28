import dayjs from "dayjs";
import { Notes } from "server/collections";
import { assertZodInternal, MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import { handleTransactionId } from "./utils/handle-transaction-id";
import { tryParseMediaFromHtml } from "./utils/parse-media-from-html";

export interface CreateNoteArgs extends BaseInternalFunctionArgs {
	data: {
		content: string;
		createdBy: number;
		isPublic?: boolean;
	};
}

export interface UpdateNoteArgs extends BaseInternalFunctionArgs {
	noteId: number;
	data: {
		content?: string;
		isPublic?: boolean;
	};
}

export interface FindNoteByIdArgs extends BaseInternalFunctionArgs {
	noteId: number;
}

export interface SearchNotesArgs extends BaseInternalFunctionArgs {
	filters?: {
		createdBy?: number;
		content?: string;
		limit?: number;
		page?: number;
	};
}

export interface DeleteNoteArgs extends BaseInternalFunctionArgs {
	noteId: number;
}

export interface FindNotesByUserArgs extends BaseInternalFunctionArgs {
	userId: number;
	limit?: number;
}

/**
 * Creates a new note using Payload local API
 */
export const tryCreateNote = Result.wrap(
	async (args: CreateNoteArgs) => {
		const {
			payload,
			data: { content, createdBy, isPublic = false },
			req,
			overrideAccess = false,
		} = args;

		// Validate content is not empty
		if (!content || content.trim().length === 0) {
			throw new Error("Note content cannot be empty");
		}

		// Handle transaction
		const transactionInfo = await handleTransactionId(payload, req);

		return await transactionInfo.tx(async (txInfo) => {
			// Parse media from HTML content
			const mediaParseResult = tryParseMediaFromHtml(
				content.trim(),
			).getOrThrow();

			const { ids: parsedIds, filenames } = mediaParseResult;

			// Resolve filenames to IDs in a single query
			let resolvedIds: number[] = [];
			if (filenames.length > 0) {
				try {
					const mediaResult = await payload
						.find({
							collection: "media",
							where: {
								filename: {
									in: filenames,
								},
							},
							limit: filenames.length,
							depth: 0,
							pagination: false,
							// ! this is a system request so should be safe
							overrideAccess: true,
							req: txInfo.reqWithTransaction,
						})
						.then(stripDepth<0, "find">());

					resolvedIds = mediaResult.docs.map((doc) => doc.id);
				} catch (error) {
					// If media lookup fails, log warning but continue
					console.warn(`Failed to resolve media filenames to IDs:`, error);
				}
			}

			// Combine parsed IDs and resolved IDs
			const mediaIds = [...parsedIds, ...resolvedIds];

			// Create note with access control
			const newNote = await payload
				.create({
					collection: "notes",
					data: {
						content: content.trim(),
						createdBy,
						isPublic,
						media: mediaIds.length > 0 ? mediaIds : undefined,
					},
					req: txInfo.reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "create">());

			return newNote;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create note", {
			cause: error,
		}),
);

/**
 * Updates an existing note using Payload local API
 */
export const tryUpdateNote = Result.wrap(
	async (args: UpdateNoteArgs) => {
		const { payload, noteId, data, req, overrideAccess = false } = args;

		// Handle transaction
		const transactionInfo = await handleTransactionId(payload, req);

		return await transactionInfo.tx(async (txInfo) => {
			// Validate content if provided
			if (data.content !== undefined) {
				if (!data.content || data.content.trim().length === 0) {
					throw new Error("Note content cannot be empty");
				}
			}

			const updateData: Record<
				string,
				string | boolean | number[] | undefined
			> = {};
			if (data.content !== undefined) {
				updateData.content = data.content.trim();

				// Parse media from updated HTML content
				const mediaParseResult = tryParseMediaFromHtml(
					data.content.trim(),
				).getOrThrow();

				const { ids: parsedIds, filenames } = mediaParseResult;

				// Resolve filenames to IDs in a single query
				let resolvedIds: number[] = [];
				if (filenames.length > 0) {
					const mediaResult = await payload
						.find({
							collection: "media",
							where: {
								filename: {
									in: filenames,
								},
							},
							limit: filenames.length,
							depth: 0,
							pagination: false,
							// ! this is a system request so should be safe
							overrideAccess: true,
							req: txInfo.reqWithTransaction,
						})
						.then(stripDepth<0, "find">());

					resolvedIds = mediaResult.docs.map((doc) => doc.id);
				}

				// Combine parsed IDs and resolved IDs
				const mediaIds = [...parsedIds, ...resolvedIds];
				updateData.media = mediaIds.length > 0 ? mediaIds : [];
			}
			if (data.isPublic !== undefined) {
				updateData.isPublic = data.isPublic;
			}

			const updatedNote = await payload
				.update({
					collection: "notes",
					id: noteId,
					data: updateData,
					req: txInfo.reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			return updatedNote;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update note", {
			cause: error,
		}),
);

/**
 * Finds a note by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindNoteById = Result.wrap(
	async (args: FindNoteByIdArgs) => {
		const { payload, noteId, req, overrideAccess = false } = args;

		// Find note with access control
		const note = await payload
			.findByID({
				collection: Notes.slug,
				id: noteId,
				req,
				overrideAccess,
				depth: 1,
			})
			.then(stripDepth<1, "findByID">());

		return note;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find note by ID", {
			cause: error,
		}),
);

/**
 * Searches notes with various filters
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const trySearchNotes = Result.wrap(
	async (args: SearchNotesArgs) => {
		const {
			payload,
			filters = {},

			req,
			overrideAccess = false,
		} = args;

		const { createdBy, content, limit = 10, page = 1 } = filters;

		const where: Record<string, { equals?: number; contains?: string }> = {};

		if (createdBy) {
			where.createdBy = {
				equals: createdBy,
			};
		}

		if (content) {
			where.content = {
				contains: content,
			};
		}

		// Search notes with access control
		const notes = await payload.find({
			collection: "notes",
			where,
			limit,
			page,
			sort: "-createdAt",
			req,
			overrideAccess,
		});

		return {
			docs: notes.docs,
			totalDocs: notes.totalDocs,
			totalPages: notes.totalPages,
			page: notes.page,
			limit: notes.limit,
			hasNextPage: notes.hasNextPage,
			hasPrevPage: notes.hasPrevPage,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to search notes", {
			cause: error,
		}),
);

/**
 * Deletes a note by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryDeleteNote = Result.wrap(
	async (args: DeleteNoteArgs) => {
		const { payload, noteId, req, overrideAccess = false } = args;

		// Delete note with access control
		const deletedNote = await payload.delete({
			collection: "notes",
			id: noteId,
			req,
			overrideAccess,
		});

		return deletedNote;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete note", {
			cause: error,
		}),
);

/**
 * Finds notes by user ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindNotesByUser = Result.wrap(
	async (args: FindNotesByUserArgs) => {
		const {
			payload,
			userId,
			limit = 10,

			req,
			overrideAccess = false,
		} = args;

		// Find notes with access control
		const notes = await payload.find({
			collection: "notes",
			where: {
				createdBy: {
					equals: userId,
				},
			},
			limit,
			sort: "-createdAt",
			req,
			overrideAccess,
		});

		return notes.docs;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find notes by user", {
			cause: error,
		}),
);

export interface GenerateNoteHeatmapArgs extends BaseInternalFunctionArgs {
	userId: number;
}

/**
 * Generates heatmap data for user's note activity
 * Returns heatmap data (date -> count), available years, and all notes
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryGenerateNoteHeatmap = Result.wrap(
	async (args: GenerateNoteHeatmapArgs) => {
		const { payload, userId, req, overrideAccess = false } = args;

		// Fetch all notes for the user
		const notes = await payload
			.find({
				collection: "notes",
				where: {
					createdBy: { equals: userId },
				},
				limit: MOCK_INFINITY,
				sort: "-createdAt",
				req,
				overrideAccess,
			})
			.then(stripDepth<1, "find">());

		const heatmapData: Record<string, number> = {};
		const availableYears: number[] = [];

		notes.docs.forEach((note) => {
			const date = dayjs(note.createdAt).format("YYYY-MM-DD");
			heatmapData[date] = (heatmapData[date] || 0) + 1;

			const year = dayjs(note.createdAt).year();
			if (!availableYears.includes(year)) {
				availableYears.push(year);
			}
		});

		availableYears.sort((a, b) => b - a);

		return {
			heatmapData,
			availableYears,
			notes: notes.docs,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to generate note heatmap", {
			cause: error,
		}),
);
