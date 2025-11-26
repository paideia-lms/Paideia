import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateQuizModuleArgs,
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
	type StartQuizAttemptArgs,
	tryStartQuizAttempt,
} from "./quiz-submission-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

const year = new Date().getFullYear();

describe("Quiz Attempt Management - Prevent Duplicate Attempts", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let teacherId: number;
	let studentId: number;
	let courseId: number;
	let enrollmentId: number;
	let courseActivityModuleLinkId: number;
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
				email: "quiz-duplicate-teacher@example.com",
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
				email: "quiz-duplicate-student@example.com",
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
				title: "Quiz Duplicate Test Course",
				description: "A test course for duplicate attempts",
				slug: "quiz-duplicate-test-course",
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

		// Create activity module with quiz
		const activityModuleArgs: CreateQuizModuleArgs = {
			payload,
			req: mockRequest,
			title: "Test Quiz",
			description: "A test quiz for duplicate attempts",
			status: "published",
			userId: teacherId,
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
		};

		const activityModuleResult = await tryCreateQuizModule(activityModuleArgs);
		if (!activityModuleResult.ok) {
			throw new Error("Test Error: Failed to create test activity module");
		}
		const activityModuleId = activityModuleResult.value.id;

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

		// Create course-activity-module-link
		const linkArgs: CreateCourseActivityModuleLinkArgs = {
			payload,
			req: mockRequest,
			course: courseId,
			activityModule: activityModuleId,
			section: sectionId,
			order: 0,
		};

		const linkResult = await tryCreateCourseActivityModuleLink(linkArgs);
		if (!linkResult.ok) {
			throw new Error(
				"Test Error: Failed to create course-activity-module-link",
			);
		}
		courseActivityModuleLinkId = linkResult.value.id;
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
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 1,
			overrideAccess: true,
		};

		const startResult1 = await tryStartQuizAttempt(startArgs1);
		expect(startResult1.ok).toBe(true);
		if (!startResult1.ok) return;

		// Try to start a second attempt while first is in_progress
		const startArgs2: StartQuizAttemptArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
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
