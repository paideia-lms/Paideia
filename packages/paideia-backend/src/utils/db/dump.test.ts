import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import sanitizedConfig from "../../payload.config";
import { dumpDatabase } from "./dump";

describe("Database Dump", () => {
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

	test("should successfully dump database without errors", async () => {
		const result = await dumpDatabase({ payload });
		expect(result.success).toBe(true);
		expect(result.outputPath).toBeDefined();
		expect(result.error).toBeUndefined();
	});

	test("should create dump file with valid SQL content", async () => {
		const result = await dumpDatabase({ payload });
		expect(result.success).toBe(true);
		expect(result.outputPath).toBeDefined();

		if (result.outputPath) {
			// Verify file exists
			expect(existsSync(result.outputPath)).toBe(true);

			// Verify file has content
			const content = readFileSync(result.outputPath, "utf-8");
			expect(content.length).toBeGreaterThan(0);

			// Verify it contains SQL header
			expect(content).toContain("-- Paideia Database Dump");

			// Clean up test file
			unlinkSync(result.outputPath);
		}
	});

	test("should accept custom output path", async () => {
		const customPath = "test-dump.sql";
		const result = await dumpDatabase({
			payload,
			outputPath: customPath,
		});
		expect(result.success).toBe(true);
		expect(result.outputPath).toBeDefined();

		if (result.outputPath) {
			// Verify file exists at expected location
			expect(result.outputPath).toContain(customPath);
			expect(existsSync(result.outputPath)).toBe(true);

			// Clean up test file
			unlinkSync(result.outputPath);
		}
	});

	test("should return error for non-PostgreSQL databases", async () => {
		// Create a mock payload with non-postgres database
		const mockPayload = {
			...payload,
			db: {
				...payload.db,
				name: "sqlite" as const,
			},
		} as typeof payload;

		const result = await dumpDatabase({ payload: mockPayload });
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("PostgreSQL");
	});
});
