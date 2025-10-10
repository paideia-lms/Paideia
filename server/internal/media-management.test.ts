import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import config from "../payload.config";
import { s3Client } from "../utils/s3-client";
import {
	tryCreateMedia,
	tryGetAllMedia,
	tryGetMediaBufferFromFilename,
	tryGetMediaByFilename,
} from "./media-management";
import { tryCreateUser } from "./user-management";

describe("Media Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
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

		// Create test user
		const userResult = await tryCreateUser({
			payload,
			data: {
				email: "test-media@example.com",
				password: "password123",
				firstName: "Test",
				lastName: "User",
				role: "user",
			},
			overrideAccess: true,
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
		}
	});

	test("should get media by filename", async () => {
		// First create a media file
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-gem-by-filename.png",
			mimeType: "image/png",
			alt: "Test gem image",
			caption: "This is a test",
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);

		if (!createResult.ok) {
			throw new Error("Failed to create test media");
		}

		const createdMedia = createResult.value.media;
		console.log("Created media with filename:", createdMedia.filename);

		// Ensure filename exists
		if (!createdMedia.filename) {
			throw new Error("Created media has no filename");
		}

		// Now try to get it by filename
		const getResult = await tryGetMediaByFilename(payload, {
			filename: createdMedia.filename,
			depth: 0,
		});

		expect(getResult.ok).toBe(true);

		if (getResult.ok) {
			const media = getResult.value;
			expect(media.id).toBe(createdMedia.id);
			expect(media.filename).toBe(createdMedia.filename);
			expect(media.mimeType).toBe("image/png");
			expect(media.alt).toBe("Test gem image");
			expect(media.caption).toBe("This is a test");

			console.log("Successfully retrieved media by filename:", media.filename);
		}
	});

	test("should fail to get media with non-existent filename", async () => {
		const result = await tryGetMediaByFilename(payload, {
			filename: "non-existent-file-12345.png",
			depth: 0,
		});

		expect(result.ok).toBe(false);

		if (!result.ok) {
			expect(result.error.message).toContain("not found");
			console.log("Expected error:", result.error.message);
		}
	});

	test("should fail to get media with empty filename", async () => {
		const result = await tryGetMediaByFilename(payload, {
			filename: "",
			depth: 0,
		});

		expect(result.ok).toBe(false);

		if (!result.ok) {
			expect(result.error.message).toContain("required");
		}
	});

	test("should get media buffer from filename", async () => {
		// First create a media file
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const originalBuffer = Buffer.from(fileBuffer);

		const createResult = await tryCreateMedia(payload, {
			file: originalBuffer,
			filename: "test-buffer-gem.png",
			mimeType: "image/png",
			alt: "Test buffer gem",
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);

		if (!createResult.ok) {
			throw new Error("Failed to create test media");
		}

		const createdMedia = createResult.value.media;

		// Ensure filename exists
		if (!createdMedia.filename) {
			throw new Error("Created media has no filename");
		}

		console.log("Testing buffer retrieval for:", createdMedia.filename);

		// Now try to get both media and buffer
		const result = await tryGetMediaBufferFromFilename(payload, s3Client, {
			filename: createdMedia.filename,
			depth: 0,
		});

		expect(result.ok).toBe(true);

		if (result.ok) {
			const { media, buffer } = result.value;

			// Verify media object
			expect(media.id).toBe(createdMedia.id);
			expect(media.filename).toBe(createdMedia.filename);
			expect(media.mimeType).toBe("image/png");
			expect(media.alt).toBe("Test buffer gem");

			// Verify buffer
			expect(buffer).toBeInstanceOf(Buffer);
			expect(buffer.length).toBeGreaterThan(0);
			expect(buffer.length).toBe(originalBuffer.length);

			console.log(
				`Successfully retrieved media and buffer (${buffer.length} bytes)`,
			);
		}
	});

	test("should fail to get buffer for non-existent file", async () => {
		const result = await tryGetMediaBufferFromFilename(payload, s3Client, {
			filename: "non-existent-buffer-file.png",
			depth: 0,
		});

		expect(result.ok).toBe(false);

		if (!result.ok) {
			expect(result.error.message).toContain("not found");
		}
	});

	test("should fail to get buffer with empty filename", async () => {
		const result = await tryGetMediaBufferFromFilename(payload, s3Client, {
			filename: "",
			depth: 0,
		});

		expect(result.ok).toBe(false);

		if (!result.ok) {
			expect(result.error.message).toContain("required");
		}
	});
});
