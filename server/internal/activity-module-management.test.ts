import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { $ } from "bun";
import { MerkleTree } from "merkletreejs";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";

import {
	type CreateActivityModuleArgs,
	type GetActivityModuleArgs,
	type SearchActivityModulesArgs,
	SHA256,
	tryCreateActivityModule,
	tryDeleteActivityModule,
	tryGetActivityModule,
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
				timestamp: commits[1].commitDate,
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
				timestamp: commits[0].commitDate,
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
			expect(getResult.error.message).toContain("not found");
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
			expect(result.error.message).toContain("already exists");
		}
	});

	test("should fail to get non-existent activity module", async () => {
		const result = await tryGetActivityModule(payload, {
			slug: "non-existent-module",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("not found");
		}
	});
});
