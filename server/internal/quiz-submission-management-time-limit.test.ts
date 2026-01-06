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
	type CreateQuizArgs,
	type StartQuizAttemptArgs,
	tryCreateQuiz,
	tryStartQuizAttempt,
	tryMarkQuizAttemptAsComplete,
} from "./quiz-submission-management";
import { tryCreateUser } from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/types";

describe("Quiz Submission Management - Time Limit", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let teacher: TryResultValue<typeof tryCreateUser>;
	let student: TryResultValue<typeof tryCreateUser>;
	let course: TryResultValue<typeof tryCreateCourse>;
	let enrollment: TryResultValue<typeof tryCreateEnrollment>;
	let section: TryResultValue<typeof tryCreateSection>;

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

		// Create teacher and student users in parallel
		const [teacherResult, studentResult] = await Promise.all([
			tryCreateUser({
				payload,
				data: {
					email: "quiz-timelimit-teacher@example.com",
					password: "password123",
					firstName: "John",
					lastName: "Teacher",
					role: "student",
				},
				overrideAccess: true,
			}).getOrThrow(),
			tryCreateUser({
				payload,
				data: {
					email: "quiz-timelimit-student@example.com",
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
				title: "Quiz Time Limit Test Course",
				description: "A test course for time limit",
				slug: "quiz-timelimit-test-course",
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

		// Create a section for the course
		section = await tryCreateSection({
			payload,
			data: {
				course: course.id,
				title: "Test Section",
				description: "Test section",
			},
			overrideAccess: true,
		}).getOrThrow();
	});

	afterAll(async () => {
		await $`bun run migrate:fresh --force-accept-warning`;
		await $`bun scripts/clean-s3.ts`;
	});

	test("should reject submission after time limit exceeded", async () => {
		// Create a quiz with a very short time limit (1 minute = 60 seconds)
		const quickQuizArgs: CreateQuizArgs = {
			payload,
			req: createLocalReq({ request: mockRequest, user: teacher as TypedUser }),
			title: "Quick Quiz",
			description: "A quiz with 1 minute time limit",
			instructions: "Complete quickly",
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
			createdBy: teacher.id,
		};

		const quickQuizResult = await tryCreateQuiz(quickQuizArgs);
		expect(quickQuizResult.ok).toBe(true);
		if (!quickQuizResult.ok) return;

		// Create activity module with this quiz
		const quickActivityModuleArgs: CreateActivityModuleArgs = {
			payload,
			req: createLocalReq({ request: mockRequest, user: teacher as TypedUser }),
			title: "Quick Quiz Module",
			description: "Module with quick quiz",
			type: "quiz",
			instructions: "Complete quickly",
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
			overrideAccess: true,
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
			req: createLocalReq({ request: mockRequest, user: teacher as TypedUser }),
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
			req: createLocalReq({ request: mockRequest, user: student as TypedUser }),
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
});
