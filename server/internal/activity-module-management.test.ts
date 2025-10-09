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

const year = new Date().getFullYear();

describe("Activity Module Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUserId: number;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
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
			role: "user",
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
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should create a page activity module", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Test Page Module",
			description: "This is a test page module",
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

	test("should create an assignment activity module", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Test Assignment",
			description: "This is a test assignment",
			type: "assignment",
			status: "draft",
			userId: testUserId,
			assignmentData: {
				instructions: "Complete this assignment",
				dueDate: "2024-12-31",
				maxAttempts: 3,
				allowLateSubmissions: true,
				allowedFileTypes: [
					{ extension: "pdf", mimeType: "application/pdf" },
					{
						extension: "docx",
						mimeType:
							"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					},
				],
				maxFileSize: 10,
				maxFiles: 2,
				requireTextSubmission: true,
				requireFileSubmission: true,
			},
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
		expect(activityModule.assignment).toBeDefined();
	});

	test("should create a quiz activity module", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Test Quiz",
			description: "This is a test quiz",
			type: "quiz",
			status: "draft",
			userId: testUserId,
			quizData: {
				description: "Quiz description",
				instructions: "Answer all questions",
				dueDate: "2024-12-31",
				maxAttempts: 2,
				allowLateSubmissions: false,
				points: 100,
				gradingType: "automatic",
				timeLimit: 60,
				showCorrectAnswers: true,
				allowMultipleAttempts: true,
				shuffleQuestions: false,
				shuffleAnswers: true,
				showOneQuestionAtATime: false,
				requirePassword: false,
				questions: [
					{
						questionText: "What is 2 + 2?",
						questionType: "multiple_choice",
						points: 10,
						options: [
							{ text: "3", isCorrect: false, feedback: "Incorrect" },
							{ text: "4", isCorrect: true, feedback: "Correct!" },
							{ text: "5", isCorrect: false, feedback: "Incorrect" },
						],
						explanation: "2 + 2 equals 4",
					},
				],
			},
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
		expect(activityModule.quiz).toBeDefined();
	});

	test("should create a discussion activity module", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Test Discussion",
			description: "This is a test discussion",
			type: "discussion",
			status: "draft",
			userId: testUserId,
			discussionData: {
				description: "Discussion description",
				instructions: "Participate in this discussion",
				dueDate: "2024-12-31",
				requireThread: true,
				requireReplies: true,
				minReplies: 2,
				minWordsPerPost: 50,
				allowAttachments: true,
				allowUpvotes: true,
				allowEditing: true,
				allowDeletion: false,
				moderationRequired: false,
				anonymousPosting: false,
				groupDiscussion: false,
				threadSorting: "recent" as const,
			},
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
		expect(activityModule.discussion).toBeDefined();
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
		const testCases = [
			{
				type: "page" as const,
				args: {
					title: "page module",
					type: "page" as const,
					userId: testUserId,
				},
			},
			{
				type: "whiteboard" as const,
				args: {
					title: "whiteboard module",
					type: "whiteboard" as const,
					userId: testUserId,
				},
			},
			{
				type: "assignment" as const,
				args: {
					title: "assignment module",
					type: "assignment" as const,
					userId: testUserId,
					assignmentData: {
						instructions: "Complete this assignment",
						dueDate: "2024-12-31",
						maxAttempts: 1,
					},
				},
			},
			{
				type: "quiz" as const,
				args: {
					title: "quiz module",
					type: "quiz" as const,
					userId: testUserId,
					quizData: {
						instructions: "Answer all questions",
						points: 100,
					},
				},
			},
			{
				type: "discussion" as const,
				args: {
					title: "discussion module",
					type: "discussion" as const,
					userId: testUserId,
					discussionData: {
						instructions: "Participate in this discussion",
						minReplies: 1,
						threadSorting: "recent" as const,
					},
				},
			},
		];

		for (const testCase of testCases) {
			const result = await tryCreateActivityModule(payload, testCase.args);

			expect(result.ok).toBe(true);
			if (!result.ok) continue;

			expect(result.value.type).toBe(testCase.type);
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

	test("should update page activity module", async () => {
		const createArgs: CreateActivityModuleArgs = {
			title: "Update Test Page Module",
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
			title: "Updated Page Title",
			description: "Updated page description",
			status: "published",
		};

		const updateResult = await tryUpdateActivityModule(payload, updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated Page Title");
		expect(updatedModule.description).toBe("Updated page description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe(createdModule.type); // Should remain unchanged
	});

	test("should update assignment activity module", async () => {
		const createArgs: CreateActivityModuleArgs = {
			title: "Update Test Assignment",
			type: "assignment",
			status: "draft",
			userId: testUserId,
			assignmentData: {
				instructions: "Original instructions",
				dueDate: "2024-12-31",
				maxAttempts: 1,
			},
		};

		const createResult = await tryCreateActivityModule(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const updateArgs: UpdateActivityModuleArgs = {
			id: createdModule.id,
			title: "Updated Assignment Title",
			description: "Updated assignment description",
			status: "published",
			assignmentData: {
				instructions: "Updated instructions",
				dueDate: `${year}-01-31`,
				maxAttempts: 3,
				allowLateSubmissions: true,
			},
		};

		const updateResult = await tryUpdateActivityModule(payload, updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated Assignment Title");
		expect(updatedModule.description).toBe("Updated assignment description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe(createdModule.type); // Should remain unchanged
	});

	test("should update quiz activity module", async () => {
		const createArgs: CreateActivityModuleArgs = {
			title: "Update Test Quiz",
			type: "quiz",
			status: "draft",
			userId: testUserId,
			quizData: {
				instructions: "Original quiz instructions",
				points: 50,
				timeLimit: 30,
			},
		};

		const createResult = await tryCreateActivityModule(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const updateArgs: UpdateActivityModuleArgs = {
			id: createdModule.id,
			title: "Updated Quiz Title",
			description: "Updated quiz description",
			status: "published",
			quizData: {
				instructions: "Updated quiz instructions",
				points: 100,
				timeLimit: 60,
				showCorrectAnswers: true,
			},
		};

		const updateResult = await tryUpdateActivityModule(payload, updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated Quiz Title");
		expect(updatedModule.description).toBe("Updated quiz description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe(createdModule.type); // Should remain unchanged
	});

	test("should update discussion activity module", async () => {
		const createArgs: CreateActivityModuleArgs = {
			title: "Update Test Discussion",
			type: "discussion",
			status: "draft",
			userId: testUserId,
			discussionData: {
				instructions: "Original discussion instructions",
				minReplies: 1,
				minWordsPerPost: 25,
				threadSorting: "recent" as const,
			},
		};

		const createResult = await tryCreateActivityModule(payload, createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const updateArgs: UpdateActivityModuleArgs = {
			id: createdModule.id,
			title: "Updated Discussion Title",
			description: "Updated discussion description",
			status: "published",
			discussionData: {
				instructions: "Updated discussion instructions",
				minReplies: 3,
				minWordsPerPost: 100,
				allowAttachments: true,
				threadSorting: "upvoted" as const,
			},
		};

		const updateResult = await tryUpdateActivityModule(payload, updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated Discussion Title");
		expect(updatedModule.description).toBe("Updated discussion description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe(createdModule.type); // Should remain unchanged
	});

	test("should delete page activity module", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Delete Test Page Module",
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

	test("should delete assignment activity module with cascading delete", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Delete Test Assignment",
			type: "assignment",
			userId: testUserId,
			assignmentData: {
				instructions: "Complete this assignment",
				dueDate: "2024-12-31",
				maxAttempts: 3,
			},
		};

		const createResult = await tryCreateActivityModule(payload, args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;
		expect(createdModule.assignment).toBeDefined();

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

	test("should delete quiz activity module with cascading delete", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Delete Test Quiz",
			type: "quiz",
			userId: testUserId,
			quizData: {
				instructions: "Answer all questions",
				points: 100,
				questions: [
					{
						questionText: "What is 1 + 1?",
						questionType: "multiple_choice",
						points: 10,
						options: [
							{ text: "1", isCorrect: false },
							{ text: "2", isCorrect: true },
						],
					},
				],
			},
		};

		const createResult = await tryCreateActivityModule(payload, args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;
		expect(createdModule.quiz).toBeDefined();

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

	test("should delete discussion activity module with cascading delete", async () => {
		const args: CreateActivityModuleArgs = {
			title: "Delete Test Discussion",
			type: "discussion",
			userId: testUserId,
			discussionData: {
				instructions: "Participate in this discussion",
				minReplies: 2,
				minWordsPerPost: 50,
				threadSorting: "recent" as const,
			},
		};

		const createResult = await tryCreateActivityModule(payload, args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;
		expect(createdModule.discussion).toBeDefined();

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
				userId: testUserId,
			},
			{
				title: "List Test Module 2",
				type: "assignment" as const,
				status: "draft" as const,
				userId: testUserId,
				assignmentData: {
					instructions: "Complete this assignment",
					dueDate: "2024-12-31",
					maxAttempts: 1,
				},
			},
			{
				title: "List Test Module 3",
				type: "quiz" as const,
				status: "published" as const,
				userId: testUserId,
				quizData: {
					instructions: "Answer all questions",
					points: 100,
				},
			},
		];

		for (const module of modules) {
			const result = await tryCreateActivityModule(payload, module);
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

	test("should fail to create assignment without assignment data", async () => {
		const invalidArgs: CreateActivityModuleArgs = {
			title: "Test Assignment",
			type: "assignment",
			userId: testUserId,
			// Missing assignmentData
		};

		const result = await tryCreateActivityModule(payload, invalidArgs);
		expect(result.ok).toBe(false);
	});

	test("should fail to create quiz without quiz data", async () => {
		const invalidArgs: CreateActivityModuleArgs = {
			title: "Test Quiz",
			type: "quiz",
			userId: testUserId,
			// Missing quizData
		};

		const result = await tryCreateActivityModule(payload, invalidArgs);
		expect(result.ok).toBe(false);
	});

	test("should fail to create discussion without discussion data", async () => {
		const invalidArgs: CreateActivityModuleArgs = {
			title: "Test Discussion",
			type: "discussion",
			userId: testUserId,
			// Missing discussionData
		};

		const result = await tryCreateActivityModule(payload, invalidArgs);
		expect(result.ok).toBe(false);
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
