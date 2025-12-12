import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import { tryCreateMedia } from "./media-management";
import {
	type CreatePageArgs,
	tryCreatePage,
	tryDeletePage,
	tryGetPageById,
	tryUpdatePage,
} from "./page-management";
import { tryCreateUser } from "./user-management";
import type { TryResultValue } from "server/utils/type-narrowing";
import { TestError } from "tests/errors";

describe("Page Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let testUser: TryResultValue<typeof tryCreateUser>;
	let testMediaId: number;
	let _testMediaFilename: string;

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

		// Create test media file
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createMediaResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-page-media.png",
			mimeType: "image/png",
			alt: "Test page media",
			userId: testUser.id,
			overrideAccess: true,
		});

		if (!createMediaResult.ok) {
			throw new Error("Failed to create test media");
		}

		testMediaId = createMediaResult.value.media.id;
		_testMediaFilename = createMediaResult.value.media.filename ?? "";
	});

	afterAll(async () => {
		// Cleanup if needed
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should create a page with valid content", async () => {
		const createArgs: CreatePageArgs = {
			payload,
			content: "<h1>Test Page</h1><p>This is a test page content.</p>",
			userId: testUser.id,
			overrideAccess: true,
		};

		const result = await tryCreatePage(createArgs);

		expect(result.ok).toBe(true);
		if (!result.ok)
			throw new TestError("Failed to create page", { cause: result.error });
		expect(result.value.content).toBe(createArgs.content);
		expect(result.value.createdBy).toBe(testUser.id);
		// Media array should be empty when no media references in HTML
		expect(result.value.contentMedia).toBeDefined();
		if (!Array.isArray(result.value.contentMedia))
			throw new TestError("Content media is not an array", {
				cause: result.error,
			});
		expect(result.value.contentMedia.length).toBe(0);
	});

	test("should create a page with empty content", async () => {
		const createArgs: CreatePageArgs = {
			payload,
			content: "",
			userId: testUser.id,
			overrideAccess: true,
		};

		const result = await tryCreatePage(createArgs);

		expect(result.ok).toBe(true);
		if (!result.ok)
			throw new TestError("Failed to create page", { cause: result.error });
		expect(result.value.content).toBe("");
	});

	test("should fail to create a page without userId", async () => {
		const createArgs = {
			payload,
			content: "<h1>Test Page</h1>",
			userId: undefined,
			overrideAccess: true,
		} as unknown as CreatePageArgs;

		const result = await tryCreatePage(createArgs);

		expect(result.ok).toBe(false);
	});

	test("should get a page by ID", async () => {
		// Create a page first
		const createArgs: CreatePageArgs = {
			payload,
			content: "<h1>Get Test Page</h1>",
			userId: testUser.id,
			overrideAccess: true,
		};

		const createResult = await tryCreatePage(createArgs);
		expect(createResult.ok).toBe(true);

		if (createResult.ok) {
			const pageId = createResult.value.id;

			// Get the page
			const getResult = await tryGetPageById({
				payload,
				id: pageId,
				overrideAccess: true,
			});

			expect(getResult.ok).toBe(true);
			if (!getResult.ok)
				throw new TestError("Failed to get page", { cause: getResult.error });
			expect(getResult.value.id).toBe(pageId);
			expect(getResult.value.content).toBe(createArgs.content);
		}
	});

	test("should fail to get a non-existent page", async () => {
		const result = await tryGetPageById({
			payload,
			id: 999999,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	test("should update a page content", async () => {
		// Create a page first
		const createArgs: CreatePageArgs = {
			payload,
			content: "<h1>Original Content</h1>",
			userId: testUser.id,
			overrideAccess: true,
		};

		const createResult = await tryCreatePage(createArgs);
		expect(createResult.ok).toBe(true);

		if (createResult.ok) {
			const pageId = createResult.value.id;

			// Update the page
			const updateResult = await tryUpdatePage({
				payload,
				id: pageId,
				content: "<h1>Updated Content</h1>",
				overrideAccess: true,
			});

			expect(updateResult.ok).toBe(true);
			if (!updateResult.ok)
				throw new TestError("Failed to update page", {
					cause: updateResult.error,
				});
			expect(updateResult.value.content).toBe("<h1>Updated Content</h1>");
			// Media array should be empty when no media references
			expect(updateResult.value.contentMedia).toBeDefined();
			if (!Array.isArray(updateResult.value.contentMedia))
				throw new TestError("Content media is not an array", {
					cause: updateResult.error,
				});
			expect(updateResult.value.contentMedia.length).toBe(0);
		}
	});

	test("should create a page with media references in HTML", async () => {
		const html = `<h1>Test Page</h1><p>This is a test page with images.</p><img src="/api/media/file/${testMediaId}" alt="Test image" />`;

		const createArgs: CreatePageArgs = {
			payload,
			content: html,
			userId: testUser.id,
			overrideAccess: true,
		};

		const result = await tryCreatePage(createArgs);

		expect(result.ok).toBe(true);
		if (!result.ok)
			throw new TestError("Failed to create page", { cause: result.error });
		expect(result.value.content).toBe(html);
		expect(result.value.contentMedia).toBeDefined();
		if (!Array.isArray(result.value.contentMedia))
			throw new TestError("Content media is not an array", {
				cause: result.error,
			});
		expect(result.value.contentMedia.length).toBe(1);
		const mediaId = result.value.contentMedia[0];
		expect(mediaId).toBe(testMediaId);
	});

	test("should update page media array when content changes", async () => {
		// Create a page first
		const createArgs: CreatePageArgs = {
			payload,
			content: "<h1>Original Content</h1>",
			userId: testUser.id,
			overrideAccess: true,
		};

		const createResult = await tryCreatePage(createArgs);
		expect(createResult.ok).toBe(true);

		if (createResult.ok) {
			const pageId = createResult.value.id;

			// Update the page with media reference
			const updatedHtml = `<h1>Updated Content</h1><img src="/api/media/file/${testMediaId}" alt="Test image" />`;
			const updateResult = await tryUpdatePage({
				payload,
				id: pageId,
				content: updatedHtml,
				overrideAccess: true,
			});

			expect(updateResult.ok).toBe(true);
			if (!updateResult.ok)
				throw new TestError("Failed to update page", {
					cause: updateResult.error,
				});
			expect(updateResult.value.content).toBe(updatedHtml);
			expect(updateResult.value.contentMedia).toBeDefined();
			if (!Array.isArray(updateResult.value.contentMedia))
				throw new TestError("Content media is not an array", {
					cause: updateResult.error,
				});
			expect(updateResult.value.contentMedia.length).toBe(1);
			const mediaId = updateResult.value.contentMedia[0];
			expect(mediaId).toBe(testMediaId);
		}
	});

	test("should fail to update a non-existent page", async () => {
		const result = await tryUpdatePage({
			payload,
			id: 999999,
			content: "<h1>Updated Content</h1>",
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	test("should delete a page", async () => {
		// Create a page first
		const createArgs: CreatePageArgs = {
			payload,
			content: "<h1>Delete Test Page</h1>",
			userId: testUser.id,
			overrideAccess: true,
		};

		const createResult = await tryCreatePage(createArgs);
		expect(createResult.ok).toBe(true);

		if (createResult.ok) {
			const pageId = createResult.value.id;

			// Delete the page
			const deleteResult = await tryDeletePage({
				payload,
				id: pageId,
				overrideAccess: true,
			});

			expect(deleteResult.ok).toBe(true);
			if (deleteResult.ok) {
				expect(deleteResult.value.success).toBe(true);
			}

			// Verify the page is deleted
			const getResult = await tryGetPageById({
				payload,
				id: pageId,
				overrideAccess: true,
			});
			expect(getResult.ok).toBe(false);
		}
	});

	test("should fail to delete a non-existent page", async () => {
		const result = await tryDeletePage({
			payload,
			id: 999999,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});
});
