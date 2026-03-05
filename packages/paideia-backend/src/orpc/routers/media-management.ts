import { os } from "@orpc/server";
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
} from "../../modules/user/services/media-management";
import type { OrpcContext } from "../context";
import { handleResult } from "../utils/handler";

const outputSchema = z.any();

const run = <T>(fn: (args: object) => Promise<{ ok: boolean; value?: T; error?: { message: string } }>, args: object) =>
	handleResult(() => fn({ ...args, req: undefined, overrideAccess: true }));

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
	.handler(async ({ input, context }) => run(tryGetMediaById, { payload: context.payload, ...input }));

export const getMediaByFilenames = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/media/by-filenames" })
	.input(filenamesSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetMediaByFilenames, { payload: context.payload, ...input }));

export const getMediaByIds = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/media/by-ids" })
	.input(idsSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetMediaByIds, { payload: context.payload, ...input }));

export const getAllMedia = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media" })
	.input(getAllSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetAllMedia, { payload: context.payload, ...input }));

export const deleteMedia = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/media/{id}" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryDeleteMedia, { payload: context.payload, ...input }));

export const getMediaByMimeType = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/by-mime-type" })
	.input(mimeTypeSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetMediaByMimeType, { payload: context.payload, ...input }));

export const findMediaByUser = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/by-user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryFindMediaByUser, { payload: context.payload, ...input }));

export const renameMedia = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/media/{id}/rename" })
	.input(renameSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryRenameMedia, { payload: context.payload, ...input }));

export const getUserMediaStats = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/stats/user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetUserMediaStats, { payload: context.payload, ...input }));

export const getSystemMediaStats = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/stats/system" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => run(tryGetSystemMediaStats, { payload: context.payload }));

export const getOrphanedMedia = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/orphaned" })
	.input(orphanedSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetOrphanedMedia, { payload: context.payload, ...input }));

export const getAllOrphanedFilenames = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/orphaned/filenames" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => run(tryGetAllOrphanedFilenames, { payload: context.payload }));

export const findMediaUsages = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/media/{mediaId}/usages" })
	.input(usagesSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryFindMediaUsages, { payload: context.payload, ...input }));
