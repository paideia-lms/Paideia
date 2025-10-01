import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { MerkleTree } from "merkletreejs";
import { getPayload } from "payload";
import { DuplicateBranchError, NonExistingSourceError } from "~/utils/error";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	type CreateBranchArgs,
	type GetActivityModuleArgs,
	type MergeBranchArgs,
	type SearchActivityModulesArgs,
	SHA256,
	tryCreateActivityModule,
	tryCreateBranch,
	tryDeleteActivityModule,
	tryDeleteBranch,
	tryGetActivityModule,
	tryGetBranchesForModule,
	tryMergeBranch,
	trySearchActivityModules,
	tryUpdateActivityModule,
	type UpdateActivityModuleArgs,
} from "./activity-module-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Activity Module Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: any;
	let instructorId: number;
	let studentId: number;

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

		// Create test users (instructor and student)
		const instructorArgs: CreateUserArgs = {
			email: "instructor@test.com",
			password: "password123",
			firstName: "John",
			lastName: "Instructor",
			role: "instructor",
		};

		const studentArgs: CreateUserArgs = {
			email: "student@test.com",
			password: "password456",
			firstName: "Jane",
			lastName: "Student",
			role: "student",
		};

		const instructorResult = await tryCreateUser(
			payload,
			mockRequest,
			instructorArgs,
		);
		const studentResult = await tryCreateUser(
			payload,
			mockRequest,
			studentArgs,
		);

		if (!instructorResult.ok || !studentResult.ok) {
			throw new Error("Failed to create test users");
		}

		instructorId = instructorResult.value.id as number;
		studentId = studentResult.value.id as number;

		// Create mock request object with user
		mockRequest = {
			user: {
				id: instructorId,
				email: "instructor@test.com",
				role: "instructor",
			},
		};
	});

	afterAll(async () => {
		if (payload?.db.destroy) {
			await payload.db.destroy();
		}
	});

	test("should create a new activity module with initial version", async () => {
		const createArgs: CreateActivityModuleArgs = {
			slug: "test-page-module",
			title: "Test Page Module",
			description: "A test page module for learning",
			type: "page",
			status: "draft",
			content: {
				html: "<h1>Welcome to the test page</h1>",
				css: "h1 { color: blue; }",
			},
			commitMessage: "Initial creation of test page module",
			branchName: "main",
			userId: instructorId,
		};

		const result = await tryCreateActivityModule(
			payload,
			mockRequest,
			createArgs,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.activityModule.slug).toBe("test-page-module");
			expect(result.value.activityModule.title).toBe("Test Page Module");
			expect(result.value.activityModule.type).toBe("page");
			expect(result.value.activityModule.status).toBe("draft");

			expect(result.value.version.title).toBe("Test Page Module");
			expect(result.value.version.content).toEqual({
				html: "<h1>Welcome to the test page</h1>",
				css: "h1 { color: blue; }",
			});
			expect(result.value.version.isCurrentHead).toBe(true);
			expect(result.value.version.contentHash).toBeDefined();

			expect(result.value.commit.message).toBe(
				"Initial creation of test page module",
			);
			expect(result.value.commit.hash).toBeDefined();
			expect(result.value.commit.isMergeCommit).toBe(false);

			expect(result.value.branch.name).toBe("main");
			expect(result.value.branch.isDefault).toBe(true);
		}
	});

	test("should get an activity module by slug", async () => {
		const getArgs: GetActivityModuleArgs = {
			slug: "test-page-module",
			branchName: "main",
		};

		const result = await tryGetActivityModule(payload, getArgs);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.activityModule.slug).toBe("test-page-module");
			expect(result.value.activityModule.title).toBe("Test Page Module");
			expect(result.value.version.content).toEqual({
				html: "<h1>Welcome to the test page</h1>",
				css: "h1 { color: blue; }",
			});
			expect(result.value.version.isCurrentHead).toBe(true);
			expect(result.value.branch.name).toBe("main");
		}
	});

	test("should update an activity module and create new version", async () => {
		const updateArgs: UpdateActivityModuleArgs = {
			title: "Updated Test Page Module",
			content: {
				html: "<h1>Updated welcome message</h1>",
				css: "h1 { color: red; }",
				js: "console.log('Updated!');",
			},
			commitMessage: "Updated content and styling",
			userId: instructorId,
		};

		const result = await tryUpdateActivityModule(
			payload,
			mockRequest,
			"test-page-module",
			updateArgs,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.activityModule.title).toBe(
				"Updated Test Page Module",
			);
			expect(result.value.version.title).toBe("Updated Test Page Module");
			expect(result.value.version.content).toEqual({
				html: "<h1>Updated welcome message</h1>",
				css: "h1 { color: red; }",
				js: "console.log('Updated!');",
			});
			expect(result.value.version.isCurrentHead).toBe(true);
			expect(result.value.commit.message).toBe("Updated content and styling");

			// Verify there are now 2 commits in the branch
			const allVersions = await payload.find({
				collection: "activity-module-versions",
				where: {
					and: [
						{ activityModule: { equals: result.value.activityModule.id } },
						{ branch: { equals: result.value.branch.id } },
					],
				},
				populate: {
					commits: {
						hash: true,
						message: true,
						author: true,
						commitDate: true,
					},
				},
			});

			expect(allVersions.docs.length).toBe(2);

			// Verify commit hashes using MerkleTree
			// Handle both depth 0 (ID) and depth 1 (populated object) cases
			const commits = allVersions.docs.map((version) => {
				const commit = version.commit;
				// If commit is populated (depth 1), return the object
				if (typeof commit === "object" && commit !== null && "hash" in commit) {
					return commit;
				}
				// If commit is just an ID (depth 0), we need to handle this case
				throw new Error(
					"Commit should be populated with hash, message, author, and commitDate",
				);
			});

			// Test the first commit (initial) - should be at index 1 (older)
			const initialContent = {
				html: "<h1>Welcome to the test page</h1>",
				css: "h1 { color: blue; }",
			};
			const initialCommitData = {
				content: JSON.stringify(
					initialContent,
					Object.keys(initialContent).sort(),
				),
				message: "Initial creation of test page module",
				authorId: instructorId,
				timestamp: new Date(commits[1].commitDate).toISOString(),
			};
			const initialDataString = JSON.stringify(initialCommitData);
			const initialLeaves = [initialDataString].map((x) => SHA256(x));
			const initialTree = new MerkleTree(initialLeaves, SHA256);
			const initialExpectedHash = initialTree.getRoot().toString("hex");

			expect(commits[1].hash).toBe(initialExpectedHash);

			// Test the updated commit - should be at index 0 (latest)
			const updatedContent = {
				html: "<h1>Updated welcome message</h1>",
				css: "h1 { color: red; }",
				js: "console.log('Updated!');",
			};
			const updatedCommitData = {
				content: JSON.stringify(
					updatedContent,
					Object.keys(updatedContent).sort(),
				),
				message: "Updated content and styling",
				authorId: instructorId,
				timestamp: new Date(commits[0].commitDate).toISOString(),
			};
			const updatedDataString = JSON.stringify(updatedCommitData);
			const updatedLeaves = [updatedDataString].map((x) => SHA256(x));
			const updatedTree = new MerkleTree(updatedLeaves, SHA256);
			const updatedExpectedHash = updatedTree.getRoot().toString("hex");

			expect(commits[0].hash).toBe(updatedExpectedHash);

			// Verify MerkleTree proof verification works
			const leaf = SHA256(updatedDataString);
			const proof = updatedTree.getProof(leaf);
			const isValid = updatedTree.verify(proof, leaf, updatedExpectedHash);
			expect(isValid).toBe(true);

			// Test that a bad proof fails
			const badLeaf = SHA256("bad data");
			const badProof = updatedTree.getProof(badLeaf);
			const isBadValid = updatedTree.verify(
				badProof,
				badLeaf,
				updatedExpectedHash,
			);
			expect(isBadValid).toBe(false);
		}
	});

	test("should create a branch from main with existing activity modules", async () => {
		const createBranchArgs: CreateBranchArgs = {
			branchName: "feature-branch",
			description: "Feature branch for testing",
			fromBranch: "main",
			userId: instructorId,
		};

		const result = await tryCreateBranch(payload, createBranchArgs);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.branch.name).toBe("feature-branch");
			expect(result.value.branch.description).toBe(
				"Feature branch for testing",
			);
			expect(result.value.branch.isDefault).toBe(false);
			expect(result.value.sourceBranch.name).toBe("main");
			expect(result.value.copiedVersionsCount).toBe(1); // Should have copied the test-page-module

			// Verify the activity module exists in the new branch
			const getResult = await tryGetActivityModule(payload, {
				slug: "test-page-module",
				branchName: "feature-branch",
			});

			expect(getResult.ok).toBe(true);
			if (getResult.ok) {
				expect(getResult.value.activityModule.slug).toBe("test-page-module");
				expect(getResult.value.branch.name).toBe("feature-branch");
				expect(getResult.value.version.title).toBe("Updated Test Page Module"); // Should have the updated version
				expect(getResult.value.version.content).toEqual({
					html: "<h1>Updated welcome message</h1>",
					css: "h1 { color: red; }",
					js: "console.log('Updated!');",
				});
				expect(getResult.value.version.isCurrentHead).toBe(true);
			}
		}
	});

	test("should fail to create branch with duplicate name", async () => {
		const createBranchArgs: CreateBranchArgs = {
			branchName: "feature-branch", // This branch already exists
			description: "Duplicate branch",
			fromBranch: "main",
			userId: instructorId,
		};

		const result = await tryCreateBranch(payload, createBranchArgs);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeInstanceOf(DuplicateBranchError);
			expect(result.error.message).toContain("already exists");
		}
	});

	test("should fail to create branch from non-existent source branch", async () => {
		const createBranchArgs: CreateBranchArgs = {
			branchName: "another-branch",
			description: "Branch from non-existent source",
			fromBranch: "non-existent-branch",
			userId: instructorId,
		};

		const result = await tryCreateBranch(payload, createBranchArgs);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeInstanceOf(NonExistingSourceError);
			expect(result.error.message).toContain("not found");
		}
	});

	test("should search activity modules", async () => {
		// Create another activity module for search testing
		const createArgs: CreateActivityModuleArgs = {
			slug: "test-quiz-module",
			title: "Test Quiz Module",
			description: "A test quiz module",
			type: "quiz",
			status: "published",
			content: {
				questions: [
					{
						question: "What is 2+2?",
						answers: ["3", "4", "5"],
						correct: 1,
					},
				],
			},
			commitMessage: "Initial quiz creation",
			userId: instructorId,
		};

		await tryCreateActivityModule(payload, mockRequest, createArgs);

		const searchArgs: SearchActivityModulesArgs = {
			type: "page",
			limit: 10,
			page: 1,
		};

		const result = await trySearchActivityModules(payload, searchArgs);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.docs.length).toBeGreaterThan(0);
			expect(result.value.docs[0].activityModule.type).toBe("page");
			expect(result.value.totalDocs).toBeGreaterThan(0);
		}
	});

	test("should delete an activity module", async () => {
		const result = await tryDeleteActivityModule(
			payload,
			mockRequest,
			"test-quiz-module",
			instructorId,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.slug).toBe("test-quiz-module");
		}

		// Verify it's deleted by trying to get it
		const getResult = await tryGetActivityModule(payload, {
			slug: "test-quiz-module",
		});

		expect(getResult.ok).toBe(false);
		if (!getResult.ok) {
			expect(getResult.error.message).toContain(
				"Failed to get activity module",
			);
		}
	});

	test("should fail to create activity module with duplicate slug", async () => {
		const createArgs: CreateActivityModuleArgs = {
			slug: "test-page-module", // This slug already exists
			title: "Duplicate Module",
			type: "page",
			content: { html: "<p>Duplicate</p>" },
			userId: instructorId,
		};

		const result = await tryCreateActivityModule(
			payload,
			mockRequest,
			createArgs,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain(
				"Failed to create activity module",
			);
		}
	});

	test("should fail to get non-existent activity module", async () => {
		const result = await tryGetActivityModule(payload, {
			slug: "non-existent-module",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Failed to get activity module");
		}
	});

	test("comprehensive branch merge workflow", async () => {
		// Step 1: Create an activity module, check it is main branch
		const createArgs: CreateActivityModuleArgs = {
			slug: "merge-test-module",
			title: "Merge Test Module",
			description: "A module for testing merge functionality",
			type: "page",
			status: "draft",
			content: {
				html: "<h1>Initial content</h1>",
				css: "h1 { color: black; }",
			},
			commitMessage: "Initial commit",
			branchName: "main",
			userId: instructorId,
		};

		const createResult = await tryCreateActivityModule(
			payload,
			mockRequest,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		// Verify it's on main branch
		const mainResult = await tryGetActivityModule(payload, {
			slug: "merge-test-module",
			branchName: "main",
		});
		expect(mainResult.ok).toBe(true);
		if (!mainResult.ok) return;
		expect(mainResult.value.branch.name).toBe("main");

		// Step 2: Create branch1, create a new commit, check it has 2 commits
		const branch1Args: CreateBranchArgs = {
			branchName: "branch1",
			description: "First feature branch",
			fromBranch: "main",
			userId: instructorId,
		};

		const branch1Result = await tryCreateBranch(payload, branch1Args);
		expect(branch1Result.ok).toBe(true);
		if (!branch1Result.ok) return;

		// Create new commit in branch1
		const updateBranch1Args: UpdateActivityModuleArgs = {
			content: {
				html: "<h1>Updated in branch1</h1>",
				css: "h1 { color: blue; }",
			},
			commitMessage: "Update in branch1",
			branchName: "branch1",
			userId: instructorId,
		};

		const updateBranch1Result = await tryUpdateActivityModule(
			payload,
			mockRequest,
			"merge-test-module",
			updateBranch1Args,
		);
		expect(updateBranch1Result.ok).toBe(true);

		// Check branch1 has 2 commits
		const branch1Versions = await payload.find({
			collection: "activity-module-versions",
			where: {
				and: [
					{ activityModule: { equals: createResult.value.activityModule.id } },
					{ branch: { equals: branch1Result.value.branch.id } },
				],
			},
		});
		expect(branch1Versions.docs.length).toBe(2);

		// Step 3: Create branch2 from branch1, create a new commit, check it has 2 commits
		const branch2Args: CreateBranchArgs = {
			branchName: "branch2",
			description: "Second feature branch",
			fromBranch: "branch1",
			userId: instructorId,
		};

		const branch2Result = await tryCreateBranch(payload, branch2Args);
		expect(branch2Result.ok).toBe(true);
		if (!branch2Result.ok) return;

		// Create new commit in branch2
		const updateBranch2Args: UpdateActivityModuleArgs = {
			content: {
				html: "<h1>Updated in branch2</h1>",
				css: "h1 { color: red; }",
				js: "console.log('branch2');",
			},
			commitMessage: "Update in branch2",
			branchName: "branch2",
			userId: instructorId,
		};

		const updateBranch2Result = await tryUpdateActivityModule(
			payload,
			mockRequest,
			"merge-test-module",
			updateBranch2Args,
		);
		expect(updateBranch2Result.ok).toBe(true);

		// Check branch2 has 2 commits (initial + branch1 update + branch2 update = 2 versions, but branch2 was created from branch1 so it inherits the commits)
		const branch2Versions = await payload.find({
			collection: "activity-module-versions",
			where: {
				and: [
					{ activityModule: { equals: createResult.value.activityModule.id } },
					{ branch: { equals: branch2Result.value.branch.id } },
				],
			},
		});
		expect(branch2Versions.docs.length).toBe(2); // branch2 has 2 versions: copied from branch1 + new update

		// Step 4: Merge branch2 back to branch1, check branch1 has 3 commits
		const mergeBranch2ToBranch1Args: MergeBranchArgs = {
			sourceBranch: "branch2",
			targetBranch: "branch1",
			mergeMessage: "Merge branch2 into branch1",
			userId: instructorId,
		};

		const merge1Result = await tryMergeBranch(
			payload,
			mergeBranch2ToBranch1Args,
		);
		if (!merge1Result.ok) {
			console.error("Merge failed:", merge1Result.error.message);
			console.error("Error details:", merge1Result.error);
		}
		expect(merge1Result.ok).toBe(true);
		if (!merge1Result.ok) return;
		expect(merge1Result.value.mergedVersionsCount).toBeGreaterThan(0);

		// Check branch1 now has 3 commits (original + branch1 update + merge commit)
		const branch1VersionsAfterMerge = await payload.find({
			collection: "activity-module-versions",
			where: {
				and: [
					{ activityModule: { equals: createResult.value.activityModule.id } },
					{ branch: { equals: branch1Result.value.branch.id } },
				],
			},
		});
		expect(branch1VersionsAfterMerge.docs.length).toBe(3);

		// Verify branch1 has the latest content from branch2
		const branch1AfterMerge = await tryGetActivityModule(payload, {
			slug: "merge-test-module",
			branchName: "branch1",
		});
		expect(branch1AfterMerge.ok).toBe(true);
		if (!branch1AfterMerge.ok) return;
		expect(branch1AfterMerge.value.version.content).toEqual({
			html: "<h1>Updated in branch2</h1>",
			css: "h1 { color: red; }",
			js: "console.log('branch2');",
		});

		// Step 5: Merge branch2 back to main branch, check main branch has 3 commits
		const mergeBranch2ToMainArgs: MergeBranchArgs = {
			sourceBranch: "branch2",
			targetBranch: "main",
			mergeMessage: "Merge branch2 into main",
			userId: instructorId,
		};

		const merge2Result = await tryMergeBranch(payload, mergeBranch2ToMainArgs);
		if (!merge2Result.ok) {
			console.error("Merge2 failed:", merge2Result.error.message);
			console.error("Error details:", merge2Result.error);
		}
		expect(merge2Result.ok).toBe(true);
		if (!merge2Result.ok) return;

		// Check main now has 2 commits (original + merge commit)
		const mainVersionsAfterMerge = await payload.find({
			collection: "activity-module-versions",
			where: {
				and: [
					{ activityModule: { equals: createResult.value.activityModule.id } },
					{ branch: { equals: createResult.value.branch.id } },
				],
			},
		});
		expect(mainVersionsAfterMerge.docs.length).toBe(2);

		// Step 6: Merge branch1 to main branch, nothing should happen (already up to date)
		const mergeBranch1ToMainArgs: MergeBranchArgs = {
			sourceBranch: "branch1",
			targetBranch: "main",
			mergeMessage: "Merge branch1 into main",
			userId: instructorId,
		};

		const merge3Result = await tryMergeBranch(payload, mergeBranch1ToMainArgs);
		if (!merge3Result.ok) {
			console.error("Merge3 failed:", merge3Result.error.message);
			console.error("Error details:", merge3Result.error);
		}
		expect(merge3Result.ok).toBe(true);
		if (!merge3Result.ok) return;
		// Should be 0 because main already has the latest content
		expect(merge3Result.value.mergedVersionsCount).toBe(0);

		// Step 7: Select branches of this module, should have 3 branches
		const branchesResult = await tryGetBranchesForModule(payload, {
			moduleSlug: "merge-test-module",
		});
		expect(branchesResult.ok).toBe(true);
		if (!branchesResult.ok) return;
		expect(branchesResult.value.branches.length).toBe(3);

		const branchNames = branchesResult.value.branches.map((b) => b.name).sort();
		expect(branchNames).toEqual(["branch1", "branch2", "main"]);

		// Step 8: Delete branch1 and branch2, select branches again, should only have main
		const deleteBranch1Result = await tryDeleteBranch(
			payload,
			"branch1",
			instructorId,
		);
		expect(deleteBranch1Result.ok).toBe(true);

		const deleteBranch2Result = await tryDeleteBranch(
			payload,
			"branch2",
			instructorId,
		);
		expect(deleteBranch2Result.ok).toBe(true);

		// Check branches again
		const finalBranchesResult = await tryGetBranchesForModule(payload, {
			moduleSlug: "merge-test-module",
		});
		expect(finalBranchesResult.ok).toBe(true);
		if (!finalBranchesResult.ok) return;
		expect(finalBranchesResult.value.branches.length).toBe(1);
		expect(finalBranchesResult.value.branches[0].name).toBe("main");

		// Verify main branch still has the merged content
		const finalMainResult = await tryGetActivityModule(payload, {
			slug: "merge-test-module",
			branchName: "main",
		});
		expect(finalMainResult.ok).toBe(true);
		if (!finalMainResult.ok) return;
		expect(finalMainResult.value.version.content).toEqual({
			html: "<h1>Updated in branch2</h1>",
			css: "h1 { color: red; }",
			js: "console.log('branch2');",
		});
	});
});
