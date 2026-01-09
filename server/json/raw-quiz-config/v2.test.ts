import { describe, expect, test } from "bun:test";
import type {
	ContainerQuizConfig,
	ManualScoring,
	QuizResource,
	RegularQuizConfig,
	SimpleScoring,
} from "./v2";
import {
	addNestedQuiz,
	addPage,
	addQuestion,
	addQuizResource,
	moveQuestionToPage,
	QuizConfigValidationError,
	QuizElementNotFoundError,
	removePage,
	removeQuestion,
	removeQuizResource,
	removeNestedQuiz,
	reorderNestedQuizzes,
	reorderPages,
	toggleQuizType,
	updateContainerSettings,
	updateGlobalTimer,
	updateGradingConfig,
	updateNestedQuizInfo,
	updateNestedQuizTimer,
	updatePageInfo,
	updateQuestion,
	updateQuestionScoring,
	updateQuizInfo,
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
			{
				id: "nested-2",
				title: "Section 2",
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
				// Should flatten all pages from nested quizzes (2 nested quizzes, each with 1 page = 2 pages)
				expect(result.pages).toHaveLength(2);
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
			// nested timers are 30 + 20 = 50, trying to set parent to 40
			expect(() => updateGlobalTimer({ config, seconds: 40 })).toThrow(
				QuizConfigValidationError,
			);
		});

		test("allows container timer equal to sum of nested timers", () => {
			const config = createContainerQuiz();
			// nested timers are 30 + 20 = 50
			const result = updateGlobalTimer({ config, seconds: 50 });

			expect(result.globalTimer).toBe(50);
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

			const result = addQuestion({
				config,
				pageId: "page-1",
				questionType: "short-answer",
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions).toHaveLength(2);
				expect(result.pages[0]!.questions[1]!.type).toBe("short-answer");
				expect(result.pages[0]!.questions[1]!.prompt).toBe("");
			}
		});

		test("adds question at specific position", () => {
			const config = createRegularQuiz();

			const result = addQuestion({
				config,
				pageId: "page-1",
				questionType: "short-answer",
				position: 0,
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions[0]!.type).toBe("short-answer");
			}
		});

		test("generates ID if not provided", () => {
			const config = createRegularQuiz();

			const result = addQuestion({
				config,
				pageId: "page-1",
				questionType: "short-answer",
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions[1]!.id).toMatch(/^question-/);
			}
		});

		test("throws error when page not found", () => {
			const config = createRegularQuiz();

			expect(() =>
				addQuestion({
					config,
					pageId: "nonexistent",
					questionType: "short-answer",
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("adds question to nested quiz", () => {
			const config = createContainerQuiz();

			const result = addQuestion({
				config,
				pageId: "page-1",
				questionType: "multiple-choice",
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.pages[0]!.questions).toHaveLength(2);
				expect(result.nestedQuizzes[0]!.pages[0]!.questions[1]!.type).toBe(
					"multiple-choice",
				);
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
					prompt: "Updated prompt",
				},
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions[0]!.id).toBe("q1");
			}
		});

		test("does not allow changing question type via updates", () => {
			const config = createRegularQuiz();

			// updateQuestion only accepts prompt and feedback, so type cannot be changed
			const result = updateQuestion({
				config,
				questionId: "q1",
				updates: { prompt: "Updated prompt" },
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions[0]!.type).toBe("multiple-choice");
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
		test("adds blank page to end of regular quiz", () => {
			const config = createRegularQuiz();

			const result = addPage({ config });

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages).toHaveLength(2);
				expect(result.pages[1]!.id).toMatch(/^page-/);
				expect(result.pages[1]!.title).toBe("New Page");
				expect(result.pages[1]!.questions).toEqual([]);
			}
		});

		test("adds blank page to nested quiz", () => {
			const config = createContainerQuiz();

			const result = addPage({
				config,
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

	// ========================================================================
	// NESTED QUIZ MANAGEMENT TESTS
	// ========================================================================

	describe("addNestedQuiz", () => {
		test("adds blank nested quiz to end", () => {
			const config = createContainerQuiz();
			const result = addNestedQuiz({
				config,
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes).toHaveLength(3);
				expect(result.nestedQuizzes[2]!.id).toMatch(/^nested-/);
				expect(result.nestedQuizzes[2]!.title).toBe("New Quiz");
				expect(result.nestedQuizzes[2]!.pages).toHaveLength(1);
				expect(result.nestedQuizzes[2]!.pages[0]!.title).toBe("Page 1");
			}
		});

		test("throws error when called on regular quiz", () => {
			const config = createRegularQuiz();
			expect(() => addNestedQuiz({ config })).toThrow(
				QuizConfigValidationError,
			);
		});
	});

	describe("removeNestedQuiz", () => {
		test("removes nested quiz from container", () => {
			const config = createContainerQuiz();
			const result = removeNestedQuiz({
				config,
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes).toHaveLength(1);
				expect(result.nestedQuizzes[0]!.id).toBe("nested-2");
			}
		});

		test("throws error when removing last nested quiz", () => {
			const config = createContainerQuiz();
			// Remove one first
			const configWith1 = removeNestedQuiz({
				config,
				nestedQuizId: "nested-1",
			});

			expect(() =>
				removeNestedQuiz({
					config: configWith1,
					nestedQuizId: "nested-2",
				}),
			).toThrow(QuizConfigValidationError);
		});

		test("throws error when nested quiz not found", () => {
			const config = createContainerQuiz();
			expect(() =>
				removeNestedQuiz({
					config,
					nestedQuizId: "nonexistent",
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("throws error when called on regular quiz", () => {
			const config = createRegularQuiz();
			expect(() =>
				removeNestedQuiz({
					config,
					nestedQuizId: "nested-1",
				}),
			).toThrow(QuizConfigValidationError);
		});
	});

	describe("updateNestedQuizInfo", () => {
		test("updates nested quiz title", () => {
			const config = createContainerQuiz();
			const result = updateNestedQuizInfo({
				config,
				nestedQuizId: "nested-1",
				updates: { title: "Updated Title" },
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.title).toBe("Updated Title");
			}
		});

		test("updates nested quiz description", () => {
			const config = createContainerQuiz();
			const result = updateNestedQuizInfo({
				config,
				nestedQuizId: "nested-1",
				updates: { description: "New description" },
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.description).toBe("New description");
			}
		});

		test("updates multiple fields at once", () => {
			const config = createContainerQuiz();
			const result = updateNestedQuizInfo({
				config,
				nestedQuizId: "nested-1",
				updates: {
					title: "New Title",
					description: "New Description",
				},
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.title).toBe("New Title");
				expect(result.nestedQuizzes[0]!.description).toBe("New Description");
			}
		});

		test("throws error when nested quiz not found", () => {
			const config = createContainerQuiz();
			expect(() =>
				updateNestedQuizInfo({
					config,
					nestedQuizId: "nonexistent",
					updates: { title: "New Title" },
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("throws error when called on regular quiz", () => {
			const config = createRegularQuiz();
			expect(() =>
				updateNestedQuizInfo({
					config,
					nestedQuizId: "nested-1",
					updates: { title: "New Title" },
				}),
			).toThrow(QuizConfigValidationError);
		});
	});

	describe("reorderNestedQuizzes", () => {
		test("reorders nested quizzes", () => {
			const config = createContainerQuiz();
			const result = reorderNestedQuizzes({
				config,
				nestedQuizIds: ["nested-2", "nested-1"],
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.id).toBe("nested-2");
				expect(result.nestedQuizzes[1]!.id).toBe("nested-1");
			}
		});

		test("throws error when ID count doesn't match", () => {
			const config = createContainerQuiz();
			expect(() =>
				reorderNestedQuizzes({
					config,
					nestedQuizIds: ["nested-1"],
				}),
			).toThrow(QuizConfigValidationError);
		});

		test("throws error when invalid ID provided", () => {
			const config = createContainerQuiz();
			expect(() =>
				reorderNestedQuizzes({
					config,
					nestedQuizIds: ["nested-1", "nonexistent"],
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("throws error when called on regular quiz", () => {
			const config = createRegularQuiz();
			expect(() =>
				reorderNestedQuizzes({
					config,
					nestedQuizIds: ["nested-1", "nested-2"],
				}),
			).toThrow(QuizConfigValidationError);
		});
	});

	// ========================================================================
	// CONTAINER SETTINGS AND QUIZ INFO TESTS
	// ========================================================================

	describe("updateContainerSettings", () => {
		test("updates sequentialOrder", () => {
			const config = createContainerQuiz();
			const result = updateContainerSettings({
				config,
				settings: { sequentialOrder: true },
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.sequentialOrder).toBe(true);
			}
		});

		test("throws error when called on regular quiz", () => {
			const config = createRegularQuiz();
			expect(() =>
				updateContainerSettings({
					config,
					settings: { sequentialOrder: true },
				}),
			).toThrow(QuizConfigValidationError);
		});
	});

	describe("updateQuizInfo", () => {
		test("updates quiz title for regular quiz", () => {
			const config = createRegularQuiz();
			const result = updateQuizInfo({
				config,
				updates: { title: "New Quiz Title" },
			});

			expect(result.title).toBe("New Quiz Title");
		});

		test("updates quiz title for container quiz", () => {
			const config = createContainerQuiz();
			const result = updateQuizInfo({
				config,
				updates: { title: "New Container Title" },
			});

			expect(result.title).toBe("New Container Title");
		});
	});

	// ========================================================================
	// PAGE MANAGEMENT TESTS
	// ========================================================================

	describe("updatePageInfo", () => {
		test("updates page title in regular quiz", () => {
			const config = createRegularQuiz();
			const result = updatePageInfo({
				config,
				pageId: "page-1",
				updates: { title: "New Page Title" },
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.title).toBe("New Page Title");
			}
		});

		test("updates page title in nested quiz", () => {
			const config = createContainerQuiz();
			const result = updatePageInfo({
				config,
				pageId: "page-1",
				updates: { title: "Updated Page" },
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.pages[0]!.title).toBe("Updated Page");
			}
		});

		test("throws error when page not found", () => {
			const config = createRegularQuiz();
			expect(() =>
				updatePageInfo({
					config,
					pageId: "nonexistent",
					updates: { title: "New Title" },
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("throws error when nestedQuizId not provided for container quiz", () => {
			const config = createContainerQuiz();
			expect(() =>
				updatePageInfo({
					config,
					pageId: "page-1",
					updates: { title: "New Title" },
				}),
			).toThrow(QuizConfigValidationError);
		});
	});

	describe("reorderPages", () => {
		test("reorders pages in regular quiz", () => {
			const config = createRegularQuiz();
			// Add another page first
			const configWith2Pages = addPage({
				config,
			});

			// Get the actual page IDs after adding
			if (configWith2Pages.type !== "regular") {
				throw new Error("Expected regular quiz");
			}
			const pageIds = configWith2Pages.pages.map((p) => p.id);
			const reversedPageIds = [...pageIds].reverse();

			const result = reorderPages({
				config: configWith2Pages,
				pageIds: reversedPageIds,
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.id).toBe(reversedPageIds[0]!);
				expect(result.pages[1]!.id).toBe(reversedPageIds[1]!);
			}
		});

		test("reorders pages in nested quiz", () => {
			const config = createContainerQuiz();
			// Add another page to nested quiz
			const configWith2Pages = addPage({
				config,
				nestedQuizId: "nested-1",
			});

			// Get the actual page IDs after adding
			if (configWith2Pages.type !== "container") {
				throw new Error("Expected container quiz");
			}
			const nestedQuiz = configWith2Pages.nestedQuizzes[0]!;
			const pageIds = nestedQuiz.pages.map((p) => p.id);
			const reversedPageIds = [...pageIds].reverse();

			const result = reorderPages({
				config: configWith2Pages,
				pageIds: reversedPageIds,
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				expect(result.nestedQuizzes[0]!.pages[0]!.id).toBe(reversedPageIds[0]!);
				expect(result.nestedQuizzes[0]!.pages[1]!.id).toBe(reversedPageIds[1]!);
			}
		});

		test("throws error when page ID count doesn't match", () => {
			const config = createRegularQuiz();
			expect(() =>
				reorderPages({
					config,
					pageIds: ["page-1", "page-2"],
				}),
			).toThrow(QuizConfigValidationError);
		});

		test("throws error when invalid page ID provided", () => {
			const config = createRegularQuiz();
			expect(() =>
				reorderPages({
					config,
					pageIds: ["nonexistent"],
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("throws error when nestedQuizId not provided for container quiz", () => {
			const config = createContainerQuiz();
			expect(() =>
				reorderPages({
					config,
					pageIds: ["page-1"],
				}),
			).toThrow(QuizConfigValidationError);
		});
	});

	// ========================================================================
	// QUESTION MOVEMENT AND SCORING TESTS
	// ========================================================================

	describe("moveQuestionToPage", () => {
		test("moves question to different page in regular quiz", () => {
			const config = createRegularQuiz();
			// Add second page
			const configWith2Pages = addPage({
				config,
			});

			// Get the actual page ID after adding
			if (configWith2Pages.type !== "regular") {
				throw new Error("Expected regular quiz");
			}
			const targetPageId = configWith2Pages.pages[1]!.id;

			const result = moveQuestionToPage({
				config: configWith2Pages,
				questionId: "q1",
				targetPageId,
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[0]!.questions).toHaveLength(0);
				expect(result.pages[1]!.questions).toHaveLength(1);
				expect(result.pages[1]!.questions[0]!.id).toBe("q1");
			}
		});

		test("moves question to specific position on target page", () => {
			const config = createRegularQuiz();
			// Add second page with a question
			let configWith2Pages = addPage({
				config,
			});

			// Get the actual page ID after adding
			if (configWith2Pages.type !== "regular") {
				throw new Error("Expected regular quiz");
			}
			const targetPageId = configWith2Pages.pages[1]!.id;

			configWith2Pages = addQuestion({
				config: configWith2Pages,
				pageId: targetPageId,
				questionType: "short-answer",
			});

			// Get the question ID that was just added
			if (configWith2Pages.type !== "regular") {
				throw new Error("Expected regular quiz");
			}
			const q2Id = configWith2Pages.pages[1]!.questions[0]!.id;

			const result = moveQuestionToPage({
				config: configWith2Pages,
				questionId: "q1",
				targetPageId,
				position: 0,
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				expect(result.pages[1]!.questions[0]!.id).toBe("q1");
				expect(result.pages[1]!.questions[1]!.id).toBe(q2Id);
			}
		});

		test("throws error when question not found", () => {
			const config = createRegularQuiz();
			expect(() =>
				moveQuestionToPage({
					config,
					questionId: "nonexistent",
					targetPageId: "page-1",
				}),
			).toThrow(QuizElementNotFoundError);
		});

		test("throws error when target page not found", () => {
			const config = createRegularQuiz();
			expect(() =>
				moveQuestionToPage({
					config,
					questionId: "q1",
					targetPageId: "nonexistent",
				}),
			).toThrow(QuizElementNotFoundError);
		});
	});

	describe("updateQuestionScoring", () => {
		test("updates question scoring in regular quiz", () => {
			const config = createRegularQuiz();
			const newScoring: SimpleScoring = {
				type: "simple",
				points: 5,
			};

			const result = updateQuestionScoring({
				config,
				questionId: "q1",
				scoring: newScoring,
			});

			expect(result.type).toBe("regular");
			if (result.type === "regular") {
				const question = result.pages[0]!.questions[0]!;
				expect(question.scoring).toEqual(newScoring);
			}
		});

		test("updates question scoring in nested quiz", () => {
			const config = createContainerQuiz();
			const newScoring: ManualScoring = {
				type: "manual",
				maxPoints: 10,
			};

			const result = updateQuestionScoring({
				config,
				questionId: "q1",
				scoring: newScoring,
				nestedQuizId: "nested-1",
			});

			expect(result.type).toBe("container");
			if (result.type === "container") {
				const question = result.nestedQuizzes[0]!.pages[0]!.questions[0]!;
				expect(question.scoring).toEqual(newScoring);
			}
		});

		test("throws error when question not found", () => {
			const config = createRegularQuiz();
			expect(() =>
				updateQuestionScoring({
					config,
					questionId: "nonexistent",
					scoring: { type: "simple", points: 5 },
				}),
			).toThrow(QuizElementNotFoundError);
		});
	});
});
