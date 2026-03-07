import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateNote,
	tryUpdateNote,
	tryFindNoteById,
	trySearchNotes,
	tryDeleteNote,
	tryFindNotesByUser,
	tryGenerateNoteHeatmap,
} from "../services/note-management";
import type { OrpcContext } from "../orpc/context";

const outputSchema = z.any();

const createNoteSchema = z.object({
	data: z.object({
		content: z.string().min(1),
		createdBy: z.coerce.number().int().min(1),
		isPublic: z.boolean().optional(),
	}),
});

const updateNoteSchema = z.object({
	noteId: z.coerce.number().int().min(1),
	data: z.object({
		content: z.string().optional(),
		isPublic: z.boolean().optional(),
	}),
});

const noteIdSchema = z.object({
	noteId: z.coerce.number().int().min(1),
});

const searchNotesSchema = z.object({
	filters: z
		.object({
			createdBy: z.coerce.number().int().min(1).optional(),
			content: z.string().optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
			page: z.coerce.number().int().min(1).optional(),
		})
		.optional(),
});

const userIdSchema = z.object({
	userId: z.coerce.number().int().min(1),
	limit: z.coerce.number().int().min(1).max(100).optional(),
});

const heatmapSchema = z.object({
	userId: z.coerce.number().int().min(1),
});

export const createNote = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/notes" })
	.input(createNoteSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryCreateNote({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const updateNote = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/notes/{noteId}" })
	.input(updateNoteSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryUpdateNote({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const findNoteById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/notes/{noteId}" })
	.input(noteIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindNoteById({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const searchNotes = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/notes/search" })
	.input(searchNotesSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await trySearchNotes({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const deleteNote = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/notes/{noteId}" })
	.input(noteIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryDeleteNote({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const findNotesByUser = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/notes/by-user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindNotesByUser({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const generateNoteHeatmap = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/notes/heatmap/{userId}" })
	.input(heatmapSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGenerateNoteHeatmap({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});
