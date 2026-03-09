import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateWhiteboard,
	tryUpdateWhiteboard,
	tryFindWhiteboardById,
	trySearchWhiteboards,
	tryDeleteWhiteboard,
	tryFindWhiteboardsByUser,
} from "../services/whiteboard-management";
import type { OrpcContext } from "../orpc/context";

const outputSchema = z.any();

const createWhiteboardSchema = z.object({
	data: z.object({
		title: z.string().min(1).max(500),
		description: z.string().optional(),
		content: z.string().optional(),
		createdBy: z.coerce.number().int().min(1),
	}),
});

const updateWhiteboardSchema = z.object({
	whiteboardId: z.coerce.number().int().min(1),
	data: z.object({
		title: z.string().min(1).max(500).optional(),
		description: z.string().optional(),
		content: z.string().optional(),
	}),
});

const whiteboardIdSchema = z.object({
	whiteboardId: z.coerce.number().int().min(1),
});

const searchWhiteboardsSchema = z.object({
	filters: z
		.object({
			createdBy: z.coerce.number().int().min(1).optional(),
			title: z.string().optional(),
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

export const createWhiteboard = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/whiteboards" })
	.input(createWhiteboardSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryCreateWhiteboard({
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

export const updateWhiteboard = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/whiteboards/{whiteboardId}" })
	.input(updateWhiteboardSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryUpdateWhiteboard({
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

export const findWhiteboardById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/whiteboards/{whiteboardId}" })
	.input(whiteboardIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindWhiteboardById({
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

export const searchWhiteboards = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/whiteboards/search" })
	.input(searchWhiteboardsSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await trySearchWhiteboards({
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

export const deleteWhiteboard = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/whiteboards/{whiteboardId}" })
	.input(whiteboardIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryDeleteWhiteboard({
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

export const findWhiteboardsByUser = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/whiteboards/by-user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindWhiteboardsByUser({
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
