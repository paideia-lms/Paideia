import { describe, expect, test } from "bun:test";
import { calculateQuizGrade, type QuizAnswer } from "./quiz-grading";
import type { LatestQuizConfig } from "server/json/raw-quiz-config/version-resolver";

describe("calculateQuizGrade", () => {
	test("should calculate grade for multiple-choice question correctly", () => {
		const config: LatestQuizConfig = {
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
							prompt: "What is 2 + 2?",
							options: {
								a: "3",
								b: "4",
								c: "5",
								d: "6",
							},
							correctAnswer: "b",
							scoring: {
								type: "simple",
								points: 25,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "What is 2 + 2?",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: false },
					{ option: "b", isSelected: true },
					{ option: "c", isSelected: false },
					{ option: "d", isSelected: false },
				],
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(25);
		expect(result.maxScore).toBe(25);
		expect(result.percentage).toBe(100);
		expect(result.questionResults).toHaveLength(1);
		expect(result.questionResults[0]?.isCorrect).toBe(true);
		expect(result.questionResults[0]?.pointsEarned).toBe(25);
		expect(result.questionResults[0]?.feedback).toBe("Correct!");
	});

	test("should calculate grade for incorrect multiple-choice answer", () => {
		const config: LatestQuizConfig = {
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
							prompt: "What is 2 + 2?",
							options: {
								a: "3",
								b: "4",
							},
							correctAnswer: "b",
							scoring: {
								type: "simple",
								points: 10,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "What is 2 + 2?",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: true },
					{ option: "b", isSelected: false },
				],
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(0);
		expect(result.maxScore).toBe(10);
		expect(result.percentage).toBe(0);
		expect(result.questionResults[0]?.isCorrect).toBe(false);
		expect(result.questionResults[0]?.pointsEarned).toBe(0);
		expect(result.questionResults[0]?.feedback).toContain("Incorrect");
		expect(result.questionResults[0]?.feedback).toContain("4");
	});

	test("should calculate grade for choice question (true/false style) with selectedAnswer", () => {
		const config: LatestQuizConfig = {
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
							type: "choice",
							prompt: "Is the sky blue?",
							options: {
								true: "True",
								false: "False",
							},
							correctAnswers: ["true"],
							scoring: {
								type: "simple",
								points: 25,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "Is the sky blue?",
				questionType: "true_false",
				selectedAnswer: "true",
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(25);
		expect(result.maxScore).toBe(25);
		expect(result.percentage).toBe(100);
		expect(result.questionResults[0]?.isCorrect).toBe(true);
		expect(result.questionResults[0]?.pointsEarned).toBe(25);
		expect(result.questionResults[0]?.feedback).toBe("Correct!");
	});

	test("should calculate grade for choice question with multipleChoiceAnswers", () => {
		const config: LatestQuizConfig = {
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
							type: "choice",
							prompt: "Select all prime numbers",
							options: {
								a: "2",
								b: "4",
								c: "5",
								d: "6",
							},
							correctAnswers: ["a", "c"],
							scoring: {
								type: "simple",
								points: 20,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "Select all prime numbers",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: true },
					{ option: "b", isSelected: false },
					{ option: "c", isSelected: true },
					{ option: "d", isSelected: false },
				],
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(20);
		expect(result.maxScore).toBe(20);
		expect(result.percentage).toBe(100);
		expect(result.questionResults[0]?.isCorrect).toBe(true);
		expect(result.questionResults[0]?.pointsEarned).toBe(20);
	});

	test("should calculate grade for short-answer question correctly", () => {
		const config: LatestQuizConfig = {
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
							type: "short-answer",
							prompt: "What is the capital of France?",
							correctAnswer: "Paris",
							scoring: {
								type: "simple",
								points: 30,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "What is the capital of France?",
				questionType: "short_answer",
				selectedAnswer: "Paris",
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(30);
		expect(result.maxScore).toBe(30);
		expect(result.percentage).toBe(100);
		expect(result.questionResults[0]?.isCorrect).toBe(true);
		expect(result.questionResults[0]?.pointsEarned).toBe(30);
		expect(result.questionResults[0]?.feedback).toBe("Correct!");
	});

	test("should handle case-insensitive short-answer matching", () => {
		const config: LatestQuizConfig = {
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
							type: "short-answer",
							prompt: "What is the capital of France?",
							correctAnswer: "Paris",
							scoring: {
								type: "simple",
								points: 30,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "What is the capital of France?",
				questionType: "short_answer",
				selectedAnswer: "  PARIS  ", // With spaces and uppercase
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(30);
		expect(result.maxScore).toBe(30);
		expect(result.questionResults[0]?.isCorrect).toBe(true);
	});

	test("should calculate grade for long-answer question with partial credit", () => {
		const config: LatestQuizConfig = {
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
							type: "long-answer",
							prompt: "Write a short essay about the importance of education",
							scoring: {
								type: "manual",
								maxPoints: 25,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "Write a short essay about the importance of education",
				questionType: "essay",
				selectedAnswer:
					"Education is very important for personal development and societal progress. It helps individuals acquire knowledge, skills, and critical thinking abilities that are essential for success in life.",
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(12); // 50% of 25 points (floor)
		expect(result.maxScore).toBe(25);
		expect(result.percentage).toBe(48);
		expect(result.questionResults[0]?.isCorrect).toBe(false);
		expect(result.questionResults[0]?.pointsEarned).toBe(12);
		expect(result.questionResults[0]?.feedback).toContain(
			"Essay submitted. Manual grading required.",
		);
	});

	test("should give zero points for short long-answer", () => {
		const config: LatestQuizConfig = {
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
							type: "long-answer",
							prompt: "Write an essay",
							scoring: {
								type: "manual",
								maxPoints: 25,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "Write an essay",
				questionType: "essay",
				selectedAnswer: "Short answer",
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(0);
		expect(result.maxScore).toBe(25);
		expect(result.questionResults[0]?.pointsEarned).toBe(0);
		expect(result.questionResults[0]?.feedback).toContain("too short");
	});

	test("should handle missing answers", () => {
		const config: LatestQuizConfig = {
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
							prompt: "What is 2 + 2?",
							options: {
								a: "3",
								b: "4",
							},
							correctAnswer: "b",
							scoring: {
								type: "simple",
								points: 10,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = []; // No answers provided

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(0);
		expect(result.maxScore).toBe(10);
		expect(result.percentage).toBe(0);
		expect(result.questionResults).toHaveLength(1);
		expect(result.questionResults[0]?.isCorrect).toBe(false);
		expect(result.questionResults[0]?.pointsEarned).toBe(0);
		expect(result.questionResults[0]?.feedback).toBe("No answer provided");
	});

	test("should calculate grade for multiple questions correctly", () => {
		const config: LatestQuizConfig = {
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
							prompt: "What is 2 + 2?",
							options: {
								a: "3",
								b: "4",
							},
							correctAnswer: "b",
							scoring: {
								type: "simple",
								points: 25,
							},
						},
						{
							id: "q2",
							type: "choice",
							prompt: "Is the sky blue?",
							options: {
								true: "True",
								false: "False",
							},
							correctAnswers: ["true"],
							scoring: {
								type: "simple",
								points: 25,
							},
						},
						{
							id: "q3",
							type: "short-answer",
							prompt: "What is the capital of France?",
							correctAnswer: "Paris",
							scoring: {
								type: "simple",
								points: 25,
							},
						},
						{
							id: "q4",
							type: "long-answer",
							prompt: "Write a short essay",
							scoring: {
								type: "manual",
								maxPoints: 25,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "What is 2 + 2?",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: false },
					{ option: "b", isSelected: true },
				],
			},
			{
				questionId: "q2",
				questionText: "Is the sky blue?",
				questionType: "true_false",
				selectedAnswer: "true",
			},
			{
				questionId: "q3",
				questionText: "What is the capital of France?",
				questionType: "short_answer",
				selectedAnswer: "Paris",
			},
			{
				questionId: "q4",
				questionText: "Write a short essay",
				questionType: "essay",
				selectedAnswer:
					"Education is very important for personal development and societal progress. It helps individuals acquire knowledge, skills, and critical thinking abilities that are essential for success in life.",
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(87); // 25 + 25 + 25 + 12 (essay partial credit)
		expect(result.maxScore).toBe(100);
		expect(result.percentage).toBe(87);
		expect(result.questionResults).toHaveLength(4);
		expect(result.feedback).toContain("87/100 points (87%)");
		expect(result.feedback).toContain("3/4 questions correct");

		// Verify individual question results
		const q1 = result.questionResults.find((q) => q.questionId === "q1");
		expect(q1?.isCorrect).toBe(true);
		expect(q1?.pointsEarned).toBe(25);

		const q2 = result.questionResults.find((q) => q.questionId === "q2");
		expect(q2?.isCorrect).toBe(true);
		expect(q2?.pointsEarned).toBe(25);

		const q3 = result.questionResults.find((q) => q.questionId === "q3");
		expect(q3?.isCorrect).toBe(true);
		expect(q3?.pointsEarned).toBe(25);

		const q4 = result.questionResults.find((q) => q.questionId === "q4");
		expect(q4?.isCorrect).toBe(false);
		expect(q4?.pointsEarned).toBe(12);
		expect(q4?.feedback).toContain("Essay submitted. Manual grading required.");
	});

	test("should handle container quiz with nested quizzes", () => {
		const config: LatestQuizConfig = {
			version: "v2",
			type: "container",
			id: "quiz-1",
			title: "Container Quiz",
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
									type: "multiple-choice",
									prompt: "What is 2 + 2?",
									options: {
										a: "3",
										b: "4",
									},
									correctAnswer: "b",
									scoring: {
										type: "simple",
										points: 50,
									},
								},
							],
						},
					],
				},
			],
			globalTimer: 60,
			sequentialOrder: false,
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "What is 2 + 2?",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: false },
					{ option: "b", isSelected: true },
				],
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(50);
		expect(result.maxScore).toBe(50);
		expect(result.percentage).toBe(100);
		expect(result.questionResults).toHaveLength(1);
	});

	test("should handle fill-in-the-blank question", () => {
		const config: LatestQuizConfig = {
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
							type: "fill-in-the-blank",
							prompt: "The capital of France is {{capital}}",
							correctAnswers: {
								capital: "Paris",
							},
							scoring: {
								type: "simple",
								points: 20,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "The capital of France is {{capital}}",
				questionType: "fill_blank",
				selectedAnswer: "Paris",
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(20);
		expect(result.maxScore).toBe(20);
		expect(result.questionResults[0]?.isCorrect).toBe(true);
		expect(result.questionResults[0]?.pointsEarned).toBe(20);
	});

	test("should handle incorrect fill-in-the-blank answer", () => {
		const config: LatestQuizConfig = {
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
							type: "fill-in-the-blank",
							prompt: "The capital of France is {{capital}}",
							correctAnswers: {
								capital: "Paris",
							},
							scoring: {
								type: "simple",
								points: 20,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "The capital of France is {{capital}}",
				questionType: "fill_blank",
				selectedAnswer: "London",
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(0);
		expect(result.maxScore).toBe(20);
		expect(result.questionResults[0]?.isCorrect).toBe(false);
		expect(result.questionResults[0]?.pointsEarned).toBe(0);
		expect(result.questionResults[0]?.feedback).toContain("Incorrect");
		expect(result.questionResults[0]?.feedback).toContain("Paris");
	});

	test("should handle questions across multiple pages", () => {
		const config: LatestQuizConfig = {
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
							prompt: "Question 1",
							options: {
								a: "Option A",
								b: "Option B",
							},
							correctAnswer: "a",
							scoring: {
								type: "simple",
								points: 10,
							},
						},
					],
				},
				{
					id: "page-2",
					title: "Page 2",
					questions: [
						{
							id: "q2",
							type: "multiple-choice",
							prompt: "Question 2",
							options: {
								a: "Option A",
								b: "Option B",
							},
							correctAnswer: "b",
							scoring: {
								type: "simple",
								points: 15,
							},
						},
					],
				},
			],
		};

		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "Question 1",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: true },
					{ option: "b", isSelected: false },
				],
			},
			{
				questionId: "q2",
				questionText: "Question 2",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: false },
					{ option: "b", isSelected: true },
				],
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(25);
		expect(result.maxScore).toBe(25);
		expect(result.percentage).toBe(100);
		expect(result.questionResults).toHaveLength(2);
		expect(result.questionResults[0]?.isCorrect).toBe(true);
		expect(result.questionResults[1]?.isCorrect).toBe(true);
	});

	test("should handle choice question with incorrect selection", () => {
		const config: LatestQuizConfig = {
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
							type: "choice",
							prompt: "Select all prime numbers",
							options: {
								a: "2",
								b: "4",
								c: "5",
							},
							correctAnswers: ["a", "c"],
							scoring: {
								type: "simple",
								points: 20,
							},
						},
					],
				},
			],
		};

		// Only select one correct answer (missing "c")
		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "Select all prime numbers",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: true },
					{ option: "b", isSelected: false },
					{ option: "c", isSelected: false },
				],
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(0);
		expect(result.maxScore).toBe(20);
		expect(result.questionResults[0]?.isCorrect).toBe(false);
		expect(result.questionResults[0]?.feedback).toContain("Incorrect");
	});

	test("should handle choice question with extra incorrect selection", () => {
		const config: LatestQuizConfig = {
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
							type: "choice",
							prompt: "Select all prime numbers",
							options: {
								a: "2",
								b: "4",
								c: "5",
							},
							correctAnswers: ["a", "c"],
							scoring: {
								type: "simple",
								points: 20,
							},
						},
					],
				},
			],
		};

		// Select all correct answers plus an incorrect one
		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "Select all prime numbers",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: true },
					{ option: "b", isSelected: true }, // Incorrect
					{ option: "c", isSelected: true },
				],
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(0);
		expect(result.maxScore).toBe(20);
		expect(result.questionResults[0]?.isCorrect).toBe(false);
	});

	test("should calculate percentage correctly with decimal values", () => {
		const config: LatestQuizConfig = {
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
							prompt: "Question 1",
							options: {
								a: "Option A",
								b: "Option B",
							},
							correctAnswer: "a",
							scoring: {
								type: "simple",
								points: 1,
							},
						},
						{
							id: "q2",
							type: "multiple-choice",
							prompt: "Question 2",
							options: {
								a: "Option A",
								b: "Option B",
							},
							correctAnswer: "a",
							scoring: {
								type: "simple",
								points: 1,
							},
						},
						{
							id: "q3",
							type: "multiple-choice",
							prompt: "Question 3",
							options: {
								a: "Option A",
								b: "Option B",
							},
							correctAnswer: "a",
							scoring: {
								type: "simple",
								points: 1,
							},
						},
					],
				},
			],
		};

		// Answer 2 out of 3 correctly = 66.67%
		const answers: QuizAnswer[] = [
			{
				questionId: "q1",
				questionText: "Question 1",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: true },
					{ option: "b", isSelected: false },
				],
			},
			{
				questionId: "q2",
				questionText: "Question 2",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: true },
					{ option: "b", isSelected: false },
				],
			},
			{
				questionId: "q3",
				questionText: "Question 3",
				questionType: "multiple_choice",
				multipleChoiceAnswers: [
					{ option: "a", isSelected: false },
					{ option: "b", isSelected: true },
				],
			},
		];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(2);
		expect(result.maxScore).toBe(3);
		expect(result.percentage).toBe(66.67);
		expect(result.feedback).toContain("2/3 points (66.67%)");
		expect(result.feedback).toContain("2/3 questions correct");
	});

	test("should handle empty quiz config", () => {
		const config: LatestQuizConfig = {
			version: "v2",
			type: "regular",
			id: "quiz-1",
			title: "Empty Quiz",
			pages: [],
		};

		const answers: QuizAnswer[] = [];

		const result = calculateQuizGrade(config, answers);

		expect(result.totalScore).toBe(0);
		expect(result.maxScore).toBe(0);
		expect(result.percentage).toBe(0);
		expect(result.questionResults).toHaveLength(0);
		expect(result.feedback).toContain("0/0 points");
		expect(result.feedback).toContain("0/0 questions correct");
	});
});
