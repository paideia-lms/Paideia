import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	tryCreateQuizModule,
} from "./activity-module-management";
import {
	type CreateCourseActivityModuleLinkArgs,
	tryCreateCourseActivityModuleLink,
} from "./course-activity-module-link-management";
import { type CreateCourseArgs, tryCreateCourse } from "./course-management";
import { tryCreateSection } from "./course-section-management";
import {
	type CreateEnrollmentArgs,
	tryCreateEnrollment,
} from "./enrollment-management";
import {
	type CreateQuizArgs,
	type StartQuizAttemptArgs,
	tryCreateQuiz,
	tryStartQuizAttempt,
	trySubmitQuiz,
} from "./quiz-submission-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

const year = new Date().getFullYear();

describe("Quiz Submission Management - Time Limit", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let teacherId: number;
	let studentId: number;
	let courseId: number;
	let enrollmentId: number;
	let sectionId: number;

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

		mockRequest = new Request("http://localhost:3000/test");

		// Create teacher user
		const teacherArgs: CreateUserArgs = {
			payload,
			data: {
				email: "quiz-timelimit-teacher@example.com",
				password: "password123",
				firstName: "John",
				lastName: "Teacher",
				role: "student",
			},
			overrideAccess: true,
		};

		const teacherResult = await tryCreateUser(teacherArgs);
		if (!teacherResult.ok) {
			throw new Error("Test Error: Failed to create test teacher");
		}
		teacherId = teacherResult.value.id;

		// Create student user
		const studentArgs: CreateUserArgs = {
			payload,
			data: {
				email: "quiz-timelimit-student@example.com",
				password: "password123",
				firstName: "Jane",
				lastName: "Student",
				role: "student",
			},
			overrideAccess: true,
		};

		const studentResult = await tryCreateUser(studentArgs);
		if (!studentResult.ok) {
			throw new Error("Test Error: Failed to create test student");
		}
		studentId = studentResult.value.id;

		// Create course
		const courseArgs: CreateCourseArgs = {
			payload,
			data: {
				title: "Quiz Time Limit Test Course",
				description: "A test course for time limit",
				slug: "quiz-timelimit-test-course",
				createdBy: teacherId,
			},
			overrideAccess: true,
		};

		const courseResult = await tryCreateCourse(courseArgs);
		if (!courseResult.ok) {
			throw new Error("Test Error: Failed to create test course");
		}
		courseId = courseResult.value.id;

		// Create enrollment
		const enrollmentArgs: CreateEnrollmentArgs = {
			payload,
			userId: studentId,
			course: courseId,
			role: "student",
			status: "active",
			overrideAccess: true,
		};

		const enrollmentResult = await tryCreateEnrollment(enrollmentArgs);
		if (!enrollmentResult.ok) {
			throw new Error("Test Error: Failed to create test enrollment");
		}
		enrollmentId = enrollmentResult.value.id;

		// Create a section for the course
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: courseId,
				title: "Test Section",
				description: "Test section",
			},
			overrideAccess: true,
		});

		if (!sectionResult.ok) {
			throw new Error("Failed to create section");
		}
		sectionId = sectionResult.value.id;
	});

	afterAll(async () => {
		await $`bun run migrate:fresh --force-accept-warning`;
		await $`bun scripts/clean-s3.ts`;
	});

	test("should reject submission after time limit exceeded", async () => {
		// Create a quiz with a very short time limit (1 minute = 60 seconds)
		const quickQuizArgs: CreateQuizArgs = {
			payload,
			req: mockRequest,
			title: "Quick Quiz",
			description: "A quiz with 1 minute time limit",
			instructions: "Complete quickly",
			dueDate: `${year}-12-31T23:59:59Z`,
			maxAttempts: 1,
			points: 100,
			gradingType: "automatic",
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
			questions: [
				{
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					points: 100,
					options: [
						{ text: "3", isCorrect: false },
						{ text: "4", isCorrect: true },
					],
				},
			],
			createdBy: teacherId,
		};

		const quickQuizResult = await tryCreateQuiz(quickQuizArgs);
		expect(quickQuizResult.ok).toBe(true);
		if (!quickQuizResult.ok) return;

		// Create activity module with this quiz
		const quickActivityModuleArgs: CreateActivityModuleArgs = {
			payload,
			req: mockRequest,
			title: "Quick Quiz Module",
			description: "Module with quick quiz",
			type: "quiz",
			status: "published",
			userId: teacherId,
			instructions: "Complete quickly",
			dueDate: `${year}-12-31T23:59:59Z`,
			maxAttempts: 1,
			points: 100,
			gradingType: "automatic",
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
			questions: [
				{
					questionText: "What is 2 + 2?",
					questionType: "multiple_choice",
					points: 100,
					options: [
						{ text: "3", isCorrect: false },
						{ text: "4", isCorrect: true },
					],
				},
			],
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
			req: mockRequest,
			course: courseId,
			activityModule: quickActivityModuleId,
			section: sectionId,
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
			req: mockRequest,
			courseModuleLinkId: quickCourseActivityModuleLinkId,
			studentId,
			enrollmentId,
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
		const submitResult = await trySubmitQuiz({
			payload,
			submissionId: quickSubmissionId,
			overrideAccess: true,
		});
		expect(submitResult.ok).toBe(false);
		if (submitResult.ok) return;

		expect(submitResult.error.message).toContain("time limit");
	});
});
