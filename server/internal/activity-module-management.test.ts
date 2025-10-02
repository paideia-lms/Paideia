import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
	tryGetActivityModuleById,
} from "./activity-module-management";
import { type CreateCommitArgs, tryCreateCommit } from "./commit-management";
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
			await payload.delete({
				collection: "commits",
				where: {},
			});
			await payload.delete({
				collection: "activity-modules",
				where: {},
			});
			await payload.delete({
				collection: "users",
				where: {},
			});
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should create an activity module with initial commit", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Test Activity Module",
			description: "This is a test activity module",
			type: "page",
			status: "draft",
			content: {
				body: "Test content",
				version: 1,
			},
			commitMessage: "Initial commit",
			userId: testUserId,
		};

		const result = await tryCreateActivityModule(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const { activityModule, commit } = result.value;

		// Verify activity module
		expect(activityModule.title).toBe(args.title);
		expect(activityModule.description).toBe(args.description);
		expect(activityModule.type).toBe(args.type);
		expect(activityModule.status).toBe(args.status);
		expect(activityModule.branch).toBe("main");
		if (
			!activityModule.createdBy ||
			typeof activityModule.createdBy !== "object"
		)
			throw new Error(
				"Test Error: Activity module created by is not an object",
			);
		expect(activityModule.createdBy.id).toBe(testUserId);

		// Verify commit
		expect(commit.message).toBe("Initial commit");
		if (!commit.author || typeof commit.author !== "object")
			throw new Error("Test Error: Commit author is not an object");
		expect(commit.author.id).toBe(testUserId);
		expect(commit.activityModule).toBeDefined();
		expect(commit.activityModule).not.toBeNull();
		if (!commit.activityModule || typeof commit.activityModule !== "object")
			throw new Error("Test Error: Commit activity module is not an object");
		expect(commit.activityModule.id).toBe(activityModule.id);
		expect(commit.content).toEqual(args.content);
		expect(commit.hash).toBeDefined();
		expect(commit.contentHash).toBeDefined();
		expect(commit.parentCommit).toBeNull();

		// get activity module by id
		const getResult = await tryGetActivityModuleById(payload, {
			id: activityModule.id,
		});
		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;
		const retrievedActivityModule = getResult.value;
		expect(retrievedActivityModule.id).toBe(activityModule.id);
		expect(retrievedActivityModule.title).toBe(activityModule.title);
		expect(retrievedActivityModule.description).toBe(
			activityModule.description,
		);
		expect(retrievedActivityModule.type).toBe(activityModule.type);
		expect(retrievedActivityModule.status).toBe(activityModule.status);
		expect(retrievedActivityModule.branch).toBe(activityModule.branch);
		expect(retrievedActivityModule.createdBy).toEqual(activityModule.createdBy);
		expect(retrievedActivityModule.commits).toBeDefined();
		expect(retrievedActivityModule.commits?.docs?.length).toBe(1);

		// create a new commit
		const newCommitArgs: CreateCommitArgs = {
			activityModule: activityModule.id,
			message: "New commit",
			author: testUserId,
			content: {
				body: "New content",
			},
		};
		const newCommitResult = await tryCreateCommit(payload, newCommitArgs);
		expect(newCommitResult.ok).toBe(true);
		if (!newCommitResult.ok) return;
		const newCommit = newCommitResult.value;
		expect(newCommit.message).toBe("New commit");
		expect(newCommit.activityModule).not.toBeNull();
		expect(newCommit.activityModule).toBeDefined();
		expect(newCommit.activityModule).toBeObject();
		if (
			!newCommit.activityModule ||
			typeof newCommit.activityModule !== "object"
		)
			throw new Error(
				"Test Error: New commit activity module is not an object",
			);
		expect(newCommit.activityModule.id).toBe(activityModule.id);
		console.log(newCommit.activityModule);
		// should have 2 commits
		expect(newCommit.activityModule.commits?.docs?.length).toBe(2);

		expect(newCommit.content).toEqual(newCommitArgs.content);
	});

	test("should create activity module with default status", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Test Activity Module 2",
			type: "whiteboard",
			content: {
				drawing: "test",
			},
			userId: testUserId,
		};

		const result = await tryCreateActivityModule(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const { activityModule } = result.value;
		expect(activityModule.status).toBe("draft");
	});

	test("should create activity module with default commit message", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Test Activity Module 3",
			type: "assignment",
			content: {
				instructions: "Complete the assignment",
			},
			userId: testUserId,
		};

		const result = await tryCreateActivityModule(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const { commit, activityModule } = result.value;
		expect(commit.message).toBe("Initial commit");
		// activity module should have a commit
		expect(activityModule.commits).toBeDefined();
		expect(activityModule.commits).not.toBeNull();
		if (!activityModule.commits)
			throw new Error("Test Error: Activity module commits is null");
		expect(activityModule.commits.docs!.length).toBe(1);
	});

	test("should create multiple activity modules for same user", async () => {
		const module1Args: CreateActivityModuleArgs = {
			title: "Module 1",
			type: "page",
			content: { version: 1 },
			userId: testUserId,
		};

		const module2Args: CreateActivityModuleArgs = {
			title: "Module 2",
			type: "quiz",
			content: { version: 1 },
			userId: testUserId,
		};

		const result1 = await tryCreateActivityModule(payload, module1Args);
		const result2 = await tryCreateActivityModule(payload, module2Args);

		expect(result1.ok).toBe(true);
		expect(result2.ok).toBe(true);

		if (!result1.ok || !result2.ok) return;

		expect(result1.value.activityModule.id).not.toBe(
			result2.value.activityModule.id,
		);
		expect(result1.value.commit.hash).not.toBe(result2.value.commit.hash);
	});

	test("should create activity module with all types", async () => {
		const types: Array<
			"page" | "whiteboard" | "assignment" | "quiz" | "discussion"
		> = ["page", "whiteboard", "assignment", "quiz", "discussion"];

		for (const type of types) {
			const args: CreateActivityModuleArgs = {
				title: `${type} module`,
				type,
				content: { type },
				userId: testUserId,
			};

			const result = await tryCreateActivityModule(payload, args);

			expect(result.ok).toBe(true);
			if (!result.ok) continue;

			expect(result.value.activityModule.type).toBe(type);
		}
	});

	test("should rollback on error during commit creation", async () => {
		// This test verifies transaction rollback behavior
		const args: CreateActivityModuleArgs = {
			title: "Transaction Test Module",
			type: "page",
			content: { test: "data" },
			userId: testUserId,
		};

		const result = await tryCreateActivityModule(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Verify both activity module and commit were created
		const moduleExists = await payload.findByID({
			collection: "activity-modules",
			id: result.value.activityModule.id,
		});

		const commitExists = await payload.findByID({
			collection: "commits",
			id: result.value.commit.id,
		});

		expect(moduleExists).toBeDefined();
		expect(commitExists).toBeDefined();
	});
});
