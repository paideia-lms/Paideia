import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreatePage,
	tryUpdatePage,
	tryFindPageById,
	trySearchPages,
	tryDeletePage,
	tryFindPagesByUser,
} from "../services/page-management";
import type { OrpcContext } from "../../../orpc/context";

const outputSchema = z.any();

const createPageSchema = z.object({
	data: z.object({
		title: z.string().min(1).max(500),
		description: z.string().optional(),
		content: z.string().optional(),
		createdBy: z.coerce.number().int().min(1),
	}),
});

const updatePageSchema = z.object({
	pageId: z.coerce.number().int().min(1),
	data: z.object({
		title: z.string().min(1).max(500).optional(),
		description: z.string().optional(),
		content: z.string().optional(),
	}),
});

const pageIdSchema = z.object({
	pageId: z.coerce.number().int().min(1),
});

const searchPagesSchema = z.object({
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

export const createPage = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/pages" })
	.input(createPageSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryCreatePage({
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

export const updatePage = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/pages/{pageId}" })
	.input(updatePageSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryUpdatePage({
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

export const findPageById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/pages/{pageId}" })
	.input(pageIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindPageById({
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

export const searchPages = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/pages/search" })
	.input(searchPagesSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await trySearchPages({
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

export const deletePage = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/pages/{pageId}" })
	.input(pageIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryDeletePage({
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

export const findPagesByUser = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/pages/by-user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindPagesByUser({
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
