import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryGetMediaById,
	tryGetMediaByFilenames,
	tryGetMediaByIds,
	tryGetAllMedia,
	tryDeleteMedia,
	tryGetMediaByMimeType,
	tryFindMediaByUser,
	tryRenameMedia,
	tryGetUserMediaStats,
	tryGetSystemMediaStats,
	tryGetOrphanedMedia,
	tryGetAllOrphanedFilenames,
	tryFindMediaUsages,
} from "../services/media-management";
import type { OrpcContext } from "../orpc/context";

const outputSchema = z.any();

const idSchema = z.object({ id: z.coerce.number().int().min(1) });
const filenamesSchema = z.object({ filenames: z.array(z.string()).min(1) });
const idsSchema = z.object({ ids: z.array(z.coerce.number().int().min(1)).min(1) });

const getAllSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
	sort: z.string().optional(),
	where: z.record(z.string(), z.any()).optional(),
});

const mimeTypeSchema = z.object({
	mimeType: z.string(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const userIdSchema = z.object({
	userId: z.coerce.number().int().min(1),
});

const renameSchema = z.object({
	id: z.coerce.number().int().min(1),
	newFilename: z.string().min(1),
});

const orphanedSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const usagesSchema = z.object({
	mediaId: z.coerce.number().int().min(1),
});

export const getMediaById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/{id}" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGetMediaById({
			payload: context.payload,
			id: input.id,
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

export const getMediaByFilenames = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/media/by-filenames" })
	.input(filenamesSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGetMediaByFilenames({
			payload: context.payload,
			filenames: input.filenames,
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

export const getMediaByIds = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/media/by-ids" })
	.input(idsSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGetMediaByIds({
			payload: context.payload,
			ids: input.ids,
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

export const getAllMedia = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media" })
	.input(getAllSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGetAllMedia({
			payload: context.payload,
			limit: input?.limit,
			page: input?.page,
			sort: input?.sort,
			where: input?.where,
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

export const deleteMedia = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/media/{id}" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		if (!context.s3Client) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "S3 client not configured",
			});
		}
		const result = await tryDeleteMedia({
			payload: context.payload,
			s3Client: context.s3Client,
			id: input.id,
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

export const getMediaByMimeType = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/by-mime-type" })
	.input(mimeTypeSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGetMediaByMimeType({
			payload: context.payload,
			mimeType: input.mimeType,
			limit: input.limit,
			page: input.page,
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

export const findMediaByUser = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/by-user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindMediaByUser({
			payload: context.payload,
			userId: input.userId,
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

export const renameMedia = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/media/{id}/rename" })
	.input(renameSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		if (!context.s3Client || !context.user) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "S3 client or user not configured",
			});
		}
		const result = await tryRenameMedia({
			payload: context.payload,
			s3Client: context.s3Client,
			id: input.id,
			newFilename: input.newFilename,
			userId: context.user.id,
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

export const getUserMediaStats = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/stats/user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGetUserMediaStats({
			payload: context.payload,
			userId: input.userId,
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

export const getSystemMediaStats = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/stats/system" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => {
		const result = await tryGetSystemMediaStats({
			payload: context.payload,
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

export const getOrphanedMedia = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/orphaned" })
	.input(orphanedSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		if (!context.s3Client) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "S3 client not configured",
			});
		}
		const result = await tryGetOrphanedMedia({
			payload: context.payload,
			s3Client: context.s3Client,
			limit: input?.limit,
			page: input?.page,
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

export const getAllOrphanedFilenames = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/orphaned/filenames" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => {
		if (!context.s3Client) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "S3 client not configured",
			});
		}
		const result = await tryGetAllOrphanedFilenames({
			payload: context.payload,
			s3Client: context.s3Client,
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

export const findMediaUsages = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/{mediaId}/usages" })
	.input(usagesSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindMediaUsages({
			payload: context.payload,
			mediaId: input.mediaId,
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
