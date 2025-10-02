import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import type { ActivityModule, User } from "../payload-types";
import { tryCreateActivityModule } from "./activity-module-management";
import {
	tryCreateCommit,
	tryGetCommitByHash,
	tryGetCommitHistory,
} from "./commit-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Commit Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUserId: number;
	let testUser: User;
	let testActivityModuleId: number;
	let testActivityModule: ActivityModule;
	let initialCommitId: number;

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
			email: "test-commit@example.com",
			password: "password123",
			firstName: "Test",
			lastName: "User",
			role: "instructor",
		};

		const userResult = await tryCreateUser(payload, mockRequest, userArgs);

		expect(userResult.ok).toBe(true);

		if (userResult.ok) {
			testUserId = userResult.value.id;
			testUser = userResult.value;

			// Create a test activity module with initial commit using tryCreateActivityModule
			const activityModuleResult = await tryCreateActivityModule(payload, {
				title: "Test Activity Module",
				description: "Test module for commit tests",
				type: "page",
				status: "draft",
				content: { initial: "content" },
				commitMessage: "Initial commit",
				userId: testUserId,
			});

			expect(activityModuleResult.ok).toBe(true);

			if (activityModuleResult.ok) {
				testActivityModule = activityModuleResult.value.activityModule;
				testActivityModuleId = testActivityModule.id;
				initialCommitId = activityModuleResult.value.commit.id;
			}
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
				collection: "origins",
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

	test("should create a commit successfully", async () => {
		const content = {
			title: "Test Page",
			body: "Test content",
			version: 1,
		};

		const result = await tryCreateCommit(payload, {
			activityModule: testActivityModuleId,
			message: "Second commit",
			author: testUserId,
			content,
			parentCommit: initialCommitId,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const commit = result.value;
		expect(commit.message).toBe("Second commit");
		if (typeof commit.author === "number") {
			expect(commit.author).toBe(testUserId);
		} else {
			expect(commit.author.id).toBe(testUserId);
		}
		expect(commit.activityModule).toBeDefined();
		expect(commit.activityModule).not.toBeNull();
		if (!commit.activityModule)
			throw new Error("Test Error: Commit activity module is null");
		expect(Array.isArray(commit.activityModule)).toBe(true);
		expect(commit.activityModule.length).toBe(1);
		const activityModuleRef = commit.activityModule[0];
		if (typeof activityModuleRef === "number") {
			expect(activityModuleRef).toBe(testActivityModuleId);
		} else {
			expect(activityModuleRef.id).toBe(testActivityModuleId);
		}
		expect(commit.content).toEqual(content);
		expect(commit.hash).toBeDefined();
		expect(commit.contentHash).toBeDefined();
		// Parent commit should be the initial commit
		if (typeof commit.parentCommit === "number") {
			expect(commit.parentCommit).toBe(initialCommitId);
		} else {
			expect(commit.parentCommit?.id).toBe(initialCommitId);
		}
	});

	test("should create a commit with parent commit", async () => {
		// Create parent commit using initialCommitId as parent
		const parentContent = {
			title: "Test Page v1",
			body: "Original content",
		};

		const parentResult = await tryCreateCommit(payload, {
			activityModule: testActivityModuleId,
			message: "Third commit",
			author: testUserId,
			content: parentContent,
			parentCommit: initialCommitId,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const parentCommit = parentResult.value;

		// Create child commit
		const childContent = {
			title: "Test Page v2",
			body: "Updated content",
		};

		const childResult = await tryCreateCommit(payload, {
			activityModule: testActivityModuleId,
			message: "Fourth commit",
			author: testUserId,
			content: childContent,
			parentCommit: parentCommit.id,
		});

		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		const childCommit = childResult.value;
		if (!childCommit.parentCommit)
			throw new Error("Test Error: Child commit parent commit is null");
		if (typeof childCommit.parentCommit === "number") {
			expect(childCommit.parentCommit).toBe(parentCommit.id);
		} else {
			expect(childCommit.parentCommit.id).toBe(parentCommit.id);
		}
		expect(childCommit.hash).not.toBe(parentCommit.hash);
	});

	test("should get commit by hash", async () => {
		// Create a commit
		const createResult = await tryCreateCommit(payload, {
			activityModule: testActivityModuleId,
			message: "Test commit for hash lookup",
			author: testUserId,
			content: { test: "data" },
			parentCommit: initialCommitId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdCommit = createResult.value;

		// Get commit by hash
		const getResult = await tryGetCommitByHash(payload, createdCommit.hash);

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedCommit = getResult.value;
		expect(retrievedCommit.id).toBe(createdCommit.id);
		expect(retrievedCommit.hash).toBe(createdCommit.hash);
	});

	test("should get commit history", async () => {
		// create an activity module with initial commit
		const activityModuleResult = await tryCreateActivityModule(payload, {
			title: "Test Activity Module for History",
			description: "Test module for commit history tests",
			type: "page",
			userId: testUserId,
			content: { test: "initial data" },
		});
		expect(activityModuleResult.ok).toBe(true);
		if (!activityModuleResult.ok) return;

		const activityModule = activityModuleResult.value.activityModule;
		const initialCommit = activityModuleResult.value.commit;

		expect(activityModule.id).toBeDefined();

		// Create a second commit
		const createResult = await tryCreateCommit(payload, {
			activityModule: activityModule.id,
			message: "Second commit for history",
			author: testUserId,
			content: { test: "data1" },
			parentCommit: initialCommit.id,
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) throw new Error("Test Error: Create commit 1 failed");

		// create a third commit
		const createResult2 = await tryCreateCommit(payload, {
			activityModule: activityModule.id,
			message: "Third commit for history",
			author: testUserId,
			content: { test: "data2" },
			parentCommit: createResult.value.id,
		});
		expect(createResult2.ok).toBe(true);
		if (!createResult2.ok)
			throw new Error("Test Error: Create commit 2 failed");

		// get commit history - should return all 3 commits (initial + 2 new ones)
		const getResult = await tryGetCommitHistory(payload, {
			activityModuleId: activityModule.id,
		});

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;
		expect(getResult.value.length).toBe(3);
		// Commits should be sorted by date (newest first)
		expect([
			getResult.value[2].hash,
			getResult.value[1].hash,
			getResult.value[0].hash,
		]).toEqual([
			initialCommit.hash,
			createResult.value.hash,
			createResult2.value.hash,
		]);
	});
});
