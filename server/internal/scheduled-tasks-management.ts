import { and, desc, isNotNull, isNull } from "@payloadcms/db-postgres/drizzle";
import type { Payload } from "payload";
import { payload_jobs } from "src/payload-generated-schema";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";

export interface ScheduledTaskInfo {
	id: number;
	taskSlug: string | null;
	queue: string | null;
	waitUntil: string | null;
	status: "pending" | "processing" | "completed" | "failed" | "expired";
	createdAt: string;
	completedAt: string | null;
	processing: boolean | null;
	hasError: boolean | null;
	error: unknown | null;
	input: unknown;
	meta: unknown;
}

export interface GetScheduledTasksResult {
	scheduledTasks: ScheduledTaskInfo[];
	totalPending: number;
	totalProcessing: number;
	totalCompleted: number;
	totalFailed: number;
	totalExpired: number;
}

/**
 * Gets all scheduled tasks (jobs with waitUntil) from the database
 * Scheduled tasks are one-time jobs scheduled for a specific time in the future
 */
export function tryGetScheduledTasks(payload: Payload) {
	return Result.try(
		async () => {
			const drizzle = payload.db.drizzle;
			const now = new Date();

			// Query all jobs that have a waitUntil timestamp (scheduled tasks)
			// Order by waitUntil to show upcoming tasks first
			const scheduledJobs = await drizzle
				.select({
					id: payload_jobs.id,
					taskSlug: payload_jobs.taskSlug,
					queue: payload_jobs.queue,
					waitUntil: payload_jobs.waitUntil,
					createdAt: payload_jobs.createdAt,
					completedAt: payload_jobs.completedAt,
					processing: payload_jobs.processing,
					hasError: payload_jobs.hasError,
					error: payload_jobs.error,
					input: payload_jobs.input,
					meta: payload_jobs.meta,
				})
				.from(payload_jobs)
				.where(isNotNull(payload_jobs.waitUntil))
				.orderBy(desc(payload_jobs.waitUntil));

			payload.logger.info(`Found ${scheduledJobs.length} scheduled tasks`);

			// Map the results to our interface and determine status
			const scheduledTasks: ScheduledTaskInfo[] = scheduledJobs.map((job) => {
				let status: ScheduledTaskInfo["status"];

				// Determine status based on job state
				if (job.completedAt) {
					// Job has been completed
					status = job.hasError ? "failed" : "completed";
				} else if (job.processing) {
					// Job is currently being processed
					status = "processing";
				} else if (job.waitUntil) {
					// Convert waitUntil string to Date for proper comparison
					const waitUntilDate = new Date(job.waitUntil);
					if (waitUntilDate < now) {
						// Job's waitUntil time has passed but it hasn't been completed or started processing
						// This could mean it expired or is waiting to be picked up
						status = "expired";
					} else {
						// Job is waiting for its scheduled time
						status = "pending";
					}
				} else {
					// No waitUntil (shouldn't happen due to where clause, but handle it)
					status = "pending";
				}

				return {
					id: job.id,
					taskSlug: job.taskSlug ?? null,
					queue: job.queue ?? null,
					waitUntil: job.waitUntil ?? null,
					status,
					createdAt: job.createdAt,
					completedAt: job.completedAt ?? null,
					processing: job.processing ?? null,
					hasError: job.hasError ?? null,
					error: job.error ?? null,
					input: job.input ?? null,
					meta: job.meta ?? null,
				};
			});

			// Calculate statistics
			const totalPending = scheduledTasks.filter(
				(t) => t.status === "pending",
			).length;
			const totalProcessing = scheduledTasks.filter(
				(t) => t.status === "processing",
			).length;
			const totalCompleted = scheduledTasks.filter(
				(t) => t.status === "completed",
			).length;
			const totalFailed = scheduledTasks.filter(
				(t) => t.status === "failed",
			).length;
			const totalExpired = scheduledTasks.filter(
				(t) => t.status === "expired",
			).length;

			return {
				scheduledTasks,
				totalPending,
				totalProcessing,
				totalCompleted,
				totalFailed,
				totalExpired,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get scheduled tasks", {
				cause: error,
			}),
	);
}

/**
 * Gets only pending scheduled tasks (tasks that haven't been executed yet)
 */
export function tryGetPendingScheduledTasks(payload: Payload) {
	return Result.try(
		async () => {
			const drizzle = payload.db.drizzle;
			const now = new Date();

			// Query jobs with waitUntil that haven't been completed
			const pendingJobs = await drizzle
				.select({
					id: payload_jobs.id,
					taskSlug: payload_jobs.taskSlug,
					queue: payload_jobs.queue,
					waitUntil: payload_jobs.waitUntil,
					createdAt: payload_jobs.createdAt,
					completedAt: payload_jobs.completedAt,
					processing: payload_jobs.processing,
					hasError: payload_jobs.hasError,
					error: payload_jobs.error,
					input: payload_jobs.input,
					meta: payload_jobs.meta,
				})
				.from(payload_jobs)
				.where(
					and(
						isNotNull(payload_jobs.waitUntil),
						isNull(payload_jobs.completedAt),
					),
				)
				.orderBy(desc(payload_jobs.waitUntil));

			// Map to ScheduledTaskInfo
			return pendingJobs.map((job) => {
				let status: ScheduledTaskInfo["status"];

				if (job.processing) {
					status = "processing";
				} else if (job.waitUntil) {
					// Convert waitUntil string to Date for proper comparison
					const waitUntilDate = new Date(job.waitUntil);
					if (waitUntilDate < now) {
						status = "expired";
					} else {
						status = "pending";
					}
				} else {
					// No waitUntil (shouldn't happen due to where clause, but handle it)
					status = "pending";
				}

				return {
					id: job.id,
					taskSlug: job.taskSlug ?? null,
					queue: job.queue ?? null,
					waitUntil: job.waitUntil ?? null,
					status,
					createdAt: job.createdAt,
					completedAt: job.completedAt ?? null,
					processing: job.processing ?? null,
					hasError: job.hasError ?? null,
					error: job.error ?? null,
					input: job.input ?? null,
					meta: job.meta ?? null,
				};
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get pending scheduled tasks", {
				cause: error,
			}),
	);
}
