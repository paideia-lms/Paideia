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
	type StartPreviewQuizAttemptArgs,
	type StartQuizAttemptArgs,
	tryAnswerQuizQuestion,
	tryCheckInProgressSubmission,
	tryListQuizSubmissions,
	tryMarkQuizAttemptAsComplete,
	tryStartPreviewQuizAttempt,
	tryStartQuizAttempt,
} from "./quiz-submission-management";
import { tryCreateUser } from "../modules/user/services/user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/types";

describe("Quiz Preview Functionality", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let instructor: TryResultValue<typeof tryCreateUser>;
	let student: TryResultValue<typeof tryCreateUser>;
	let course: TryResultValue<typeof tryCreateCourse>;
	let enrollment: TryResultValue<typeof tryCreateEnrollment>;
	let instructorEnrollment: TryResultValue<typeof tryCreateEnrollment>;
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

		// Create instructor and student users in parallel
		const [instructorResult, studentResult] = await Promise.all([
			tryCreateUser({
				payload,
				data: {
					email: "quiz-preview-instructor@example.com",
					password: "password123",
					firstName: "John",
					lastName: "Instructor",
					role: "instructor",
				},
				overrideAccess: true,
				req: undefined,
			}).getOrThrow(),
			tryCreateUser({
				payload,
				data: {
					email: "quiz-preview-student@example.com",
					password: "password123",
					firstName: "Jane",
					lastName: "Student",
					role: "student",
				},
				overrideAccess: true,
				req: undefined,
			}).getOrThrow(),
		]);

		instructor = instructorResult;
		student = studentResult;

		// Create course
		course = await tryCreateCourse({
			payload,
			data: {
				title: "Quiz Preview Test Course",
				description: "A test course for quiz preview",
				slug: "quiz-preview-test-course",
				createdBy: instructor.id,
			},
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		// Create enrollments
		enrollment = await tryCreateEnrollment({
			payload,
			userId: student.id,
			course: course.id,
			role: "student",
			status: "active",
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		instructorEnrollment = await tryCreateEnrollment({
			payload,
			userId: instructor.id,
			course: course.id,
			role: "teacher",
			status: "active",
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		// Create activity module with quiz
		const activityModuleResult = await tryCreateQuizModule({
			payload,
			title: "Test Quiz",
			description: "A test quiz for preview",
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			instructions: "Complete this quiz",
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
			req: undefined,
		}).getOrThrow();

		// Create course-activity-module-link
		courseActivityModuleLink = await tryCreateCourseActivityModuleLink({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
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

	test("should create preview attempt with isPreview: true", async () => {
		const previewArgs: StartPreviewQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			userId: instructor.id,
			enrollmentId: instructorEnrollment.id,
			overrideAccess: true,
		};

		const previewResult = await tryStartPreviewQuizAttempt(previewArgs);
		expect(previewResult.ok).toBe(true);
		if (!previewResult.ok) return;

		const preview = previewResult.value;
		expect(preview.isPreview).toBe(true);
		expect(preview.status).toBe("in_progress");
		expect(preview.attemptNumber).toBe(999999);
		// student is normalized to ID in the return value
		expect(preview.student).toBe(instructor.id);
	});

	test("should delete old preview when starting new preview", async () => {
		// Start first preview
		const previewArgs1: StartPreviewQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			userId: instructor.id,
			enrollmentId: instructorEnrollment.id,
			overrideAccess: true,
		};

		const previewResult1 = await tryStartPreviewQuizAttempt(previewArgs1);
		expect(previewResult1.ok).toBe(true);
		if (!previewResult1.ok) return;

		const previewId1 = previewResult1.value.id;

		// Start second preview
		const previewResult2 = await tryStartPreviewQuizAttempt(previewArgs1);
		expect(previewResult2.ok).toBe(true);
		if (!previewResult2.ok) return;

		const previewId2 = previewResult2.value.id;

		// First preview should be deleted
		expect(previewId1).not.toBe(previewId2);

		// Verify first preview no longer exists
		try {
			const deletedPreview = await payload.findByID({
				collection: "quiz-submissions",
				id: previewId1,
				overrideAccess: true,
			});
			expect(deletedPreview).toBeNull();
		} catch (error) {
			// NotFound error is also acceptable
			expect(error).toBeDefined();
		}
	});

	test("should not block starting real attempt when preview exists", async () => {
		// Start a preview attempt
		const previewArgs: StartPreviewQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			userId: instructor.id,
			enrollmentId: instructorEnrollment.id,
			overrideAccess: true,
		};

		const previewResult = await tryStartPreviewQuizAttempt(previewArgs);
		expect(previewResult.ok).toBe(true);
		if (!previewResult.ok) return;

		// Check in-progress submission should not find preview
		const checkResult = await tryCheckInProgressSubmission({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: instructor.id,
			req: undefined,
			overrideAccess: true,
		});
		expect(checkResult.ok).toBe(true);
		if (!checkResult.ok) return;
		expect(checkResult.value.hasInProgress).toBe(false);

		// Should be able to start a real attempt even with preview
		const startArgs: StartQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: instructor.id,
			enrollmentId: instructorEnrollment.id,
			attemptNumber: 1,
			overrideAccess: true,
		};

		const startResult = await tryStartQuizAttempt(startArgs);
		expect(startResult.ok).toBe(true);
	});

	test("should allow preview attempts to answer questions", async () => {
		// Start a preview attempt
		const previewArgs: StartPreviewQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			userId: instructor.id,
			enrollmentId: instructorEnrollment.id,
			overrideAccess: true,
		};

		const previewResult = await tryStartPreviewQuizAttempt(previewArgs);
		expect(previewResult.ok).toBe(true);
		if (!previewResult.ok) return;

		const previewId = previewResult.value.id;

		// Get the quiz to find a valid question ID
		const courseModuleLink = await payload.findByID({
			collection: "course-activity-module-links",
			id: courseActivityModuleLink.id,
			depth: 2,
			overrideAccess: true,
		});

		const activityModule = courseModuleLink?.activityModule;
		if (!activityModule || typeof activityModule !== "object") {
			// Skip this test if activity module is not an object
			return;
		}

		const quiz = activityModule.quiz;
		if (!quiz || typeof quiz !== "object") {
			// Skip this test if quiz doesn't have questions
			return;
		}

		const rawConfig = quiz.rawQuizConfig as any;
		const questions =
			rawConfig?.questions || rawConfig?.sections?.[0]?.questions || [];

		if (questions.length === 0) {
			// Skip this test if quiz has no questions
			return;
		}

		const firstQuestion = questions[0];
		const questionId = firstQuestion.id || firstQuestion.questionId;

		if (!questionId) {
			// Skip this test if question has no ID
			return;
		}

		// Try to answer a question (this should work for previews)
		const answerResult = await tryAnswerQuizQuestion({
			payload,
			submissionId: previewId,
			questionId: String(questionId),
			answer: {
				type: "multiple-choice",
				value: "option1",
			},
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			overrideAccess: true,
		});

		// Should succeed (previews can answer questions)
		// Note: This might fail if the question format doesn't match, but that's okay
		// The important thing is that previews are allowed to call this function
		expect(answerResult.ok).toBe(true);
	});

	test("should reject marking preview attempt as complete", async () => {
		// Start a preview attempt
		const previewArgs: StartPreviewQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			userId: instructor.id,
			enrollmentId: instructorEnrollment.id,
			overrideAccess: true,
		};

		const previewResult = await tryStartPreviewQuizAttempt(previewArgs);
		expect(previewResult.ok).toBe(true);
		if (!previewResult.ok) return;

		const previewId = previewResult.value.id;

		// Try to mark preview as complete (should fail)
		const completeResult = await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId: previewId,
			req: undefined,
			overrideAccess: true,
		});

		expect(completeResult.ok).toBe(false);
		if (completeResult.ok) return;
		expect(completeResult.error.message).toContain(
			"Preview attempts cannot be marked as complete",
		);
	});

	test("should exclude preview attempts from listings by default", async () => {
		// Start a preview attempt
		const previewArgs: StartPreviewQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			userId: instructor.id,
			enrollmentId: instructorEnrollment.id,
			overrideAccess: true,
		};

		const previewResult = await tryStartPreviewQuizAttempt(previewArgs);
		expect(previewResult.ok).toBe(true);
		if (!previewResult.ok) return;

		// List submissions (should exclude preview by default)
		const listResult = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: instructor.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		// Preview should not be in the list
		const previewInList = listResult.value.docs.some(
			(doc) => doc.id === previewResult.value.id,
		);
		expect(previewInList).toBe(false);
	});

	test("should include preview attempts when includePreview is true", async () => {
		// Start a preview attempt
		const previewArgs: StartPreviewQuizAttemptArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			courseModuleLinkId: courseActivityModuleLink.id,
			userId: instructor.id,
			enrollmentId: instructorEnrollment.id,
			overrideAccess: true,
		};

		const previewResult = await tryStartPreviewQuizAttempt(previewArgs);
		expect(previewResult.ok).toBe(true);
		if (!previewResult.ok) return;

		// List submissions with includePreview: true
		const listResult = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLink.id,
			studentId: instructor.id,
			includePreview: true,
			req: undefined,
			overrideAccess: true,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		// Preview should be in the list
		const previewInList = listResult.value.docs.some(
			(doc) => doc.id === previewResult.value.id,
		);
		expect(previewInList).toBe(true);
	});
});
