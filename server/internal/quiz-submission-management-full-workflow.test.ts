import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import { JobQueue } from "../utils/job-queue";
import {
	type CreateActivityModuleArgs,
	tryCreateQuizModule,
} from "./activity-module-management";
import {
	type CreateCourseActivityModuleLinkArgs,
	tryCreateCourseActivityModuleLink,
} from "./course-activity-module-link-management";
import { tryCreateCourse } from "./course-management";
import { tryCreateSection } from "./course-section-management";
import { tryCreateEnrollment } from "./enrollment-management";
import { tryCreateGradebookItem } from "./gradebook-item-management";
import {
	type CreateQuizArgs,
	type StartQuizAttemptArgs,
	tryAnswerQuizQuestion,
	tryCalculateQuizGrade,
	tryCreateQuiz,
	tryDeleteQuizSubmission,
	tryFlagQuizQuestion,
	tryGetQuizById,
	tryGetQuizSubmissionById,
	tryListQuizSubmissions,
	tryRemoveAnswerFromQuizQuestion,
	tryStartQuizAttempt,
	tryMarkQuizAttemptAsComplete,
	tryUnflagQuizQuestion,
} from "./quiz-submission-management";
import { tryCreateUser } from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/types";
import { autoSubmitQuiz } from "../tasks/auto-submit-quiz";

