import { os } from "@orpc/server";
import { z } from "zod";
import { tryGetCronJobs, tryGetCronJobHistory } from "../../internal/cron-jobs-management";
import type { OrpcContext } from "../context";
import { handleResult } from "../utils/handler";

const outputSchema = z.any();

const run = <T>(fn: (args: object) => Promise<{ ok: boolean; value?: T; error?: { message: string } }>, args: object) =>
	handleResult(() => fn({ ...args, req: undefined, overrideAccess: true }));

const historySchema = z.object({
	historyLimit: z.coerce.number().int().min(1).max(500).optional(),
});

export const getCronJobs = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/cron-jobs" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => run(tryGetCronJobs, { payload: context.payload }));

export const getCronJobHistory = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/cron-jobs/history" })
	.input(historySchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetCronJobHistory, { payload: context.payload, ...input }));
