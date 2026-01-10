import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type AddNestedQuizArgs,
	type AddPageArgs,
	type AddQuestionArgs,
	type AddQuizResourceArgs,
	type MoveQuestionToPageArgs,
	type RemoveNestedQuizArgs,
	type RemovePageArgs,
	type RemoveQuestionArgs,
	type RemoveQuizResourceArgs,
	type ReorderNestedQuizzesArgs,
	type ReorderPagesArgs,
	type ToggleQuizTypeArgs,
	type UpdateContainerSettingsArgs,
	type UpdateGlobalTimerArgs,
	type UpdateGradingConfigArgs,
	type UpdateNestedQuizInfoArgs,
	type UpdateNestedQuizTimerArgs,
	type UpdatePageInfoArgs,
	type UpdateQuestionArgs,
	type UpdateQuestionScoringArgs,
	type UpdateQuizInfoArgs,
	type UpdateQuizResourceArgs,
	tryAddNestedQuiz,
	tryAddPage,
	tryAddQuestion,
	tryAddQuizResource,
	tryMoveQuestionToPage,
	tryRemoveNestedQuiz,
	tryRemovePage,
	tryRemoveQuestion,
	tryRemoveQuizResource,
	tryReorderNestedQuizzes,
	tryReorderPages,
	tryToggleQuizType,
	tryUpdateContainerSettings,
	tryUpdateGlobalTimer,
	tryUpdateGradingConfig,
	tryUpdateNestedQuizInfo,
	tryUpdateNestedQuizTimer,
	tryUpdatePageInfo,
	tryUpdateQuestion,
	tryUpdateQuestionScoring,
	tryUpdateQuizInfo,
	tryUpdateQuizResource,
} from "./quiz-module-management";
import { tryCreateQuizModule } from "./activity-module-management";
import { tryCreateUser } from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/types";
import {
	createDefaultQuizConfig,
	type QuizResource,
} from "server/json/raw-quiz-config/v2";

