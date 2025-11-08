import type { Payload } from "payload";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";

export interface CronJobInfo {
	name: string;
	pattern: string;
	queue?: string;
	type: "queue" | "task";
	isActive: boolean;
	description?: string;
	nextRun: Date | null;
	previousRun: Date | null;
}

export interface GetCronJobsResult {
	cronJobs: CronJobInfo[];
	cronEnabled: boolean;
}

/**
 * Gets all cron jobs from Payload and maps them to displayable information
 * Matches cron instances with config to get names, types, queues, and descriptions
 */
export const tryGetCronJobs = Result.wrap(
	async (payload: Payload): Promise<GetCronJobsResult> => {
		// Get cron jobs directly from payload.crons
		// payload.crons is an array of Cron instances from croner
		const crons = payload.crons || [];
		const cronEnabled = crons.length > 0;

		// Get config to match cron instances with their names
		const config = payload.config as {
			jobs?: {
				autoRun?: Array<{ cron: string; queue: string }>;
				tasks?: Array<{
					slug: string;
					schedule?: Array<{
						cron: string;
						queue: string;
					}>;
				}>;
			};
		};

		// Map cron instances to displayable info
		const cronJobs = crons.map((cron, index) => {
			const pattern = cron.getPattern?.() || "Unknown";
			const isRunning = cron.isRunning?.() ?? false;
			const isStopped = cron.isStopped?.() ?? false;
			const nextRun = cron.nextRun?.() ?? null;
			const previousRun = cron.previousRun?.() ?? null;

			// Determine if the cron job is active
			// Active means it's running and not stopped
			const isActive = isRunning && !isStopped;

			// Try to match cron instance with config to get name and queue
			let name = "Unknown";
			let type: "queue" | "task" = "queue";
			let queue: string | undefined;
			let description: string | undefined;

			// First, try to match with autoRun queues
			if (config.jobs?.autoRun) {
				for (const autoRun of config.jobs.autoRun) {
					if (autoRun.cron === pattern) {
						type = "queue";
						queue = autoRun.queue;
						name = `Queue: ${autoRun.queue}`;
						description = `Queue configuration for ${autoRun.queue}`;
						break;
					}
				}
			}

			// If not matched, try to match with tasks
			if (name === "Unknown" && config.jobs?.tasks) {
				for (const task of config.jobs.tasks) {
					if (task.schedule) {
						for (const schedule of task.schedule) {
							if (schedule.cron === pattern) {
								type = "task";
								queue = schedule.queue;
								name = `Task: ${task.slug}`;
								if (task.slug === "sandboxReset") {
									description =
										"Resets sandbox database daily at midnight (only when SANDBOX_MODE is enabled)";
								} else {
									description = `Task: ${task.slug}`;
								}
								break;
							}
						}
					}
				}
			}

			// If still not matched, use a fallback name
			if (name === "Unknown") {
				name = `Cron Job ${index + 1}`;
			}

			return {
				name,
				pattern,
				queue,
				type,
				isActive,
				description,
				nextRun,
				previousRun,
			};
		});

		return {
			cronJobs,
			cronEnabled,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get cron jobs", {
			cause: error,
		}),
);
