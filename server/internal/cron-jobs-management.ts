import { desc, eq } from "@payloadcms/db-postgres/drizzle";
import type { Payload } from "payload";
import { payload_jobs, payload_jobs_log } from "src/payload-generated-schema";
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

export interface CronJobHistoryEntry {
	id: string;
	taskSlug: string | null;
	queue: string | null;
	executedAt: string;
	completedAt: string;
	state: "succeeded" | "failed";
	error: unknown | null;
}

export interface GetCronJobsResult {
	cronJobs: CronJobInfo[];
	cronEnabled: boolean;
	jobHistory: CronJobHistoryEntry[];
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

		// Get job history from database
		const jobHistoryResult = await tryGetCronJobHistory(payload, 100);
		const jobHistory = jobHistoryResult.ok ? jobHistoryResult.value : [];

		return {
			cronJobs,
			cronEnabled,
			jobHistory,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get cron jobs", {
			cause: error,
		}),
);

/**
 * Gets cron job execution history from the database
 * Queries payload_jobs for completed jobs, with optional join to payload_jobs_log for detailed execution info
 */
export const tryGetCronJobHistory = Result.wrap(
	async (
		payload: Payload,
		historyLimit: number = 100,
	): Promise<CronJobHistoryEntry[]> => {
		const drizzle = payload.db.drizzle;

		// Query job history from payload_jobs
		// Left join with payload_jobs_log to get detailed execution info if available
		// Show all jobs that have been created (no filter - show everything)
		const history = await drizzle
			.select({
				jobId: payload_jobs.id,
				logId: payload_jobs_log.id,
				taskSlug: payload_jobs.taskSlug,
				queue: payload_jobs.queue,
				jobCreatedAt: payload_jobs.createdAt,
				jobCompletedAt: payload_jobs.completedAt,
				logExecutedAt: payload_jobs_log.executedAt,
				logCompletedAt: payload_jobs_log.completedAt,
				logState: payload_jobs_log.state,
				jobHasError: payload_jobs.hasError,
				logError: payload_jobs_log.error,
				jobError: payload_jobs.error,
			})
			.from(payload_jobs)
			.leftJoin(
				payload_jobs_log,
				eq(payload_jobs_log._parentID, payload_jobs.id),
			)
			.orderBy(desc(payload_jobs.createdAt))
			.limit(historyLimit);

		payload.logger.info(`Found ${history.length} cron job history entries`);

		// Map the results to our interface
		return history.map((entry) => {
			const id = entry.logId ?? String(entry.jobId);
			const executedAt =
				entry.logExecutedAt ?? entry.jobCreatedAt ?? entry.jobCompletedAt ?? "";
			const completedAt = entry.logCompletedAt ?? entry.jobCompletedAt ?? "";
			const state =
				entry.logState ??
				(entry.jobHasError ? ("failed" as const) : ("succeeded" as const));
			const error = entry.logError ?? entry.jobError ?? null;

			return {
				id,
				taskSlug: entry.taskSlug ?? null,
				queue: entry.queue ?? null,
				executedAt,
				completedAt,
				state,
				error,
			};
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get cron job history", {
			cause: error,
		}),
);