describe("Quiz Management - Full Workflow", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let teacher: TryResultValue<typeof tryCreateUser>;
	let student: TryResultValue<typeof tryCreateUser>;
	let course: TryResultValue<typeof tryCreateCourse>;
	let enrollment: TryResultValue<typeof tryCreateEnrollment>;
	let section: TryResultValue<typeof tryCreateSection>;
	let courseActivityModuleLink: TryResultValue<
		typeof tryCreateCourseActivityModuleLink
	>;
	let activityModuleId: number;
	let quizId: number;
	let gradebookItemId: number;

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

		// Create teacher and student users in parallel
		const [teacherResult, studentResult] = await Promise.all([
			tryCreateUser({
				payload,
				data: {
					email: "quiz-teacher@example.com",
					password: "password123",
					firstName: "John",
					lastName: "Teacher",
					role: "instructor",
				},
				overrideAccess: true,
			}).getOrThrow(),
			tryCreateUser({
				payload,
				data: {
					email: "quiz-student@example.com",
					password: "password123",
					firstName: "Jane",
					lastName: "Student",
					role: "student",
				},
				overrideAccess: true,
			}).getOrThrow(),
		]);

		teacher = teacherResult;
		student = studentResult;

		// Create course
		course = await tryCreateCourse({
			payload,
			data: {
				title: "Quiz Test Course",
				description: "A test course for quiz submissions",
				slug: "quiz-test-course",
				createdBy: teacher.id,
			},
			overrideAccess: true,
		}).getOrThrow();

		// Create enrollment
		enrollment = await tryCreateEnrollment({
			payload,
			userId: student.id,
			course: course.id,
			role: "student",
			status: "active",
			overrideAccess: true,
		}).getOrThrow();

		// Create activity module with quiz
		const activityModuleResult = await tryCreateQuizModule({
			payload,
			title: "Test Quiz",
			description: "A test quiz for submission workflow",
			instructions: "Complete this quiz by answering all questions",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: `quiz-${Date.now()}`,
				title: "Test Quiz",
				globalTimer: 1800, // 30 minutes in seconds
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [
							{
								id: `q1-${Date.now()}`,
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
							{
								id: `q2-${Date.now()}`,
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
								id: `q3-${Date.now()}`,
								type: "short-answer",
								prompt: "What is the capital of France?",
								correctAnswer: "Paris",
								scoring: {
									type: "simple",
									points: 25,
								},
							},
							{
								id: `q4-${Date.now()}`,
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
			},
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			overrideAccess: true,
		});

		if (!activityModuleResult.ok) {
			throw new Error("Test Error: Failed to create test activity module");
		}
		activityModuleId = activityModuleResult.value.id;
		console.log("Created activity module with ID:", activityModuleId);
		// Get the quiz ID from the activity module
		// Since QuizModuleResult is a discriminated union, we need to check the type first
		if (activityModuleResult.value.type === "quiz") {
			// Fetch the activity module with depth to get the quiz relationship
			const module = await payload.findByID({
				collection: "activity-modules",
				id: activityModuleId,
				depth: 1,
			});
			if (module.quiz) {
				quizId =
					typeof module.quiz === "object" && "id" in module.quiz
						? module.quiz.id
						: (module.quiz as number);
				console.log("Extracted quiz ID:", quizId);
			}
		}

		// Create a section for the course
		section = await tryCreateSection({
			payload,
			data: {
				course: course.id,
				title: "Test Section",
				description: "Test section for quiz submissions",
			},
			overrideAccess: true,
		}).getOrThrow();

		// Create course-activity-module-link
		courseActivityModuleLink = await tryCreateCourseActivityModuleLink({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			course: course.id,
			activityModule: activityModuleId,
			section: section.id,
			order: 0,
			overrideAccess: true,
		}).getOrThrow();

		console.log(
			"Created course-activity-module-link with ID:",
			courseActivityModuleLink.id,
		);

		// Verify gradebook exists
		const verifyGradebook = await payload.findByID({
			collection: "gradebooks",
			id: course.gradebook.id,
		});
		console.log(
			"Gradebook verification result:",
			verifyGradebook ? "Found" : "Not found",
		);

		// Verify activity module exists
		const verifyActivityModule = await payload.findByID({
			collection: "activity-modules",
			id: activityModuleId,
		});
		console.log(
			"Activity module verification result:",
			verifyActivityModule ? "Found" : "Not found",
		);

		const gradebookItemResult = await tryCreateGradebookItem({
			payload,
			courseId: course.id,
			name: "Test Quiz",
			description: "Quiz submission test",
			activityModuleId: courseActivityModuleLink.id,
			maxGrade: 100,
			weight: 25,
			sortOrder: 1,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			overrideAccess: true,
		});
		if (!gradebookItemResult.ok) {
			console.error(
				"Gradebook item creation failed:",
				gradebookItemResult.error,
			);
		}
		expect(gradebookItemResult.ok).toBe(true);
		if (gradebookItemResult.ok) {
			gradebookItemId = gradebookItemResult.value.id;
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

	test("should calculate quiz grade automatically", async () => {
		// First get the quiz to get the actual question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			id: quizId,
			overrideAccess: true,
		});
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		// Extract questions from rawQuizConfig
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];

		// Test the calculateQuizGrade function directly with actual question IDs
		const answers = [
			{
				questionId: questions[0]?.id?.toString() || "1",
				questionText: "What is 2 + 2?",
				questionType: "multiple_choice" as const,
				multipleChoiceAnswers: [
					{ option: "3", isSelected: false },
					{ option: "4", isSelected: true },
					{ option: "5", isSelected: false },
					{ option: "6", isSelected: false },
				],
			},
			{
				questionId: questions[1]?.id?.toString() || "2",
				questionText: "Is the sky blue?",
				questionType: "true_false" as const,
				selectedAnswer: "true",
			},
			{
				questionId: questions[2]?.id?.toString() || "3",
				questionText: "What is the capital of France?",
				questionType: "short_answer" as const,
				selectedAnswer: "Paris",
			},
			{
				questionId: questions[3]?.id?.toString() || "4",
				questionText: "Write a short essay about the importance of education",
				questionType: "essay" as const,
				selectedAnswer:
					"Education is very important for personal development and societal progress. It helps individuals acquire knowledge, skills, and critical thinking abilities that are essential for success in life.",
			},
		];

		const result = await tryCalculateQuizGrade({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			quizId,
			answers,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const gradeData = result.value;

		// Verify grading results
		expect(gradeData.maxScore).toBe(100);
		expect(gradeData.questionResults).toHaveLength(4);

		// Verify all questions have results
		for (const question of questions) {
			const result = gradeData.questionResults.find(
				(q) => q.questionId === question.id?.toString(),
			);
			expect(result).toBeDefined();
			expect(result?.questionId).toBe(question.id?.toString());
			expect(result?.questionText).toBeDefined();
			expect(result?.pointsEarned).toBeGreaterThanOrEqual(0);
			expect(result?.maxPoints).toBeGreaterThan(0);
			expect(result?.feedback).toBeDefined();
		}

		// Check overall feedback format
		expect(gradeData.feedback).toContain("Quiz completed!");
		expect(gradeData.feedback).toContain("points");
		expect(gradeData.feedback).toContain("questions correct");
	});

	test("should get quiz by ID", async () => {
		const result = await tryGetQuizById({
			payload,
			id: quizId,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const quiz = result.value;
		expect(quiz.id).toBe(quizId);
		expect(quiz.title).toBe("Test Quiz");
		// Extract questions from rawQuizConfig
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];
		expect(questions).toHaveLength(4);
		expect(quiz.createdBy.id).toBe(teacher.id);
	});

	test("should list quiz submissions with filtering", async () => {
		// First, create some submissions for testing
		const startResult1 = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 1,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult1.ok).toBe(true);

		// Complete the first submission
		if (startResult1.ok) {
			await tryMarkQuizAttemptAsComplete({
				payload,
				submissionId: startResult1.value.id,
				req: createLocalReq({
					request: mockRequest,
					user: student as TypedUser,
				}),
				overrideAccess: true,
			});
		}

		// List all submissions for this activity module
		const listResult = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			overrideAccess: true,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		const submissions = listResult.value;
		expect(submissions.docs.length).toBeGreaterThan(0);
		expect(submissions.totalDocs).toBeGreaterThan(0);

		// All submissions should be for the same course module link
		submissions.docs.forEach((submission) => {
			expect(submission.courseModuleLink).toBe(courseActivityModuleLink.id);
		});

		// Test filtering by student
		const studentListResult = await tryListQuizSubmissions({
			payload,
			studentId: student.id,
			overrideAccess: true,
		});

		expect(studentListResult.ok).toBe(true);
		if (!studentListResult.ok) return;

		const studentSubmissions = studentListResult.value;
		studentSubmissions.docs.forEach((submission) => {
			expect(submission.student.id).toBe(student.id);
		});

		// Test filtering by status
		const inProgressListResult = await tryListQuizSubmissions({
			payload,
			status: "in_progress",
			overrideAccess: true,
		});

		expect(inProgressListResult.ok).toBe(true);
		if (!inProgressListResult.ok) return;

		const inProgressSubmissions = inProgressListResult.value;
		inProgressSubmissions.docs.forEach((submission) => {
			expect(submission.status).toBe("in_progress");
		});
	});

	test("should handle pagination in listing", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Create multiple submissions for pagination testing
		// Note: We need to complete each submission immediately after creation
		// because tryStartQuizAttempt doesn't allow multiple in-progress submissions
		for (let i = 0; i < 5; i++) {
			const startResult = await tryStartQuizAttempt({
				payload,
				courseModuleLinkId: courseActivityModuleLink.id,
				studentId: student.id,
				enrollmentId: enrollment.id,
				attemptNumber: 20 + i,
				req: createLocalReq({
					request: mockRequest,
					user: student as TypedUser,
				}),
				overrideAccess: true,
			});
			expect(startResult.ok).toBe(true);
			if (!startResult.ok) continue;

			// Complete the submission immediately so we can create the next one
			await tryMarkQuizAttemptAsComplete({
				payload,
				submissionId: startResult.value.id,
				req: createLocalReq({
					request: mockRequest,
					user: student as TypedUser,
				}),
				overrideAccess: true,
			});
		}

		// Test pagination
		const page1Result = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			limit: 2,
			page: 1,
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

	test("should fail to get non-existent submission", async () => {
		const result = await tryGetQuizSubmissionById({
			payload,
			id: 99999,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to delete non-existent submission", async () => {
		const result = await tryDeleteQuizSubmission({
			payload,
			id: 99999,
			overrideAccess: true,
		});
		expect(result.ok).toBe(false);
	});

	test("should remove answer from quiz question", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 10,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Get quiz to find question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			id: quizId,
			overrideAccess: true,
		});
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];

		if (questions.length === 0) {
			throw new Error("Test Error: No questions found in quiz");
		}

		const questionId = questions[0]?.id?.toString();
		if (!questionId) {
			throw new Error("Test Error: Question ID not found");
		}

		// First, answer the question
		const answerResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId,
			answer: {
				type: "multiple-choice",
				value: "b",
			},
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(answerResult.ok).toBe(true);
		if (!answerResult.ok) return;

		// Verify answer was added
		const submissionWithAnswer = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});
		expect(submissionWithAnswer.ok).toBe(true);
		if (!submissionWithAnswer.ok) return;
		const answersWithAnswer = submissionWithAnswer.value.answers || [];
		expect(answersWithAnswer.length).toBeGreaterThan(0);
		const answerExists = answersWithAnswer.some(
			(a) => a.questionId === questionId,
		);
		expect(answerExists).toBe(true);

		// Now remove the answer
		const removeResult = await tryRemoveAnswerFromQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(removeResult.ok).toBe(true);
		if (!removeResult.ok) return;

		// Verify answer was removed
		const submissionWithoutAnswer = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});
		expect(submissionWithoutAnswer.ok).toBe(true);
		if (!submissionWithoutAnswer.ok) return;
		const answersWithoutAnswer = submissionWithoutAnswer.value.answers || [];
		const answerStillExists = answersWithoutAnswer.some(
			(a) => a.questionId === questionId,
		);
		expect(answerStillExists).toBe(false);
	});

	test("should handle removing answer that doesn't exist", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 11,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Get quiz to find question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			id: quizId,
			overrideAccess: true,
		});
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];

		if (questions.length === 0) {
			throw new Error("Test Error: No questions found in quiz");
		}

		const questionId = questions[0]?.id?.toString();
		if (!questionId) {
			throw new Error("Test Error: Question ID not found");
		}

		// Try to remove answer that doesn't exist - should succeed (idempotent)
		const removeResult = await tryRemoveAnswerFromQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(removeResult.ok).toBe(true);
		if (!removeResult.ok) return;

		// Verify submission is unchanged
		const submission = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});
		expect(submission.ok).toBe(true);
		if (!submission.ok) return;
		const answers = submission.value.answers || [];
		expect(answers.length).toBe(0);
	});

	test("should fail to remove answer from completed submission", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 12,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Get quiz to find question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			id: quizId,
			overrideAccess: true,
		});
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];

		if (questions.length === 0) {
			throw new Error("Test Error: No questions found in quiz");
		}

		const questionId = questions[0]?.id?.toString();
		if (!questionId) {
			throw new Error("Test Error: Question ID not found");
		}

		// Submit the quiz first
		const submitResult = await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		// Try to remove answer from completed submission - should fail
		const removeResult = await tryRemoveAnswerFromQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(removeResult.ok).toBe(false);
	});

	test("should flag quiz question", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 14,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Get quiz to find question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			id: quizId,
			overrideAccess: true,
		});
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];

		if (questions.length === 0) {
			throw new Error("Test Error: No questions found in quiz");
		}

		const questionId = questions[0]?.id?.toString();
		if (!questionId) {
			throw new Error("Test Error: Question ID not found");
		}

		// Flag the question
		const flagResult = await tryFlagQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(flagResult.ok).toBe(true);
		if (!flagResult.ok) return;

		// Verify question was flagged
		const submissionWithFlag = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});
		expect(submissionWithFlag.ok).toBe(true);
		if (!submissionWithFlag.ok) return;
		const flaggedQuestions = submissionWithFlag.value.flaggedQuestions || [];
		const isFlagged = flaggedQuestions.some((f) => f.questionId === questionId);
		expect(isFlagged).toBe(true);
	});

	test("should handle flagging question that is already flagged", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 15,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Get quiz to find question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			id: quizId,
			overrideAccess: true,
		});
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];

		if (questions.length === 0) {
			throw new Error("Test Error: No questions found in quiz");
		}

		const questionId = questions[0]?.id?.toString();
		if (!questionId) {
			throw new Error("Test Error: Question ID not found");
		}

		// Flag the question first time
		const flagResult1 = await tryFlagQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(flagResult1.ok).toBe(true);
		if (!flagResult1.ok) return;

		// Try to flag again - should succeed (idempotent)
		const flagResult2 = await tryFlagQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(flagResult2.ok).toBe(true);
		if (!flagResult2.ok) return;

		// Verify question is still flagged (only once)
		const submission = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});
		expect(submission.ok).toBe(true);
		if (!submission.ok) return;
		const flaggedQuestions = submission.value.flaggedQuestions || [];
		const flaggedCount = flaggedQuestions.filter(
			(f) => f.questionId === questionId,
		).length;
		expect(flaggedCount).toBe(1);
	});

	test("should unflag quiz question", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 16,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Get quiz to find question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			id: quizId,
			overrideAccess: true,
		});
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];

		if (questions.length === 0) {
			throw new Error("Test Error: No questions found in quiz");
		}

		const questionId = questions[0]?.id?.toString();
		if (!questionId) {
			throw new Error("Test Error: Question ID not found");
		}

		// First flag the question
		const flagResult = await tryFlagQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(flagResult.ok).toBe(true);
		if (!flagResult.ok) return;

		// Verify question was flagged
		const submissionWithFlag = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});
		expect(submissionWithFlag.ok).toBe(true);
		if (!submissionWithFlag.ok) return;
		const flaggedQuestionsBefore =
			submissionWithFlag.value.flaggedQuestions || [];
		const isFlaggedBefore = flaggedQuestionsBefore.some(
			(f) => f.questionId === questionId,
		);
		expect(isFlaggedBefore).toBe(true);

		// Now unflag the question
		const unflagResult = await tryUnflagQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(unflagResult.ok).toBe(true);
		if (!unflagResult.ok) return;

		// Verify question was unflagged
		const submissionWithoutFlag = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});
		expect(submissionWithoutFlag.ok).toBe(true);
		if (!submissionWithoutFlag.ok) return;
		const flaggedQuestionsAfter =
			submissionWithoutFlag.value.flaggedQuestions || [];
		const isFlaggedAfter = flaggedQuestionsAfter.some(
			(f) => f.questionId === questionId,
		);
		expect(isFlaggedAfter).toBe(false);
	});

	test("should handle unflagging question that is not flagged", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 17,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Get quiz to find question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			id: quizId,
			overrideAccess: true,
		});
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];

		if (questions.length === 0) {
			throw new Error("Test Error: No questions found in quiz");
		}

		const questionId = questions[0]?.id?.toString();
		if (!questionId) {
			throw new Error("Test Error: Question ID not found");
		}

		// Try to unflag question that is not flagged - should succeed (idempotent)
		const unflagResult = await tryUnflagQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(unflagResult.ok).toBe(true);
		if (!unflagResult.ok) return;

		// Verify submission is unchanged
		const submission = await tryGetQuizSubmissionById({
			payload,
			id: submissionId,
			overrideAccess: true,
		});
		expect(submission.ok).toBe(true);
		if (!submission.ok) return;
		const flaggedQuestions = submission.value.flaggedQuestions || [];
		expect(flaggedQuestions.length).toBe(0);
	});

	test("should fail to flag question in completed submission", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 18,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Get quiz to find question IDs
		const quizResult = await tryGetQuizById({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			id: quizId,
			overrideAccess: true,
		});
		expect(quizResult.ok).toBe(true);
		if (!quizResult.ok) return;

		const quiz = quizResult.value;
		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.type === "regular" && rawConfig?.pages
				? rawConfig.pages.flatMap((page: any) => page.questions || [])
				: [];

		if (questions.length === 0) {
			throw new Error("Test Error: No questions found in quiz");
		}

		const questionId = questions[0]?.id?.toString();
		if (!questionId) {
			throw new Error("Test Error: Question ID not found");
		}

		// Submit the quiz first
		const submitResult = await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		// Try to flag question in completed submission - should fail
		const flagResult = await tryFlagQuizQuestion({
			payload,
			submissionId,
			questionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(flagResult.ok).toBe(false);
	});

	test("should fail to flag question with invalid question ID", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 19,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Try to flag question with invalid question ID - should fail
		const flagResult = await tryFlagQuizQuestion({
			payload,
			submissionId,
			questionId: "invalid-question-id",
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(flagResult.ok).toBe(false);
	});

	test("should fail to remove answer with invalid question ID", async () => {
		// First, complete any existing in-progress submissions to avoid conflicts
		const existingSubmissions = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			status: "in_progress",
			overrideAccess: true,
		});

		if (existingSubmissions.ok) {
			for (const submission of existingSubmissions.value.docs) {
				await tryMarkQuizAttemptAsComplete({
					payload,
					submissionId: submission.id,
					req: createLocalReq({
						request: mockRequest,
						user: student as TypedUser,
					}),
					overrideAccess: true,
				});
			}
		}

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 13,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Try to remove answer with invalid question ID - should fail
		const removeResult = await tryRemoveAnswerFromQuizQuestion({
			payload,
			submissionId,
			questionId: "invalid-question-id",
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
		expect(removeResult.ok).toBe(false);
	});

	test("should store and retrieve rawQuizConfig", async () => {
		// Create a quiz with rawQuizConfig
		const rawQuizConfig = {
			id: `quiz-${Date.now()}`,
			title: "Test Quiz with Config",
			pages: [
				{
					id: `page-${Date.now()}`,
					title: "Page 1",
					questions: [
						{
							id: `q-${Date.now()}`,
							type: "multiple-choice" as const,
							prompt: "What is 2 + 2?",
							options: { a: "3", b: "4", c: "5" },
							correctAnswer: "b",
							scoring: { type: "simple" as const, points: 1 },
						},
					],
				},
			],
			grading: {
				enabled: true,
				passingScore: 70,
				showScoreToStudent: true,
				showCorrectAnswers: false,
			},
		};

		const args: CreateQuizArgs = {
			payload,
			title: "Quiz with Raw Config",
			description: "Testing rawQuizConfig storage",
			instructions: "Complete the quiz",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				...rawQuizConfig,
			},
			createdBy: teacher.id,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
		};

		// Create the quiz
		const createResult = await tryCreateQuiz(args);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const createdQuiz = createResult.value;
		expect(createdQuiz.rawQuizConfig).toBeDefined();

		// Retrieve the quiz and verify rawQuizConfig is present
		const getResult = await tryGetQuizById({
			payload,
			id: createdQuiz.id,
			overrideAccess: true,
		});
		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedQuiz = getResult.value;
		expect(retrievedQuiz.rawQuizConfig).toBeDefined();
		// Note: rawQuizConfig is stored as JSON, so deep comparison might require parsing
		expect(retrievedQuiz.title).toBe("Quiz with Raw Config");
	});

	test("should reject submission after time limit exceeded", async () => {
		// Create a quiz with a very short time limit (1 minute = 60 seconds)
		const quickQuizArgs: CreateQuizArgs = {
			payload,
			title: "Quick Quiz",
			description: "A quiz with 1 minute time limit",
			instructions: "Complete quickly",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: `quiz-${Date.now()}`,
				title: "Quick Quiz",
				globalTimer: 60, // 1 minute in seconds
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [
							{
								id: `q-${Date.now()}`,
								type: "multiple-choice",
								prompt: "What is 2 + 2?",
								options: {
									a: "3",
									b: "4",
								},
								correctAnswer: "b",
								scoring: {
									type: "simple",
									points: 100,
								},
							},
						],
					},
				],
			},
			createdBy: teacher.id,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
		};

		const quickQuizResult = await tryCreateQuiz(quickQuizArgs);
		expect(quickQuizResult.ok).toBe(true);
		if (!quickQuizResult.ok) return;

		// Create activity module with this quiz
		const quickActivityModuleArgs: CreateActivityModuleArgs = {
			payload,
			title: "Quick Quiz Module",
			description: "Module with quick quiz",
			type: "quiz",
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			instructions: "Complete quickly",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: `quiz-${Date.now()}`,
				title: "Quick Quiz",
				globalTimer: 60, // 1 minute in seconds
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [
							{
								id: `q-${Date.now()}`,
								type: "multiple-choice",
								prompt: "What is 2 + 2?",
								options: {
									a: "3",
									b: "4",
								},
								correctAnswer: "b",
								scoring: {
									type: "simple",
									points: 100,
								},
							},
						],
					},
				],
			},
		};

		const quickActivityModuleResult = await tryCreateQuizModule(
			quickActivityModuleArgs,
		);
		expect(quickActivityModuleResult.ok).toBe(true);
		if (!quickActivityModuleResult.ok) return;
		const quickActivityModuleId = quickActivityModuleResult.value.id;

		// Create course-activity-module-link
		const quickLinkArgs: CreateCourseActivityModuleLinkArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			course: course.id,
			activityModule: quickActivityModuleId,
			section: section.id,
			order: 0,
		};

		const quickLinkResult =
			await tryCreateCourseActivityModuleLink(quickLinkArgs);
		expect(quickLinkResult.ok).toBe(true);
		if (!quickLinkResult.ok) return;

		const quickCourseActivityModuleLinkId = quickLinkResult.value.id;

		// Start quiz attempt
		const quickStartArgs: StartQuizAttemptArgs = {
			payload,
			courseModuleLinkId: quickCourseActivityModuleLinkId,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 1,
			overrideAccess: true,
		};

		const quickStartResult = await tryStartQuizAttempt(quickStartArgs);
		expect(quickStartResult.ok).toBe(true);
		if (!quickStartResult.ok) return;

		const quickSubmissionId = quickStartResult.value.id;

		// Manually update startedAt to be 2 minutes ago (exceeding 1 minute limit)
		const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
		await payload.update({
			collection: "quiz-submissions",
			id: quickSubmissionId,
			data: {
				startedAt: twoMinutesAgo,
			},
		});

		// Try to submit - should fail due to time limit
		const submitResult = await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId: quickSubmissionId,
			overrideAccess: true,
		});
		expect(submitResult.ok).toBe(false);
		if (submitResult.ok) return;

		expect(submitResult.error.message).toContain("time limit");
	});

	test("should auto-submit quiz when timer expires", async () => {
		// Create a quiz with a very short time limit (2 seconds)
		const autoSubmitQuizArgs: CreateQuizArgs = {
			payload,
			title: "Auto Submit Quiz",
			description: "A quiz with 2 second time limit",
			instructions: "Will auto-submit",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: `quiz-${Date.now()}`,
				title: "Auto Submit Quiz",
				globalTimer: 2, // 2 seconds
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [
							{
								id: `q-${Date.now()}`,
								type: "multiple-choice",
								prompt: "What is 2 + 2?",
								options: {
									a: "3",
									b: "4",
								},
								correctAnswer: "b",
								scoring: {
									type: "simple",
									points: 100,
								},
							},
						],
					},
				],
			},
			createdBy: teacher.id,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
		};

		const autoSubmitQuizResult = await tryCreateQuiz(autoSubmitQuizArgs);
		expect(autoSubmitQuizResult.ok).toBe(true);
		if (!autoSubmitQuizResult.ok) return;

		// Create activity module with this quiz
		const autoSubmitActivityModuleArgs: CreateActivityModuleArgs = {
			payload,
			title: "Auto Submit Quiz Module",
			description: "Module with auto-submit quiz",
			type: "quiz",
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			instructions: "Will auto-submit",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: `quiz-${Date.now()}`,
				title: "Auto Submit Quiz",
				globalTimer: 2, // 2 seconds
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [
							{
								id: `q-${Date.now()}`,
								type: "multiple-choice",
								prompt: "What is 2 + 2?",
								options: {
									a: "3",
									b: "4",
								},
								correctAnswer: "b",
								scoring: {
									type: "simple",
									points: 100,
								},
							},
						],
					},
				],
			},
		};

		const autoSubmitActivityModuleResult = await tryCreateQuizModule(
			autoSubmitActivityModuleArgs,
		);
		expect(autoSubmitActivityModuleResult.ok).toBe(true);
		if (!autoSubmitActivityModuleResult.ok) return;

		const autoSubmitActivityModuleId = autoSubmitActivityModuleResult.value.id;

		// Create course-activity-module-link
		const autoSubmitLinkArgs: CreateCourseActivityModuleLinkArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			course: course.id,
			activityModule: autoSubmitActivityModuleId,
			section: section.id,
			order: 0,
		};

		const autoSubmitLinkResult =
			await tryCreateCourseActivityModuleLink(autoSubmitLinkArgs);
		expect(autoSubmitLinkResult.ok).toBe(true);
		if (!autoSubmitLinkResult.ok) return;

		const autoSubmitCourseActivityModuleLinkId = autoSubmitLinkResult.value.id;

		// Start quiz attempt - this should schedule the auto-submit job
		const autoSubmitStartArgs: StartQuizAttemptArgs = {
			payload,
			courseModuleLinkId: autoSubmitCourseActivityModuleLinkId,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 1,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		};

		const autoSubmitStartResult =
			await tryStartQuizAttempt(autoSubmitStartArgs);
		expect(autoSubmitStartResult.ok).toBe(true);
		if (!autoSubmitStartResult.ok) return;

		const autoSubmitSubmissionId = autoSubmitStartResult.value.id;

		// Verify initial state - should be in_progress
		const initialSubmission = await tryGetQuizSubmissionById({
			payload,
			id: autoSubmitSubmissionId,
			overrideAccess: true,
		});
		expect(initialSubmission.ok).toBe(true);
		if (!initialSubmission.ok) return;
		expect(initialSubmission.value.status).toBe("in_progress");

		// Verify that the job was scheduled
		const jobsResult = await payload.find({
			collection: "payload-jobs",
			where: {
				and: [
					{ taskSlug: { equals: "autoSubmitQuiz" } },
					{ queue: { equals: JobQueue.SECONDLY } },
				],
			},
			limit: 1,
			overrideAccess: true,
		});
		expect(jobsResult.docs.length).toBeGreaterThan(0);
		const scheduledJob = jobsResult.docs[0]!;
		expect(scheduledJob.waitUntil).toBeDefined();

		// Wait 3 seconds (longer than the 2 second timer)
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Process jobs to ensure the auto-submit job runs
		// The job queue should process jobs automatically via the "secondly" queue
		// Process both scheduled jobs and pending jobs
		await payload.jobs.handleSchedules({ queue: JobQueue.DEFAULT });
		await payload.jobs.handleSchedules({ queue: JobQueue.SECONDLY });

		// Check if the job was processed, if not, manually execute it
		const jobAfterWait = await payload.findByID({
			collection: "payload-jobs",
			id: scheduledJob.id,
			overrideAccess: true,
		});

		// If job hasn't been completed yet, manually execute it
		// This is needed in tests where automatic job processing might not be active
		if (jobAfterWait && !jobAfterWait.completedAt) {
			// Manually execute the job by calling the task handler
			const mockReq = {
				payload,
				user: null,
			};
			// Call the handler directly - use type assertion to bypass complex type checking
			// The handler only needs req and input, other params are optional
			if (typeof autoSubmitQuiz.handler === "function") {
				await (
					autoSubmitQuiz.handler as (args: {
						req: { payload: typeof payload; user: null };
						input: { submissionId: number };
					}) => Promise<unknown>
				)({
					req: mockReq,
					input: { submissionId: autoSubmitSubmissionId },
				});
			}
		}

		// Wait a bit more for the job to complete (jobs are processed asynchronously)
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Check if the quiz was auto-submitted
		const finalSubmission = await tryGetQuizSubmissionById({
			payload,
			id: autoSubmitSubmissionId,
			overrideAccess: true,
		});
		expect(finalSubmission.ok).toBe(true);
		if (!finalSubmission.ok) return;

		// The submission should be completed (auto-submitted)
		expect(finalSubmission.value.status).toBe("completed");
		expect(finalSubmission.value.submittedAt).toBeDefined();
	});
});
