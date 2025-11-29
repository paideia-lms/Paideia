import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateAssignmentModuleArgs,
	type CreateDiscussionModuleArgs,
	type CreatePageModuleArgs,
	type CreateQuizModuleArgs,
	type CreateWhiteboardModuleArgs,
	type UpdateAssignmentModuleArgs,
	type UpdateDiscussionModuleArgs,
	type UpdateFileModuleArgs,
	type UpdatePageModuleArgs,
	type UpdateQuizModuleArgs,
	tryCreateAssignmentModule,
	tryCreateDiscussionModule,
	tryCreateFileModule,
	tryCreatePageModule,
	tryCreateQuizModule,
	tryCreateWhiteboardModule,
	tryDeleteActivityModule,
	tryGetActivityModuleById,
	tryListActivityModules,
	tryUpdateAssignmentModule,
	tryUpdateDiscussionModule,
	tryUpdateFileModule,
	tryUpdatePageModule,
	tryUpdateQuizModule,
} from "./activity-module-management";
import { tryCreateUser } from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/type-narrowing";

describe("Activity Module Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUser: TryResultValue<typeof tryCreateUser>;

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

		// Create test admin user (only admin, instructor, or content-manager can create activity modules)
		testUser = await tryCreateUser({
			payload,
			data: {
				email: "test-activity@example.com",
				password: "password123",
				firstName: "Test",
				lastName: "User",
				role: "admin",
			},
			overrideAccess: true,
		}).getOrThrow();
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
		const args = {
			payload,
			title: "Test Page Module",
			description: "This is a test page module",
			status: "draft" as const,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			content: "<p>This is test page content</p>",
		} satisfies CreatePageModuleArgs;

		const result = await tryCreatePageModule(args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const activityModule = result.value;

		// Verify activity module
		expect(activityModule.title).toBe(args.title);
		expect(activityModule.description).toBe(args.description);
		expect(activityModule.type).toBe("page");
		expect(activityModule.status).toBe(args.status || "draft");
		expect(activityModule.createdBy.id).toBe(testUser.id);
		expect(activityModule.id).toBeDefined();
		expect(activityModule.createdAt).toBeDefined();
	});

	test("should create an assignment activity module", async () => {
		const args: CreateAssignmentModuleArgs = {
			payload,
			title: "Test Assignment",
			description: "This is a test assignment",
			status: "draft",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Complete this assignment",
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
		};

		const result = await tryCreateAssignmentModule(args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const activityModule = result.value;

		// Verify activity module
		expect(activityModule.title).toBe(args.title);
		expect(activityModule.type).toBe("assignment");
		// For assignments, description uses instructions if provided
		expect(activityModule.description).toBe(args.description);
		expect(activityModule.status).toBe(args.status || "draft");
		expect(activityModule.createdBy.id).toBe(testUser.id);
		expect(activityModule.id).toBeDefined();
		expect(activityModule.createdAt).toBeDefined();
		expect(activityModule.maxFiles).toBeDefined();
	});

	test("should create a quiz activity module", async () => {
		const args: CreateQuizModuleArgs = {
			payload,
			title: "Test Quiz",
			description: "This is a test quiz",
			status: "draft",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Answer all questions",
			points: 100,
			gradingType: "automatic",
			timeLimit: 60,
			showCorrectAnswers: true,
			allowMultipleAttempts: true,
			shuffleQuestions: false,
			shuffleAnswers: true,
			showOneQuestionAtATime: false,
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
		};

		const result = await tryCreateQuizModule(args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const activityModule = result.value;

		// Verify activity module
		expect(activityModule.title).toBe(args.title);
		expect(activityModule.description).toBe(args.description);
		expect(activityModule.type).toBe("quiz");
		expect(activityModule.status).toBe(args.status || "draft");
		expect(activityModule.createdBy.id).toBe(testUser.id);
		expect(activityModule.id).toBeDefined();
		expect(activityModule.createdAt).toBeDefined();
	});

	test("should create a file activity module", async () => {
		const args = {
			payload,
			title: "Test File Module",
			description: "This is a test file module",
			status: "draft" as const,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			media: [],
		};

		const result = await tryCreateFileModule(args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const activityModule = result.value;

		// Verify activity module
		expect(activityModule.title).toBe(args.title);
		expect(activityModule.description).toBe(args.description);
		expect(activityModule.type).toBe("file");
		expect(activityModule.status).toBe(args.status);
		expect(activityModule.createdBy.id).toBe(testUser.id);
		expect(activityModule.id).toBeDefined();
		expect(activityModule.createdAt).toBeDefined();
		expect(activityModule.media).toBeDefined();
	});

	test("should create a discussion activity module", async () => {
		const args: CreateDiscussionModuleArgs = {
			payload,
			title: "Test Discussion",
			description: "This is a test discussion",
			status: "draft",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
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
		};

		const result = await tryCreateDiscussionModule(args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const activityModule = result.value;

		// Verify activity module
		expect(activityModule.title).toBe(args.title);
		expect(activityModule.description).toBe(args.description);
		expect(activityModule.type).toBe("discussion");
		expect(activityModule.status).toBe(args.status || "draft");
		expect(activityModule.createdBy.id).toBe(testUser.id);
		expect(activityModule.id).toBeDefined();
		expect(activityModule.createdAt).toBeDefined();
		expect(activityModule.minReplies).toBeDefined();
	});

	test("should create activity module with default status", async () => {
		const args = {
			payload,
			title: "Test Activity Module 2",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			content: JSON.stringify({ shapes: [], bindings: [] }),
		} satisfies CreateWhiteboardModuleArgs;

		const result = await tryCreateWhiteboardModule(args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const activityModule = result.value;
		expect(activityModule.status).toBe("draft");
	});

	test("should create activity module with all types", async () => {
		const results = await Promise.all([
			tryCreatePageModule({
				payload,
				title: "page module",
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				content: "<p>Test page content</p>",
			}),
			tryCreateWhiteboardModule({
				payload,
				title: "whiteboard module",
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				content: JSON.stringify({ shapes: [], bindings: [] }),
			}),
			tryCreateFileModule({
				payload,
				title: "file module",
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				media: [],
			}),
			tryCreateAssignmentModule({
				payload,
				title: "assignment module",
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				instructions: "Complete this assignment",
			}),
			tryCreateQuizModule({
				payload,
				title: "quiz module",
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				instructions: "Answer all questions",
				points: 100,
			}),
			tryCreateDiscussionModule({
				payload,
				title: "discussion module",
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				instructions: "Participate in this discussion",
				minReplies: 1,
				threadSorting: "recent" as const,
			}),
		]);

		const expectedType: Array<
			"page" | "whiteboard" | "file" | "assignment" | "quiz" | "discussion"
		> = ["page", "whiteboard", "file", "assignment", "quiz", "discussion"];

		results.forEach((result, index) => {
			expect(result.ok).toBe(true);
			if (!result.ok) {
				return;
			}

			expect(result.value.type).toBe(expectedType[index]!);
		});
	});

	test("should get activity module by ID", async () => {
		const args = {
			payload,
			title: "Get Test Module",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			content: "<p>Get test content</p>",
		} satisfies CreatePageModuleArgs;

		const createResult = await tryCreatePageModule(args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const getResult = await tryGetActivityModuleById({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedModule = getResult.value;
		expect(retrievedModule.id).toBe(createdModule.id);
		expect(retrievedModule.title).toBe(createdModule.title);
		expect(retrievedModule.type).toBe(createdModule.type);
		expect(retrievedModule.status).toBe(createdModule.status);
		expect(retrievedModule.createdBy.id).toBe(testUser.id);
	});

	test("should update page activity module", async () => {
		const createArgs = {
			payload,
			title: "Update Test Page Module",
			status: "draft",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			content: "<p>Original content</p>",
		} satisfies CreatePageModuleArgs;

		const createResult = await tryCreatePageModule(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const updateArgs: UpdatePageModuleArgs = {
			payload,
			id: createdModule.id,
			title: "Updated Page Title",
			description: "Updated page description",
			status: "published",
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			content: "<p>Updated content</p>",
		};

		const updateResult = await tryUpdatePageModule(updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated Page Title");
		expect(updatedModule.description).toBe("Updated page description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe("page"); // Should remain unchanged
	});

	test("should update assignment activity module", async () => {
		const createArgs = {
			payload,
			title: "Update Test Assignment",
			status: "draft",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Original instructions",
		} satisfies CreateAssignmentModuleArgs;

		const createResult = await tryCreateAssignmentModule(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const updateArgs: UpdateAssignmentModuleArgs = {
			payload,
			id: createdModule.id,
			title: "Updated Assignment Title",
			description: "Updated assignment description",
			status: "published",
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Updated instructions",
		};

		const updateResult = await tryUpdateAssignmentModule(updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated Assignment Title");
		// For assignments, description uses instructions if provided
		expect(updatedModule.description).toBe("Updated assignment description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe("assignment"); // Should remain unchanged
	});

	test("should update quiz activity module", async () => {
		const createArgs = {
			payload,
			title: "Update Test Quiz",
			status: "draft",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Original quiz instructions",
			points: 50,
			timeLimit: 30,
		} satisfies CreateQuizModuleArgs;

		const createResult = await tryCreateQuizModule(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const updateArgs: UpdateQuizModuleArgs = {
			payload,
			id: createdModule.id,
			title: "Updated Quiz Title",
			description: "Updated quiz description",
			status: "published",
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Updated quiz instructions",
			points: 100,
			timeLimit: 60,
			showCorrectAnswers: true,
		};

		const updateResult = await tryUpdateQuizModule(updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated Quiz Title");
		expect(updatedModule.description).toBe("Updated quiz description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe("quiz"); // Should remain unchanged
	});

	test("should update file activity module", async () => {
		const createArgs = {
			payload,
			title: "Update Test File Module",
			status: "draft" as const,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			media: [],
		};

		const createResult = await tryCreateFileModule(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const updateArgs: UpdateFileModuleArgs = {
			payload,
			id: createdModule.id,
			title: "Updated File Title",
			description: "Updated file description",
			status: "published",
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			media: [],
		};

		const updateResult = await tryUpdateFileModule(updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated File Title");
		expect(updatedModule.description).toBe("Updated file description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe("file"); // Should remain unchanged
	});

	test("should update discussion activity module", async () => {
		const createArgs = {
			payload,
			title: "Update Test Discussion",
			status: "draft",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Original discussion instructions",
			minReplies: 1,
			minWordsPerPost: 25,
			threadSorting: "recent" as const,
		} satisfies CreateDiscussionModuleArgs;

		const createResult = await tryCreateDiscussionModule(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const updateArgs: UpdateDiscussionModuleArgs = {
			payload,
			id: createdModule.id,
			title: "Updated Discussion Title",
			description: "Updated discussion description",
			status: "published",
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Updated discussion instructions",
			minReplies: 3,
			minWordsPerPost: 100,
			allowAttachments: true,
			threadSorting: "upvoted" as const,
		};

		const updateResult = await tryUpdateDiscussionModule(updateArgs);
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedModule = updateResult.value;
		expect(updatedModule.title).toBe("Updated Discussion Title");
		// For discussions, description uses discussionData.description if provided
		expect(updatedModule.description).toBe("Updated discussion description");
		expect(updatedModule.status).toBe("published");
		expect(updatedModule.type).toBe("discussion"); // Should remain unchanged
	});

	test("should delete page activity module", async () => {
		const args = {
			payload,
			title: "Delete Test Page Module",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			content: "<p>Delete test content</p>",
		} satisfies CreatePageModuleArgs;

		const createResult = await tryCreatePageModule(args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;

		const deleteResult = await tryDeleteActivityModule({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(deleteResult.ok).toBe(true);

		// Verify module is deleted
		const getResult = await tryGetActivityModuleById({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(getResult.ok).toBe(false);
	});

	test("should delete assignment activity module with cascading delete", async () => {
		const args = {
			payload,
			title: "Delete Test Assignment",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Complete this assignment",
		} satisfies CreateAssignmentModuleArgs;

		const createResult = await tryCreateAssignmentModule(args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;
		if (createdModule.type !== "assignment")
			throw new Error("Test Error: Activity module type is not assignment");

		const deleteResult = await tryDeleteActivityModule({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(deleteResult.ok).toBe(true);

		// Verify module is deleted
		const getResult = await tryGetActivityModuleById({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(getResult.ok).toBe(false);
	});

	test("should delete quiz activity module with cascading delete", async () => {
		const args = {
			payload,
			title: "Delete Test Quiz",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Answer all questions",
			points: 100,
		} satisfies CreateQuizModuleArgs;

		const createResult = await tryCreateQuizModule(args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;
		if (createdModule.type !== "quiz")
			throw new Error("Test Error: Activity module type is not quiz");
		expect(createdModule.points).toBeDefined();

		const deleteResult = await tryDeleteActivityModule({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(deleteResult.ok).toBe(true);

		// Verify module is deleted
		const getResult = await tryGetActivityModuleById({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(getResult.ok).toBe(false);
	});

	test("should delete file activity module with cascading delete", async () => {
		const args = {
			payload,
			title: "Delete Test File Module",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			media: [],
		} ;

		const createResult = await tryCreateFileModule(args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;
		if (createdModule.type !== "file")
			throw new Error("Test Error: Activity module type is not file");
		expect(createdModule.media).toBeDefined();

		const deleteResult = await tryDeleteActivityModule({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(deleteResult.ok).toBe(true);

		// Verify module is deleted
		const getResult = await tryGetActivityModuleById({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(getResult.ok).toBe(false);
	});

	test("should delete discussion activity module with cascading delete", async () => {
		const args = {
			payload,
			title: "Delete Test Discussion",
			
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			instructions: "Participate in this discussion",
			minReplies: 2,
			minWordsPerPost: 50,
			threadSorting: "recent" as const,
		} satisfies CreateDiscussionModuleArgs;

		const createResult = await tryCreateDiscussionModule(args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdModule = createResult.value;
		if (createdModule.type !== "discussion")
			throw new Error("Test Error: Activity module type is not discussion");
		expect(createdModule.minReplies).toBeDefined();

		const deleteResult = await tryDeleteActivityModule({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(deleteResult.ok).toBe(true);

		// Verify module is deleted
		const getResult = await tryGetActivityModuleById({
			payload,
			id: createdModule.id,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
		});
		expect(getResult.ok).toBe(false);
	});

	test("should list activity modules", async () => {
		await Promise.all([
			tryCreatePageModule({
				payload,
				title: "List Test Module 1",
				status: "published",
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				content: "<p>List test 1</p>",
			}),
			tryCreateAssignmentModule({
				payload,
				title: "List Test Module 2",
				status: "draft",
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				instructions: "Complete this assignment",
			}),
			tryCreateQuizModule({
				payload,
				title: "List Test Module 3",
				status: "published",
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				instructions: "Answer all questions",
				points: 100,
			}),
		]);

		// Test listing all modules
		const listResult = await tryListActivityModules({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		expect(listResult.value.docs.length).toBeGreaterThanOrEqual(3);
		expect(listResult.value.totalDocs).toBeGreaterThanOrEqual(3);

		// Test filtering by type
		const pageModulesResult = await tryListActivityModules({
			payload,
			type: "page",
			overrideAccess: true,
		});

		expect(pageModulesResult.ok).toBe(true);
		if (!pageModulesResult.ok) return;

		pageModulesResult.value.docs.forEach((module) => {
			expect(module.type).toBe("page");
		});

		// Test filtering by file type
		const fileModulesResult = await tryListActivityModules({
			payload,
			type: "file",
			overrideAccess: true,
		});

		expect(fileModulesResult.ok).toBe(true);
		if (!fileModulesResult.ok) return;

		fileModulesResult.value.docs.forEach((module) => {
			expect(module.type).toBe("file");
		});

		// Test filtering by status
		const publishedModulesResult = await tryListActivityModules({
			payload,
			status: "published",
			overrideAccess: true,
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
			const args = {
				payload,
				title: `Pagination Test Module ${i + 1}`,
				
				req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
				content: `<p>Pagination test ${i + 1}</p>`,
			} satisfies CreatePageModuleArgs;

			const result = await tryCreatePageModule(args);
			expect(result.ok).toBe(true);
		}

		// Test pagination
		const page1Result = await tryListActivityModules({
			payload,
			
			limit: 2,
			page: 1,
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			overrideAccess: true,
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
		const invalidArgs1: CreatePageModuleArgs = {
			payload,
			title: "",
			content: "<p>Test</p>",
		};

		const result1 = await tryCreatePageModule(invalidArgs1);
		expect(result1.ok).toBe(false);

		// Test missing userId
		const invalidArgs3: CreatePageModuleArgs = {
			payload,
			title: "Test",
			content: "<p>Test</p>",
		};

		const result3 = await tryCreatePageModule(invalidArgs3);
		expect(result3.ok).toBe(false);
	});

	// Note: Tests for missing type-specific data (assignmentData, quizData, etc.) are no longer needed
	// because the discriminated union enforces this at compile time

	test("should fail to get non-existent activity module", async () => {
		const result = await tryGetActivityModuleById({
			payload,
			id: 99999,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to update non-existent activity module", async () => {
		const updateArgs = {
			payload,
			id: 99999,
			title: "Updated Title",
			content: "<p>Updated</p>",
		} satisfies UpdatePageModuleArgs;

		const result = await tryUpdatePageModule(updateArgs);
		expect(result.ok).toBe(false);
	});

	test("should fail to delete non-existent activity module", async () => {
		const result = await tryDeleteActivityModule({
			payload,
			id: 99999,
		});
		expect(result.ok).toBe(false);
	});
});
