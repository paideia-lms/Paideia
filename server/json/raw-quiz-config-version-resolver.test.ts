import { describe, expect, test } from "bun:test";
import type { QuizConfig as QuizConfigV1 } from "./raw-quiz-config.types";
import type { QuizConfig as QuizConfigV2 } from "./raw-quiz-config.types.v2";
import {
	isValidQuizConfig,
	resolveQuizConfigToLatest,
	tryResolveQuizConfigToLatest,
} from "./raw-quiz-config-version-resolver";

describe("raw-quiz-config-version-resolver", () => {
	test("should convert v1 regular quiz to v2 with correct discriminated union", () => {
		const v1Config: QuizConfigV1 = {
			id: "quiz-1",
			title: "Sample Quiz",
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
			resources: [
				{
					id: "res-1",
					title: "Resource",
					content: "<p>Content</p>",
					pages: ["page-1"],
				},
			],
			globalTimer: 300,
			grading: {
				enabled: true,
				passingScore: 70,
			},
		};

		const result = resolveQuizConfigToLatest(v1Config);

		// Should have v2 structure with discriminated union
		expect(result.version).toBe("v2");
		expect(result.type).toBe("regular");
		expect(result.id).toBe("quiz-1");
		expect(result.title).toBe("Sample Quiz");

		// Type narrowing works
		if (result.type === "regular") {
			expect(result.pages).toHaveLength(1);
			expect(result.resources).toHaveLength(1);
			expect(result.pages[0].questions).toHaveLength(1);
		}

		expect(result.globalTimer).toBe(300);
		expect(result.grading?.enabled).toBe(true);
		expect(result.grading?.passingScore).toBe(70);
	});

	test("should convert v1 container quiz to v2 and move resources to nested quizzes", () => {
		const v1Config: QuizConfigV1 = {
			id: "quiz-container",
			title: "Container Quiz",
			nestedQuizzes: [
				{
					id: "nested-1",
					title: "Section 1",
					pages: [
						{
							id: "page-1",
							title: "Page 1",
							questions: [],
						},
					],
				},
			],
			resources: [
				{
					id: "res-1",
					title: "Shared Resource",
					content: "<p>Content</p>",
					pages: ["page-1"],
				},
			],
			sequentialOrder: true,
		};

		const result = resolveQuizConfigToLatest(v1Config);

		expect(result.version).toBe("v2");
		expect(result.type).toBe("container");

		if (result.type === "container") {
			expect(result.nestedQuizzes).toHaveLength(1);
			expect(result.sequentialOrder).toBe(true);

			// Resources moved to nested quiz
			expect(result.nestedQuizzes[0].resources).toHaveLength(1);
			expect(result.nestedQuizzes[0].resources?.[0].id).toBe("res-1");
		}
	});

	test("should pass through v2 config unchanged", () => {
		const v2Config: QuizConfigV2 = {
			version: "v2",
			type: "regular",
			id: "quiz-2",
			title: "Already V2",
			pages: [],
		};

		const result = resolveQuizConfigToLatest(v2Config);

		expect(result).toEqual(v2Config);
	});

	test("should validate quiz configs correctly", () => {
		expect(isValidQuizConfig({ id: "1", title: "Test", pages: [] })).toBe(true);
		expect(
			isValidQuizConfig({ id: "1", title: "Test", nestedQuizzes: [] }),
		).toBe(true);
		expect(
			isValidQuizConfig({
				version: "v2",
				type: "regular",
				id: "1",
				title: "Test",
				pages: [],
			}),
		).toBe(true);

		expect(isValidQuizConfig(null)).toBe(false);
		expect(isValidQuizConfig({})).toBe(false);
		expect(isValidQuizConfig({ id: "1" })).toBe(false);
		expect(isValidQuizConfig({ title: "Test" })).toBe(false);
	});

	test("should safely handle invalid input with try function", () => {
		expect(tryResolveQuizConfigToLatest(null)).toBeNull();
		expect(tryResolveQuizConfigToLatest({})).toBeNull();
		expect(tryResolveQuizConfigToLatest({ id: 123, title: "Test" })).toBeNull();

		const validConfig = tryResolveQuizConfigToLatest({
			id: "1",
			title: "Test",
			pages: [],
		});
		expect(validConfig).not.toBeNull();
		expect(validConfig?.version).toBe("v2");
	});

	test("should convert v1 fill-in-the-blank questions to v2 format", () => {
		const v1Config: QuizConfigV1 = {
			id: "quiz-fill-v1",
			title: "V1 Fill in the Blank Quiz",
			pages: [
				{
					id: "page-1",
					title: "Page 1",
					questions: [
						{
							id: "q1",
							type: "fill-in-the-blank",
							prompt: "The capital of France is {{capital}} and the largest city is also {{capital}}.",
							correctAnswers: ["Paris"],
						},
						{
							id: "q2",
							type: "fill-in-the-blank",
							prompt: "{{country}} has {{capital}} as its capital.",
							correctAnswers: ["France", "Paris"],
						},
					],
				},
			],
		};

		const result = resolveQuizConfigToLatest(v1Config);

		expect(result.version).toBe("v2");
		expect(result.type).toBe("regular");

		if (result.type === "regular") {
			expect(result.pages[0].questions).toHaveLength(2);

			const q1 = result.pages[0].questions[0];
			if (q1.type === "fill-in-the-blank") {
				expect(q1.prompt).toBe("The capital of France is {{capital}} and the largest city is also {{capital}}.");
				expect(q1.correctAnswers).toEqual({ capital: "Paris" });
			}

			const q2 = result.pages[0].questions[1];
			if (q2.type === "fill-in-the-blank") {
				expect(q2.prompt).toBe("{{country}} has {{capital}} as its capital.");
				expect(q2.correctAnswers).toEqual({ country: "France", capital: "Paris" });
			}
		}
	});

	test("should pass through v2 fill-in-the-blank with new blank_id format", () => {
		const v2Config: QuizConfigV2 = {
			version: "v2",
			type: "regular",
			id: "quiz-fill",
			title: "Fill in the Blank Quiz",
			pages: [
				{
					id: "page-1",
					title: "Page 1",
					questions: [
						{
							id: "q1",
							type: "fill-in-the-blank",
							prompt: "The capital of France is {{capital}} and the largest city is also {{capital}}.",
							correctAnswers: { capital: "Paris" },
						},
						{
							id: "q2",
							type: "fill-in-the-blank",
							prompt: "{{country}} has {{capital}} as its capital.",
							correctAnswers: { country: "France", capital: "Paris" },
						},
					],
				},
			],
		};

		const result = resolveQuizConfigToLatest(v2Config);

		expect(result.version).toBe("v2");
		expect(result.type).toBe("regular");

		if (result.type === "regular") {
			expect(result.pages[0].questions).toHaveLength(2);

			const q1 = result.pages[0].questions[0];
			if (q1.type === "fill-in-the-blank") {
				expect(q1.prompt).toBe("The capital of France is {{capital}} and the largest city is also {{capital}}.");
				expect(q1.correctAnswers).toEqual({ capital: "Paris" });
			}

			const q2 = result.pages[0].questions[1];
			if (q2.type === "fill-in-the-blank") {
				expect(q2.prompt).toBe("{{country}} has {{capital}} as its capital.");
				expect(q2.correctAnswers).toEqual({ country: "France", capital: "Paris" });
			}
		}
	});
});
