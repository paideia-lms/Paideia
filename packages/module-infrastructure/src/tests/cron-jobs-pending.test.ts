import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, Migration } from "payload";
import { TestError } from "@paideia/shared";
import sanitizedConfig from "../payload.config";
import { tryGetPendingJobsByQueue } from "../services/cron-jobs-management";
import { InfrastructureModule } from "../index";
import { migrations } from "src/migrations";


describe("Cron Jobs Pending by Queue", async () => {

	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const infrastructureModule = new InfrastructureModule(payload);
	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();
	});

	afterAll(async () => {
		try {
			await infrastructureModule.migrateFresh({
				migrations: migrations as Migration[],
				forceAcceptWarning: true,
			});
			await infrastructureModule.cleanS3();
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should return pending jobs for a queue", async () => {
		const futureTime = new Date(Date.now() + 10000);

		await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: { submissionId: 1 },
			waitUntil: futureTime,
			queue: "secondly",
		});

		await payload.jobs.queue({
			task: "autoSubmitQuiz",
			input: { submissionId: 2 },
			waitUntil: futureTime,
			queue: "secondly",
		});

		const result = await tryGetPendingJobsByQueue({
			payload,
			req: undefined,
			overrideAccess: false,
			queue: "secondly",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new TestError(`Failed to get pending jobs by queue: ${result.error.message}`);
		}

		const jobs = result.value;
		expect(jobs.length).toBeGreaterThanOrEqual(2);

		const secondlyJobs = jobs.filter((j) => j.queue === "secondly");
		expect(secondlyJobs.length).toBeGreaterThanOrEqual(2);
		expect(secondlyJobs.every((j) => j.taskSlug === "autoSubmitQuiz")).toBe(true);
	});

	test("should return empty array for queue with no pending jobs", async () => {
		const result = await tryGetPendingJobsByQueue({
			payload,
			req: undefined,
			overrideAccess: false,
			queue: "nonexistent-queue",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new TestError(`Failed to get pending jobs by queue: ${result.error.message}`);
		}

		expect(result.value).toEqual([]);
	});

	test("should respect limit parameter", async () => {
		const result = await tryGetPendingJobsByQueue({
			payload,
			req: undefined,
			overrideAccess: false,
			queue: "secondly",
			limit: 1,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new TestError(`Failed to get pending jobs by queue: ${result.error.message}`);
		}

		expect(result.value.length).toBeLessThanOrEqual(1);
	});
});
