import { describe, expect, test } from "bun:test";
import type { LatestQuizConfig } from "server/json/raw-quiz-config/version-resolver";
import type {
	Question,
	TypedQuestionAnswer,
} from "server/json/raw-quiz-config/v2";
import {
	convertDatabaseAnswerToQuestionAnswer,
	convertDatabaseAnswersToQuizAnswers,
	convertQuestionAnswerToDatabaseFormat,
	findQuestionInConfig,
	validateAnswerTypeMatchesQuestion,
} from "./quiz-answer-converter";
import { InvalidArgumentError } from "~/utils/error";

describe("Quiz Answer Converter Utilities", () => {
	const regularQuizConfig: LatestQuizConfig = {
		version: "v2",
		type: "regular",
		id: "test-quiz",
		title: "Test Quiz",
		pages: [
			{
				id: "page-1",
				title: "Page 1",
				questions: [
					{
						id: "q1",
						type: "multiple-choice",
						prompt: "What is 2 + 2?",
						options: { a: "3", b: "4", c: "5", d: "6" },
						correctAnswer: "b",
					},
					{
						id: "q2",
						type: "short-answer",
						prompt: "What is the capital of France?",
						correctAnswer: "Paris",
					},
					{
						id: "q3",
						type: "long-answer",
						prompt: "Explain the importance of education",
					},
					{
						id: "q4",
						type: "article",
						prompt: "Write an article about technology",
					},
					{
						id: "q5",
						type: "choice",
						prompt: "Select all prime numbers",
						options: { a: "2", b: "3", c: "4", d: "5" },
						correctAnswers: ["a", "b", "d"],
					},
					{
						id: "q6",
						type: "ranking",
						prompt: "Rank these items",
						items: { a: "First", b: "Second", c: "Third" },
					},
					{
						id: "q7",
						type: "fill-in-the-blank",
						prompt: "The capital of {{country}} is {{capital}}",
						correctAnswers: { country: "France", capital: "Paris" },
					},
					{
						id: "q8",
						type: "single-selection-matrix",
						prompt: "Select one option per row",
						rows: { r1: "Row 1", r2: "Row 2" },
						columns: { c1: "Col 1", c2: "Col 2" },
					},
					{
						id: "q9",
						type: "multiple-selection-matrix",
						prompt: "Select multiple options per row",
						rows: { r1: "Row 1", r2: "Row 2" },
						columns: { c1: "Col 1", c2: "Col 2" },
					},
					{
						id: "q10",
						type: "whiteboard",
						prompt: "Draw a diagram",
					},
				],
			},
		],
	};

	const containerQuizConfig: LatestQuizConfig = {
		version: "v2",
		type: "container",
		id: "container-quiz",
		title: "Container Quiz",
		nestedQuizzes: [
			{
				id: "nested-1",
				title: "Nested Quiz 1",
				pages: [
					{
						id: "nested-page-1",
						title: "Nested Page 1",
						questions: [
							{
								id: "nq1",
								type: "multiple-choice",
								prompt: "Nested question 1",
								options: { a: "Option A", b: "Option B" },
								correctAnswer: "a",
							},
						],
					},
				],
			},
		],
	};

	describe("convertQuestionAnswerToDatabaseFormat", () => {
		test("should convert multiple-choice answer", () => {
			const question = regularQuizConfig.pages[0]!.questions[0]!;
			const answer: TypedQuestionAnswer = {
				type: "multiple-choice",
				value: "b",
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q1");
			expect(result.questionText).toBe("What is 2 + 2?");
			expect(result.questionType).toBe("multiple_choice");
			expect(result.selectedAnswer).toBe("b");
			expect(result.multipleChoiceAnswers).toBeUndefined();
		});

		test("should convert short-answer", () => {
			const question = regularQuizConfig.pages[0]!.questions[1]!;
			const answer: TypedQuestionAnswer = {
				type: "short-answer",
				value: "Paris",
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q2");
			expect(result.questionType).toBe("short_answer");
			expect(result.selectedAnswer).toBe("Paris");
		});

		test("should convert long-answer", () => {
			const question = regularQuizConfig.pages[0]!.questions[2]!;
			const answer: TypedQuestionAnswer = {
				type: "long-answer",
				value: "Education is important for personal development",
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q3");
			expect(result.questionType).toBe("essay");
			expect(result.selectedAnswer).toBe(
				"Education is important for personal development",
			);
		});

		test("should convert article", () => {
			const question = regularQuizConfig.pages[0]!.questions[3]!;
			const answer: TypedQuestionAnswer = {
				type: "article",
				value: "<p>Technology article content</p>",
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q4");
			expect(result.questionType).toBe("essay");
			expect(result.selectedAnswer).toBe("<p>Technology article content</p>");
		});

		test("should convert choice (multiple selection)", () => {
			const question = regularQuizConfig.pages[0]!.questions[4]!;
			const answer: TypedQuestionAnswer = {
				type: "choice",
				value: ["a", "b", "d"],
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q5");
			expect(result.questionType).toBe("multiple_choice");
			expect(result.multipleChoiceAnswers).toBeDefined();
			expect(result.multipleChoiceAnswers?.length).toBe(3);
			expect(result.multipleChoiceAnswers?.every((opt) => opt.isSelected)).toBe(
				true,
			);
			expect(result.multipleChoiceAnswers?.map((opt) => opt.option)).toEqual([
				"a",
				"b",
				"d",
			]);
		});

		test("should convert ranking", () => {
			const question = regularQuizConfig.pages[0]!.questions[5]!;
			const answer: TypedQuestionAnswer = {
				type: "ranking",
				value: ["a", "b", "c"],
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q6");
			expect(result.questionType).toBe("multiple_choice");
			expect(result.multipleChoiceAnswers).toBeDefined();
			expect(result.multipleChoiceAnswers?.length).toBe(3);
		});

		test("should convert fill-in-the-blank", () => {
			const question = regularQuizConfig.pages[0]!.questions[6]!;
			const answer: TypedQuestionAnswer = {
				type: "fill-in-the-blank",
				value: { country: "France", capital: "Paris" },
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q7");
			expect(result.questionType).toBe("fill_blank");
			expect(result.selectedAnswer).toBe(
				'{"country":"France","capital":"Paris"}',
			);
		});

		test("should convert single-selection-matrix", () => {
			const question = regularQuizConfig.pages[0]!.questions[7]!;
			const answer: TypedQuestionAnswer = {
				type: "single-selection-matrix",
				value: { r1: "c1", r2: "c2" },
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q8");
			expect(result.questionType).toBe("fill_blank");
			const parsed = JSON.parse(result.selectedAnswer || "{}") as Record<
				string,
				string
			>;
			expect(parsed.r1).toBe("c1");
			expect(parsed.r2).toBe("c2");
		});

		test("should convert multiple-selection-matrix", () => {
			const question = regularQuizConfig.pages[0]!.questions[8]!;
			const answer: TypedQuestionAnswer = {
				type: "multiple-selection-matrix",
				value: { r1: "c1", r2: "c2" },
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q9");
			expect(result.questionType).toBe("fill_blank");
			const parsed = JSON.parse(result.selectedAnswer || "{}") as Record<
				string,
				string
			>;
			expect(parsed.r1).toBe("c1");
			expect(parsed.r2).toBe("c2");
		});

		test("should convert whiteboard", () => {
			const question = regularQuizConfig.pages[0]!.questions[9]!;
			const answer: TypedQuestionAnswer = {
				type: "whiteboard",
				value: '{"type":"excalidraw","elements":[]}',
			};

			const result = convertQuestionAnswerToDatabaseFormat(question, answer);

			expect(result.questionId).toBe("q10");
			expect(result.questionType).toBe("essay");
			expect(result.selectedAnswer).toBe('{"type":"excalidraw","elements":[]}');
		});

		test("should throw error if answer type doesn't match question type", () => {
			const question = regularQuizConfig.pages[0]!.questions[0]!; // multiple-choice
			const answer: TypedQuestionAnswer = {
				type: "short-answer",
				value: "some text",
			};

			expect(() => {
				convertQuestionAnswerToDatabaseFormat(question, answer);
			}).toThrow(InvalidArgumentError);
		});
	});

	describe("convertDatabaseAnswerToQuestionAnswer", () => {
		test("should reconstruct multiple-choice answer", () => {
			const question = regularQuizConfig.pages[0]!.questions[0]!;
			const dbAnswer = {
				questionId: "q1",
				questionText: "What is 2 + 2?",
				questionType: "multiple_choice" as const,
				selectedAnswer: "b",
			};

			const result = convertDatabaseAnswerToQuestionAnswer(question, dbAnswer);

			expect(result.type).toBe("multiple-choice");
			expect(result.value).toBe("b");
		});

		test("should reconstruct short-answer", () => {
			const question = regularQuizConfig.pages[0]!.questions[1]!;
			const dbAnswer = {
				questionId: "q2",
				questionText: "What is the capital of France?",
				questionType: "short_answer" as const,
				selectedAnswer: "Paris",
			};

			const result = convertDatabaseAnswerToQuestionAnswer(question, dbAnswer);

			expect(result.type).toBe("short-answer");
			expect(result.value).toBe("Paris");
		});

		test("should reconstruct choice answer", () => {
			const question = regularQuizConfig.pages[0]!.questions[4]!;
			const dbAnswer = {
				questionId: "q5",
				questionText: "Select all prime numbers",
				questionType: "multiple_choice" as const,
				multipleChoiceAnswers: [
					{ option: "a", isSelected: true },
					{ option: "b", isSelected: true },
					{ option: "c", isSelected: false },
					{ option: "d", isSelected: true },
				],
			};

			const result = convertDatabaseAnswerToQuestionAnswer(question, dbAnswer);

			expect(result.type).toBe("choice");
			expect(result.value).toEqual(["a", "b", "d"]);
		});

		test("should reconstruct ranking answer", () => {
			const question = regularQuizConfig.pages[0]!.questions[5]!;
			const dbAnswer = {
				questionId: "q6",
				questionText: "Rank these items",
				questionType: "multiple_choice" as const,
				multipleChoiceAnswers: [
					{ option: "a", isSelected: true },
					{ option: "b", isSelected: true },
					{ option: "c", isSelected: true },
				],
			};

			const result = convertDatabaseAnswerToQuestionAnswer(question, dbAnswer);

			expect(result.type).toBe("ranking");
			expect(result.value).toEqual(["a", "b", "c"]);
		});

		test("should reconstruct fill-in-the-blank answer", () => {
			const question = regularQuizConfig.pages[0]!.questions[6]!;
			const dbAnswer = {
				questionId: "q7",
				questionText: "The capital of {{country}} is {{capital}}",
				questionType: "fill_blank" as const,
				selectedAnswer: '{"country":"France","capital":"Paris"}',
			};

			const result = convertDatabaseAnswerToQuestionAnswer(question, dbAnswer);

			expect(result.type).toBe("fill-in-the-blank");
			expect(result.value).toEqual({ country: "France", capital: "Paris" });
		});

		test("should handle fill-in-the-blank with invalid JSON (fallback)", () => {
			const question = regularQuizConfig.pages[0]!.questions[6]!;
			const dbAnswer = {
				questionId: "q7",
				questionText: "The capital of {{country}} is {{capital}}",
				questionType: "fill_blank" as const,
				selectedAnswer: "just a string",
			};

			const result = convertDatabaseAnswerToQuestionAnswer(question, dbAnswer);

			expect(result.type).toBe("fill-in-the-blank");
			expect(result.value).toEqual({ blank: "just a string" });
		});

		test("should reconstruct single-selection-matrix answer", () => {
			const question = regularQuizConfig.pages[0]!.questions[7]!;
			const dbAnswer = {
				questionId: "q8",
				questionText: "Select one option per row",
				questionType: "fill_blank" as const,
				selectedAnswer: '{"r1":"c1","r2":"c2"}',
			};

			const result = convertDatabaseAnswerToQuestionAnswer(question, dbAnswer);

			expect(result.type).toBe("single-selection-matrix");
			expect(result.value).toEqual({ r1: "c1", r2: "c2" });
		});

		test("should throw error for single-selection-matrix with invalid JSON", () => {
			const question = regularQuizConfig.pages[0]!.questions[7]!;
			const dbAnswer = {
				questionId: "q8",
				questionText: "Select one option per row",
				questionType: "fill_blank" as const,
				selectedAnswer: "invalid json",
			};

			expect(() => {
				convertDatabaseAnswerToQuestionAnswer(question, dbAnswer);
			}).toThrow(InvalidArgumentError);
		});

		test("should throw error if required field is missing", () => {
			const question = regularQuizConfig.pages[0]!.questions[0]!;
			const dbAnswer = {
				questionId: "q1",
				questionText: "What is 2 + 2?",
				questionType: "multiple_choice" as const,
				// missing selectedAnswer
			};

			expect(() => {
				convertDatabaseAnswerToQuestionAnswer(question, dbAnswer);
			}).toThrow(InvalidArgumentError);
		});
	});

	describe("findQuestionInConfig", () => {
		test("should find question in regular quiz", () => {
			const question = findQuestionInConfig(regularQuizConfig, "q1");
			expect(question).toBeDefined();
			expect(question?.id).toBe("q1");
			expect(question?.type).toBe("multiple-choice");
		});

		test("should return null for non-existent question", () => {
			const question = findQuestionInConfig(regularQuizConfig, "non-existent");
			expect(question).toBeNull();
		});

		test("should find question in nested quiz", () => {
			const question = findQuestionInConfig(
				containerQuizConfig,
				"nested-1:nq1",
			);
			expect(question).toBeDefined();
			expect(question?.id).toBe("nq1");
			expect(question?.type).toBe("multiple-choice");
		});

		test("should return null for non-existent nested quiz", () => {
			const question = findQuestionInConfig(
				containerQuizConfig,
				"non-existent:nq1",
			);
			expect(question).toBeNull();
		});

		test("should return null for non-existent question in nested quiz", () => {
			const question = findQuestionInConfig(
				containerQuizConfig,
				"nested-1:non-existent",
			);
			expect(question).toBeNull();
		});
	});

	describe("validateAnswerTypeMatchesQuestion", () => {
		test("should return true for matching types", () => {
			const question = regularQuizConfig.pages[0]!.questions[0]!;
			const answer: TypedQuestionAnswer = {
				type: "multiple-choice",
				value: "b",
			};

			expect(validateAnswerTypeMatchesQuestion(question, answer)).toBe(true);
		});

		test("should return false for non-matching types", () => {
			const question = regularQuizConfig.pages[0]!.questions[0]!;
			const answer: TypedQuestionAnswer = {
				type: "short-answer",
				value: "some text",
			};

			expect(validateAnswerTypeMatchesQuestion(question, answer)).toBe(false);
		});
	});

	describe("convertDatabaseAnswersToQuizAnswers", () => {
		test("should convert multiple database answers to QuizAnswers format", () => {
			const dbAnswers = [
				{
					questionId: "q1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice" as const,
					selectedAnswer: "b",
				},
				{
					questionId: "q2",
					questionText: "What is the capital of France?",
					questionType: "short_answer" as const,
					selectedAnswer: "Paris",
				},
				{
					questionId: "q5",
					questionText: "Select all prime numbers",
					questionType: "multiple_choice" as const,
					multipleChoiceAnswers: [
						{ option: "a", isSelected: true },
						{ option: "b", isSelected: true },
						{ option: "d", isSelected: true },
					],
				},
				{
					questionId: "q7",
					questionText: "The capital of {{country}} is {{capital}}",
					questionType: "fill_blank" as const,
					selectedAnswer: '{"country":"France","capital":"Paris"}',
				},
			];

			const result = convertDatabaseAnswersToQuizAnswers(
				regularQuizConfig,
				dbAnswers,
			);

			expect(result.q1).toBe("b");
			expect(result.q2).toBe("Paris");
			expect(result.q5).toEqual(["a", "b", "d"]);
			expect(result.q7).toEqual({ country: "France", capital: "Paris" });
		});

		test("should skip answers for non-existent questions", () => {
			const dbAnswers = [
				{
					questionId: "non-existent",
					questionText: "Non-existent question",
					questionType: "multiple_choice" as const,
					selectedAnswer: "b",
				},
				{
					questionId: "q1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice" as const,
					selectedAnswer: "b",
				},
			];

			const result = convertDatabaseAnswersToQuizAnswers(
				regularQuizConfig,
				dbAnswers,
			);

			expect(result["non-existent"]).toBeUndefined();
			expect(result.q1).toBe("b");
		});

		test("should skip invalid answers", () => {
			const dbAnswers = [
				{
					questionId: "q1",
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice" as const,
					// missing selectedAnswer - will cause error
				},
				{
					questionId: "q2",
					questionText: "What is the capital of France?",
					questionType: "short_answer" as const,
					selectedAnswer: "Paris",
				},
			];

			const result = convertDatabaseAnswersToQuizAnswers(
				regularQuizConfig,
				dbAnswers,
			);

			// q1 should be skipped due to error
			expect(result.q1).toBeUndefined();
			expect(result.q2).toBe("Paris");
		});

		test("should handle empty answers array", () => {
			const result = convertDatabaseAnswersToQuizAnswers(regularQuizConfig, []);

			expect(Object.keys(result).length).toBe(0);
		});
	});
});
