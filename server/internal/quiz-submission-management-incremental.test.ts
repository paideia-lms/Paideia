import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
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
import {
	type AnswerQuizQuestionArgs,
	tryAnswerQuizQuestion,
	tryMarkQuizAttemptAsComplete,
	tryStartQuizAttempt,
} from "./quiz-submission-management";
import { tryCreateUser } from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/types";
import type { TypedQuestionAnswer } from "server/json/raw-quiz-config/v2";

describe("Quiz Submission Management - Incremental Answer Saving", () => {
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

		// Create teacher and student users
		const [teacherResult, studentResult] = await Promise.all([
			tryCreateUser({
				payload,
				data: {
					email: "incremental-teacher@example.com",
					password: "password123",
					firstName: "John",
					lastName: "Teacher",
					role: "instructor",
				},
				overrideAccess: true,
				req: undefined,
			}).getOrThrow(),
			tryCreateUser({
				payload,
				data: {
					email: "incremental-student@example.com",
					password: "password123",
					firstName: "Jane",
					lastName: "Student",
					role: "student",
				},
				overrideAccess: true,
				req: undefined,
			}).getOrThrow(),
		]);

		teacher = teacherResult;
		student = studentResult;

		// Create course
		course = await tryCreateCourse({
			payload,
			data: {
				title: "Incremental Quiz Test Course",
				description: "A test course for incremental quiz answer saving",
				slug: "incremental-quiz-test-course",
				createdBy: teacher.id,
			},
			overrideAccess: true,

			req: undefined,
		}).getOrThrow();

		// Create enrollment
		enrollment = await tryCreateEnrollment({
			payload,
			userId: student.id,
			course: course.id,
			role: "student",
			status: "active",
			overrideAccess: true,

			req: undefined,
		}).getOrThrow();

		// Create section
		section = await tryCreateSection({
			payload,
			data: {
				course: course.id,
				title: "Test Section",
				description: "Test section for incremental quiz tests",
				contentOrder: 1,
			},
			overrideAccess: true,

			req: undefined,
		}).getOrThrow();

		// Create quiz with multiple question types
		const quizConfig = {
			version: "v2" as const,
			type: "regular" as const,
			id: "test-quiz-1",
			title: "Test Quiz for Incremental Saving",
			pages: [
				{
					id: "page-1",
					title: "Page 1",
					questions: [
						{
							id: "q1",
							type: "multiple-choice" as const,
							prompt: "What is 2 + 2?",
							options: { a: "3", b: "4", c: "5", d: "6" },
							correctAnswer: "b",
						},
						{
							id: "q2",
							type: "short-answer" as const,
							prompt: "What is the capital of France?",
							correctAnswer: "Paris",
						},
						{
							id: "q3",
							type: "choice" as const,
							prompt: "Select all prime numbers",
							options: { a: "2", b: "3", c: "4", d: "5" },
							correctAnswers: ["a", "b", "d"],
						},
						{
							id: "q4",
							type: "fill-in-the-blank" as const,
							prompt: "The capital of {{country}} is {{capital}}",
							correctAnswers: { country: "France", capital: "Paris" },
						},
					],
				},
			],
		};

		const activityModuleResult = await tryCreateQuizModule({
			payload,
			title: "Test Quiz Module",
			description: "A test quiz module",
			instructions: "Answer all questions",
			rawQuizConfig: quizConfig,
			userId: teacher.id,
			overrideAccess: true,

			req: undefined,
		}).getOrThrow();

		activityModuleId = activityModuleResult.id;

		// Fetch the activity module with depth to get the quiz relationship
		const module = await payload.findByID({
			collection: "activity-modules",
			id: activityModuleId,
			depth: 1,
			overrideAccess: true,
		});
		if (module.quiz) {
			quizId =
				typeof module.quiz === "object" && "id" in module.quiz
					? module.quiz.id
					: (module.quiz as number);
		} else {
			quizId = 0;
		}

		// Create course activity module link
		const linkArgs: CreateCourseActivityModuleLinkArgs = {
			payload,
			course: course.id,
			activityModule: activityModuleId,
			section: section.id,
			order: 1,
			overrideAccess: true,
			req: undefined,
		};

		courseActivityModuleLink =
			await tryCreateCourseActivityModuleLink(linkArgs).getOrThrow();
	});

	afterAll(async () => {
		// Clean up
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	test("should save answer for valid question", async () => {
		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Answer a question
		const answer: TypedQuestionAnswer = {
			type: "multiple-choice",
			value: "b",
		};

		const answerResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "q1",
			answer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(answerResult.ok).toBe(true);
		if (!answerResult.ok) return;

		expect(answerResult.value.answers).toBeDefined();
		expect(answerResult.value.answers?.length).toBe(1);
		expect(answerResult.value.answers?.[0]?.questionId).toBe("q1");
		expect(answerResult.value.answers?.[0]?.selectedAnswer).toBe("b");

		// Complete the submission to clean up for next test
		await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
	});

	test("should update existing answer for same question", async () => {
		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 2,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Answer question first time
		const firstAnswer: TypedQuestionAnswer = {
			type: "multiple-choice",
			value: "a",
		};

		const firstResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "q1",
			answer: firstAnswer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(firstResult.ok).toBe(true);
		if (!firstResult.ok) return;
		expect(firstResult.value.answers?.length).toBe(1);
		expect(firstResult.value.answers?.[0]?.selectedAnswer).toBe("a");

		// Update answer
		const secondAnswer: TypedQuestionAnswer = {
			type: "multiple-choice",
			value: "b",
		};

		const secondResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "q1",
			answer: secondAnswer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(secondResult.ok).toBe(true);
		if (!secondResult.ok) return;
		expect(secondResult.value.answers?.length).toBe(1); // Still only one answer
		expect(secondResult.value.answers?.[0]?.selectedAnswer).toBe("b"); // Updated value

		// Complete the submission to clean up for next test
		await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
	});

	test("should validate submission is in_progress", async () => {
		// Start and complete a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 3,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Mark as complete
		const completeResult = await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(completeResult.ok).toBe(true);

		// Try to answer question on completed submission
		const answer: TypedQuestionAnswer = {
			type: "multiple-choice",
			value: "b",
		};

		const answerResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "q1",
			answer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(answerResult.ok).toBe(false);
		if (answerResult.ok) return;
		expect(answerResult.error.message).toContain("in-progress");
		// Submission already completed, no cleanup needed
	});

	test("should validate question exists in quiz", async () => {
		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 4,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Try to answer non-existent question
		const answer: TypedQuestionAnswer = {
			type: "multiple-choice",
			value: "b",
		};

		const answerResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "non-existent",
			answer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(answerResult.ok).toBe(false);
		if (answerResult.ok) return;
		expect(answerResult.error.message).toContain("not found");

		// Complete the submission to clean up for next test
		await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
	});

	test("should validate answer type matches question type", async () => {
		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 5,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Try to answer multiple-choice question with wrong type
		const wrongAnswer: TypedQuestionAnswer = {
			type: "short-answer",
			value: "some text",
		};

		const answerResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "q1", // This is a multiple-choice question
			answer: wrongAnswer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(answerResult.ok).toBe(false);
		if (answerResult.ok) return;
		expect(answerResult.error.message).toContain("does not match");

		// Complete the submission to clean up for next test
		await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
	});

	test("should handle all question answer types correctly", async () => {
		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 6,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Answer multiple-choice question
		const mcAnswer: TypedQuestionAnswer = {
			type: "multiple-choice",
			value: "b",
		};

		const mcResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "q1",
			answer: mcAnswer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(mcResult.ok).toBe(true);

		// Answer short-answer question
		const saAnswer: TypedQuestionAnswer = {
			type: "short-answer",
			value: "Paris",
		};

		const saResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "q2",
			answer: saAnswer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(saResult.ok).toBe(true);
		if (!saResult.ok) return;
		expect(saResult.value.answers?.length).toBe(2);

		// Answer choice question (multiple selection)
		const choiceAnswer: TypedQuestionAnswer = {
			type: "choice",
			value: ["a", "b", "d"],
		};

		const choiceResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "q3",
			answer: choiceAnswer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(choiceResult.ok).toBe(true);
		if (!choiceResult.ok) return;
		expect(choiceResult.value.answers?.length).toBe(3);
		expect(
			choiceResult.value.answers?.[2]?.multipleChoiceAnswers,
		).toBeDefined();
		expect(choiceResult.value.answers?.[2]?.multipleChoiceAnswers?.length).toBe(
			3,
		);

		// Answer fill-in-the-blank question
		const fillAnswer: TypedQuestionAnswer = {
			type: "fill-in-the-blank",
			value: { country: "France", capital: "Paris" },
		};

		const fillResult = await tryAnswerQuizQuestion({
			payload,
			submissionId,
			questionId: "q4",
			answer: fillAnswer,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(fillResult.ok).toBe(true);
		if (!fillResult.ok) return;
		expect(fillResult.value.answers?.length).toBe(4);
		expect(fillResult.value.answers?.[3]?.selectedAnswer).toBeDefined();
		// Should be JSON stringified
		const parsed = JSON.parse(
			fillResult.value.answers?.[3]?.selectedAnswer || "{}",
		) as Record<string, string>;
		expect(parsed.country).toBe("France");
		expect(parsed.capital).toBe("Paris");

		// Complete the submission to clean up for next test
		await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});
	});

	test("should calculate timeSpent automatically when marking complete", async () => {
		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 7,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;
		const startedAt = startResult.value.startedAt;

		// Wait a bit
		await Bun.sleep(100);

		// Mark as complete
		const completeResult = await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(completeResult.ok).toBe(true);
		if (!completeResult.ok) return;

		expect(completeResult.value.status).toBe("completed");
		expect(completeResult.value.submittedAt).toBeDefined();
		expect(completeResult.value.timeSpent).toBeDefined();
		expect(completeResult.value.timeSpent).toBeGreaterThan(0);

		// Verify timeSpent is approximately correct (within 1 second)
		if (startedAt && completeResult.value.submittedAt) {
			const expectedTimeSpent =
				(new Date(completeResult.value.submittedAt).getTime() -
					new Date(startedAt).getTime()) /
				(1000 * 60);
			expect(completeResult.value.timeSpent).toBeCloseTo(expectedTimeSpent, 1);
		}
	});

	test("should only mark in_progress submissions as complete", async () => {
		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 8,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const submissionId = startResult.value.id;

		// Mark as complete first time
		const firstComplete = await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(firstComplete.ok).toBe(true);

		// Try to mark as complete again
		const secondComplete = await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(secondComplete.ok).toBe(false);
		if (secondComplete.ok) return;
		expect(secondComplete.error.message).toContain("in-progress");
	});
});
