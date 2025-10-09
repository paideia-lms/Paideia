import type { Payload } from "payload";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";

export interface CreateNoteArgs {
	content: string;
	createdBy: number;
	isPublic?: boolean;
}

export interface UpdateNoteArgs {
	content?: string;
	isPublic?: boolean;
}

export interface SearchNotesArgs {
	createdBy?: number;
	content?: string;
	limit?: number;
	page?: number;
}

/**
 * Creates a new note using Payload local API
 * Requires authenticated request to enforce access control
 */
export const tryCreateNote = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		args: CreateNoteArgs,
		overrideAccess: boolean = false,
	) => {
		const { content, createdBy, isPublic = false } = args;

		// Validate content is not empty
		if (!content || content.trim().length === 0) {
			throw new Error("Note content cannot be empty");
		}

		// Verify user exists
		const user = await payload.findByID({
			collection: "users",
			id: createdBy,
			overrideAccess: true, // Always allow checking if user exists
			req: request,
		});

		if (!user) {
			throw new Error(`User with ID ${createdBy} not found`);
		}

		// Payload automatically authenticates via Authorization header
		const newNote = await payload.create({
			collection: "notes",
			data: {
				content: content.trim(),
				createdBy,
				isPublic,
			},
			overrideAccess,
			req: request,
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
 * Requires authenticated request to enforce access control
 */
export const tryUpdateNote = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		noteId: number,
		args: UpdateNoteArgs,
		overrideAccess: boolean = false,
	) => {
		// Check if note exists and user has permission to update it
		// Payload automatically authenticates via Authorization header
		const existingNote = await payload.findByID({
			collection: "notes",
			id: noteId,
			overrideAccess,
			req: request,
		});

		if (!existingNote) {
			throw new Error(`Note with ID ${noteId} not found`);
		}

		// Validate content if provided
		if (args.content !== undefined) {
			if (!args.content || args.content.trim().length === 0) {
				throw new Error("Note content cannot be empty");
			}
		}

		const updateData: Record<string, string | boolean | undefined> = {};
		if (args.content !== undefined) {
			updateData.content = args.content.trim();
		}
		if (args.isPublic !== undefined) {
			updateData.isPublic = args.isPublic;
		}

		const updatedNote = await payload.update({
			collection: "notes",
			id: noteId,
			data: updateData,
			overrideAccess,
			req: request,
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
 * If request is provided, enforces access control (user can only read their own notes or public notes)
 */
export const tryFindNoteById = Result.wrap(
	async (
		payload: Payload,
		noteId: number,
		request?: Request,
		overrideAccess: boolean = false,
	) => {
		// Payload automatically authenticates via Authorization header
		const note = await payload.findByID({
			collection: "notes",
			id: noteId,
			req: request,
			overrideAccess,
		});

		if (!note) {
			throw new Error(`Note with ID ${noteId} not found`);
		}

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
 * If request is provided, enforces access control (user can only see their own notes or public notes)
 */
export const trySearchNotes = Result.wrap(
	async (
		payload: Payload,
		args: SearchNotesArgs = {},
		request?: Request,
		overrideAccess: boolean = false,
	) => {
		const { createdBy, content, limit = 10, page = 1 } = args;

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

		// Payload automatically authenticates via Authorization header
		const notes = await payload.find({
			collection: "notes",
			where,
			limit,
			page,
			sort: "-createdAt",
			req: request,
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
 * Requires authenticated request to enforce access control
 */
export const tryDeleteNote = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		noteId: number,
		overrideAccess: boolean = false,
	) => {
		// Payload automatically authenticates via Authorization header
		// Access control is enforced by Payload's access control hooks
		const deletedNote = await payload.delete({
			collection: "notes",
			id: noteId,
			req: request,
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
 */
export const tryFindNotesByUser = Result.wrap(
	async (
		payload: Payload,
		userId: number,
		limit: number = 10,
		request: Request,
		overrideAccess: boolean = false,
	) => {
		const notes = await payload.find({
			collection: "notes",
			where: {
				createdBy: {
					equals: userId,
				},
			},
			limit,
			sort: "-createdAt",
			overrideAccess,
			req: request,
		});

		return notes.docs;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find notes by user", {
			cause: error,
		}),
);
