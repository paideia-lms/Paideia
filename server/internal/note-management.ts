import dayjs from "dayjs";
import type { Payload, TypedUser } from "payload";
import { Notes } from "server/collections";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";

export interface CreateNoteArgs {
	payload: Payload;
	data: {
		content: string;
		createdBy: number;
		isPublic?: boolean;
	};
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface UpdateNoteArgs {
	payload: Payload;
	noteId: number;
	data: {
		content?: string;
		isPublic?: boolean;
	};
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface FindNoteByIdArgs {
	payload: Payload;
	noteId: number;
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface SearchNotesArgs {
	payload: Payload;
	filters?: {
		createdBy?: number;
		content?: string;
		limit?: number;
		page?: number;
	};
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface DeleteNoteArgs {
	payload: Payload;
	noteId: number;
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface FindNotesByUserArgs {
	payload: Payload;
	userId: number;
	limit?: number;
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

/**
 * Creates a new note using Payload local API
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryCreateNote = Result.wrap(
	async (args: CreateNoteArgs) => {
		const {
			payload,
			data: { content, createdBy, isPublic = false },
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate content is not empty
		if (!content || content.trim().length === 0) {
			throw new Error("Note content cannot be empty");
		}

		// Verify user exists
		const userExists = await payload.findByID({
			collection: "users",
			id: createdBy,
			overrideAccess: true, // Always allow checking if user exists
		});

		if (!userExists) {
			throw new Error(`User with ID ${createdBy} not found`);
		}

		// Create note with access control
		const newNote = await payload.create({
			collection: "notes",
			data: {
				content: content.trim(),
				createdBy,
				isPublic,
			},
			user,
			req,
			overrideAccess,
		});

		return newNote;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create note", {
			cause: error,
		}),
);

/**
 * Updates an existing note using Payload local API
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryUpdateNote = Result.wrap(
	async (args: UpdateNoteArgs) => {
		const {
			payload,
			noteId,
			data,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Check if note exists and user has permission to update it
		const existingNote = await payload.findByID({
			collection: "notes",
			id: noteId,
			user,
			req,
			overrideAccess,
		});

		if (!existingNote) {
			throw new Error(`Note with ID ${noteId} not found`);
		}

		// Validate content if provided
		if (data.content !== undefined) {
			if (!data.content || data.content.trim().length === 0) {
				throw new Error("Note content cannot be empty");
			}
		}

		const updateData: Record<string, string | boolean | undefined> = {};
		if (data.content !== undefined) {
			updateData.content = data.content.trim();
		}
		if (data.isPublic !== undefined) {
			updateData.isPublic = data.isPublic;
		}

		const updatedNote = await payload.update({
			collection: "notes",
			id: noteId,
			data: updateData,
			user,
			req,
			overrideAccess,
		});

		return updatedNote;
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
		const { payload, noteId, user = null, req, overrideAccess = false } = args;

		// Find note with access control
		const note = await payload
			.findByID({
				collection: Notes.slug,
				id: noteId,
				user,
				req,
				overrideAccess,
			})
			.then((n) => {
				const createdBy = n.createdBy;
				assertZod(
					createdBy,
					z.object({ id: z.number() }, { error: "Note createdBy is required" }),
				);
				const avatar = createdBy.avatar;
				assertZod(
					avatar,
					z.number({ error: "Note createdBy avatar is required" }).nullish(),
				);
				return {
					...n,
					createdBy: {
						...createdBy,
						avatar,
					},
				};
			});

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
			user = null,
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
			user,
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
		const { payload, noteId, user = null, req, overrideAccess = false } = args;

		// Delete note with access control
		const deletedNote = await payload.delete({
			collection: "notes",
			id: noteId,
			user,
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
			user = null,
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
			user,
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

export interface GenerateNoteHeatmapArgs {
	payload: Payload;
	userId: number;
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

/**
 * Generates heatmap data for user's note activity
 * Returns heatmap data (date -> count), available years, and all notes
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryGenerateNoteHeatmap = Result.wrap(
	async (args: GenerateNoteHeatmapArgs) => {
		const { payload, userId, user = null, req, overrideAccess = false } = args;

		// Fetch all notes for the user
		const notes = await payload.find({
			collection: "notes",
			where: {
				createdBy: { equals: userId },
			},
			limit: 1000,
			sort: "-createdAt",
			user,
			req,
			overrideAccess,
		});

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
