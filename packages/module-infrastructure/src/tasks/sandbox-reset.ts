import type { PayloadRequest, TaskConfig } from "payload";
import { envVars } from "../services/env";
import { tryResetSandbox } from "../services/sandbox-reset";

/**
 * Payload task that resets the sandbox database daily at midnight
 * Only runs when SANDBOX_MODE is enabled
 *
 * This task deletes all user data (students, courses, etc.) while preserving
 * system tables (payload-jobs, payload-jobs-log, payload-migrations, etc.)
 * and then re-seeds the database with fresh data.
 */
export const sandboxReset = {
	slug: "sandboxReset" as const,
	schedule: [
		// This schedule configuration automatically queues a job every midnight, but only when SANDBOX_MODE is enabled. The job is placed in the NIGHTLY queue for later execution.
		{
			cron: "0 0 * * *", // Every midnight
			queue: "nightly",
			hooks: {
				beforeSchedule: async () => {
					return {
						shouldSchedule: envVars.SANDBOX_MODE.enabled,
					};
				},
			},
		},
	],
	outputSchema: [
		{
			name: "message",
			type: "text",
			required: true,
		},
	],
	handler: async ({ req }: { req: PayloadRequest }) => {
		await tryResetSandbox({
			payload: req.payload,
			req: req,
			// ! we can override access because this is a system request
			overrideAccess: true,
		}).getOrThrow()

		return {
			state: "succeeded",
			output: {
				message: "Sandbox database reset completed successfully",
			},
		};
	},
} as unknown as TaskConfig;
