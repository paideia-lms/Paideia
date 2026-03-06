import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryGetCronJobs,
	tryGetCronJobHistory,
	tryGetPendingJobsByQueue,
} from "../services/cron-jobs-management";
import type { OrpcContext } from "../../../orpc/context";

const outputSchema = z.any();

const historySchema = z.object({
	historyLimit: z.coerce.number().int().min(1).max(500).optional(),
});

const pendingByQueueSchema = z.object({
	queue: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const getCronJobs = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/cron-jobs" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => {
		const result = await tryGetCronJobs({
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

export const getCronJobHistory = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/cron-jobs/history" })
	.input(historySchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGetCronJobHistory({
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

export const getPendingJobsByQueue = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/cron-jobs/pending/{queue}" })
	.input(pendingByQueueSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGetPendingJobsByQueue({
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
