import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	CreateQuizModuleArgs,
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
	tryGetQuizSubmissionById,
	tryStartQuizAttempt,
} from "./quiz-submission-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

const year = new Date().getFullYear();

describe("Quiz Attempt Management - Start and Retrieve", () => {
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
				email: "quiz-attempt-teacher@example.com",
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
				email: "quiz-attempt-student@example.com",
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
				title: "Quiz Attempt Test Course",
				description: "A test course for quiz attempts",
				slug: "quiz-attempt-test-course",
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
			req: mockRequest as Request,
			title: "Test Quiz",
			description: "A test quiz for attempt workflow",
			status: "published",
			userId: teacherId,
			instructions: "Complete this quiz",
			dueDate: `${year}-12-31T23:59:59Z`,
			maxAttempts: 3,
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

	test("should start quiz attempt and retrieve it", async () => {
		const startArgs: StartQuizAttemptArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 1,
			overrideAccess: true,
		};

		const startResult = await tryStartQuizAttempt(startArgs);
		expect(startResult.ok).toBe(true);
		if (!startResult.ok) return;

		const startedSubmission = startResult.value;
		expect(startedSubmission.status).toBe("in_progress");
		expect(startedSubmission.attemptNumber).toBe(1);
		expect(startedSubmission.startedAt).toBeDefined();
		expect(startedSubmission.answers).toEqual([]);

		// Retrieve the submission
		const getResult = await tryGetQuizSubmissionById({
			payload,
			id: startedSubmission.id,
			overrideAccess: true,
		});

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedSubmission = getResult.value;
		expect(retrievedSubmission.id).toBe(startedSubmission.id);
		expect(retrievedSubmission.status).toBe("in_progress");
		expect(retrievedSubmission.attemptNumber).toBe(1);
		expect(retrievedSubmission.startedAt).toBeDefined();
	});
});
