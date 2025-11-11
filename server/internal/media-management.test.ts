import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import config from "../payload.config";
import { envVars } from "../env";
import { s3Client } from "../utils/s3-client";
import {
	tryCreateMedia,
	tryDeleteMedia,
	tryDeleteOrphanedMedia,
	tryFindMediaByUser,
	tryGetAllMedia,
	tryGetMediaBufferFromFilename,
	tryGetMediaById,
	tryGetMediaByFilename,
	tryGetOrphanedMedia,
	tryGetSystemMediaStats,
	tryGetUserMediaStats,
	tryRenameMedia,
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
				role: "student",
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
		if (result.ok) {
			// Verify createdBy is set correctly
			expect(result.value.media.createdBy).toBeDefined();
			// createdBy could be an object or ID, so check if it's a number or has an id property
			const createdBy =
				typeof result.value.media.createdBy === "object" &&
					result.value.media.createdBy !== null
					? result.value.media.createdBy.id
					: result.value.media.createdBy;
			expect(createdBy).toBe(testUserId);
		}
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

	});

	test("should fail to get media with empty filename", async () => {
		const result = await tryGetMediaByFilename(payload, {
			filename: "",
			depth: 0,
		});

		expect(result.ok).toBe(false);
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
	});

	test("should fail to get buffer with empty filename", async () => {
		const result = await tryGetMediaBufferFromFilename(payload, s3Client, {
			filename: "",
			depth: 0,
		});

		expect(result.ok).toBe(false);
	});

	test("should find media by user", async () => {
		// First create some media files for the test user
		const fileBuffer1 = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult1 = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer1),
			filename: "test-user-media-1.png",
			mimeType: "image/png",
			alt: "Test media 1",
			userId: testUserId,
		});

		expect(createResult1.ok).toBe(true);

		const fileBuffer2 = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult2 = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer2),
			filename: "test-user-media-2.png",
			mimeType: "image/png",
			alt: "Test media 2",
			userId: testUserId,
		});

		expect(createResult2.ok).toBe(true);

		// Now find media by user
		const result = await tryFindMediaByUser({
			payload,
			userId: testUserId,
			limit: 10,
			page: 1,
			depth: 0,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);

		if (result.ok) {
			expect(result.value.docs.length).toBeGreaterThanOrEqual(2);
			// Verify all media belong to the test user
			for (const media of result.value.docs) {
				const createdBy =
					typeof media.createdBy === "object" && media.createdBy !== null
						? media.createdBy.id
						: media.createdBy;
				expect(createdBy).toBe(testUserId);
			}
			expect(result.value.totalDocs).toBeGreaterThanOrEqual(2);
			expect(result.value.page).toBe(1);
			expect(result.value.limit).toBe(10);
		}
	});

	test("should find media by user with pagination", async () => {
		const result = await tryFindMediaByUser({
			payload,
			userId: testUserId,
			limit: 1,
			page: 1,
			depth: 0,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);

		if (result.ok) {
			expect(result.value.docs.length).toBeLessThanOrEqual(1);
			expect(result.value.limit).toBe(1);
			expect(result.value.page).toBe(1);
		}
	});

	test("should delete a single media record", async () => {
		// First create a media file
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-delete-single.png",
			mimeType: "image/png",
			alt: "Test delete single",
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);

		if (!createResult.ok) {
			throw new Error("Failed to create test media");
		}

		const createdMedia = createResult.value.media;

		// Delete the media record
		const deleteResult = await tryDeleteMedia(payload, s3Client, {
			id: createdMedia.id,
			userId: testUserId,
		});

		expect(deleteResult.ok).toBe(true);

		if (deleteResult.ok) {
			expect(deleteResult.value.deletedMedia.length).toBe(1);
			expect(deleteResult.value.deletedMedia[0].id).toBe(createdMedia.id);

			// Verify the media is actually deleted from database
			const getResult = await tryGetMediaById(payload, {
				id: createdMedia.id,
				depth: 0,
			});

			expect(getResult.ok).toBe(false);

			// Verify the file is deleted from S3 (if filename exists)
			if (createdMedia.filename) {
				const bufferResult = await tryGetMediaBufferFromFilename(
					payload,
					s3Client,
					{
						filename: createdMedia.filename,
						depth: 0,
					},
				);
				expect(bufferResult.ok).toBe(false);
			}
		}
	});

	test("should delete multiple media records (batch delete)", async () => {
		// Create multiple media files
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult1 = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-batch-delete-1.png",
			mimeType: "image/png",
			alt: "Test batch delete 1",
			userId: testUserId,
		});

		expect(createResult1.ok).toBe(true);

		const createResult2 = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-batch-delete-2.png",
			mimeType: "image/png",
			alt: "Test batch delete 2",
			userId: testUserId,
		});

		expect(createResult2.ok).toBe(true);

		const createResult3 = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-batch-delete-3.png",
			mimeType: "image/png",
			alt: "Test batch delete 3",
			userId: testUserId,
		});

		expect(createResult3.ok).toBe(true);

		if (!createResult1.ok || !createResult2.ok || !createResult3.ok) {
			throw new Error("Failed to create test media");
		}

		const mediaIds = [
			createResult1.value.media.id,
			createResult2.value.media.id,
			createResult3.value.media.id,
		];

		// Delete all media records in batch
		const deleteResult = await tryDeleteMedia(payload, s3Client, {
			id: mediaIds,
			userId: testUserId,
		});

		expect(deleteResult.ok).toBe(true);

		if (deleteResult.ok) {
			expect(deleteResult.value.deletedMedia.length).toBe(3);
			const deletedIds = deleteResult.value.deletedMedia.map((m: { id: number }) => m.id);
			expect(deletedIds).toContain(mediaIds[0]);
			expect(deletedIds).toContain(mediaIds[1]);
			expect(deletedIds).toContain(mediaIds[2]);

			// Verify all media are actually deleted
			for (const mediaId of mediaIds) {
				const getResult = await tryGetMediaById(payload, {
					id: mediaId,
					depth: 0,
				});

				expect(getResult.ok).toBe(false);
			}
		}
	});

	test("should fail to delete media with empty array", async () => {
		const result = await tryDeleteMedia(payload, s3Client, {
			id: [],
			userId: testUserId,
		});

		expect(result.ok).toBe(false);

		if (!result.ok) {
			expect(result.error.message).toContain("required");
		}
	});

	test("should fail to delete non-existent media", async () => {
		const result = await tryDeleteMedia(payload, s3Client, {
			id: 999999,
			userId: testUserId,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to delete media when some IDs don't exist", async () => {
		// Create one media file
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-partial-delete.png",
			mimeType: "image/png",
			alt: "Test partial delete",
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);

		if (!createResult.ok) {
			throw new Error("Failed to create test media");
		}

		const existingId = createResult.value.media.id;
		const nonExistentId = 999999;

		// Try to delete both existing and non-existent media
		const result = await tryDeleteMedia(payload, s3Client, {
			id: [existingId, nonExistentId],
			userId: testUserId,
		});

		expect(result.ok).toBe(false);


		// Verify the existing media was not deleted (transaction rollback)
		const getResult = await tryGetMediaById(payload, {
			id: existingId,
			depth: 0,
		});

		expect(getResult.ok).toBe(true);
	});

	test("should get user media stats", async () => {
		// Create some media files with different types
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-stats-1.png",
			mimeType: "image/png",
			userId: testUserId,
		});

		await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-stats-2.jpg",
			mimeType: "image/jpeg",
			userId: testUserId,
		});

		await tryCreateMedia(payload, {
			file: Buffer.from("test pdf content"),
			filename: "test-stats.pdf",
			mimeType: "application/pdf",
			userId: testUserId,
		});

		// Get stats
		const result = await tryGetUserMediaStats({
			payload,
			userId: testUserId,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);

		if (result.ok) {
			const stats = result.value;

			// Check data shape
			expect(typeof stats.count).toBe("number");
			expect(stats.count).toBeGreaterThanOrEqual(0);
			expect(typeof stats.totalSize).toBe("number");
			expect(stats.totalSize).toBeGreaterThanOrEqual(0);
			expect(typeof stats.mediaTypeCount).toBe("object");
			expect(stats.mediaTypeCount).not.toBeNull();

			// Check media type count structure
			for (const [type, count] of Object.entries(stats.mediaTypeCount)) {
				expect(typeof type).toBe("string");
				expect(typeof count).toBe("number");
				expect(count).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test("should get system media stats", async () => {
		// Get stats for entire system
		const result = await tryGetSystemMediaStats({
			payload,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);

		if (result.ok) {
			const stats = result.value;

			// Check data shape
			expect(typeof stats.count).toBe("number");
			expect(stats.count).toBeGreaterThanOrEqual(0);
			expect(typeof stats.totalSize).toBe("number");
			expect(stats.totalSize).toBeGreaterThanOrEqual(0);
			expect(typeof stats.mediaTypeCount).toBe("object");
			expect(stats.mediaTypeCount).not.toBeNull();

			// Check media type count structure
			for (const [type, count] of Object.entries(stats.mediaTypeCount)) {
				expect(typeof type).toBe("string");
				expect(typeof count).toBe("number");
				expect(count).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test("should rename media file", async () => {
		// First create a media file
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-rename-original.png",
			mimeType: "image/png",
			alt: "Test rename original",
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

		const newFilename = "test-rename-new.png";

		// Rename the media file
		const renameResult = await tryRenameMedia(payload, s3Client, {
			id: createdMedia.id,
			newFilename,
			userId: testUserId,
		});

		expect(renameResult.ok).toBe(true);

		if (renameResult.ok) {
			const renamedMedia = renameResult.value.media;
			expect(renamedMedia.filename).toBe(newFilename);
			expect(renamedMedia.id).toBe(createdMedia.id);

			// Verify the old file is gone and new file exists by trying to get it
			const getOldResult = await tryGetMediaByFilename(payload, {
				filename: createdMedia.filename,
				depth: 0,
			});
			expect(getOldResult.ok).toBe(false);

			const getNewResult = await tryGetMediaByFilename(payload, {
				filename: newFilename,
				depth: 0,
			});
			expect(getNewResult.ok).toBe(true);
		}
	});

	test("should fail to rename media with duplicate filename", async () => {
		// Create two media files
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult1 = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-rename-duplicate-1.png",
			mimeType: "image/png",
			userId: testUserId,
		});

		const createResult2 = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-rename-duplicate-2.png",
			mimeType: "image/png",
			userId: testUserId,
		});

		expect(createResult1.ok).toBe(true);
		expect(createResult2.ok).toBe(true);

		if (!createResult1.ok || !createResult2.ok) {
			throw new Error("Failed to create test media");
		}

		// Try to rename the second file to the first file's name
		const renameResult = await tryRenameMedia(payload, s3Client, {
			id: createResult2.value.media.id,
			newFilename: "test-rename-duplicate-1.png",
			userId: testUserId,
		});

		expect(renameResult.ok).toBe(false);
	});

	test("should get orphaned media files", async () => {
		// First, create a media file that will be in the database
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-managed-file.png",
			mimeType: "image/png",
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);

		// Upload a file directly to S3 (simulating an orphaned file)
		// We'll use the S3 client to upload a file that won't be in the database
		const { PutObjectCommand } = await import("@aws-sdk/client-s3");
		const orphanedFilename = "test-orphaned-file.png";
		await s3Client.send(
			new PutObjectCommand({
				Bucket: envVars.S3_BUCKET.value,
				Key: orphanedFilename,
				Body: Buffer.from("orphaned file content"),
			}),
		);

		// Get orphaned media
		const result = await tryGetOrphanedMedia(payload, s3Client, {
			limit: 10,
			page: 1,
		});

		expect(result.ok).toBe(true);

		if (result.ok) {
			// Should find at least the orphaned file we created
			const orphanedFiles = result.value.files.filter(
				(file) => file.filename === orphanedFilename,
			);
			expect(orphanedFiles.length).toBeGreaterThan(0);

			// Verify pagination structure
			expect(result.value.totalFiles).toBeGreaterThanOrEqual(0);
			expect(result.value.limit).toBe(10);
			expect(result.value.page).toBe(1);
			expect(typeof result.value.totalSize).toBe("number");

			// Clean up orphaned file
			const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
			await s3Client.send(
				new DeleteObjectCommand({
					Bucket: envVars.S3_BUCKET.value,
					Key: orphanedFilename,
				}),
			);
		}
	});

	test("should get orphaned media with pagination", async () => {
		// Create multiple orphaned files
		const { PutObjectCommand } = await import("@aws-sdk/client-s3");
		const orphanedFilenames: string[] = [];

		for (let i = 0; i < 3; i++) {
			const filename = `test-orphaned-pagination-${i}.png`;
			orphanedFilenames.push(filename);
			await s3Client.send(
				new PutObjectCommand({
					Bucket: envVars.S3_BUCKET.value,
					Key: filename,
					Body: Buffer.from(`orphaned file ${i}`),
				}),
			);
		}

		// Get first page
		const result1 = await tryGetOrphanedMedia(payload, s3Client, {
			limit: 2,
			page: 1,
		});

		expect(result1.ok).toBe(true);

		if (result1.ok) {
			expect(result1.value.files.length).toBeLessThanOrEqual(2);
			expect(result1.value.page).toBe(1);
			expect(result1.value.limit).toBe(2);
		}

		// Clean up orphaned files
		const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
		for (const filename of orphanedFilenames) {
			await s3Client.send(
				new DeleteObjectCommand({
					Bucket: envVars.S3_BUCKET.value,
					Key: filename,
				}),
			);
		}
	});

	test("should delete orphaned media files", async () => {
		// Create orphaned files
		const { PutObjectCommand } = await import("@aws-sdk/client-s3");
		const orphanedFilenames = [
			"test-delete-orphaned-1.png",
			"test-delete-orphaned-2.png",
		];

		for (const filename of orphanedFilenames) {
			await s3Client.send(
				new PutObjectCommand({
					Bucket: envVars.S3_BUCKET.value,
					Key: filename,
					Body: Buffer.from("orphaned file content"),
				}),
			);
		}

		// Delete orphaned files
		const result = await tryDeleteOrphanedMedia(payload, s3Client, {
			filenames: orphanedFilenames,
		});

		expect(result.ok).toBe(true);

		if (result.ok) {
			expect(result.value.deletedCount).toBe(2);
			expect(result.value.deletedFiles.length).toBe(2);
			expect(result.value.errors.length).toBe(0);

			// Verify files are actually deleted from S3
			const { GetObjectCommand } = await import("@aws-sdk/client-s3");
			for (const filename of orphanedFilenames) {
				try {
					await s3Client.send(
						new GetObjectCommand({
							Bucket: envVars.S3_BUCKET.value,
							Key: filename,
						}),
					);
					// If we get here, file still exists (shouldn't happen)
					expect(true).toBe(false);
				} catch (error) {
					// Expected: file should not exist
					expect(error).toBeDefined();
				}
			}
		}
	});

	test("should fail to delete non-orphaned media files", async () => {
		// Create a managed media file
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createResult = await tryCreateMedia(payload, {
			file: Buffer.from(fileBuffer),
			filename: "test-managed-for-delete.png",
			mimeType: "image/png",
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);

		if (!createResult.ok) {
			throw new Error("Failed to create test media");
		}

		const managedFilename = createResult.value.media.filename;

		if (!managedFilename) {
			throw new Error("Created media has no filename");
		}

		// Try to delete it as orphaned (should fail)
		const result = await tryDeleteOrphanedMedia(payload, s3Client, {
			filenames: [managedFilename],
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to delete orphaned media with empty array", async () => {
		const result = await tryDeleteOrphanedMedia(payload, s3Client, {
			filenames: [],
		});

		expect(result.ok).toBe(false);
	});
});
