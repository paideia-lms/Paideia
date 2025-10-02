import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import config from "../payload.config";
import type { ActivityModule, User } from "../payload-types";
import {
	tryCreateActivityModule,
	tryCreateBranch,
} from "./activity-module-management";
import {
	tryCreateMergeRequest,
	tryDeleteMergeRequest,
	tryGetMergeRequestById,
	tryGetMergeRequestsByActivityModule,
	tryUpdateMergeRequestStatus,
} from "./merge-request-management";
import { tryCreateUser } from "./user-management";

describe("Merge Request Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUserId: number;
	let activityModule1: ActivityModule;
	let activityModule2: ActivityModule;
	let activityModule3: ActivityModule; // Different origin

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: config,
		});

		// Create mock request object
		mockRequest = new Request("http://localhost:3000/test");

		// Create test user
		const userResult = await tryCreateUser(payload, mockRequest, {
			email: "test-merge@example.com",
			password: "password123",
			firstName: "Test",
			lastName: "User",
			role: "instructor",
		});

		if (!userResult.ok) {
			throw new Error("Failed to create test user");
		}

		testUserId = userResult.value.id;

		// Create test activity modules
		const module1Result = await tryCreateActivityModule(payload, {
			title: "Test Module 1",
			description: "Test description 1",
			type: "page",
			content: { test: "content1" },
			userId: testUserId,
		});

		if (!module1Result.ok) {
			throw new Error("Failed to create test activity module 1");
		}

		activityModule1 = module1Result.value.activityModule;

		// Create branch from module1 (same origin)
		const branchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: activityModule1.id,
			branchName: "feature-branch",
			userId: testUserId,
		});

		if (!branchResult.ok) {
			throw new Error("Failed to create test branch");
		}

		activityModule2 = branchResult.value;

		// Create another activity module with different origin
		const module3Result = await tryCreateActivityModule(payload, {
			title: "Test Module 3",
			description: "Test description 3",
			type: "assignment",
			content: { test: "content3" },
			userId: testUserId,
		});

		if (!module3Result.ok) {
			throw new Error("Failed to create test activity module 3");
		}

		activityModule3 = module3Result.value.activityModule;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should create a merge request between activity modules with same origin", async () => {
		const result = await tryCreateMergeRequest(payload, {
			title: "Test Merge Request",
			description: "Test merge request description",
			fromActivityModuleId: activityModule1.id,
			toActivityModuleId: activityModule2.id,
			userId: testUserId,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.mergeRequest.title).toBe("Test Merge Request");
			expect(result.value.mergeRequest.description).toBe(
				"Test merge request description",
			);
			expect(result.value.mergeRequest.status).toBe("open");
			// Handle both cases: when from/to are IDs or objects
			const fromId =
				typeof result.value.mergeRequest.from === "object"
					? result.value.mergeRequest.from.id
					: result.value.mergeRequest.from;
			const toId =
				typeof result.value.mergeRequest.to === "object"
					? result.value.mergeRequest.to.id
					: result.value.mergeRequest.to;
			expect(fromId).toBe(activityModule1.id);
			expect(toId).toBe(activityModule2.id);
			const createdById =
				typeof result.value.mergeRequest.createdBy === "object"
					? result.value.mergeRequest.createdBy.id
					: result.value.mergeRequest.createdBy;
			expect(createdById).toBe(testUserId);
		}
	});

	test("should fail to create merge request with same activity module", async () => {
		const result = await tryCreateMergeRequest(payload, {
			title: "Invalid Merge Request",
			fromActivityModuleId: activityModule1.id,
			toActivityModuleId: activityModule1.id,
			userId: testUserId,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to create merge request between modules with different origins", async () => {
		const result = await tryCreateMergeRequest(payload, {
			title: "Invalid Merge Request",
			fromActivityModuleId: activityModule1.id,
			toActivityModuleId: activityModule3.id,
			userId: testUserId,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to create duplicate merge request", async () => {
		const result = await tryCreateMergeRequest(payload, {
			title: "Duplicate Merge Request",
			fromActivityModuleId: activityModule1.id,
			toActivityModuleId: activityModule2.id,
			userId: testUserId,
		});

		expect(result.ok).toBe(false);
	});

	test("should get merge request by ID", async () => {
		// First create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Get Test Merge Request",
			fromActivityModuleId: activityModule2.id,
			toActivityModuleId: activityModule1.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Now get it by ID
		const getResult = await tryGetMergeRequestById(payload, {
			id: mergeRequest.id,
		});

		expect(getResult.ok).toBe(true);
		if (getResult.ok) {
			expect(getResult.value.id).toBe(mergeRequest.id);
			expect(getResult.value.title).toBe("Get Test Merge Request");
		}
	});

	test("should fail to get non-existing merge request", async () => {
		const result = await tryGetMergeRequestById(payload, {
			id: 99999,
		});

		expect(result.ok).toBe(false);
	});

	test("should update merge request status to merged", async () => {
		// Create a new activity module for this test to avoid conflicts
		const testModuleResult = await tryCreateActivityModule(payload, {
			title: "Status Test Module",
			type: "page",
			content: { test: "status content" },
			userId: testUserId,
		});

		if (!testModuleResult.ok) {
			throw new Error("Failed to create test module for status test");
		}

		const testModule = testModuleResult.value.activityModule;

		// Create branch from test module
		const testBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: testModule.id,
			branchName: "status-test-branch",
			userId: testUserId,
		});

		if (!testBranchResult.ok) {
			throw new Error("Failed to create test branch for status test");
		}

		const testBranch = testBranchResult.value;

		// First create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Status Test Merge Request",
			fromActivityModuleId: testModule.id,
			toActivityModuleId: testBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Update status to merged
		const updateResult = await tryUpdateMergeRequestStatus(payload, {
			id: mergeRequest.id,
			status: "merged",
			userId: testUserId,
		});

		expect(updateResult.ok).toBe(true);
		if (updateResult.ok) {
			expect(updateResult.value.status).toBe("merged");
			expect(updateResult.value.mergedAt).toBeDefined();
			const mergedById =
				typeof updateResult.value.mergedBy === "object" &&
				updateResult.value.mergedBy !== null
					? updateResult.value.mergedBy.id
					: updateResult.value.mergedBy;
			expect(mergedById).toBe(testUserId);
		}
	});

	test("should update merge request status to rejected", async () => {
		// Create a new activity module for this test to avoid conflicts
		const rejectModuleResult = await tryCreateActivityModule(payload, {
			title: "Reject Test Module",
			type: "assignment",
			content: { test: "reject content" },
			userId: testUserId,
		});

		if (!rejectModuleResult.ok) {
			throw new Error("Failed to create test module for reject test");
		}

		const rejectModule = rejectModuleResult.value.activityModule;

		// Create branch from reject module
		const rejectBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: rejectModule.id,
			branchName: "reject-test-branch",
			userId: testUserId,
		});

		if (!rejectBranchResult.ok) {
			throw new Error("Failed to create test branch for reject test");
		}

		const rejectBranch = rejectBranchResult.value;

		// First create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Reject Test Merge Request",
			fromActivityModuleId: rejectModule.id,
			toActivityModuleId: rejectBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Update status to rejected
		const updateResult = await tryUpdateMergeRequestStatus(payload, {
			id: mergeRequest.id,
			status: "rejected",
			userId: testUserId,
		});

		expect(updateResult.ok).toBe(true);
		if (updateResult.ok) {
			expect(updateResult.value.status).toBe("rejected");
			expect(updateResult.value.rejectedAt).toBeDefined();
			const rejectedById =
				typeof updateResult.value.rejectedBy === "object" &&
				updateResult.value.rejectedBy !== null
					? updateResult.value.rejectedBy.id
					: updateResult.value.rejectedBy;
			expect(rejectedById).toBe(testUserId);
		}
	});

	test("should get merge requests by activity module", async () => {
		// Create a new activity module for this test to avoid conflicts
		const queryModuleResult = await tryCreateActivityModule(payload, {
			title: "Query Test Module",
			type: "quiz",
			content: { test: "query content" },
			userId: testUserId,
		});

		if (!queryModuleResult.ok) {
			throw new Error("Failed to create test module for query test");
		}

		const queryModule = queryModuleResult.value.activityModule;

		// Create branch from query module
		const queryBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: queryModule.id,
			branchName: "query-test-branch",
			userId: testUserId,
		});

		if (!queryBranchResult.ok) {
			throw new Error("Failed to create test branch for query test");
		}

		const queryBranch = queryBranchResult.value;

		// Create a few merge requests
		await tryCreateMergeRequest(payload, {
			title: "Module Query Test 1",
			fromActivityModuleId: queryModule.id,
			toActivityModuleId: queryBranch.id,
			userId: testUserId,
		});

		await tryCreateMergeRequest(payload, {
			title: "Module Query Test 2",
			fromActivityModuleId: queryBranch.id,
			toActivityModuleId: queryModule.id,
			userId: testUserId,
		});

		// Get merge requests for queryModule
		const result = await tryGetMergeRequestsByActivityModule(payload, {
			activityModuleId: queryModule.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.length).toBeGreaterThan(0);
			// All returned merge requests should involve queryModule
			for (const mr of result.value) {
				const fromId = typeof mr.from === "object" ? mr.from.id : mr.from;
				const toId = typeof mr.to === "object" ? mr.to.id : mr.to;
				expect(fromId === queryModule.id || toId === queryModule.id).toBe(true);
			}
		}
	});

	test("should get merge requests by activity module with status filter", async () => {
		const result = await tryGetMergeRequestsByActivityModule(payload, {
			activityModuleId: activityModule1.id,
			status: "open",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			// All returned merge requests should be open
			for (const mr of result.value) {
				expect(mr.status).toBe("open");
			}
		}
	});

	test("should delete merge request", async () => {
		// Create a new activity module for this test to avoid conflicts
		const deleteModuleResult = await tryCreateActivityModule(payload, {
			title: "Delete Test Module",
			type: "discussion",
			content: { test: "delete content" },
			userId: testUserId,
		});

		if (!deleteModuleResult.ok) {
			throw new Error("Failed to create test module for delete test");
		}

		const deleteModule = deleteModuleResult.value.activityModule;

		// Create branch from delete module
		const deleteBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: deleteModule.id,
			branchName: "delete-test-branch",
			userId: testUserId,
		});

		if (!deleteBranchResult.ok) {
			throw new Error("Failed to create test branch for delete test");
		}

		const deleteBranch = deleteBranchResult.value;

		// First create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Delete Test Merge Request",
			fromActivityModuleId: deleteModule.id,
			toActivityModuleId: deleteBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Delete the merge request
		const deleteResult = await tryDeleteMergeRequest(payload, {
			id: mergeRequest.id,
			userId: testUserId,
		});

		expect(deleteResult.ok).toBe(true);
		if (deleteResult.ok) {
			expect(deleteResult.value.id).toBe(mergeRequest.id);
		}

		// Verify it's deleted by trying to get it
		const getResult = await tryGetMergeRequestById(payload, {
			id: mergeRequest.id,
		});

		expect(getResult.ok).toBe(false);
		if (!getResult.ok) {
			expect(getResult.error.type).toBe("NonExistingMergeRequestError");
		}
	});

	test("should fail to delete non-existing merge request", async () => {
		const result = await tryDeleteMergeRequest(payload, {
			id: 99999,
			userId: testUserId,
		});

		expect(result.ok).toBe(false);
	});
});
