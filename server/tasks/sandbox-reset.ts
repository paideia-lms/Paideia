import type { TaskConfig } from "payload";
import { envVars } from "../env";
import { tryResetSandbox } from "../utils/db/sandbox-reset";

/**
 * Payload task that resets the sandbox database daily at midnight
 * Only runs when SANDBOX_MODE is enabled
 *
 * This task deletes all user data (students, courses, etc.) while preserving
 * system tables (payload-jobs, payload-jobs-log, payload-migrations, etc.)
 * and then re-seeds the database with fresh data.
 */
export const sandboxReset: TaskConfig<"sandboxReset"> = {
	slug: "sandboxReset" as const,
	schedule: [
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
	handler: async ({ req }) => {
		const resetResult = await tryResetSandbox(req.payload);

		if (!resetResult.ok) {
			return {
				state: "failed",
				errorMessage: resetResult.error.message,
			};
		}

		return {
			state: "succeeded",
			output: {
				message: "Sandbox database reset completed successfully",
			},
		};
	},
};
