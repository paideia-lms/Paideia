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
		const result = await tryRunSeed({
			payload,
			req: undefined,
			overrideAccess: true,
		});
		expect(result.ok).toBe(true);

		if (!result.ok) {
			return;
		}

		const seedResult = result.value;

		if (seedResult === "user-exists") throw new Error("User already exists");

		// Test users
		expect(seedResult.users.additional.length).toBe(5);

		// Test categories
		expect(seedResult.categories.length).toBe(4);

		// Test courses
		expect(seedResult.courses.length).toBe(7);

		// Test enrollments
		expect(seedResult.enrollments.additional.length).toBe(5);

		// Test modules
		expect(seedResult.modules.additional.length).toBe(8);

		// Test sections
		expect(seedResult.sections.length).toBe(4);

		// Test links (1 page module + 8 additional modules = 9 total)
		expect(seedResult.links.length).toBe(9);
	});
});
