import type { Payload } from "payload";
import { Note } from "server/payload-types";
import { Result } from "typescript-result";

export interface CreateNoteArgs {
	content: string;
	createdBy: number;
}

export interface UpdateNoteArgs {
	content?: string;
}

export interface SearchNotesArgs {
	createdBy?: number;
	content?: string;
	limit?: number;
	page?: number;
}

/**
 * Creates a new note using Payload local API
 */
export const tryCreateNote = Result.wrap(
	async (payload: Payload, request: Request, args: CreateNoteArgs) => {
		const { content, createdBy } = args;

		// Validate content is not empty
		if (!content || content.trim().length === 0) {
			throw new Error("Note content cannot be empty");
		}

		// Verify user exists
		const user = await payload.findByID({
			collection: "users",
			id: createdBy,
			req: request,
		});

		if (!user) {
			throw new Error(`User with ID ${createdBy} not found`);
		}

		const newNote = await payload.create({
			collection: "notes",
			data: {
				content: content.trim(),
				createdBy,
			},
			req: request,
		});

		return newNote;
	},
	(error) =>
		new Error(
			`Failed to create note: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Updates an existing note using Payload local API
 */
export const tryUpdateNote = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		noteId: number,
		args: UpdateNoteArgs,
	) => {
		// Check if note exists
		const existingNote = await payload.findByID({
			collection: "notes",
			id: noteId,
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

		const updatedNote = await payload.update({
			collection: "notes",
			id: noteId,
			data: {
				...args,
				content: args.content?.trim(),
			},
			req: request,
		});

		return updatedNote;
	},
	(error) =>
		new Error(
			`Failed to update note: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a note by ID
 */
export const tryFindNoteById = Result.wrap(
	async (payload: Payload, noteId: number) => {
		const note = await payload.findByID({
			collection: "notes",
			id: noteId,
		});

		if (!note) {
			throw new Error(`Note with ID ${noteId} not found`);
		}

		return note;
	},
	(error) =>
		new Error(
			`Failed to find note by ID: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Searches notes with various filters
 */
export const trySearchNotes = Result.wrap(
	async (payload: Payload, args: SearchNotesArgs = {}) => {
		const { createdBy, content, limit = 10, page = 1 } = args;

		const where: any = {};

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

		const notes = await payload.find({
			collection: "notes",
			where,
			limit,
			page,
			sort: "-createdAt",
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
		new Error(
			`Failed to search notes: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Deletes a note by ID
 */
export const tryDeleteNote = Result.wrap(
	async (payload: Payload, request: Request, noteId: number) => {
		const deletedNote = await payload.delete({
			collection: "notes",
			id: noteId,
			req: request,
		});

		return deletedNote;
	},
	(error) =>
		new Error(
			`Failed to delete note: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds notes by user ID
 */
export const tryFindNotesByUser = Result.wrap(
	async (payload: Payload, userId: number, limit: number = 10) => {
		const notes = await payload.find({
			collection: "notes",
			where: {
				createdBy: {
					equals: userId,
				},
			},
			limit,
			sort: "-createdAt",
		});

		return notes.docs;
	},
	(error) =>
		new Error(
			`Failed to find notes by user: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds notes containing course links ([[course-slug]] syntax)
 */
export const tryFindNotesWithCourseLinks = Result.wrap(
	async (payload: Payload, limit: number = 10) => {
		const notes = await payload.find({
			collection: "notes",
			where: {
				content: {
					contains: "[[",
				},
			},
			limit,
			sort: "-createdAt",
		});

		return notes.docs;
	},
	(error) =>
		new Error(
			`Failed to find notes with course links: ${error instanceof Error ? error.message : String(error)}`,
		),
);
