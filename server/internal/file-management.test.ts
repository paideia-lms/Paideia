import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateFileArgs,
	tryCreateFile,
	tryDeleteFile,
	tryGetFileById,
	tryUpdateFile,
} from "./file-management";
import { tryCreateMedia } from "./media-management";
import { tryCreateUser } from "./user-management";
import type { TryResultValue } from "server/utils/type-narrowing";

describe("File Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let testUser: TryResultValue<typeof tryCreateUser>;
	let testMediaId1: number;
	let testMediaId2: number;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		// Create test user
		testUser = await tryCreateUser({
			payload,
			data: {
				email: "testuser@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
				role: "student",
			},
			overrideAccess: true,
		}).getOrThrow();

		// Create test media files
		const fileBuffer1 = await Bun.file("fixture/gem.png").arrayBuffer();
		const createMediaResult1 = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer1),
			filename: "test-file-media-1.png",
			mimeType: "image/png",
			alt: "Test file media 1",
			userId: testUser.id,
			overrideAccess: true,
		});

		if (!createMediaResult1.ok) {
			throw new Error("Failed to create test media 1");
		}

		testMediaId1 = createMediaResult1.value.media.id;

		const fileBuffer2 = await Bun.file("fixture/gem.png").arrayBuffer();
		const createMediaResult2 = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer2),
			filename: "test-file-media-2.png",
			mimeType: "image/png",
			alt: "Test file media 2",
			userId: testUser.id,
			overrideAccess: true,
		});

		if (!createMediaResult2.ok) {
			throw new Error("Failed to create test media 2");
		}

		testMediaId2 = createMediaResult2.value.media.id;
	});

	afterAll(async () => {
		// Cleanup if needed
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should create a file with valid media", async () => {
		const createArgs: CreateFileArgs = {
			payload,
			media: [testMediaId1, testMediaId2],
			userId: testUser.id,
			overrideAccess: true,
		};

		const result = await tryCreateFile(createArgs);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.createdBy).toBe(testUser.id);
			expect(result.value.media).toBeDefined();
			if (Array.isArray(result.value.media)) {
				expect(result.value.media.length).toBe(2);
				const mediaIds = result.value.media;
				expect(mediaIds).toContain(testMediaId1);
				expect(mediaIds).toContain(testMediaId2);
			}
		}
	});

	test("should create a file with empty media array", async () => {
		const createArgs: CreateFileArgs = {
			payload,
			media: [],
			userId: testUser.id,
			overrideAccess: true,
		};

		const result = await tryCreateFile(createArgs);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.createdBy).toBe(testUser.id);
			expect(result.value.media).toBeDefined();
			if (Array.isArray(result.value.media)) {
				expect(result.value.media.length).toBe(0);
			}
		}
	});

	test("should create a file without media", async () => {
		const createArgs: CreateFileArgs = {
			payload,
			userId: testUser.id,
			overrideAccess: true,
		};

		const result = await tryCreateFile(createArgs);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.createdBy).toBe(testUser.id);
		}
	});

	test("should fail to create a file without userId", async () => {
		const createArgs = {
			payload,
			media: [testMediaId1],
			userId: undefined,
			overrideAccess: true,
		} as unknown as CreateFileArgs;

		const result = await tryCreateFile(createArgs);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.type).toBe("InvalidArgumentError");
		}
	});

	test("should get a file by ID", async () => {
		// Create a file first
		const createArgs: CreateFileArgs = {
			payload,
			media: [testMediaId1],
			userId: testUser.id,
			overrideAccess: true,
		};

		const createResult = await tryCreateFile(createArgs);
		expect(createResult.ok).toBe(true);

		if (createResult.ok) {
			const fileId = createResult.value.id;

			// Get the file
			const getResult = await tryGetFileById({
				payload,
				id: fileId,
				overrideAccess: true,
			});

			expect(getResult.ok).toBe(true);
			if (getResult.ok) {
				expect(getResult.value.id).toBe(fileId);
				expect(getResult.value.media).toBeDefined();
				if (Array.isArray(getResult.value.media)) {
					expect(getResult.value.media.length).toBe(1);
					const mediaId =
						typeof getResult.value.media[0] === "number"
							? getResult.value.media[0]
							: getResult.value.media[0]?.id;
					expect(mediaId).toBe(testMediaId1);
				}
			}
		}
	});

	test("should fail to get a non-existent file", async () => {
		const result = await tryGetFileById({
			payload,
			id: 999999,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	test("should update a file media", async () => {
		// Create a file first
		const createArgs: CreateFileArgs = {
			payload,
			media: [testMediaId1],
			userId: testUser.id,
			overrideAccess: true,
		};

		const createResult = await tryCreateFile(createArgs);
		expect(createResult.ok).toBe(true);

		if (createResult.ok) {
			const fileId = createResult.value.id;

			// Update the file with different media
			const updateResult = await tryUpdateFile({
				payload,
				id: fileId,
				media: [testMediaId2],
				overrideAccess: true,
			});

			expect(updateResult.ok).toBe(true);
			if (updateResult.ok) {
				expect(updateResult.value.media).toBeDefined();
				expect(updateResult.value.media?.length!).toBe(1);
				const mediaId = updateResult.value.media![0];
				expect(mediaId).toBe(testMediaId2);
			}
		}
	});

	test("should update a file to have no media", async () => {
		// Create a file first with media
		const createArgs: CreateFileArgs = {
			payload,
			media: [testMediaId1],
			userId: testUser.id,
			overrideAccess: true,
		};

		const createResult = await tryCreateFile(createArgs);
		expect(createResult.ok).toBe(true);

		if (createResult.ok) {
			const fileId = createResult.value.id;

			// Update the file to have no media
			const updateResult = await tryUpdateFile({
				payload,
				id: fileId,
				media: [],
				overrideAccess: true,
			});

			expect(updateResult.ok).toBe(true);
			if (updateResult.ok) {
				expect(updateResult.value.media).toBeDefined();
				if (Array.isArray(updateResult.value.media)) {
					expect(updateResult.value.media.length).toBe(0);
				}
			}
		}
	});

	test("should fail to update a non-existent file", async () => {
		const result = await tryUpdateFile({
			payload,
			id: 999999,
			media: [testMediaId1],
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	test("should delete a file", async () => {
		// Create a file first
		const createArgs: CreateFileArgs = {
			payload,
			media: [testMediaId1],
			userId: testUser.id,
			overrideAccess: true,
		};

		const createResult = await tryCreateFile(createArgs);
		expect(createResult.ok).toBe(true);

		if (createResult.ok) {
			const fileId = createResult.value.id;

			// Delete the file
			const deleteResult = await tryDeleteFile({
				payload,
				id: fileId,
				overrideAccess: true,
			});

			expect(deleteResult.ok).toBe(true);
			if (deleteResult.ok) {
				expect(deleteResult.value.success).toBe(true);
			}

			// Verify the file is deleted
			const getResult = await tryGetFileById({
				payload,
				id: fileId,
				overrideAccess: true,
			});
			expect(getResult.ok).toBe(false);
		}
	});

	test("should fail to delete a non-existent file", async () => {
		const result = await tryDeleteFile({
			payload,
			id: 999999,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});
});
