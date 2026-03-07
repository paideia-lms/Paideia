import { os } from "@orpc/server";
import { z } from "zod";
import {
	tryGetScheduledTasks,
	tryGetPendingScheduledTasks,
} from "../services/scheduled-tasks-management";

/** Placeholder - when integrated in paideia-backend, use OrpcContext from orpc/context */
interface OrpcContext {
	payload: import("payload").Payload;
}

/** Placeholder - when integrated in paideia-backend, use handleResult from orpc/utils/handler */
async function handleResult<T>(
	fn: () => Promise<import("typescript-result").Result<unknown, T>>,
) {
	const result = await fn();
	if (result.ok) {
		return result.value;
	}
	throw result.error;
}

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
