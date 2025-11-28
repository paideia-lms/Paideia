import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateQuizModuleArgs,
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
	type StartQuizAttemptArgs,
	tryStartQuizAttempt,
} from "./quiz-submission-management";
import { tryCreateUser } from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/type-narrowing";

describe("Quiz Attempt Management - Prevent Duplicate Attempts", () => {
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
					email: "quiz-duplicate-teacher@example.com",
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
					email: "quiz-duplicate-student@example.com",
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
				title: "Quiz Duplicate Test Course",
				description: "A test course for duplicate attempts",
				slug: "quiz-duplicate-test-course",
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
			description: "A test quiz for duplicate attempts",
			status: "published",
			req: createLocalReq({
				request: mockRequest,
				user: teacher as TypedUser,
			}),
			instructions: "Complete this quiz",
			points: 100,
			gradingType: "automatic",
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
		})

		if (!activityModuleResult.ok) {
			throw new Error("Test Error: Failed to create test activity module");
		}
		const activityModuleId = activityModuleResult.value.id;

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
		}).getOrThrow();
	});

	afterAll(async () => {
		// reset the database
		await $`bun run migrate:fresh --force-accept-warning`;
		await $`bun scripts/clean-s3.ts`;
	});

	test("should prevent starting new attempt if previous is in_progress", async () => {
		// Start first attempt
		const startArgs1: StartQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 1,
			overrideAccess: true,
		};

		const startResult1 = await tryStartQuizAttempt(startArgs1);
		expect(startResult1.ok).toBe(true);
		if (!startResult1.ok) return;

		// Try to start a second attempt while first is in_progress
		const startArgs2: StartQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: student.id,
			enrollmentId: enrollment.id,
			attemptNumber: 2,
			overrideAccess: true,
		};

		const startResult2 = await tryStartQuizAttempt(startArgs2);
		expect(startResult2.ok).toBe(false);
		if (startResult2.ok) return;

		expect(startResult2.error.message).toContain(
			"Cannot start a new quiz attempt while another attempt is in progress",
		);
	});
});
