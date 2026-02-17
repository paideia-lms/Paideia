import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import { tryCreateCourseActivityModuleLink } from "./course-activity-module-link-management";
import { tryCreateCourse } from "./course-management";
import { tryCreateSection } from "./course-section-management";
import { tryCreateEnrollment } from "./enrollment-management";
import {
	tryMarkNestedQuizAsComplete,
	tryStartNestedQuiz,
	tryStartQuizAttempt,
} from "./quiz-submission-management";
import { tryCreateUser } from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/types";
import { tryCreateQuizModule } from "./activity-module-management";

describe("Nested Quiz Management", () => {
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
	let containerQuizId: string;
	let nestedQuiz1Id: string;
	let nestedQuiz2Id: string;
	let submissionId: number;

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
					email: "nested-quiz-teacher@example.com",
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
					email: "nested-quiz-student@example.com",
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
				title: "Nested Quiz Test Course",
				description: "A test course for nested quiz submissions",
				slug: "nested-quiz-test-course",
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
				description: "Test section for nested quiz",
			},
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		// Create container quiz with nested quizzes
		containerQuizId = `container-quiz-${Date.now()}`;
		nestedQuiz1Id = `nested-quiz-1-${Date.now()}`;
		nestedQuiz2Id = `nested-quiz-2-${Date.now()}`;

		const activityModuleResult = await tryCreateQuizModule({
			payload,
			title: "Container Quiz",
			description: "A container quiz with nested quizzes",
			instructions: "Complete all nested quizzes",
			rawQuizConfig: {
				version: "v2",
				type: "container",
				id: containerQuizId,
				title: "Container Quiz",
				globalTimer: 3600, // 60 minutes for entire container
				sequentialOrder: false,
				nestedQuizzes: [
					{
						id: nestedQuiz1Id,
						title: "Nested Quiz 1",
						description: "First nested quiz",
						globalTimer: 900, // 15 minutes
						pages: [
							{
								id: `page-1-${Date.now()}`,
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
											points: 10,
										},
									},
								],
							},
						],
					},
					{
						id: nestedQuiz2Id,
						title: "Nested Quiz 2",
						description: "Second nested quiz",
						globalTimer: 1200, // 20 minutes
						pages: [
							{
								id: `page-2-${Date.now()}`,
								title: "Page 1",
								questions: [
									{
										id: `q2-${Date.now()}`,
										type: "short-answer",
										prompt: "What is the capital of France?",
										correctAnswer: "Paris",
										scoring: {
											type: "simple",
											points: 10,
										},
									},
								],
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
			throw new Error(
				`Failed to create activity module: ${activityModuleResult.error}`,
			);
		}

		const activityModuleId = activityModuleResult.value.id;

		// Create course activity module link
		const linkResult = await tryCreateCourseActivityModuleLink({
			payload,
			course: course.id,
			section: section.id,
			activityModule: activityModuleId,
			order: 0,
			overrideAccess: true,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
		});

		if (!linkResult.ok) {
			throw new Error(
				`Failed to create course activity module link: ${linkResult.error}`,
			);
		}

		courseActivityModuleLink = linkResult.value;

		// Start a quiz attempt
		const startResult = await tryStartQuizAttempt({
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

		if (!startResult.ok) {
			throw new Error(`Failed to start quiz attempt: ${startResult.error}`);
		}

		submissionId = startResult.value.id;
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

	test("tryStartNestedQuiz should create entry with startedAt for new nested quiz", async () => {
		const result = await tryStartNestedQuiz({
			payload,
			submissionId,
			nestedQuizId: nestedQuiz1Id,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;
		expect(submission.completedNestedQuizzes).toBeDefined();
		expect(submission.completedNestedQuizzes?.length).toBeGreaterThan(0);

		// Find entry by checking if it has startedAt (since we just started it)
		const nestedQuizEntry = submission.completedNestedQuizzes?.find(
			(entry) => entry.startedAt && !entry.completedAt,
		);
		expect(nestedQuizEntry).toBeDefined();
		expect(nestedQuizEntry?.startedAt).toBeDefined();
		expect(nestedQuizEntry?.completedAt).toBeNull();
	});

	test("tryStartNestedQuiz should update existing entry startedAt if called again", async () => {
		// First call
		const firstResult = await tryStartNestedQuiz({
			payload,
			submissionId,
			nestedQuizId: nestedQuiz2Id,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(firstResult.ok).toBe(true);
		if (!firstResult.ok) return;

		const firstSubmission = firstResult.value;
		// Add answers to help identify the entry
		await payload.update({
			collection: "quiz-submissions",
			id: submissionId,
			data: {
				answers: [
					{
						questionId: `${nestedQuiz2Id}:q1`,
						questionText: "Test",
						questionType: "multiple_choice",
						selectedAnswer: "a",
					},
				],
			},
			overrideAccess: true,
		});

		// Get the entry by id
		const firstEntry = firstSubmission.completedNestedQuizzes?.find(
			(entry) => entry.id === nestedQuiz2Id,
		);
		const firstStartedAt = firstEntry?.startedAt;

		// Wait a bit to ensure different timestamp
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Second call
		const secondResult = await tryStartNestedQuiz({
			payload,
			submissionId,
			nestedQuizId: nestedQuiz2Id,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(secondResult.ok).toBe(true);
		if (!secondResult.ok) return;

		const secondSubmission = secondResult.value;
		// The entry should be updated (same entry, new startedAt)
		// Find by id to get the updated entry
		const secondEntry = secondSubmission.completedNestedQuizzes?.find(
			(entry) => entry.id === nestedQuiz2Id,
		);
		expect(secondEntry?.startedAt).toBeDefined();
		// The startedAt should be updated (newer timestamp)
		expect(secondEntry?.startedAt).not.toBe(firstStartedAt);
	});

	test("tryStartNestedQuiz should fail for non-container quiz", async () => {
		// Create a regular quiz (not container)
		const regularQuizId = `regular-quiz-${Date.now()}`;
		const activityModuleResult = await tryCreateQuizModule({
			payload,
			title: "Regular Quiz",
			description: "A regular quiz",
			rawQuizConfig: {
				version: "v2",
				type: "regular",
				id: regularQuizId,
				title: "Regular Quiz",
				pages: [
					{
						id: `page-${Date.now()}`,
						title: "Page 1",
						questions: [],
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
			throw new Error(
				`Failed to create regular quiz: ${activityModuleResult.error}`,
			);
		}

		const linkResult = await tryCreateCourseActivityModuleLink({
			payload,
			course: course.id,
			section: section.id,
			activityModule: activityModuleResult.value.id,
			order: 0,
			overrideAccess: true,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
		});

		if (!linkResult.ok) {
			throw new Error(
				`Failed to create link for regular quiz: ${linkResult.error}`,
			);
		}

		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: linkResult.value.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 1,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		if (!startResult.ok) {
			throw new Error(
				`Failed to start regular quiz attempt: ${startResult.error}`,
			);
		}

		const result = await tryStartNestedQuiz({
			payload,
			submissionId: startResult.value.id,
			nestedQuizId: "some-nested-id",
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.message).toContain("container quizzes");
	});

	test("tryStartNestedQuiz should fail for non-existent nested quiz", async () => {
		const result = await tryStartNestedQuiz({
			payload,
			submissionId,
			nestedQuizId: "non-existent-nested-quiz",
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.message).toContain("not found in container quiz");
	});

	test("tryMarkNestedQuizAsComplete should fail if nested quiz not started", async () => {
		// Create a new container quiz with a nested quiz that hasn't been started
		const testNestedQuizId = `test-nested-quiz-${Date.now()}`;
		const testContainerQuizId = `test-container-quiz-${Date.now()}`;
		const activityModuleResult = await tryCreateQuizModule({
			payload,
			title: "Test Container Quiz",
			description: "A test container quiz",
			rawQuizConfig: {
				version: "v2",
				type: "container",
				id: testContainerQuizId,
				title: "Test Container Quiz",
				nestedQuizzes: [
					{
						id: testNestedQuizId,
						title: "Test Nested Quiz",
						pages: [
							{
								id: `page-${Date.now()}`,
								title: "Page 1",
								questions: [],
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
			throw new Error(
				`Failed to create test container quiz: ${activityModuleResult.error}`,
			);
		}

		const linkResult = await tryCreateCourseActivityModuleLink({
			payload,
			course: course.id,
			section: section.id,
			activityModule: activityModuleResult.value.id,
			order: 0,
			overrideAccess: true,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
		});

		if (!linkResult.ok) {
			throw new Error(
				`Failed to create link for test container quiz: ${linkResult.error}`,
			);
		}

		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: linkResult.value.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 1,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		if (!startResult.ok) {
			throw new Error(
				`Failed to start test container quiz attempt: ${startResult.error}`,
			);
		}

		const testSubmissionId = startResult.value.id;

		// Try to mark as complete without starting (should fail)
		const result = await tryMarkNestedQuizAsComplete({
			payload,
			submissionId: testSubmissionId,
			nestedQuizId: testNestedQuizId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.message).toContain("must be started before");
	});

	test("tryMarkNestedQuizAsComplete should set completedAt for started nested quiz", async () => {
		// First start the nested quiz
		const startResult = await tryStartNestedQuiz({
			payload,
			submissionId,
			nestedQuizId: nestedQuiz1Id,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		// Add some answers to help identify the entry
		// This simulates the student answering questions in the nested quiz
		// The answers will have questionId format: "nestedQuizId:questionId"
		const submission = await payload.findByID({
			collection: "quiz-submissions",
			id: submissionId,
			overrideAccess: true,
		});

		const questionId = `${nestedQuiz1Id}:q1`;
		const currentAnswers = submission.answers || [];
		await payload.update({
			collection: "quiz-submissions",
			id: submissionId,
			data: {
				answers: [
					...currentAnswers,
					{
						questionId,
						questionText: "What is 2 + 2?",
						questionType: "multiple_choice",
						selectedAnswer: "b",
					},
				],
			},
			overrideAccess: true,
		});

		// Now mark as complete
		const completeResult = await tryMarkNestedQuizAsComplete({
			payload,
			submissionId,
			nestedQuizId: nestedQuiz1Id,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(completeResult.ok).toBe(true);
		if (!completeResult.ok) return;

		const completedSubmission = completeResult.value;
		// Find entry by checking if it has completedAt
		const completedEntry = completedSubmission.completedNestedQuizzes?.find(
			(entry) => entry.completedAt,
		);
		expect(completedEntry).toBeDefined();
		expect(completedEntry?.completedAt).toBeDefined();
		expect(completedEntry?.startedAt).toBeDefined();
	});

	test("tryMarkNestedQuizAsComplete should be idempotent (return existing if already completed)", async () => {
		// Mark as complete again
		const firstResult = await tryMarkNestedQuizAsComplete({
			payload,
			submissionId,
			nestedQuizId: nestedQuiz1Id,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(firstResult.ok).toBe(true);
		if (!firstResult.ok) return;

		const firstCompletedAt = firstResult.value.completedNestedQuizzes?.find(
			(entry) => entry.completedAt,
		)?.completedAt;

		// Mark as complete again
		const secondResult = await tryMarkNestedQuizAsComplete({
			payload,
			submissionId,
			nestedQuizId: nestedQuiz1Id,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(secondResult.ok).toBe(true);
		if (!secondResult.ok) return;

		const secondCompletedAt = secondResult.value.completedNestedQuizzes?.find(
			(entry) => entry.completedAt,
		)?.completedAt;

		// Should return the same completedAt (idempotent)
		expect(secondCompletedAt).toBe(firstCompletedAt);
	});

	test("tryMarkNestedQuizAsComplete should check nested quiz time limit", async () => {
		// Create a nested quiz with a very short timer
		const shortTimerNestedQuizId = `short-timer-${Date.now()}`;
		const activityModuleResult = await tryCreateQuizModule({
			payload,
			title: "Short Timer Container",
			description: "Container with short timer nested quiz",
			rawQuizConfig: {
				version: "v2",
				type: "container",
				id: `short-container-${Date.now()}`,
				title: "Short Timer Container",
				nestedQuizzes: [
					{
						id: shortTimerNestedQuizId,
						title: "Short Timer Quiz",
						globalTimer: 1, // 1 second timer
						pages: [
							{
								id: `page-${Date.now()}`,
								title: "Page 1",
								questions: [],
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
			throw new Error(
				`Failed to create short timer quiz: ${activityModuleResult.error}`,
			);
		}

		const linkResult = await tryCreateCourseActivityModuleLink({
			payload,
			course: course.id,
			section: section.id,
			activityModule: activityModuleResult.value.id,
			order: 0,
			overrideAccess: true,
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
		});

		if (!linkResult.ok) {
			throw new Error(
				`Failed to create link for short timer quiz: ${linkResult.error}`,
			);
		}

		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: linkResult.value.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 1,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		if (!startResult.ok) {
			throw new Error(
				`Failed to start short timer quiz attempt: ${startResult.error}`,
			);
		}

		const shortSubmissionId = startResult.value.id;

		// Start the nested quiz
		await tryStartNestedQuiz({
			payload,
			submissionId: shortSubmissionId,
			nestedQuizId: shortTimerNestedQuizId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		// Add answers to identify the entry
		await payload.update({
			collection: "quiz-submissions",
			id: shortSubmissionId,
			data: {
				answers: [
					{
						questionId: `${shortTimerNestedQuizId}:q1`,
						questionText: "Test",
						questionType: "multiple_choice",
						selectedAnswer: "a",
					},
				],
			},
			overrideAccess: true,
		});

		// Wait for timer to expire
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Try to mark as complete (should fail due to time limit)
		const result = await tryMarkNestedQuizAsComplete({
			payload,
			submissionId: shortSubmissionId,
			nestedQuizId: shortTimerNestedQuizId,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.message).toContain("time limit");
	});

	test("tryMarkNestedQuizAsComplete should bypass time limit when bypassTimeLimit is true", async () => {
		// Start nested quiz 2
		await tryStartNestedQuiz({
			payload,
			submissionId,
			nestedQuizId: nestedQuiz2Id,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		// Add answers
		const submissionBefore = await payload.findByID({
			collection: "quiz-submissions",
			id: submissionId,
			overrideAccess: true,
		});

		const currentAnswers = submissionBefore.answers || [];
		await payload.update({
			collection: "quiz-submissions",
			id: submissionId,
			data: {
				answers: [
					...currentAnswers,
					{
						questionId: `${nestedQuiz2Id}:q2`,
						questionText: "What is the capital of France?",
						questionType: "short_answer",
						selectedAnswer: "Paris",
					},
				],
			},
			overrideAccess: true,
		});

		// Mark as complete with bypassTimeLimit
		const result = await tryMarkNestedQuizAsComplete({
			payload,
			submissionId,
			nestedQuizId: nestedQuiz2Id,
			bypassTimeLimit: true,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const completedEntry = result.value.completedNestedQuizzes?.find(
			(entry) => entry.completedAt,
		);
		expect(completedEntry?.completedAt).toBeDefined();
	});
});
