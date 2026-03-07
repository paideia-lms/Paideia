import { and, desc, isNotNull, isNull } from "@payloadcms/db-postgres/drizzle";
import type { Payload } from "payload";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "@paideia/shared";
import { payload_jobs } from "../payload-generated-schema";

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
 */
export function tryGetScheduledTasks(payload: Payload) {
	return Result.try(
		async () => {
			const drizzle = payload.db.drizzle;
			const now = new Date();

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

			const scheduledTasks: ScheduledTaskInfo[] = scheduledJobs.map((job) => {
				let status: ScheduledTaskInfo["status"];
				if (job.completedAt) {
					status = job.hasError ? "failed" : "completed";
				} else if (job.processing) {
					status = "processing";
				} else if (job.waitUntil) {
					const waitUntilDate = new Date(job.waitUntil);
					status = waitUntilDate < now ? "expired" : "pending";
				} else {
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

			return {
				scheduledTasks,
				totalPending: scheduledTasks.filter((t) => t.status === "pending").length,
				totalProcessing: scheduledTasks.filter((t) => t.status === "processing").length,
				totalCompleted: scheduledTasks.filter((t) => t.status === "completed").length,
				totalFailed: scheduledTasks.filter((t) => t.status === "failed").length,
				totalExpired: scheduledTasks.filter((t) => t.status === "expired").length,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get scheduled tasks", { cause: error }),
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

			return pendingJobs.map((job) => {
				let status: ScheduledTaskInfo["status"];
				if (job.processing) {
					status = "processing";
				} else if (job.waitUntil) {
					const waitUntilDate = new Date(job.waitUntil);
					status = waitUntilDate < now ? "expired" : "pending";
				} else {
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
			new UnknownError("Failed to get pending scheduled tasks", { cause: error }),
	);
}
