import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig, { JobQueue } from "../payload.config";
import { tryGetScheduledTasks } from "./scheduled-tasks-management";

describe("Scheduled Tasks Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});
	});

	afterAll(async () => {
		// Clean up test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should correctly identify pending status for future scheduled task", async () => {
		// Schedule a job 5 seconds in the future
		const futureTime = new Date(Date.now() + 5000); // 5 seconds from now

		await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: {
				submissionId: 999, // Mock submission ID
			},
			waitUntil: futureTime,
			queue: JobQueue.SECONDLY,
		});

		// Get scheduled tasks
		const result = await tryGetScheduledTasks(payload);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(`Failed to get scheduled tasks: ${result.error.message}`);
		}

		const scheduledTasks = result.value.scheduledTasks;

		// Find our scheduled task
		const ourTask = scheduledTasks.find(
			(task) =>
				task.taskSlug === "autoSubmitQuiz" &&
				task.input &&
				typeof task.input === "object" &&
				"submissionId" in task.input &&
				task.input.submissionId === 999,
		);

		expect(ourTask).toBeDefined();
		if (!ourTask) {
			throw new Error("Scheduled task not found");
		}

		// The task should be pending since it's scheduled for the future
		expect(ourTask.status).toBe("pending");
		expect(ourTask.waitUntil).toBeDefined();
		expect(ourTask.completedAt).toBeNull();
		expect(ourTask.processing).toBeFalsy();
	});

	test("should correctly identify expired status for past scheduled task", async () => {
		// Schedule a job 5 seconds in the past
		const pastTime = new Date(Date.now() - 5000); // 5 seconds ago

		await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: {
				submissionId: 998, // Mock submission ID
			},
			waitUntil: pastTime,
			queue: JobQueue.SECONDLY,
		});

		// Wait a bit to ensure the task is in the database
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Get scheduled tasks
		const result = await tryGetScheduledTasks(payload);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(`Failed to get scheduled tasks: ${result.error.message}`);
		}

		const scheduledTasks = result.value.scheduledTasks;

		// Find our scheduled task
		const ourTask = scheduledTasks.find(
			(task) =>
				task.taskSlug === "autoSubmitQuiz" &&
				task.input &&
				typeof task.input === "object" &&
				"submissionId" in task.input &&
				task.input.submissionId === 998,
		);

		expect(ourTask).toBeDefined();
		if (!ourTask) {
			throw new Error("Scheduled task not found");
		}

		// The task should be expired since its waitUntil time has passed
		expect(ourTask.status).toBe("expired");
		expect(ourTask.waitUntil).toBeDefined();
		expect(ourTask.completedAt).toBeNull();
		expect(ourTask.processing).toBeFalsy();
	});

	test("should correctly identify completed status for finished task", async () => {
		// Schedule a job
		const futureTime = new Date(Date.now() + 10000); // 10 seconds from now

		const job = await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: {
				submissionId: 997, // Mock submission ID
			},
			waitUntil: futureTime,
			queue: JobQueue.SECONDLY,
		});

		// Manually mark the job as completed
		await payload.update({
			collection: "payload-jobs",
			id: job.id,
			data: {
				completedAt: new Date().toISOString(),
				hasError: false,
			},
			overrideAccess: true,
		});

		// Get scheduled tasks
		const result = await tryGetScheduledTasks(payload);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(`Failed to get scheduled tasks: ${result.error.message}`);
		}

		const scheduledTasks = result.value.scheduledTasks;

		// Find our scheduled task
		const ourTask = scheduledTasks.find((task) => task.id === job.id);

		expect(ourTask).toBeDefined();
		if (!ourTask) {
			throw new Error("Scheduled task not found");
		}

		// The task should be completed
		expect(ourTask.status).toBe("completed");
		expect(ourTask.completedAt).toBeDefined();
		expect(ourTask.hasError).toBe(false);
	});

	test("should correctly identify failed status for failed task", async () => {
		// Schedule a job
		const futureTime = new Date(Date.now() + 10000); // 10 seconds from now

		const job = await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: {
				submissionId: 996, // Mock submission ID
			},
			waitUntil: futureTime,
			queue: JobQueue.SECONDLY,
		});

		// Manually mark the job as failed
		await payload.update({
			collection: "payload-jobs",
			id: job.id,
			data: {
				completedAt: new Date().toISOString(),
				hasError: true,
				error: { message: "Test error" },
			},
			overrideAccess: true,
		});

		// Get scheduled tasks
		const result = await tryGetScheduledTasks(payload);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(`Failed to get scheduled tasks: ${result.error.message}`);
		}

		const scheduledTasks = result.value.scheduledTasks;

		// Find our scheduled task
		const ourTask = scheduledTasks.find((task) => task.id === job.id);

		expect(ourTask).toBeDefined();
		if (!ourTask) {
			throw new Error("Scheduled task not found");
		}

		// The task should be failed
		expect(ourTask.status).toBe("failed");
		expect(ourTask.completedAt).toBeDefined();
		expect(ourTask.hasError).toBe(true);
		expect(ourTask.error).toBeDefined();
	});

	test("should correctly identify processing status for task being processed", async () => {
		// Schedule a job
		const futureTime = new Date(Date.now() + 10000); // 10 seconds from now

		const job = await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: {
				submissionId: 995, // Mock submission ID
			},
			waitUntil: futureTime,
			queue: JobQueue.SECONDLY,
		});

		// Manually mark the job as processing
		await payload.update({
			collection: "payload-jobs",
			id: job.id,
			data: {
				processing: true,
			},
			overrideAccess: true,
		});

		// Get scheduled tasks
		const result = await tryGetScheduledTasks(payload);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(`Failed to get scheduled tasks: ${result.error.message}`);
		}

		const scheduledTasks = result.value.scheduledTasks;

		// Find our scheduled task
		const ourTask = scheduledTasks.find((task) => task.id === job.id);

		expect(ourTask).toBeDefined();
		if (!ourTask) {
			throw new Error("Scheduled task not found");
		}

		// The task should be processing
		expect(ourTask.status).toBe("processing");
		expect(ourTask.processing).toBe(true);
		expect(ourTask.completedAt).toBeNull();
	});

	test("should calculate statistics correctly", async () => {
		// Create multiple tasks with different statuses
		const now = Date.now();

		// Pending task (future)
		await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: { submissionId: 1001 },
			waitUntil: new Date(now + 10000),
			queue: JobQueue.SECONDLY,
		});

		// Expired task (past)
		await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: { submissionId: 1002 },
			waitUntil: new Date(now - 5000),
			queue: JobQueue.SECONDLY,
		});

		// Completed task
		const completedJob = await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: { submissionId: 1003 },
			waitUntil: new Date(now + 10000),
			queue: JobQueue.SECONDLY,
		});
		await payload.update({
			collection: "payload-jobs",
			id: completedJob.id,
			data: {
				completedAt: new Date().toISOString(),
				hasError: false,
			},
			overrideAccess: true,
		});

		// Failed task
		const failedJob = await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: { submissionId: 1004 },
			waitUntil: new Date(now + 10000),
			queue: JobQueue.SECONDLY,
		});
		await payload.update({
			collection: "payload-jobs",
			id: failedJob.id,
			data: {
				completedAt: new Date().toISOString(),
				hasError: true,
			},
			overrideAccess: true,
		});

		// Wait a bit for database to sync
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Get scheduled tasks
		const result = await tryGetScheduledTasks(payload);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(`Failed to get scheduled tasks: ${result.error.message}`);
		}

		const stats = result.value;

		// Verify statistics (at least 1 of each type we created)
		expect(stats.totalPending).toBeGreaterThanOrEqual(1);
		expect(stats.totalExpired).toBeGreaterThanOrEqual(1);
		expect(stats.totalCompleted).toBeGreaterThanOrEqual(1);
		expect(stats.totalFailed).toBeGreaterThanOrEqual(1);
		expect(stats.totalProcessing).toBeGreaterThanOrEqual(0);
	});
});
