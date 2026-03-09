import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateFile,
	tryUpdateFile,
	tryFindFileById,
	trySearchFiles,
	tryDeleteFile,
	tryFindFilesByUser,
} from "../services/file-management";
import type { OrpcContext } from "../orpc/context";

const outputSchema = z.any();

const createFileSchema = z.object({
	data: z.object({
		title: z.string().min(1).max(500),
		description: z.string().optional(),
		media: z.array(z.coerce.number().int().min(1)).optional(),
		createdBy: z.coerce.number().int().min(1),
	}),
});

const updateFileSchema = z.object({
	fileId: z.coerce.number().int().min(1),
	data: z.object({
		title: z.string().min(1).max(500).optional(),
		description: z.string().optional(),
		media: z.array(z.coerce.number().int().min(1)).optional(),
	}),
});

const fileIdSchema = z.object({
	fileId: z.coerce.number().int().min(1),
});

const searchFilesSchema = z.object({
	filters: z
		.object({
			createdBy: z.coerce.number().int().min(1).optional(),
			title: z.string().optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
			page: z.coerce.number().int().min(1).optional(),
		})
		.optional(),
});

const userIdSchema = z.object({
	userId: z.coerce.number().int().min(1),
	limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createFile = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/files" })
	.input(createFileSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryCreateFile({
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

export const updateFile = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/files/{fileId}" })
	.input(updateFileSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryUpdateFile({
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

export const findFileById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/files/{fileId}" })
	.input(fileIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindFileById({
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

export const searchFiles = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/files/search" })
	.input(searchFilesSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await trySearchFiles({
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

export const deleteFile = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/files/{fileId}" })
	.input(fileIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryDeleteFile({
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

export const findFilesByUser = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/files/by-user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindFilesByUser({
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
