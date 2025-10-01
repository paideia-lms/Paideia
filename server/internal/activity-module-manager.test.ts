import { describe, expect, test } from "bun:test";
import { ActivityModuleManager } from "./activity-module-manager";
import { InMemoryActivityModuleStorage } from "./activity-module-storage-memory";

describe("ActivityModuleManager", () => {
	test("should create activity module on main branch", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		const result = await manager.tryCreateActivityModule({
			slug: "intro-to-programming",
			title: "Introduction to Programming",
			description: "Learn the basics of programming",
			type: "page",
			status: "draft",
			content: {
				body: "Welcome to programming!",
			},
			commitMessage: "Initial commit",
			branchName: "main",
			userId: 1,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.activityModule.slug).toBe("intro-to-programming");
		expect(result.value.activityModule.title).toBe(
			"Introduction to Programming",
		);
		expect(result.value.branch.name).toBe("main");
		expect(result.value.branch.isDefault).toBe(true);
		expect(result.value.commit.message).toBe("Initial commit");
		expect(result.value.version.isCurrentHead).toBe(true);
	});

	test("should update activity module and create new version", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create initial module
		const createResult = await manager.tryCreateActivityModule({
			slug: "test-module",
			title: "Test Module",
			type: "page",
			content: { body: "Original content" },
			userId: 1,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		// Update module
		const updateResult = await manager.tryUpdateActivityModule("test-module", {
			title: "Updated Test Module",
			content: { body: "Updated content" },
			commitMessage: "Update content",
			userId: 1,
		});

		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		expect(updateResult.value.activityModule.title).toBe("Updated Test Module");
		expect(updateResult.value.version.content).toEqual({
			body: "Updated content",
		});
		expect(updateResult.value.commit.message).toBe("Update content");
	});

	test("should get activity module", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create module
		await manager.tryCreateActivityModule({
			slug: "get-test",
			title: "Get Test",
			type: "page",
			content: { body: "Test content" },
			userId: 1,
		});

		// Get module by slug
		const result = await manager.tryGetActivityModule({
			slug: "get-test",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.activityModule.slug).toBe("get-test");
		expect(result.value.version.content).toEqual({ body: "Test content" });
	});

	test("should search activity modules", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create multiple modules
		await manager.tryCreateActivityModule({
			slug: "module-1",
			title: "First Module",
			type: "page",
			content: {},
			userId: 1,
		});

		await manager.tryCreateActivityModule({
			slug: "module-2",
			title: "Second Module",
			type: "quiz",
			content: {},
			userId: 1,
		});

		// Search all modules
		const searchResult = await manager.trySearchActivityModules({});

		expect(searchResult.ok).toBe(true);
		if (!searchResult.ok) return;

		expect(searchResult.value.docs.length).toBe(2);
		expect(searchResult.value.totalDocs).toBe(2);

		// Search by type
		const quizResult = await manager.trySearchActivityModules({ type: "quiz" });

		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		expect(quizResult.value.docs.length).toBe(1);
		expect(quizResult.value.docs[0].activityModule.type).toBe("quiz");
	});

	test("should create a new branch from main", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create a module on main
		await manager.tryCreateActivityModule({
			slug: "branch-test",
			title: "Branch Test",
			type: "page",
			content: { body: "Main content" },
			userId: 1,
		});

		// Create new branch
		const branchResult = await manager.tryCreateBranch({
			branchName: "feature",
			description: "Feature branch",
			fromBranch: "main",
			userId: 1,
		});

		expect(branchResult.ok).toBe(true);
		if (!branchResult.ok) return;

		expect(branchResult.value.branch.name).toBe("feature");
		expect(branchResult.value.sourceBranch.name).toBe("main");
		expect(branchResult.value.copiedVersionsCount).toBe(1);

		// Verify module exists on new branch
		const getResult = await manager.tryGetActivityModule({
			slug: "branch-test",
			branchName: "feature",
		});

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		expect(getResult.value.branch.name).toBe("feature");
		expect(getResult.value.version.content).toEqual({ body: "Main content" });
	});

	test("should update module on feature branch without affecting main", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create module on main
		await manager.tryCreateActivityModule({
			slug: "isolated-test",
			title: "Isolated Test",
			type: "page",
			content: { body: "Main content" },
			userId: 1,
		});

		// Create feature branch
		await manager.tryCreateBranch({
			branchName: "feature",
			userId: 1,
		});

		// Update on feature branch
		await manager.tryUpdateActivityModule("isolated-test", {
			content: { body: "Feature content" },
			branchName: "feature",
			userId: 1,
		});

		// Check main branch
		const mainResult = await manager.tryGetActivityModule({
			slug: "isolated-test",
			branchName: "main",
		});

		expect(mainResult.ok).toBe(true);
		if (!mainResult.ok) return;
		expect(mainResult.value.version.content).toEqual({ body: "Main content" });

		// Check feature branch
		const featureResult = await manager.tryGetActivityModule({
			slug: "isolated-test",
			branchName: "feature",
		});

		expect(featureResult.ok).toBe(true);
		if (!featureResult.ok) return;
		expect(featureResult.value.version.content).toEqual({
			body: "Feature content",
		});
	});

	test("should merge feature branch into main", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create module on main
		const createResult = await manager.tryCreateActivityModule({
			slug: "merge-test",
			title: "Merge Test",
			type: "page",
			content: { body: "Main content" },
			userId: 1,
		});

		expect(createResult.ok).toBe(true);

		// Create feature branch
		const branchResult = await manager.tryCreateBranch({
			branchName: "feature",
			userId: 1,
		});

		expect(branchResult.ok).toBe(true);

		// Update on feature branch
		const updateResult = await manager.tryUpdateActivityModule("merge-test", {
			content: { body: "Feature content" },
			branchName: "feature",
			commitMessage: "Update on feature",
			userId: 1,
		});

		expect(updateResult.ok).toBe(true);

		// Merge feature into main
		const mergeResult = await manager.tryMergeBranch({
			sourceBranch: "feature",
			targetBranch: "main",
			userId: 1,
		});

		expect(mergeResult.ok).toBe(true);
		if (!mergeResult.ok) return;

		expect(mergeResult.value.mergedVersionsCount).toBe(1);

		// Verify main now has feature content
		const mainResult = await manager.tryGetActivityModule({
			slug: "merge-test",
			branchName: "main",
		});

		expect(mainResult.ok).toBe(true);
		if (!mainResult.ok) return;
		expect(mainResult.value.version.content).toEqual({
			body: "Feature content",
		});
	});

	test("should handle merge with new module in source branch", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create module on main
		await manager.tryCreateActivityModule({
			slug: "existing-module",
			title: "Existing",
			type: "page",
			content: {},
			userId: 1,
		});

		// Create feature branch
		await manager.tryCreateBranch({
			branchName: "feature",
			userId: 1,
		});

		// Create new module on feature branch
		await manager.tryCreateActivityModule({
			slug: "new-module",
			title: "New Module",
			type: "page",
			content: { body: "New content" },
			branchName: "feature",
			userId: 1,
		});

		// Merge feature into main
		const mergeResult = await manager.tryMergeBranch({
			sourceBranch: "feature",
			targetBranch: "main",
			userId: 1,
		});

		expect(mergeResult.ok).toBe(true);
		if (!mergeResult.ok) return;

		// Verify new module exists on main
		const mainResult = await manager.tryGetActivityModule({
			slug: "new-module",
			branchName: "main",
		});

		expect(mainResult.ok).toBe(true);
		if (!mainResult.ok) return;
		expect(mainResult.value.version.content).toEqual({ body: "New content" });
	});

	test("should delete activity module", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create module
		await manager.tryCreateActivityModule({
			slug: "delete-test",
			title: "Delete Test",
			type: "page",
			content: {},
			userId: 1,
		});

		// Delete module
		const deleteResult = await manager.tryDeleteActivityModule("delete-test");

		expect(deleteResult.ok).toBe(true);

		// Verify module is deleted
		const getResult = await manager.tryGetActivityModule({
			slug: "delete-test",
		});

		expect(getResult.ok).toBe(false);
	});

	test("should delete branch", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create module on main
		await manager.tryCreateActivityModule({
			slug: "test",
			title: "Test",
			type: "page",
			content: {},
			userId: 1,
		});

		// Create feature branch
		await manager.tryCreateBranch({
			branchName: "feature",
			userId: 1,
		});

		// Delete feature branch
		const deleteResult = await manager.tryDeleteBranch("feature");

		expect(deleteResult.ok).toBe(true);

		// Verify branch is deleted
		const getResult = await manager.tryGetActivityModule({
			slug: "test",
			branchName: "feature",
		});

		expect(getResult.ok).toBe(false);
	});

	test("should not delete main branch", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create module on main to ensure main branch exists
		await manager.tryCreateActivityModule({
			slug: "test",
			title: "Test",
			type: "page",
			content: {},
			userId: 1,
		});

		// Try to delete main branch
		const deleteResult = await manager.tryDeleteBranch("main");

		expect(deleteResult.ok).toBe(false);
		if (deleteResult.ok) return;
		expect(deleteResult.error.message).toContain("Failed to delete branch");
	});

	test("should handle duplicate activity module slug", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create first module
		await manager.tryCreateActivityModule({
			slug: "duplicate-test",
			title: "First",
			type: "page",
			content: {},
			userId: 1,
		});

		// Try to create duplicate
		const duplicateResult = await manager.tryCreateActivityModule({
			slug: "duplicate-test",
			title: "Second",
			type: "page",
			content: {},
			userId: 1,
		});

		expect(duplicateResult.ok).toBe(false);
	});

	test("should handle duplicate branch name", async () => {
		const storage = new InMemoryActivityModuleStorage();
		const manager = new ActivityModuleManager(storage);

		// Create a module on main to ensure main branch exists
		await manager.tryCreateActivityModule({
			slug: "test",
			title: "Test",
			type: "page",
			content: {},
			userId: 1,
		});

		// Create first branch
		await manager.tryCreateBranch({
			branchName: "feature",
			userId: 1,
		});

		// Try to create duplicate
		const duplicateResult = await manager.tryCreateBranch({
			branchName: "feature",
			userId: 1,
		});

		expect(duplicateResult.ok).toBe(false);
		if (duplicateResult.ok) return;
		expect(duplicateResult.error.type).toBe("DuplicateBranchError");
	});
});
