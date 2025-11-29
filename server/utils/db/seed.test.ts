import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../../payload.config";
import { tryRunSeed } from "./seed";

describe("Database Seeding", () => {
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

	test("should successfully seed database without errors", async () => {
		const result = await tryRunSeed({ payload });
		expect(result.ok).toBe(true);
	});
});
