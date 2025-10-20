import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreatePageArgs,
	tryCreatePage,
	tryDeletePage,
	tryGetPageById,
	tryUpdatePage,
} from "./page-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Page Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let testUser: { id: number };

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		// Create test user
		const userArgs: CreateUserArgs = {
			payload,
			data: {
				email: "testuser@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
				role: "student",
			},
			overrideAccess: true,
		};

		const userResult = await tryCreateUser(userArgs);

		if (!userResult.ok) {
			throw new Error("Failed to create test user");
		}

		testUser = userResult.value;
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
		if (result.ok) {
			expect(result.value.content).toBe(createArgs.content);
			expect(result.value.createdBy.id).toBe(testUser.id);
		}
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
		if (result.ok) {
			expect(result.value.content).toBe("");
		}
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
		if (!result.ok) {
			expect(result.error.type).toBe("InvalidArgumentError");
		}
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
			if (getResult.ok) {
				expect(getResult.value.id).toBe(pageId);
				expect(getResult.value.content).toBe(createArgs.content);
			}
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
			if (updateResult.ok) {
				expect(updateResult.value.content).toBe("<h1>Updated Content</h1>");
			}
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
