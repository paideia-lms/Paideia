import type { TaskConfig } from "payload";
import { envVars } from "../env";
import { tryResetSandbox } from "../utils/db/sandbox-reset";

/**
 * Payload task that resets the sandbox database daily at midnight
 * Only runs when SANDBOX_MODE is enabled
 */
export const sandboxReset: TaskConfig<"sandboxReset"> = {
	slug: "sandboxReset" as const,
	schedule: [
		{
			cron: "0 0 * * *", // Daily at midnight
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
