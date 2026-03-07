import { os } from "@orpc/server";
import { z } from "zod";
import { tryGetScheduledTasks, tryGetPendingScheduledTasks } from "../../../internal/scheduled-tasks-management";
import type { OrpcContext } from "../../../orpc/context";
import { handleResult } from "../../../orpc/utils/handler";

const outputSchema = z.any();

export const getScheduledTasks = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/scheduled-tasks" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) =>
		handleResult(() => tryGetScheduledTasks(context.payload)),
	);

export const getPendingScheduledTasks = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/scheduled-tasks/pending" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) =>
		handleResult(() => tryGetPendingScheduledTasks(context.payload)),
	);
