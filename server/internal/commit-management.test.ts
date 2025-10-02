import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
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
	let testActivityModuleId: number;

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

			// Create a test activity module
			// Note: commits field is a join field and will be auto-populated
			const activityModule = await payload.create({
				collection: "activity-modules",
				data: {
					title: "Test Activity Module",
					description: "Test module for commit tests",
					branch: "main",
					type: "page",
					status: "draft",
					createdBy: testUserId,
				} as never,
			});

			testActivityModuleId = activityModule.id;
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

	test("should create a commit successfully", async () => {
		const content = {
			title: "Test Page",
			body: "Test content",
			version: 1,
		};

		const result = await tryCreateCommit(payload, {
			activityModule: testActivityModuleId,
			message: "Initial commit",
			author: testUserId,
			content,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const commit = result.value;
		expect(commit.message).toBe("Initial commit");
		if (typeof commit.author === "number") {
			expect(commit.author).toBe(testUserId);
		} else {
			expect(commit.author.id).toBe(testUserId);
		}
		expect(commit.activityModule).toBeDefined();
		expect(commit.activityModule).not.toBeNull();
		if (!commit.activityModule)
			throw new Error("Test Error: Commit activity module is null");
		if (typeof commit.activityModule === "number") {
			expect(commit.activityModule).toBe(testActivityModuleId);
		} else {
			expect(commit.activityModule.id).toBe(testActivityModuleId);
		}
		expect(commit.content).toEqual(content);
		expect(commit.hash).toBeDefined();
		expect(commit.contentHash).toBeDefined();
		expect(commit.parentCommit).toBeNull();
	});

	test("should create a commit with parent commit", async () => {
		// Create parent commit
		const parentContent = {
			title: "Test Page v1",
			body: "Original content",
		};

		const parentResult = await tryCreateCommit(payload, {
			activityModule: testActivityModuleId,
			message: "First commit",
			author: testUserId,
			content: parentContent,
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
			message: "Second commit",
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
		// Create a chain of commits
		const firstResult = await tryCreateCommit(payload, {
			activityModule: testActivityModuleId,
			message: "First in chain",
			author: testUserId,
			content: { version: 1 },
		});

		expect(firstResult.ok).toBe(true);
		if (!firstResult.ok) return;

		const secondResult = await tryCreateCommit(payload, {
			activityModule: testActivityModuleId,
			message: "Second in chain",
			author: testUserId,
			content: { version: 2 },
			parentCommit: firstResult.value.id,
		});

		expect(secondResult.ok).toBe(true);
		if (!secondResult.ok) return;

		const thirdResult = await tryCreateCommit(payload, {
			activityModule: testActivityModuleId,
			message: "Third in chain",
			author: testUserId,
			content: { version: 3 },
			parentCommit: secondResult.value.id,
		});

		expect(thirdResult.ok).toBe(true);
		if (!thirdResult.ok) return;

		// Get history starting from the latest commit
		const historyResult = await tryGetCommitHistory(
			payload,
			thirdResult.value.id,
			10,
		);

		expect(historyResult.ok).toBe(true);
		if (!historyResult.ok) return;

		const history = historyResult.value;
		expect(history.length).toBe(3);
		expect(history[0].id).toBe(thirdResult.value.id);
		expect(history[1].id).toBe(secondResult.value.id);
		expect(history[2].id).toBe(firstResult.value.id);
	});

	test("should respect limit in commit history", async () => {
		// Create a chain of 5 commits
		let previousId: number | undefined;
		for (let i = 1; i <= 5; i++) {
			const result = await tryCreateCommit(payload, {
				activityModule: testActivityModuleId,
				message: `Commit ${i}`,
				author: testUserId,
				content: { count: i },
				parentCommit: previousId,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			previousId = result.value.id;
		}

		// Get history with limit of 3
		if (!previousId) return;
		const historyResult = await tryGetCommitHistory(payload, previousId, 3);

		expect(historyResult.ok).toBe(true);
		if (!historyResult.ok) return;

		const history = historyResult.value;
		expect(history.length).toBe(3);
	});
});
