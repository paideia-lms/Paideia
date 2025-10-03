import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import config from "../payload.config";
import type { ActivityModule, User } from "../payload-types";
import {
	tryCreateActivityModule,
	tryCreateBranch,
	tryGetActivityModuleById,
} from "./activity-module-management";
import { tryCreateCommit } from "./commit-management";
import {
	tryAcceptMergeRequest,
	tryCloseMergeRequest,
	tryCreateMergeRequest,
	tryCreateMergeRequestComment,
	tryDeleteMergeRequest,
	tryGetMergeRequestById,
	tryGetMergeRequestsByActivityModule,
	tryRejectMergeRequest,
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

	test("should create a comment on merge request", async () => {
		// Create a new activity module for this test to avoid conflicts
		const commentModuleResult = await tryCreateActivityModule(payload, {
			title: "Comment Test Module",
			type: "page",
			content: { test: "comment content" },
			userId: testUserId,
		});

		if (!commentModuleResult.ok) {
			throw new Error("Failed to create test module for comment test");
		}

		const commentModule = commentModuleResult.value.activityModule;

		// Create branch from comment module
		const commentBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: commentModule.id,
			branchName: "comment-test-branch",
			userId: testUserId,
		});

		if (!commentBranchResult.ok) {
			throw new Error("Failed to create test branch for comment test");
		}

		const commentBranch = commentBranchResult.value;

		// Create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Comment Test Merge Request",
			fromActivityModuleId: commentModule.id,
			toActivityModuleId: commentBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Create a comment
		const commentResult = await tryCreateMergeRequestComment(payload, {
			mergeRequestId: mergeRequest.id,
			comment: "This is a test comment",
			userId: testUserId,
		});

		expect(commentResult.ok).toBe(true);
		if (commentResult.ok) {
			expect(commentResult.value.comment).toBe("This is a test comment");
			const createdById =
				typeof commentResult.value.createdBy === "object"
					? commentResult.value.createdBy.id
					: commentResult.value.createdBy;
			expect(createdById).toBe(testUserId);
		}
	});

	test("should fail to create comment when comments are disabled", async () => {
		// Create a new activity module for this test to avoid conflicts
		const disabledModuleResult = await tryCreateActivityModule(payload, {
			title: "Disabled Comment Test Module",
			type: "assignment",
			content: { test: "disabled comment content" },
			userId: testUserId,
		});

		if (!disabledModuleResult.ok) {
			throw new Error("Failed to create test module for disabled comment test");
		}

		const disabledModule = disabledModuleResult.value.activityModule;

		// Create branch from disabled module
		const disabledBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: disabledModule.id,
			branchName: "disabled-comment-test-branch",
			userId: testUserId,
		});

		if (!disabledBranchResult.ok) {
			throw new Error("Failed to create test branch for disabled comment test");
		}

		const disabledBranch = disabledBranchResult.value;

		// Create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Disabled Comment Test Merge Request",
			fromActivityModuleId: disabledModule.id,
			toActivityModuleId: disabledBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Disable comments on the merge request
		await payload.update({
			collection: "merge-requests",
			id: mergeRequest.id,
			data: { allowComments: false },
		});

		// Try to create a comment - should fail
		const commentResult = await tryCreateMergeRequestComment(payload, {
			mergeRequestId: mergeRequest.id,
			comment: "This comment should fail",
			userId: testUserId,
		});

		expect(commentResult.ok).toBe(false);
	});

	test("should reject merge request with reason", async () => {
		// Create a new activity module for this test to avoid conflicts
		const rejectModuleResult = await tryCreateActivityModule(payload, {
			title: "Reject Test Module",
			type: "quiz",
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

		// Create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Reject Test Merge Request",
			fromActivityModuleId: rejectModule.id,
			toActivityModuleId: rejectBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Reject the merge request
		const rejectResult = await tryRejectMergeRequest(payload, {
			id: mergeRequest.id,
			reason: "Code quality issues need to be addressed",
			userId: testUserId,
		});

		expect(rejectResult.ok).toBe(true);
		if (rejectResult.ok) {
			expect(rejectResult.value.status).toBe("rejected");
			expect(rejectResult.value.rejectedAt).toBeDefined();
			const rejectedById =
				typeof rejectResult.value.rejectedBy === "object"
					? rejectResult.value.rejectedBy!.id
					: rejectResult.value.rejectedBy;
			expect(rejectedById).toBe(testUserId);
		}
	});

	test("should reject merge request with reason and stop comments", async () => {
		// Create a new activity module for this test to avoid conflicts
		const rejectStopModuleResult = await tryCreateActivityModule(payload, {
			title: "Reject Stop Test Module",
			type: "discussion",
			content: { test: "reject stop content" },
			userId: testUserId,
		});

		if (!rejectStopModuleResult.ok) {
			throw new Error("Failed to create test module for reject stop test");
		}

		const rejectStopModule = rejectStopModuleResult.value.activityModule;

		// Create branch from reject stop module
		const rejectStopBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: rejectStopModule.id,
			branchName: "reject-stop-test-branch",
			userId: testUserId,
		});

		if (!rejectStopBranchResult.ok) {
			throw new Error("Failed to create test branch for reject stop test");
		}

		const rejectStopBranch = rejectStopBranchResult.value;

		// Create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Reject Stop Test Merge Request",
			fromActivityModuleId: rejectStopModule.id,
			toActivityModuleId: rejectStopBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Reject the merge request with stopComments
		const rejectResult = await tryRejectMergeRequest(payload, {
			id: mergeRequest.id,
			reason: "Major architectural issues",
			userId: testUserId,
			stopComments: true,
		});

		expect(rejectResult.ok).toBe(true);
		if (rejectResult.ok) {
			expect(rejectResult.value.status).toBe("rejected");
			expect(rejectResult.value.allowComments).toBe(false);
		}
	});

	test("should accept merge request without reason", async () => {
		// Create a new activity module for this test to avoid conflicts
		const acceptModuleResult = await tryCreateActivityModule(payload, {
			title: "Accept Test Module",
			type: "page",
			content: { test: "accept content" },
			userId: testUserId,
		});

		if (!acceptModuleResult.ok) {
			throw new Error("Failed to create test module for accept test");
		}

		const acceptModule = acceptModuleResult.value.activityModule;

		// Create branch from accept module
		const acceptBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: acceptModule.id,
			branchName: "accept-test-branch",
			userId: testUserId,
		});

		if (!acceptBranchResult.ok) {
			throw new Error("Failed to create test branch for accept test");
		}

		const acceptBranch = acceptBranchResult.value;

		// Create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Accept Test Merge Request",
			fromActivityModuleId: acceptModule.id,
			toActivityModuleId: acceptBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Accept the merge request without reason
		const acceptResult = await tryAcceptMergeRequest(payload, {
			id: mergeRequest.id,
			userId: testUserId,
		});

		expect(acceptResult.ok).toBe(true);
		if (acceptResult.ok) {
			expect(acceptResult.value.status).toBe("merged");
			expect(acceptResult.value.mergedAt).toBeDefined();
			const mergedById =
				typeof acceptResult.value.mergedBy === "object"
					? acceptResult.value.mergedBy!.id
					: acceptResult.value.mergedBy;
			expect(mergedById).toBe(testUserId);
		}
	});

	test("should accept merge request with reason", async () => {
		// Create a new activity module for this test to avoid conflicts
		const acceptReasonModuleResult = await tryCreateActivityModule(payload, {
			title: "Accept Reason Test Module",
			type: "assignment",
			content: { test: "accept reason content" },
			userId: testUserId,
		});

		if (!acceptReasonModuleResult.ok) {
			throw new Error("Failed to create test module for accept reason test");
		}

		const acceptReasonModule = acceptReasonModuleResult.value.activityModule;

		// Create branch from accept reason module
		const acceptReasonBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: acceptReasonModule.id,
			branchName: "accept-reason-test-branch",
			userId: testUserId,
		});

		if (!acceptReasonBranchResult.ok) {
			throw new Error("Failed to create test branch for accept reason test");
		}

		const acceptReasonBranch = acceptReasonBranchResult.value;

		// Create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Accept Reason Test Merge Request",
			fromActivityModuleId: acceptReasonModule.id,
			toActivityModuleId: acceptReasonBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Accept the merge request with reason
		const acceptResult = await tryAcceptMergeRequest(payload, {
			id: mergeRequest.id,
			reason: "All tests pass and code review is complete",
			userId: testUserId,
		});

		expect(acceptResult.ok).toBe(true);
		if (acceptResult.ok) {
			expect(acceptResult.value.status).toBe("merged");
			expect(acceptResult.value.mergedAt).toBeDefined();
		}
	});

	test("should close merge request without reason", async () => {
		// Create a new activity module for this test to avoid conflicts
		const closeModuleResult = await tryCreateActivityModule(payload, {
			title: "Close Test Module",
			type: "quiz",
			content: { test: "close content" },
			userId: testUserId,
		});

		if (!closeModuleResult.ok) {
			throw new Error("Failed to create test module for close test");
		}

		const closeModule = closeModuleResult.value.activityModule;

		// Create branch from close module
		const closeBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: closeModule.id,
			branchName: "close-test-branch",
			userId: testUserId,
		});

		if (!closeBranchResult.ok) {
			throw new Error("Failed to create test branch for close test");
		}

		const closeBranch = closeBranchResult.value;

		// Create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Close Test Merge Request",
			fromActivityModuleId: closeModule.id,
			toActivityModuleId: closeBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Close the merge request without reason
		const closeResult = await tryCloseMergeRequest(payload, {
			id: mergeRequest.id,
			userId: testUserId,
		});

		expect(closeResult.ok).toBe(true);
		if (closeResult.ok) {
			expect(closeResult.value.status).toBe("closed");
			expect(closeResult.value.closedAt).toBeDefined();
			const closedById =
				typeof closeResult.value.closedBy === "object"
					? closeResult.value.closedBy!.id
					: closeResult.value.closedBy;
			expect(closedById).toBe(testUserId);
		}
	});

	test("should close merge request with reason and stop comments", async () => {
		// Create a new activity module for this test to avoid conflicts
		const closeStopModuleResult = await tryCreateActivityModule(payload, {
			title: "Close Stop Test Module",
			type: "discussion",
			content: { test: "close stop content" },
			userId: testUserId,
		});

		if (!closeStopModuleResult.ok) {
			throw new Error("Failed to create test module for close stop test");
		}

		const closeStopModule = closeStopModuleResult.value.activityModule;

		// Create branch from close stop module
		const closeStopBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: closeStopModule.id,
			branchName: "close-stop-test-branch",
			userId: testUserId,
		});

		if (!closeStopBranchResult.ok) {
			throw new Error("Failed to create test branch for close stop test");
		}

		const closeStopBranch = closeStopBranchResult.value;

		// Create a merge request
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Close Stop Test Merge Request",
			fromActivityModuleId: closeStopModule.id,
			toActivityModuleId: closeStopBranch.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Close the merge request with reason and stopComments
		const closeResult = await tryCloseMergeRequest(payload, {
			id: mergeRequest.id,
			reason: "Superseded by a newer implementation",
			userId: testUserId,
			stopComments: true,
		});

		expect(closeResult.ok).toBe(true);
		if (closeResult.ok) {
			expect(closeResult.value.status).toBe("closed");
			expect(closeResult.value.allowComments).toBe(false);
		}
	});

	test("should perform fast-forward merge", async () => {
		// Create a new activity module for this test to avoid conflicts
		const ffModuleResult = await tryCreateActivityModule(payload, {
			title: "Fast Forward Test Module",
			type: "page",
			content: { test: "ff content" },
			userId: testUserId,
		});

		if (!ffModuleResult.ok) {
			throw new Error("Failed to create test module for fast-forward test");
		}

		const ffModule = ffModuleResult.value.activityModule;
		const initialCommit = ffModuleResult.value.commit;

		// Create branch from ff module
		const ffBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: ffModule.id,
			branchName: "ff-test-branch",
			userId: testUserId,
		});

		if (!ffBranchResult.ok) {
			throw new Error("Failed to create test branch for fast-forward test");
		}

		const ffBranch = ffBranchResult.value;

		// Add commits to the source branch (ffBranch) but not to target branch (ffModule)
		// This creates a fast-forward scenario
		const commit1Result = await tryCreateCommit(payload, {
			activityModule: ffBranch.id,
			message: "First commit on branch",
			author: testUserId,
			content: { feature: "new feature 1" },
			parentCommit: initialCommit.id,
		});

		expect(commit1Result.ok).toBe(true);
		if (!commit1Result.ok) return;

		const commit2Result = await tryCreateCommit(payload, {
			activityModule: ffBranch.id,
			message: "Second commit on branch",
			author: testUserId,
			content: { feature: "new feature 2" },
			parentCommit: commit1Result.value.id,
		});

		expect(commit2Result.ok).toBe(true);
		if (!commit2Result.ok) return;

		// Create a merge request from ffBranch to ffModule
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Fast Forward Test Merge Request",
			fromActivityModuleId: ffBranch.id,
			toActivityModuleId: ffModule.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Accept the merge request (should be fast-forward)
		const acceptResult = await tryAcceptMergeRequest(payload, {
			id: mergeRequest.id,
			reason: "Fast-forward merge test",
			userId: testUserId,
		});

		expect(acceptResult.ok).toBe(true);
		if (acceptResult.ok) {
			expect(acceptResult.value.status).toBe("merged");
			expect(acceptResult.value.mergedAt).toBeDefined();
		}

		// get the ffmodule, it should have 3 commits
		const newFfModuleResult = await tryGetActivityModuleById(payload, {
			id: ffModule.id,
		});

		expect(newFfModuleResult.ok).toBe(true);
		if (!ffModuleResult.ok) return;

		expect(newFfModuleResult.ok).toBe(true);
		if (!newFfModuleResult.ok) return;
		const newFfModuleWithCommits = newFfModuleResult.value;
		expect(newFfModuleWithCommits.commits?.docs?.length).toBe(3);
	});

	test("should perform three-way merge with resolved content", async () => {
		// Create a new activity module for this test to avoid conflicts
		const threeWayModuleResult = await tryCreateActivityModule(payload, {
			title: "Three Way Test Module",
			type: "assignment",
			content: { test: "three way content" },
			userId: testUserId,
		});

		if (!threeWayModuleResult.ok) {
			throw new Error("Failed to create test module for three-way test");
		}

		const threeWayModule = threeWayModuleResult.value.activityModule;
		const initialCommit = threeWayModuleResult.value.commit;

		// Create branch from three way module
		const threeWayBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: threeWayModule.id,
			branchName: "three-way-test-branch",
			userId: testUserId,
		});

		if (!threeWayBranchResult.ok) {
			throw new Error("Failed to create test branch for three-way test");
		}

		const threeWayBranch = threeWayBranchResult.value;

		// Add commits to both branches to create divergence
		// Commit to target branch (threeWayModule)
		const targetCommitResult = await tryCreateCommit(payload, {
			activityModule: threeWayModule.id,
			message: "Commit on target branch",
			author: testUserId,
			content: { target: "target changes" },
			parentCommit: initialCommit.id,
		});

		expect(targetCommitResult.ok).toBe(true);
		if (!targetCommitResult.ok) return;

		// Commit to source branch (threeWayBranch)
		const sourceCommitResult = await tryCreateCommit(payload, {
			activityModule: threeWayBranch.id,
			message: "Commit on source branch",
			author: testUserId,
			content: { source: "source changes" },
			parentCommit: initialCommit.id,
		});

		expect(sourceCommitResult.ok).toBe(true);
		if (!sourceCommitResult.ok) return;

		// Create a merge request from threeWayBranch to threeWayModule
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Three Way Test Merge Request",
			fromActivityModuleId: threeWayBranch.id,
			toActivityModuleId: threeWayModule.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Accept the merge request with resolved content (should be three-way)
		const resolvedContent = {
			merged: "resolved content",
			target: "target changes",
			source: "source changes",
		};

		const acceptResult = await tryAcceptMergeRequest(payload, {
			id: mergeRequest.id,
			reason: "Three-way merge test",
			userId: testUserId,
			resolvedContent,
		});

		expect(acceptResult.ok).toBe(true);
		if (acceptResult.ok) {
			expect(acceptResult.value.status).toBe("merged");
			expect(acceptResult.value.mergedAt).toBeDefined();
		}

		// get the new three way module, it should have 3 commits
		const newThreeWayModuleResult = await tryGetActivityModuleById(payload, {
			id: threeWayModule.id,
		});

		expect(newThreeWayModuleResult.ok).toBe(true);
		if (!newThreeWayModuleResult.ok) return;
		const newThreeWayModuleWithCommits = newThreeWayModuleResult.value;
		expect(newThreeWayModuleWithCommits.commits?.docs?.length).toBe(3);
	});

	test("should fail three-way merge without resolved content", async () => {
		// Create a new activity module for this test to avoid conflicts
		const failModuleResult = await tryCreateActivityModule(payload, {
			title: "Fail Test Module",
			type: "quiz",
			content: { test: "fail content" },
			userId: testUserId,
		});

		if (!failModuleResult.ok) {
			throw new Error("Failed to create test module for fail test");
		}

		const failModule = failModuleResult.value.activityModule;
		const initialCommit = failModuleResult.value.commit;

		// Create branch from fail module
		const failBranchResult = await tryCreateBranch(payload, {
			sourceActivityModuleId: failModule.id,
			branchName: "fail-test-branch",
			userId: testUserId,
		});

		if (!failBranchResult.ok) {
			throw new Error("Failed to create test branch for fail test");
		}

		const failBranch = failBranchResult.value;

		// Add commits to both branches to create divergence
		// Commit to target branch (failModule)
		const targetCommitResult = await tryCreateCommit(payload, {
			activityModule: failModule.id,
			message: "Commit on target branch",
			author: testUserId,
			content: { target: "target changes" },
			parentCommit: initialCommit.id,
		});

		expect(targetCommitResult.ok).toBe(true);
		if (!targetCommitResult.ok) return;

		// Commit to source branch (failBranch)
		const sourceCommitResult = await tryCreateCommit(payload, {
			activityModule: failBranch.id,
			message: "Commit on source branch",
			author: testUserId,
			content: { source: "source changes" },
			parentCommit: initialCommit.id,
		});

		expect(sourceCommitResult.ok).toBe(true);
		if (!sourceCommitResult.ok) return;

		// Create a merge request from failBranch to failModule
		const createResult = await tryCreateMergeRequest(payload, {
			title: "Fail Test Merge Request",
			fromActivityModuleId: failBranch.id,
			toActivityModuleId: failModule.id,
			userId: testUserId,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const mergeRequest = createResult.value.mergeRequest;

		// Try to accept the merge request without resolved content (should fail)
		const acceptResult = await tryAcceptMergeRequest(payload, {
			id: mergeRequest.id,
			reason: "Three-way merge test without resolved content",
			userId: testUserId,
			// No resolvedContent provided
		});

		expect(acceptResult.ok).toBe(false);
		if (!acceptResult.ok) {
			expect(acceptResult.error.message).toContain(
				"Resolved content is required for three-way merge",
			);
		}
	});
});
