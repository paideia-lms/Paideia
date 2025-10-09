import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import config from "../payload.config";
import {
	tryCreateMedia,
	tryDeleteMedia,
	tryGetAllMedia,
	tryGetMediaById,
	tryGetMediaByMimeType,
	tryUpdateMedia,
} from "./media-management";
import { tryCreateUser } from "./user-management";

describe("Media Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUserId: number;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: config,
		});

		// Create mock request object
		mockRequest = new Request("http://localhost:3000/test");

		// Create test user
		const userResult = await tryCreateUser(payload, mockRequest, {
			email: "test-media@example.com",
			password: "password123",
			firstName: "Test",
			lastName: "User",
			role: "user",
		});

		if (!userResult.ok) {
			throw new Error("Failed to create test user");
		}

		testUserId = userResult.value.id;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should fail to create media with invalid data", async () => {
		const result = await tryCreateMedia(payload, {
			file: Buffer.from("test"),
			filename: "",
			mimeType: "image/jpeg",
			userId: testUserId,
		});

		expect(result.ok).toBe(false);
	});

	test("Should create image media", async () => {
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const result = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "gem.png",
			mimeType: "image/png",
			userId: testUserId,
		});

		expect(result.ok).toBe(true);
	});

	test("should get all media in database", async () => {
		// This is the main test case requested by the user
		const result = await tryGetAllMedia(payload, {
			limit: 100, // Get a large number to get all media
			page: 1,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value.docs)).toBe(true);
			expect(result.value.totalDocs).toBeGreaterThanOrEqual(0);
			expect(result.value.limit).toBe(100);
			expect(result.value.page).toBe(1);

			// Log the results for debugging
			console.log(`Found ${result.value.totalDocs} media records in database`);
			console.log(`Total pages: ${result.value.totalPages}`);

			// Verify each media record has required fields
			for (const media of result.value.docs) {
				expect(media.id).toBeDefined();
				expect(media.filename).toBeDefined();
				expect(media.mimeType).toBeDefined();
				expect(media.filesize).toBeDefined();
				expect(media.createdAt).toBeDefined();
				expect(media.updatedAt).toBeDefined();
				// console.log(media.url);
				// console.log(media.thumbnailURL);
			}

			// get the buffer from payload
			const test = await payload.findByID({
				collection: "media",
				id: result.value.docs[0].id,
			});
		}
	});
});
