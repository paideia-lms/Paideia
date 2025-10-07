import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
	tryDeleteActivityModule,
	tryGetActivityModuleById,
	tryListActivityModules,
	tryUpdateActivityModule,
	type UpdateActivityModuleArgs,
} from "./activity-module-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Activity Module Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUserId: number;

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

		// Create mock request object
		mockRequest = new Request("http://localhost:3000/test");

		// Create test user
		const userArgs: CreateUserArgs = {
			email: "test-activity@example.com",
			password: "password123",
			firstName: "Test",
			lastName: "User",
			role: "instructor",
		};

		const userResult = await tryCreateUser(payload, mockRequest, userArgs);

		expect(userResult.ok).toBe(true);

		if (userResult.ok) {
			testUserId = userResult.value.id;
		}
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should create an activity module", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Test Activity Module",
			description: "This is a test activity module",
			type: "page",
			status: "draft",
			userId: testUserId,
		};

		const result = await tryCreateActivityModule(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const activityModule = result.value;

		// Verify activity module
		expect(activityModule.title).toBe(args.title);
		expect(activityModule.description).toBe(args.description);
		expect(activityModule.type).toBe(args.type);
		expect(activityModule.status).toBe(args.status || "draft");
		expect(activityModule.createdBy.id).toBe(testUserId);
		expect(activityModule.id).toBeDefined();
		expect(activityModule.createdAt).toBeDefined();
	});

	test("should create activity module with default status", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Test Activity Module 2",
			type: "whiteboard",
			userId: testUserId,
		};

		const result = await tryCreateActivityModule(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const activityModule = result.value;
		expect(activityModule.status).toBe("draft");
	});

	test("should create activity module with all types", async () => {
		const types: Array<
			"page" | "whiteboard" | "assignment" | "quiz" | "discussion"
		> = ["page", "whiteboard", "assignment", "quiz", "discussion"];

		for (const type of types) {
			const args: CreateActivityModuleArgs = {
				title: `${type} module`,
				type,
				userId: testUserId,
			};

			const result = await tryCreateActivityModule(payload, args);

			expect(result.ok).toBe(true);
			if (!result.ok) continue;

			expect(result.value.type).toBe(type);
		}
	});

	test("should get activity module by ID", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Get Test Module",
			type: "page",
			userId: testUserId,
		};

		const createResult = await tryCreateActivityModule(payload, args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const getResult = await tryGetActivityModuleById(payload, {
			id: createdModule.id,
		});

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedModule = getResult.value;
		expect(retrievedModule.id).toBe(createdModule.id);
		expect(retrievedModule.title).toBe(createdModule.title);
		expect(retrievedModule.type).toBe(createdModule.type);
		expect(retrievedModule.status).toBe(createdModule.status);
		expect(retrievedModule.createdBy.id).toBe(testUserId);
	});

	test("should update activity module", async () => {
		const createArgs: CreateActivityModuleArgs = {
			title: "Update Test Module",
			type: "page",
			status: "draft",
			userId: testUserId,
		};

		const createResult = await tryCreateActivityModule(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const updateArgs: UpdateActivityModuleArgs = {
			id: createdModule.id,
			title: "Updated Title",
			description: "Updated description",
			status: "published",
		};

		const updateResult = await tryUpdateActivityModule(payload, updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated Title");
		expect(updatedModule.description).toBe("Updated description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe(createdModule.type); // Should remain unchanged
	});

	test("should delete activity module", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Delete Test Module",
			type: "page",
			userId: testUserId,
		};

		const createResult = await tryCreateActivityModule(payload, args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const deleteResult = await tryDeleteActivityModule(
			payload,
			createdModule.id,
		);
		expect(deleteResult.ok).toBe(true);

		// Verify module is deleted
		const getResult = await tryGetActivityModuleById(payload, {
			id: createdModule.id,
		});
		expect(getResult.ok).toBe(false);
	});

	test("should list activity modules", async () => {
		// Create multiple modules for testing
		const modules = [
			{
				title: "List Test Module 1",
				type: "page" as const,
				status: "published" as const,
			},
			{
				title: "List Test Module 2",
				type: "assignment" as const,
				status: "draft" as const,
			},
			{
				title: "List Test Module 3",
				type: "quiz" as const,
				status: "published" as const,
			},
		];

		for (const module of modules) {
			const args: CreateActivityModuleArgs = {
				...module,
				userId: testUserId,
			};

			const result = await tryCreateActivityModule(payload, args);
			expect(result.ok).toBe(true);
		}

		// Test listing all modules
		const listResult = await tryListActivityModules(payload, {
			userId: testUserId,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		expect(listResult.value.docs.length).toBeGreaterThanOrEqual(modules.length);
		expect(listResult.value.totalDocs).toBeGreaterThanOrEqual(modules.length);

		// Test filtering by type
		const pageModulesResult = await tryListActivityModules(payload, {
			userId: testUserId,
			type: "page",
		});

		expect(pageModulesResult.ok).toBe(true);
		if (!pageModulesResult.ok) return;

		pageModulesResult.value.docs.forEach((module) => {
			expect(module.type).toBe("page");
		});

		// Test filtering by status
		const publishedModulesResult = await tryListActivityModules(payload, {
			userId: testUserId,
			status: "published",
		});

		expect(publishedModulesResult.ok).toBe(true);
		if (!publishedModulesResult.ok) return;

		publishedModulesResult.value.docs.forEach((module) => {
			expect(module.status).toBe("published");
		});
	});

	test("should handle pagination", async () => {
		// Create multiple modules for pagination testing
		for (let i = 0; i < 5; i++) {
			const args: CreateActivityModuleArgs = {
				title: `Pagination Test Module ${i + 1}`,
				type: "page",
				userId: testUserId,
			};

			const result = await tryCreateActivityModule(payload, args);
			expect(result.ok).toBe(true);
		}

		// Test pagination
		const page1Result = await tryListActivityModules(payload, {
			userId: testUserId,
			limit: 2,
			page: 1,
		});

		expect(page1Result.ok).toBe(true);
		if (!page1Result.ok) return;

		expect(page1Result.value.docs.length).toBeLessThanOrEqual(2);
		expect(page1Result.value.page).toBe(1);
		expect(page1Result.value.limit).toBe(2);
		expect(page1Result.value.hasNextPage).toBeDefined();
		expect(page1Result.value.hasPrevPage).toBeDefined();
	});

	test("should fail with invalid arguments", async () => {
		// Test missing title
		const invalidArgs1: CreateActivityModuleArgs = {
			title: "",
			type: "page",
			userId: testUserId,
		};

		const result1 = await tryCreateActivityModule(payload, invalidArgs1);
		expect(result1.ok).toBe(false);

		// Test missing type
		const invalidArgs2: CreateActivityModuleArgs = {
			title: "Test",
			type: undefined as never,
			userId: testUserId,
		};

		const result2 = await tryCreateActivityModule(payload, invalidArgs2);
		expect(result2.ok).toBe(false);

		// Test missing userId
		const invalidArgs3: CreateActivityModuleArgs = {
			title: "Test",
			type: "page",
			userId: undefined as never,
		};

		const result3 = await tryCreateActivityModule(payload, invalidArgs3);
		expect(result3.ok).toBe(false);
	});

	test("should fail to get non-existent activity module", async () => {
		const result = await tryGetActivityModuleById(payload, {
			id: 99999,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to update non-existent activity module", async () => {
		const updateArgs: UpdateActivityModuleArgs = {
			id: 99999,
			title: "Updated Title",
		};

		const result = await tryUpdateActivityModule(payload, updateArgs);
		expect(result.ok).toBe(false);
	});

	test("should fail to delete non-existent activity module", async () => {
		const result = await tryDeleteActivityModule(payload, 99999);
		expect(result.ok).toBe(false);
	});
});
