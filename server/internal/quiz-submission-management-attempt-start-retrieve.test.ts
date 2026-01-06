import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import { tryCreateQuizModule } from "./activity-module-management";
import { tryCreateCourseActivityModuleLink } from "./course-activity-module-link-management";
import { tryCreateCourse } from "./course-management";
import { tryCreateSection } from "./course-section-management";
import { tryCreateEnrollment } from "./enrollment-management";
import {
	type StartQuizAttemptArgs,
	tryGetQuizSubmissionById,
	tryStartQuizAttempt,
} from "./quiz-submission-management";
import { tryCreateUser } from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/types";

describe("Quiz Attempt Management - Start and Retrieve", () => {
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
					email: "quiz-attempt-teacher@example.com",
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
					email: "quiz-attempt-student@example.com",
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
				title: "Quiz Attempt Test Course",
				description: "A test course for quiz attempts",
				slug: "quiz-attempt-test-course",
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
			description: "A test quiz for attempt workflow",
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
		});

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

	test("should start quiz attempt and retrieve it", async () => {
		const startArgs: StartQuizAttemptArgs = {
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
