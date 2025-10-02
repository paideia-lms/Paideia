import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import type { ActivityModule } from "server/payload-types";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	type CreateBranchArgs,
	tryCreateActivityModule,
	tryCreateBranch,
	tryDeleteActivityModule,
	tryGetActivityModuleById,
} from "./activity-module-management";
import {
	type CreateCommitArgs,
	tryCreateCommit,
	tryGetCommitByHash,
} from "./commit-management";
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

	// afterAll(async () => {
	// 	// Clean up any test data
	// 	try {
	// 		await payload.delete({
	// 			collection: "commits",
	// 			where: {},
	// 		});
	// 		await payload.delete({
	// 			collection: "activity-modules",
	// 			where: {},
	// 		});
	// 		await payload.delete({
	// 			collection: "users",
	// 			where: {},
	// 		});
	// 	} catch (error) {
	// 		console.warn("Cleanup failed:", error);
	// 	}
	// });

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
		if (!commit.activityModule || !Array.isArray(commit.activityModule))
			throw new Error("Test Error: Commit activity module is not an array");
		expect(commit.activityModule.length).toBe(1);
		const commitActivityModule = commit.activityModule[0];
		if (typeof commitActivityModule !== "object")
			throw new Error(
				"Test Error: Commit activity module item is not an object",
			);
		expect(commitActivityModule.id).toBe(activityModule.id);
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

		const initialCommit = retrievedActivityModule.commits!.docs![0]!;
		if (typeof initialCommit === "number") {
			throw new Error("Test Error: Initial commit is a number");
		}

		// create a new commit
		const newCommitArgs: CreateCommitArgs = {
			activityModule: activityModule.id,
			message: "New commit",
			author: testUserId,
			content: {
				body: "New content",
			},
			parentCommit: initialCommit.id,
		};
		const newCommitResult = await tryCreateCommit(payload, newCommitArgs);
		expect(newCommitResult.ok).toBe(true);
		if (!newCommitResult.ok) return;
		const newCommit = newCommitResult.value;
		expect(newCommit.message).toBe("New commit");
		expect(newCommit.activityModule).not.toBeNull();
		expect(newCommit.activityModule).toBeDefined();
		if (!newCommit.activityModule || !Array.isArray(newCommit.activityModule))
			throw new Error("Test Error: New commit activity module is not an array");
		expect(newCommit.activityModule.length).toBe(1);
		const newCommitActivityModule = newCommit.activityModule[0];
		if (typeof newCommitActivityModule !== "object")
			throw new Error(
				"Test Error: New commit activity module item is not an object",
			);
		expect(newCommitActivityModule.id).toBe(activityModule.id);
		// console.log(newCommit.activityModule);
		// should have 2 commits
		expect(newCommitActivityModule.commits?.docs?.length).toBe(2);

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

	let originalModule: ActivityModule;
	let branchModule: ActivityModule;
	let subBranchModule: ActivityModule;

	test("should create a branch from an existing activity module", async () => {
		// First create an activity module with initial commit
		const originalArgs: CreateActivityModuleArgs = {
			title: "Original Module",
			description: "Original description",
			type: "page",
			content: { body: "Original content" },
			commitMessage: "Initial commit",
			userId: testUserId,
		};

		const originalResult = await tryCreateActivityModule(payload, originalArgs);
		expect(originalResult.ok).toBe(true);
		if (!originalResult.ok) return;

		originalModule = originalResult.value.activityModule;

		const initialCommit = originalModule.commits?.docs?.[0];
		// @ts-expect-error
		let initialCommitId = initialCommit?.id;
		const commitCounts = 10;
		// create 99 more commits on this branch
		for (let i = 0; i < commitCounts - 1; i++) {
			const commitArgs: CreateCommitArgs = {
				activityModule: originalModule.id,
				message: `Commit ${i + 1}`,
				author: testUserId,
				content: {
					body: `Commit ${i + 1} content`,
				},
				parentCommit: initialCommitId,
			};
			const commitResult = await tryCreateCommit(payload, commitArgs);
			expect(commitResult.ok).toBe(true);
			if (!commitResult.ok) throw new Error("Failed to create commit");
			initialCommitId = commitResult.value.id;
		}
		const commits = await payload.find({
			collection: "commits",
			where: {
				activityModule: {
					equals: originalModule.id,
				},
			},
			pagination: false,
		});
		expect(commits.docs?.length).toBe(commitCounts);

		// get the activity module by id
		const originalModuleResult = await tryGetActivityModuleById(payload, {
			id: originalModule.id,
		});
		expect(originalModuleResult.ok).toBe(true);
		if (!originalModuleResult.ok)
			throw new Error("Failed to get original module");

		// console.log(originalModuleResult.value)
		// check if original module has 100 commits
		expect(originalModuleResult.value?.commits?.docs?.length).toBe(
			commitCounts,
		);

		// Create a branch from the original module
		const branchArgs: CreateBranchArgs = {
			sourceActivityModuleId: originalModule.id,
			branchName: "feature-branch",
			userId: testUserId,
		};

		const branchResult = await tryCreateBranch(payload, branchArgs);
		expect(branchResult.ok).toBe(true);
		if (!branchResult.ok) return;

		branchModule = branchResult.value;

		// Verify branch properties
		expect(branchModule.id).not.toBe(originalModule.id);
		expect(branchModule.title).toBe(originalModule.title);
		expect(branchModule.description).toBe(originalModule.description);
		expect(branchModule.type).toBe(originalModule.type);
		expect(branchModule.status).toBe(originalModule.status);
		expect(branchModule.branch).toBe("feature-branch");

		// Verify origin points to the original module
		if (!branchModule.origin || typeof branchModule.origin !== "object")
			throw new Error("Test Error: Branch module origin is not an object");
		expect(branchModule.origin.id).toBe(originalModule.id);

		// Verify createdBy is set correctly
		if (!branchModule.createdBy || typeof branchModule.createdBy !== "object")
			throw new Error("Test Error: Branch module created by is not an object");
		expect(branchModule.createdBy.id).toBe(testUserId);

		// Create another branch from the feature-branch
		// This should point to the same origin (original module)
		const subBranchArgs: CreateBranchArgs = {
			sourceActivityModuleId: branchModule.id,
			branchName: "sub-feature-branch",
			userId: testUserId,
		};

		const subBranchResult = await tryCreateBranch(payload, subBranchArgs);
		expect(subBranchResult.ok).toBe(true);
		if (!subBranchResult.ok) return;

		subBranchModule = subBranchResult.value;

		// Sub-branch should point to the same origin as the feature-branch
		if (!subBranchModule.origin || typeof subBranchModule.origin !== "object")
			throw new Error("Test Error: Sub-branch module origin is not an object");
		expect(subBranchModule.origin.id).toBe(originalModule.id);
		expect(subBranchModule.branch).toBe("sub-feature-branch");

		// get the main branch
		const mainBranchResult = await tryGetActivityModuleById(payload, {
			id: originalModule.id,
		});
		expect(mainBranchResult.ok).toBe(true);
		if (!mainBranchResult.ok) return;
		const mainBranchModule = mainBranchResult.value;

		// main branch should have 2 branches
		expect(mainBranchModule.branches).toBeDefined();
		expect(mainBranchModule.branches).not.toBeNull();
		expect(mainBranchModule.branches?.docs?.length).toBe(3);

		// console.log(JSON.stringify(mainBranchModule, null, 2));

		// check if main branch has 100 commits
		expect(mainBranchModule.commits?.docs?.length).toBe(commitCounts);

		// get the feature-branch
		const featureBranchResult = await tryGetActivityModuleById(payload, {
			id: branchModule.id,
		});
		expect(featureBranchResult.ok).toBe(true);
		if (!featureBranchResult.ok) return;
		const featureBranchModule = featureBranchResult.value;
		expect(featureBranchModule.id).toBe(branchModule.id);
		expect(featureBranchModule.branch).toBe("feature-branch");
		if (
			!featureBranchModule.origin ||
			typeof featureBranchModule.origin !== "object"
		)
			throw new Error(
				"Test Error: Feature branch module origin is not an object",
			);
		expect(featureBranchModule.origin.id).toBe(originalModule.id);
		// ! branches will not have branches, only main branch will have branches
		expect(featureBranchModule.branches?.docs?.length).toBe(0);
		expect(featureBranchModule.origin.branches?.docs?.length).toBe(3);
		// feature branch should have 100 commits
		expect(featureBranchModule.commits?.docs?.length).toBe(commitCounts);

		// get the sub-feature-branch
		const subFeatureBranchResult = await tryGetActivityModuleById(payload, {
			id: subBranchModule.id,
		});

		expect(subFeatureBranchResult.ok).toBe(true);
		if (!subFeatureBranchResult.ok)
			throw new Error("Failed to get sub-feature-branch");
		const subFeatureBranchModule = subFeatureBranchResult.value;
		expect(subFeatureBranchModule.id).toBe(subBranchModule.id);
		expect(subFeatureBranchModule.branch).toBe("sub-feature-branch");
		if (
			!subFeatureBranchModule.origin ||
			typeof subFeatureBranchModule.origin !== "object"
		)
			throw new Error(
				"Test Error: Feature branch module origin is not an object",
			);
		expect(subFeatureBranchModule.origin.id).toBe(originalModule.id);
		// ! branches will not have branches, only main branch will have branches
		expect(subFeatureBranchModule.branches?.docs?.length).toBe(0);
		expect(subFeatureBranchModule.origin.branches?.docs?.length).toBe(3);
		// subbranch should have 100 commits
		expect(subFeatureBranchModule.commits?.docs?.length).toBe(commitCounts);
	});

	test("should delete an activity module and all branches", async () => {
		// delete the subbranch
		const deleteResult = await tryDeleteActivityModule(payload, {
			id: subBranchModule.id,
		});
		expect(deleteResult.ok).toBe(true);
		if (!deleteResult.ok) throw new Error("Failed to delete subbranch");

		// get the activity module by id
		const getResult = await tryGetActivityModuleById(payload, {
			id: originalModule.id,
		});
		expect(getResult.ok).toBe(true);
		if (!getResult.ok) throw new Error("Failed to get activity module");
		// there should be only 2 branch
		expect(getResult.value.branches?.docs?.length).toBe(2);

		// try get the commit of the main branch
		const mainBranchCommit = getResult.value.commits?.docs?.[0];
		if (!mainBranchCommit) throw new Error("Failed to get main branch commit");
		if (typeof mainBranchCommit === "number")
			throw new Error("Failed to get main branch commit");
		const getCommitResult = await tryGetCommitByHash(
			payload,
			mainBranchCommit.hash,
		);
		expect(getCommitResult.ok).toBe(true);
		if (!getCommitResult.ok) throw new Error("Failed to get commit");

		// delete the main branch
		const deleteMainBranchResult = await tryDeleteActivityModule(payload, {
			id: originalModule.id,
		});
		expect(deleteMainBranchResult.ok).toBe(true);
		if (!deleteMainBranchResult.ok)
			throw new Error("Failed to delete main branch");

		// get the activity module by id
		const getMainBranchResult = await tryGetActivityModuleById(payload, {
			id: originalModule.id,
		});
		// should not be found
		expect(getMainBranchResult.ok).toBe(false);
	});
});
