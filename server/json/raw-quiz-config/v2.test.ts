import { describe, expect, test } from "bun:test";
import type {
	ContainerQuizConfig,
	GradingConfig,
	Question,
	QuizConfig,
	QuizPage,
	QuizResource,
	RegularQuizConfig,
} from "./v2";
import {
	addPage,
	addQuestion,
	addQuizResource,
	QuizConfigValidationError,
	QuizElementNotFoundError,
	removePage,
	removeQuestion,
	removeQuizResource,
	toggleQuizType,
	updateGlobalTimer,
	updateGradingConfig,
	updateNestedQuizTimer,
	updateQuestion,
	updateQuizResource,
} from "./v2";

describe("Quiz Config Utility Functions", () => {
	// Helper function to create a basic regular quiz config
	const createRegularQuiz = (): RegularQuizConfig => ({
		version: "v2",
		type: "regular",
		id: "quiz-1",
		title: "Test Quiz",
		pages: [
			{
				id: "page-1",
				title: "Page 1",
				questions: [
					{
						id: "q1",
						type: "multiple-choice",
						prompt: "What is 2+2?",
						options: { a: "3", b: "4", c: "5" },
						correctAnswer: "b",
					},
				],
			},
		],
		globalTimer: 60,
	});

	// Helper function to create a basic container quiz config
	const createContainerQuiz = (): ContainerQuizConfig => ({
		version: "v2",
		type: "container",
		id: "quiz-1",
		title: "Test Container Quiz",
		nestedQuizzes: [
			{
				id: "nested-1",
				title: "Section 1",
				pages: [
					{
						id: "page-1",
						title: "Page 1",
						questions: [
							{
								id: "q1",
								type: "short-answer",
								prompt: "What is your name?",
							},
						],
					},
				],
				globalTimer: 30,
			},
		],
		globalTimer: 60,
		sequentialOrder: false,
	});

	describe("toggleQuizType", () => {
		test("converts regular quiz to container quiz", () => {
			const regular = createRegularQuiz();
			const result = toggleQuizType({ config: regular, newType: "container" });

			expect(result.type).toBe("container");
			expect(result.id).toBe(regular.id);
			expect(result.title).toBe(regular.title);
			expect(result.globalTimer).toBe(regular.globalTimer);

			if (result.type === "container") {
				expect(result.nestedQuizzes).toHaveLength(1);
				expect(result.nestedQuizzes[0]!.pages).toEqual(regular.pages);
			}
		});

		test("converts container quiz to regular quiz", () => {
			const container = createContainerQuiz();
			const result = toggleQuizType({ config: container, newType: "regular" });

			expect(result.type).toBe("regular");
			expect(result.id).toBe(container.id);
			expect(result.title).toBe(container.title);
			expect(result.globalTimer).toBe(container.globalTimer);

			if (result.type === "regular") {
				// Should flatten all pages from nested quizzes
				expect(result.pages).toHaveLength(1);
				expect(result.pages[0]!.id).toBe("page-1");
			}
		});

		test("returns same config if type is already correct", () => {
			const regular = createRegularQuiz();
			const result = toggleQuizType({ config: regular, newType: "regular" });

			expect(result).toBe(regular);
		});

		test("preserves grading config when converting", () => {
			const regular = createRegularQuiz();
			regular.grading = { enabled: true, passingScore: 70 };

			const result = toggleQuizType({ config: regular, newType: "container" });

			expect(result.grading).toEqual(regular.grading);
		});
	});

	describe("updateGlobalTimer", () => {
		test("updates global timer on regular quiz", () => {
			const config = createRegularQuiz();
			const result = updateGlobalTimer({ config, seconds: 120 });

			expect(result.globalTimer).toBe(120);
		});

		test("updates global timer on container quiz", () => {
			const config = createContainerQuiz();
			const result = updateGlobalTimer({ config, seconds: 90 });

			expect(result.globalTimer).toBe(90);
		});

		test("allows undefined timer", () => {
			const config = createRegularQuiz();
			const result = updateGlobalTimer({ config, seconds: undefined });

			expect(result.globalTimer).toBeUndefined();
		});

		test("throws error when timer is negative", () => {
			const config = createRegularQuiz();

			expect(() => updateGlobalTimer({ config, seconds: -10 })).toThrow(
				QuizConfigValidationError,
			);
		});

		test("throws error when container timer is less than sum of nested timers", () => {
			const config = createContainerQuiz();
			// nested timer is 30, trying to set parent to 20
			expect(() => updateGlobalTimer({ config, seconds: 20 })).toThrow(
				QuizConfigValidationError,
			);
		});

		test("allows container timer equal to sum of nested timers", () => {
			const config = createContainerQuiz();
			const result = updateGlobalTimer({ config, seconds: 30 });

			expect(result.globalTimer).toBe(30);
		});
	});

	describe("updateNestedQuizTimer", () => {
		test("updates nested quiz timer", () => {
			const config = createContainerQuiz();
			const result = updateNestedQuizTimer({
				config,
				nestedQuizId: "nested-1",
				seconds: 40,
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.globalTimer).toBe(40);
			}
		});

		test("throws error when called on regular quiz", () => {
			const config = createRegularQuiz();

			expect(() =>
				updateNestedQuizTimer({
					config,
					nestedQuizId: "nested-1",
					seconds: 30,
				}),
			).toThrow(QuizConfigValidationError);
		});

		test("throws error when nested quiz not found", () => {
			const config = createContainerQuiz();

			expect(() =>
				updateNestedQuizTimer({
					config,
					nestedQuizId: "nonexistent",
					seconds: 30,
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("throws error when sum of nested timers exceeds parent timer", () => {
			const config = createContainerQuiz();
			// parent is 60, trying to set nested to 70
			expect(() =>
				updateNestedQuizTimer({
					config,
					nestedQuizId: "nested-1",
					seconds: 70,
				}),
			).toThrow(QuizConfigValidationError);
		});

		test("throws error when timer is negative", () => {
			const config = createContainerQuiz();

			expect(() =>
				updateNestedQuizTimer({
					config,
					nestedQuizId: "nested-1",
					seconds: -10,
				}),
			).toThrow(QuizConfigValidationError);
		});
	});

	describe("updateGradingConfig", () => {
		test("enables grading", () => {
			const config = createRegularQuiz();
			const result = updateGradingConfig({
				config,
				gradingConfig: { enabled: true },
			});

			expect(result.grading?.enabled).toBe(true);
		});

		test("updates passing score", () => {
			const config = createRegularQuiz();
			const result = updateGradingConfig({
				config,
				gradingConfig: {
					enabled: true,
					passingScore: 75,
				},
			});

			expect(result.grading?.passingScore).toBe(75);
		});

		test("throws error when passing score is below 0", () => {
			const config = createRegularQuiz();

			expect(() =>
				updateGradingConfig({
					config,
					gradingConfig: { enabled: true, passingScore: -10 },
				}),
			).toThrow(QuizConfigValidationError);
		});

		test("throws error when passing score is above 100", () => {
			const config = createRegularQuiz();

			expect(() =>
				updateGradingConfig({
					config,
					gradingConfig: { enabled: true, passingScore: 110 },
				}),
			).toThrow(QuizConfigValidationError);
		});

		test("merges with existing grading config", () => {
			const config = createRegularQuiz();
			config.grading = {
				enabled: true,
				passingScore: 60,
				showScoreToStudent: true,
			};

			const result = updateGradingConfig({
				config,
				gradingConfig: { passingScore: 80 },
			});

			expect(result.grading).toEqual({
				enabled: true,
				passingScore: 80,
				showScoreToStudent: true,
			});
		});
	});

	describe("addQuizResource", () => {
		test("adds resource to regular quiz", () => {
			const config = createRegularQuiz();
			const resource: QuizResource = {
				id: "resource-1",
				title: "Reference Material",
				content: "<p>Some content</p>",
				pages: ["page-1"],
			};

			const result = addQuizResource({ config, resource });

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.resources).toHaveLength(1);
				expect(result.resources![0]).toEqual(resource);
			}
		});

		test("throws error when adding resource to container quiz root", () => {
			const config = createContainerQuiz();
			const resource: QuizResource = {
				id: "resource-1",
				title: "Reference Material",
				content: "<p>Some content</p>",
				pages: ["page-1"],
			};

			expect(() => addQuizResource({ config, resource })).toThrow(
				QuizConfigValidationError,
			);
		});

		test("adds resource to nested quiz", () => {
			const config = createContainerQuiz();
			const resource: QuizResource = {
				id: "resource-1",
				title: "Reference Material",
				content: "<p>Some content</p>",
				pages: ["page-1"],
			};

			const result = addQuizResource({
				config,
				resource,
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.resources).toHaveLength(1);
				expect(result.nestedQuizzes[0]!.resources![0]).toEqual(resource);
			}
		});

		test("throws error when page IDs are invalid", () => {
			const config = createRegularQuiz();
			const resource: QuizResource = {
				id: "resource-1",
				title: "Reference Material",
				content: "<p>Some content</p>",
				pages: ["nonexistent-page"],
			};

			expect(() => addQuizResource({ config, resource })).toThrow(
				QuizConfigValidationError,
			);
		});
	});

	describe("removeQuizResource", () => {
		test("removes resource from regular quiz", () => {
			const config = createRegularQuiz();
			config.resources = [
				{
					id: "resource-1",
					title: "Resource 1",
					content: "",
					pages: ["page-1"],
				},
			];

			const result = removeQuizResource({ config, resourceId: "resource-1" });

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.resources).toHaveLength(0);
			}
		});

		test("returns unchanged config when resource not found", () => {
			const config = createRegularQuiz();
			const result = removeQuizResource({ config, resourceId: "nonexistent" });

			expect(result).toBe(config);
		});

		test("removes resource from nested quiz", () => {
			const config = createContainerQuiz();
			if (config.type === "container") {
				config.nestedQuizzes[0]!.resources = [
					{
						id: "resource-1",
						title: "Resource 1",
						content: "",
						pages: ["page-1"],
					},
				];
			}

			const result = removeQuizResource({
				config,
				resourceId: "resource-1",
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.resources).toHaveLength(0);
			}
		});
	});

	describe("updateQuizResource", () => {
		test("updates resource in regular quiz", () => {
			const config = createRegularQuiz();
			config.resources = [
				{
					id: "resource-1",
					title: "Resource 1",
					content: "Old content",
					pages: ["page-1"],
				},
			];

			const result = updateQuizResource({
				config,
				resourceId: "resource-1",
				updates: {
					title: "Updated Resource",
					content: "New content",
				},
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.resources![0]!.title).toBe("Updated Resource");
				expect(result.resources![0]!.content).toBe("New content");
			}
		});

		test("throws error when resource not found", () => {
			const config = createRegularQuiz();

			expect(() =>
				updateQuizResource({
					config,
					resourceId: "nonexistent",
					updates: { title: "New Title" },
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("validates page IDs when updating pages", () => {
			const config = createRegularQuiz();
			config.resources = [
				{
					id: "resource-1",
					title: "Resource 1",
					content: "",
					pages: ["page-1"],
				},
			];

			expect(() =>
				updateQuizResource({
					config,
					resourceId: "resource-1",
					updates: {
						pages: ["nonexistent-page"],
					},
				}),
			).toThrow(QuizConfigValidationError);
		});
	});

	describe("addQuestion", () => {
		test("adds question to end of page in regular quiz", () => {
			const config = createRegularQuiz();
			const newQuestion: Question = {
				id: "q2",
				type: "short-answer",
				prompt: "What is your name?",
			};

			const result = addQuestion({
				config,
				pageId: "page-1",
				question: newQuestion,
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions).toHaveLength(2);
				expect(result.pages[0]!.questions[1]).toEqual(newQuestion);
			}
		});

		test("adds question at specific position", () => {
			const config = createRegularQuiz();
			const newQuestion: Question = {
				id: "q2",
				type: "short-answer",
				prompt: "What is your name?",
			};

			const result = addQuestion({
				config,
				pageId: "page-1",
				question: newQuestion,
				position: 0,
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions[0]).toEqual(newQuestion);
			}
		});

		test("generates ID if not provided", () => {
			const config = createRegularQuiz();
			const newQuestion = {
				type: "short-answer" as const,
				prompt: "What is your name?",
			};

			const result = addQuestion({
				config,
				pageId: "page-1",
				question: newQuestion as unknown as Question,
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions[1]!.id).toMatch(/^question-/);
			}
		});

		test("throws error when page not found", () => {
			const config = createRegularQuiz();
			const newQuestion: Question = {
				id: "q2",
				type: "short-answer",
				prompt: "What is your name?",
			};

			expect(() =>
				addQuestion({ config, pageId: "nonexistent", question: newQuestion }),
			).toThrow(QuizElementNotFoundError);
		});

		test("adds question to nested quiz", () => {
			const config = createContainerQuiz();
			const newQuestion: Question = {
				id: "q2",
				type: "multiple-choice",
				prompt: "What is 3+3?",
				options: { a: "5", b: "6" },
			};

			const result = addQuestion({
				config,
				pageId: "page-1",
				question: newQuestion,
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.pages[0]!.questions).toHaveLength(2);
			}
		});
	});

	describe("removeQuestion", () => {
		test("removes question from regular quiz", () => {
			const config = createRegularQuiz();
			const result = removeQuestion({ config, questionId: "q1" });

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions).toHaveLength(0);
			}
		});

		test("returns unchanged config when question not found", () => {
			const config = createRegularQuiz();
			const result = removeQuestion({ config, questionId: "nonexistent" });

			expect(result).toBe(config);
		});

		test("removes question from nested quiz", () => {
			const config = createContainerQuiz();
			const result = removeQuestion({
				config,
				questionId: "q1",
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.pages[0]!.questions).toHaveLength(0);
			}
		});
	});

	describe("updateQuestion", () => {
		test("updates question in regular quiz", () => {
			const config = createRegularQuiz();
			const result = updateQuestion({
				config,
				questionId: "q1",
				updates: {
					prompt: "Updated prompt",
				},
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions[0]!.prompt).toBe("Updated prompt");
			}
		});

		test("preserves question ID", () => {
			const config = createRegularQuiz();
			const result = updateQuestion({
				config,
				questionId: "q1",
				updates: {
					id: "different-id",
					prompt: "Updated prompt",
				},
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions[0]!.id).toBe("q1");
			}
		});

		test("throws error when question not found", () => {
			const config = createRegularQuiz();

			expect(() =>
				updateQuestion({
					config,
					questionId: "nonexistent",
					updates: { prompt: "New prompt" },
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("updates question in nested quiz", () => {
			const config = createContainerQuiz();
			const result = updateQuestion({
				config,
				questionId: "q1",
				updates: { prompt: "Updated prompt" },
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.pages[0]!.questions[0]!.prompt).toBe(
					"Updated prompt",
				);
			}
		});
	});

	describe("addPage", () => {
		test("adds page to end of regular quiz", () => {
			const config = createRegularQuiz();
			const newPage: Partial<QuizPage> = {
				id: "page-2",
				title: "Page 2",
				questions: [],
			};

			const result = addPage({ config, page: newPage });

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages).toHaveLength(2);
				expect(result.pages[1]!.id).toBe("page-2");
			}
		});

		test("adds page at specific position", () => {
			const config = createRegularQuiz();
			const newPage: Partial<QuizPage> = {
				id: "page-0",
				title: "Page 0",
			};

			const result = addPage({ config, page: newPage, position: 0 });

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.id).toBe("page-0");
			}
		});

		test("generates ID and title if not provided", () => {
			const config = createRegularQuiz();
			const result = addPage({ config, page: {} });

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[1]!.id).toMatch(/^page-/);
				expect(result.pages[1]!.title).toBe("New Page");
			}
		});

		test("adds page to nested quiz", () => {
			const config = createContainerQuiz();
			const newPage: Partial<QuizPage> = {
				id: "page-2",
				title: "Page 2",
			};

			const result = addPage({
				config,
				page: newPage,
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.pages).toHaveLength(2);
			}
		});
	});

	describe("removePage", () => {
		test("removes page from regular quiz", () => {
			const config = createRegularQuiz();
			// Add another page first
			config.pages.push({
				id: "page-2",
				title: "Page 2",
				questions: [],
			});

			const result = removePage({ config, pageId: "page-2" });

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages).toHaveLength(1);
			}
		});

		test("moves questions to previous page when removing", () => {
			const config = createRegularQuiz();
			config.pages.push({
				id: "page-2",
				title: "Page 2",
				questions: [
					{
						id: "q2",
						type: "short-answer",
						prompt: "Question 2",
					},
				],
			});

			const result = removePage({ config, pageId: "page-2" });

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions).toHaveLength(2);
				expect(result.pages[0]!.questions[1]!.id).toBe("q2");
			}
		});

		test("throws error when removing last page", () => {
			const config = createRegularQuiz();

			expect(() => removePage({ config, pageId: "page-1" })).toThrow(
				QuizConfigValidationError,
			);
		});

		test("throws error when page not found", () => {
			const config = createRegularQuiz();
			config.pages.push({
				id: "page-2",
				title: "Page 2",
				questions: [],
			});

			expect(() => removePage({ config, pageId: "nonexistent" })).toThrow(
				QuizElementNotFoundError,
			);
		});

		test("removes page from nested quiz", () => {
			const config = createContainerQuiz();
			if (config.type === "container") {
				config.nestedQuizzes[0]!.pages.push({
					id: "page-2",
					title: "Page 2",
					questions: [],
				});
			}

			const result = removePage({
				config,
				pageId: "page-2",
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.pages).toHaveLength(1);
			}
		});
	});
});