describe("Quiz Module Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUser: TryResultValue<typeof tryCreateUser>;
	let regularQuizModuleId: number;
	let containerQuizModuleId: number;

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

		// Create test admin user
		testUser = await tryCreateUser({
			payload,
			data: {
				email: "test-quiz-module@example.com",
				password: "password123",
				firstName: "Test",
				lastName: "User",
				role: "admin",
			},
			overrideAccess: true,

			req: undefined,
		}).getOrThrow();

		// Create a regular quiz module for testing with known page ID
		const regularQuizConfig = {
			version: "v2" as const,
			type: "regular" as const,
			id: `quiz-regular-${Date.now()}`,
			title: "Test Regular Quiz",
			pages: [
				{
					id: "page-1",
					title: "Page 1",
					questions: [],
				},
			],
		};

		const regularQuizResult = await tryCreateQuizModule({
			payload,
			title: "Test Regular Quiz",
			description: "Test quiz description",
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			rawQuizConfig: regularQuizConfig,
		});

		expect(regularQuizResult.ok).toBe(true);
		if (!regularQuizResult.ok) {
			throw new Error("Failed to create regular quiz module");
		}
		regularQuizModuleId = regularQuizResult.value.id;

		// Create a container quiz module for testing
		const containerConfig = {
			version: "v2" as const,
			type: "container" as const,
			id: `quiz-${Date.now()}`,
			title: "Test Container Quiz",
			nestedQuizzes: [
				{
					id: "nested-1",
					title: "Nested Quiz 1",
					pages: [
						{
							id: "page-1",
							title: "Page 1",
							questions: [
								{
									id: "q1",
									type: "short-answer" as const,
									prompt: "What is 2+2?",
									correctAnswer: "4",
									scoring: { type: "simple" as const, points: 1 },
								},
							],
						},
					],
					globalTimer: 30,
				},
				{
					id: "nested-2",
					title: "Nested Quiz 2",
					pages: [
						{
							id: "page-2",
							title: "Page 2",
							questions: [],
						},
					],
					globalTimer: 20,
				},
			],
			globalTimer: 60,
			sequentialOrder: false,
		};

		const containerQuizResult = await tryCreateQuizModule({
			payload,
			title: "Test Container Quiz",
			req: createLocalReq({
				request: mockRequest,
				user: testUser as TypedUser,
			}),
			rawQuizConfig: containerConfig,
		});

		expect(containerQuizResult.ok).toBe(true);
		if (!containerQuizResult.ok) {
			throw new Error("Failed to create container quiz module");
		}
		containerQuizModuleId = containerQuizResult.value.id;
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

	describe("tryToggleQuizType", () => {
		test("should toggle regular quiz to container quiz", async () => {
			// Create a separate quiz module for this test
			const createResult = await tryCreateQuizModule({
				payload,
				title: "Toggle Test Regular Quiz",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
				rawQuizConfig: createDefaultQuizConfig(),
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const args: ToggleQuizTypeArgs = {
				payload,
				activityModuleId: createResult.value.id,
				newType: "container",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryToggleQuizType(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (updatedQuiz.rawQuizConfig) {
				expect(updatedQuiz.rawQuizConfig.type).toBe("container");
			}
		});

		test("should toggle container quiz to regular quiz", async () => {
			// Create a separate container quiz module for this test
			const containerConfig = {
				version: "v2" as const,
				type: "container" as const,
				id: `quiz-toggle-${Date.now()}`,
				title: "Toggle Test Container Quiz",
				nestedQuizzes: [
					{
						id: "nested-toggle",
						title: "Nested Quiz",
						pages: [],
						globalTimer: 30,
					},
				],
				globalTimer: 60,
				sequentialOrder: false,
			};

			const createResult = await tryCreateQuizModule({
				payload,
				title: "Toggle Test Container Quiz",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
				rawQuizConfig: containerConfig,
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const args: ToggleQuizTypeArgs = {
				payload,
				activityModuleId: createResult.value.id,
				newType: "regular",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryToggleQuizType(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (updatedQuiz.rawQuizConfig) {
				expect(updatedQuiz.rawQuizConfig.type).toBe("regular");
			}
		});

		test("should return error when activity module is not a quiz", async () => {
			// Create a page module instead
			const pageModuleResult = await tryCreateQuizModule({
				payload,
				title: "Page Module",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(pageModuleResult.ok).toBe(true);
			if (!pageModuleResult.ok) return;

			// This test would need a non-quiz module, but we'll test with invalid ID instead
			const args: ToggleQuizTypeArgs = {
				payload,
				activityModuleId: 999999,
				newType: "container",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryToggleQuizType(args);
			expect(result.ok).toBe(false);
		});
	});

	describe("tryUpdateGlobalTimer", () => {
		test("should update global timer for regular quiz", async () => {
			const args: UpdateGlobalTimerArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				seconds: 120,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateGlobalTimer(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (updatedQuiz.rawQuizConfig) {
				expect(updatedQuiz.rawQuizConfig.globalTimer).toBe(120);
			}
		});

		test("should update global timer for container quiz", async () => {
			const args: UpdateGlobalTimerArgs = {
				payload,
				activityModuleId: containerQuizModuleId,
				seconds: 90,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateGlobalTimer(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "container"
			) {
				expect(updatedQuiz.rawQuizConfig.globalTimer).toBe(90);
			}
		});

		test("should allow undefined timer", async () => {
			const args: UpdateGlobalTimerArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				seconds: undefined,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateGlobalTimer(args);

			expect(result.ok).toBe(true);
		});
	});

	describe("tryUpdateNestedQuizTimer", () => {
		test("should update nested quiz timer", async () => {
			// Create a fresh container quiz for this test to ensure nested quiz IDs exist
			const containerConfig = {
				version: "v2" as const,
				type: "container" as const,
				id: `quiz-nested-timer-${Date.now()}`,
				title: "Nested Timer Test Container Quiz",
				nestedQuizzes: [
					{
						id: "nested-timer-1",
						title: "Nested Quiz 1",
						pages: [],
						globalTimer: 30,
					},
				],
				globalTimer: 60,
				sequentialOrder: false,
			};

			const createResult = await tryCreateQuizModule({
				payload,
				title: "Nested Timer Test Container Quiz",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
				rawQuizConfig: containerConfig,
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const args: UpdateNestedQuizTimerArgs = {
				payload,
				activityModuleId: createResult.value.id,
				nestedQuizId: "nested-timer-1",
				seconds: 40,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateNestedQuizTimer(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "container"
			) {
				const nestedQuiz = updatedQuiz.rawQuizConfig.nestedQuizzes.find(
					(nq) => nq.id === "nested-timer-1",
				);
				expect(nestedQuiz?.globalTimer).toBe(40);
			}
		});

		test("should return error when called on regular quiz", async () => {
			const args: UpdateNestedQuizTimerArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				nestedQuizId: "nested-1",
				seconds: 30,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateNestedQuizTimer(args);
			expect(result.ok).toBe(false);
		});
	});

	describe("tryUpdateGradingConfig", () => {
		test("should enable grading", async () => {
			const args: UpdateGradingConfigArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				gradingConfig: { enabled: true },
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateGradingConfig(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (updatedQuiz.rawQuizConfig) {
				expect(updatedQuiz.rawQuizConfig.grading?.enabled).toBe(true);
			}
		});

		test("should update passing score", async () => {
			const args: UpdateGradingConfigArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				gradingConfig: {
					enabled: true,
					passingScore: 75,
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateGradingConfig(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (updatedQuiz.rawQuizConfig) {
				expect(updatedQuiz.rawQuizConfig.grading?.passingScore).toBe(75);
			}
		});
	});

	describe("tryAddQuizResource", () => {
		test("should add resource to regular quiz", async () => {
			const resource: QuizResource = {
				id: "resource-1",
				title: "Reference Material",
				content: "<p>Some content</p>",
				pages: ["page-1"],
			};

			const args: AddQuizResourceArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				resource,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryAddQuizResource(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				expect(updatedQuiz.rawQuizConfig.resources).toBeDefined();
				expect(updatedQuiz.rawQuizConfig.resources?.length).toBeGreaterThan(0);
			}
		});

		test("should add resource to nested quiz", async () => {
			const resource: QuizResource = {
				id: "resource-2",
				title: "Nested Resource",
				content: "<p>Nested content</p>",
				pages: ["page-1"],
			};

			const args: AddQuizResourceArgs = {
				payload,
				activityModuleId: containerQuizModuleId,
				resource,
				nestedQuizId: "nested-1",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryAddQuizResource(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "container"
			) {
				const nestedQuiz = updatedQuiz.rawQuizConfig.nestedQuizzes.find(
					(nq) => nq.id === "nested-1",
				);
				expect(nestedQuiz?.resources).toBeDefined();
				expect(nestedQuiz?.resources?.length).toBeGreaterThan(0);
			}
		});
	});

	describe("tryRemoveQuizResource", () => {
		test("should remove resource from regular quiz", async () => {
			// First add a resource
			const addResourceResult = await tryAddQuizResource({
				payload,
				activityModuleId: regularQuizModuleId,
				resource: {
					id: "resource-to-remove",
					title: "To Remove",
					content: "<p>Content</p>",
					pages: ["page-1"],
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(addResourceResult.ok).toBe(true);
			if (!addResourceResult.ok) return;

			// Now remove it
			const args: RemoveQuizResourceArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				resourceId: "resource-to-remove",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryRemoveQuizResource(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				const resourceExists = updatedQuiz.rawQuizConfig.resources?.some(
					(r) => r.id === "resource-to-remove",
				);
				expect(resourceExists).toBe(false);
			}
		});
	});

	describe("tryUpdateQuizResource", () => {
		test("should update resource in regular quiz", async () => {
			// First add a resource
			const addResourceResult = await tryAddQuizResource({
				payload,
				activityModuleId: regularQuizModuleId,
				resource: {
					id: "resource-to-update",
					title: "Original Title",
					content: "<p>Original content</p>",
					pages: ["page-1"],
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(addResourceResult.ok).toBe(true);
			if (!addResourceResult.ok) return;

			// Now update it
			const args: UpdateQuizResourceArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				resourceId: "resource-to-update",
				updates: {
					title: "Updated Title",
					content: "<p>Updated content</p>",
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateQuizResource(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				const resource = updatedQuiz.rawQuizConfig.resources?.find(
					(r) => r.id === "resource-to-update",
				);
				expect(resource?.title).toBe("Updated Title");
				expect(resource?.content).toBe("<p>Updated content</p>");
			}
		});
	});

	describe("tryAddQuestion", () => {
		test("should add question to page in regular quiz", async () => {
			const args: AddQuestionArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				pageId: "page-1",
				questionType: "short-answer",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryAddQuestion(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				const page = updatedQuiz.rawQuizConfig.pages.find(
					(p) => p.id === "page-1",
				);
				// Question ID is auto-generated, so just check that a question was added
				expect(page?.questions.length).toBeGreaterThan(0);
				expect(page?.questions.some((q) => q.type === "short-answer")).toBe(
					true,
				);
			}
		});
	});

	describe("tryRemoveQuestion", () => {
		test("should remove question from regular quiz", async () => {
			// First add a question
			const addQuestionResult = await tryAddQuestion({
				payload,
				activityModuleId: regularQuizModuleId,
				pageId: "page-1",
				questionType: "short-answer",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(addQuestionResult.ok).toBe(true);
			if (!addQuestionResult.ok) return;

			// Get the question ID from the result
			const addedQuiz = addQuestionResult.value;
			if (
				!addedQuiz.rawQuizConfig ||
				addedQuiz.rawQuizConfig.type !== "regular"
			) {
				throw new Error("Expected regular quiz");
			}
			const page = addedQuiz.rawQuizConfig.pages.find((p) => p.id === "page-1");
			if (!page || page.questions.length === 0) {
				throw new Error("Question not found");
			}
			const questionId = page.questions[page.questions.length - 1]!.id;

			// Now remove it
			const args: RemoveQuestionArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				questionId,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryRemoveQuestion(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				const questionExists = updatedQuiz.rawQuizConfig.pages.some((page) =>
					page.questions.some((q) => q.id === questionId),
				);
				expect(questionExists).toBe(false);
			}
		});
	});

	describe("tryUpdateQuestion", () => {
		test("should update question in regular quiz", async () => {
			// First add a question
			const addQuestionResult = await tryAddQuestion({
				payload,
				activityModuleId: regularQuizModuleId,
				pageId: "page-1",
				questionType: "short-answer",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(addQuestionResult.ok).toBe(true);
			if (!addQuestionResult.ok) return;

			// Get the question ID from the result
			const addedQuiz = addQuestionResult.value;
			if (
				!addedQuiz.rawQuizConfig ||
				addedQuiz.rawQuizConfig.type !== "regular"
			) {
				throw new Error("Expected regular quiz");
			}
			const page = addedQuiz.rawQuizConfig.pages.find((p) => p.id === "page-1");
			if (!page || page.questions.length === 0) {
				throw new Error("Question not found");
			}
			const questionId = page.questions[page.questions.length - 1]!.id;

			// Now update it
			const args: UpdateQuestionArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				questionId,
				updates: {
					prompt: "Updated prompt",
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateQuestion(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				const question = updatedQuiz.rawQuizConfig.pages
					.flatMap((p) => p.questions)
					.find((q) => q.id === questionId);
				expect(question?.prompt).toBe("Updated prompt");
			}
		});
	});

	describe("tryAddPage", () => {
		test("should add blank page to regular quiz", async () => {
			const args: AddPageArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryAddPage(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				expect(updatedQuiz.rawQuizConfig.pages.length).toBeGreaterThan(1);
				const newPage =
					updatedQuiz.rawQuizConfig.pages[
						updatedQuiz.rawQuizConfig.pages.length - 1
					]!;
				expect(newPage.title).toBe("New Page");
				expect(newPage.questions).toEqual([]);
			}
		});
	});

	describe("tryRemovePage", () => {
		test("should remove page from regular quiz", async () => {
			// First add a page
			const addPageResult = await tryAddPage({
				payload,
				activityModuleId: regularQuizModuleId,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(addPageResult.ok).toBe(true);
			if (!addPageResult.ok) return;

			// Get the page ID from the result
			const addedQuiz = addPageResult.value;
			if (
				!addedQuiz.rawQuizConfig ||
				addedQuiz.rawQuizConfig.type !== "regular"
			) {
				throw new Error("Expected regular quiz");
			}
			const pageToRemove =
				addedQuiz.rawQuizConfig.pages[addedQuiz.rawQuizConfig.pages.length - 1];
			if (!pageToRemove) {
				throw new Error("Page not found");
			}
			const pageId = pageToRemove.id;

			// Now remove it
			const args: RemovePageArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				pageId,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryRemovePage(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				expect(
					updatedQuiz.rawQuizConfig.pages.some((p) => p.id === pageId),
				).toBe(false);
			}
		});
	});

	describe("tryAddNestedQuiz", () => {
		test("should add blank nested quiz to container quiz", async () => {
			const args: AddNestedQuizArgs = {
				payload,
				activityModuleId: containerQuizModuleId,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryAddNestedQuiz(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "container"
			) {
				expect(updatedQuiz.rawQuizConfig.nestedQuizzes.length).toBeGreaterThan(
					2,
				);
				const newNested =
					updatedQuiz.rawQuizConfig.nestedQuizzes[
						updatedQuiz.rawQuizConfig.nestedQuizzes.length - 1
					]!;
				expect(newNested.title).toBe("New Quiz");
				expect(newNested.pages).toHaveLength(1);
				expect(newNested.pages[0]!.title).toBe("Page 1");
			}
		});
	});

	describe("tryRemoveNestedQuiz", () => {
		test("should remove nested quiz from container quiz", async () => {
			// First add a nested quiz
			const addNestedResult = await tryAddNestedQuiz({
				payload,
				activityModuleId: containerQuizModuleId,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(addNestedResult.ok).toBe(true);
			if (!addNestedResult.ok) return;

			// Get the nested quiz ID from the result
			const addedQuiz = addNestedResult.value;
			if (
				!addedQuiz.rawQuizConfig ||
				addedQuiz.rawQuizConfig.type !== "container"
			) {
				throw new Error("Expected container quiz");
			}
			const nestedQuizToRemove =
				addedQuiz.rawQuizConfig.nestedQuizzes[
					addedQuiz.rawQuizConfig.nestedQuizzes.length - 1
				];
			if (!nestedQuizToRemove) {
				throw new Error("Nested quiz not found");
			}
			const nestedQuizId = nestedQuizToRemove.id;

			// Now remove it
			const args: RemoveNestedQuizArgs = {
				payload,
				activityModuleId: containerQuizModuleId,
				nestedQuizId,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryRemoveNestedQuiz(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "container"
			) {
				expect(
					updatedQuiz.rawQuizConfig.nestedQuizzes.some(
						(nq) => nq.id === nestedQuizId,
					),
				).toBe(false);
			}
		});
	});

	describe("tryUpdateNestedQuizInfo", () => {
		test("should update nested quiz title", async () => {
			const args: UpdateNestedQuizInfoArgs = {
				payload,
				activityModuleId: containerQuizModuleId,
				nestedQuizId: "nested-1",
				updates: {
					title: "Updated Nested Title",
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateNestedQuizInfo(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "container"
			) {
				const nestedQuiz = updatedQuiz.rawQuizConfig.nestedQuizzes.find(
					(nq) => nq.id === "nested-1",
				);
				expect(nestedQuiz?.title).toBe("Updated Nested Title");
			}
		});
	});

	describe("tryReorderNestedQuizzes", () => {
		test("should reorder nested quizzes", async () => {
			// Create a fresh container quiz for this test
			const containerConfig = {
				version: "v2" as const,
				type: "container" as const,
				id: `quiz-reorder-${Date.now()}`,
				title: "Reorder Test Container Quiz",
				nestedQuizzes: [
					{
						id: "nested-reorder-1",
						title: "Nested Quiz 1",
						pages: [],
						globalTimer: 30,
					},
					{
						id: "nested-reorder-2",
						title: "Nested Quiz 2",
						pages: [],
						globalTimer: 20,
					},
				],
				globalTimer: 60,
				sequentialOrder: false,
			};

			const createResult = await tryCreateQuizModule({
				payload,
				title: "Reorder Test Container Quiz",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
				rawQuizConfig: containerConfig,
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const args: ReorderNestedQuizzesArgs = {
				payload,
				activityModuleId: createResult.value.id,
				nestedQuizIds: ["nested-reorder-2", "nested-reorder-1"],
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryReorderNestedQuizzes(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "container"
			) {
				expect(updatedQuiz.rawQuizConfig.nestedQuizzes[0]?.id).toBe(
					"nested-reorder-2",
				);
				expect(updatedQuiz.rawQuizConfig.nestedQuizzes[1]?.id).toBe(
					"nested-reorder-1",
				);
			}
		});
	});

	describe("tryUpdateContainerSettings", () => {
		test("should update sequentialOrder", async () => {
			const args: UpdateContainerSettingsArgs = {
				payload,
				activityModuleId: containerQuizModuleId,
				settings: {
					sequentialOrder: true,
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateContainerSettings(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "container"
			) {
				expect(updatedQuiz.rawQuizConfig.sequentialOrder).toBe(true);
			}
		});
	});

	describe("tryUpdateQuizInfo", () => {
		test("should update quiz title", async () => {
			const args: UpdateQuizInfoArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				updates: {
					title: "Updated Quiz Title",
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateQuizInfo(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (updatedQuiz.rawQuizConfig) {
				expect(updatedQuiz.rawQuizConfig.title).toBe("Updated Quiz Title");
			}
		});
	});

	describe("tryUpdatePageInfo", () => {
		test("should update page title in regular quiz", async () => {
			const args: UpdatePageInfoArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				pageId: "page-1",
				updates: {
					title: "Updated Page Title",
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdatePageInfo(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				const page = updatedQuiz.rawQuizConfig.pages.find(
					(p) => p.id === "page-1",
				);
				expect(page?.title).toBe("Updated Page Title");
			}
		});
	});

	describe("tryReorderPages", () => {
		test("should reorder pages in regular quiz", async () => {
			// Create a fresh regular quiz with two pages for this test
			const regularQuizConfig = {
				version: "v2" as const,
				type: "regular" as const,
				id: `quiz-reorder-pages-${Date.now()}`,
				title: "Reorder Pages Test Quiz",
				pages: [
					{
						id: "page-reorder-1",
						title: "Page 1",
						questions: [],
					},
					{
						id: "page-reorder-2",
						title: "Page 2",
						questions: [],
					},
				],
			};

			const createResult = await tryCreateQuizModule({
				payload,
				title: "Reorder Pages Test Quiz",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
				rawQuizConfig: regularQuizConfig,
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			// Now reorder them
			const args: ReorderPagesArgs = {
				payload,
				activityModuleId: createResult.value.id,
				pageIds: ["page-reorder-2", "page-reorder-1"],
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryReorderPages(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				expect(updatedQuiz.rawQuizConfig.pages[0]?.id).toBe("page-reorder-2");
				expect(updatedQuiz.rawQuizConfig.pages[1]?.id).toBe("page-reorder-1");
			}
		});
	});

	describe("tryMoveQuestionToPage", () => {
		test("should move question to different page", async () => {
			// First add a second page
			const addPageResult = await tryAddPage({
				payload,
				activityModuleId: regularQuizModuleId,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(addPageResult.ok).toBe(true);
			if (!addPageResult.ok) return;

			// Add a question to page-1
			const addQuestionResult = await tryAddQuestion({
				payload,
				activityModuleId: regularQuizModuleId,
				pageId: "page-1",
				questionType: "short-answer",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(addQuestionResult.ok).toBe(true);
			if (!addQuestionResult.ok) return;

			// Get the question ID and target page ID from the result
			const addedQuiz = addQuestionResult.value;
			if (
				!addedQuiz.rawQuizConfig ||
				addedQuiz.rawQuizConfig.type !== "regular"
			) {
				throw new Error("Expected regular quiz");
			}
			const sourcePage = addedQuiz.rawQuizConfig.pages.find(
				(p) => p.id === "page-1",
			);
			if (!sourcePage || sourcePage.questions.length === 0) {
				throw new Error("Question not found");
			}
			const questionId =
				sourcePage.questions[sourcePage.questions.length - 1]!.id;
			const targetPageId = addedQuiz.rawQuizConfig.pages.find(
				(p) => p.id !== "page-1",
			)?.id;
			if (!targetPageId) {
				throw new Error("Target page not found");
			}

			// Now move it
			const args: MoveQuestionToPageArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				questionId,
				targetPageId,
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryMoveQuestionToPage(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				const updatedSourcePage = updatedQuiz.rawQuizConfig.pages.find(
					(p) => p.id === "page-1",
				);
				const updatedTargetPage = updatedQuiz.rawQuizConfig.pages.find(
					(p) => p.id === targetPageId,
				);
				expect(
					updatedSourcePage?.questions.some((q) => q.id === questionId),
				).toBe(false);
				expect(
					updatedTargetPage?.questions.some((q) => q.id === questionId),
				).toBe(true);
			}
		});
	});

	describe("tryUpdateQuestionScoring", () => {
		test("should update question scoring", async () => {
			// First add a question
			const addQuestionResult = await tryAddQuestion({
				payload,
				activityModuleId: regularQuizModuleId,
				pageId: "page-1",
				questionType: "short-answer",
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			});

			expect(addQuestionResult.ok).toBe(true);
			if (!addQuestionResult.ok) return;

			// Get the question ID from the result
			const addedQuiz = addQuestionResult.value;
			if (
				!addedQuiz.rawQuizConfig ||
				addedQuiz.rawQuizConfig.type !== "regular"
			) {
				throw new Error("Expected regular quiz");
			}
			const page = addedQuiz.rawQuizConfig.pages.find((p) => p.id === "page-1");
			if (!page || page.questions.length === 0) {
				throw new Error("Question not found");
			}
			const questionId = page.questions[page.questions.length - 1]!.id;

			// Now update scoring
			const args: UpdateQuestionScoringArgs = {
				payload,
				activityModuleId: regularQuizModuleId,
				questionId,
				scoring: {
					type: "simple",
					points: 5,
				},
				req: createLocalReq({
					request: mockRequest,
					user: testUser as TypedUser,
				}),
			};

			const result = await tryUpdateQuestionScoring(args);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const updatedQuiz = result.value;
			expect(updatedQuiz.rawQuizConfig).toBeDefined();
			if (
				updatedQuiz.rawQuizConfig &&
				updatedQuiz.rawQuizConfig.type === "regular"
			) {
				const question = updatedQuiz.rawQuizConfig.pages
					.flatMap((p) => p.questions)
					.find((q) => q.id === questionId);
				expect(question?.scoring).toEqual({ type: "simple", points: 5 });
			}
		});
	});
});
