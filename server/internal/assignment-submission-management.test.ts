import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	tryCreateAssignmentModule,
	type CreateAssignmentModuleArgs,
} from "./activity-module-management";
import {
	type CreateAssignmentSubmissionArgs,
	tryCreateAssignmentSubmission,
	tryDeleteAssignmentSubmission,
	tryGetAssignmentSubmissionById,
	tryGradeAssignmentSubmission,
	tryListAssignmentSubmissions,
	trySubmitAssignment,
	tryUpdateAssignmentSubmission,
	type UpdateAssignmentSubmissionArgs,
} from "./assignment-submission-management";
import {
	type CreateCourseActivityModuleLinkArgs,
	tryCreateCourseActivityModuleLink,
} from "./course-activity-module-link-management";
import { tryCreateCourse } from "./course-management";
import { tryCreateSection } from "./course-section-management";
import {
	type CreateEnrollmentArgs,
	tryCreateEnrollment,
} from "./enrollment-management";
import {
	type CreateGradebookItemArgs,
	tryCreateGradebookItem,
} from "./gradebook-item-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

const year = new Date().getFullYear();

describe("Assignment Submission Management - Full Workflow", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let teacherId: number;
	let studentId: number;
	let courseId: number;
	let enrollmentId: number;
	let gradebookItemId: number;
	let activityModuleId: number;
	let assignmentId: number;
	let courseActivityModuleLinkId: number;

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

		// Create teacher user
		const teacherArgs: CreateUserArgs = {
			payload,
			data: {
				email: "teacher@example.com",
				password: "password123",
				firstName: "John",
				lastName: "Teacher",
				role: "student",
			},
			overrideAccess: true,
		};

		const teacherResult = await tryCreateUser(teacherArgs);
		expect(teacherResult.ok).toBe(true);
		if (!teacherResult.ok) {
			throw new Error("Test Error: Failed to create test teacher");
		}
		teacherId = teacherResult.value.id;

		// Create student user
		const studentArgs: CreateUserArgs = {
			payload,
			data: {
				email: "student@example.com",
				password: "password123",
				firstName: "Jane",
				lastName: "Student",
				role: "student",
			},
			overrideAccess: true,
		};

		const studentResult = await tryCreateUser(studentArgs);
		expect(studentResult.ok).toBe(true);
		if (!studentResult.ok) {
			throw new Error("Test Error: Failed to create test student");
		}
		studentId = studentResult.value.id;

		const courseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Test Course",
				description: "A test course for assignment submissions",
				slug: "test-course",
				createdBy: teacherId,
			},
			overrideAccess: true,
		});
		expect(courseResult.ok).toBe(true);
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
			user: null,
			overrideAccess: true,
		};

		const enrollmentResult = await tryCreateEnrollment(enrollmentArgs);
		expect(enrollmentResult.ok).toBe(true);
		if (enrollmentResult.ok) {
			enrollmentId = enrollmentResult.value.id;
		}

		// Create activity module with assignment
		const activityModuleArgs = {
			payload,
			req: mockRequest,
			title: "Test Assignment",
			description: "A test assignment for submission workflow",
			status: "published",
			userId: teacherId,
			instructions: "Complete this assignment by writing a short essay",
			dueDate: `${year}-12-31T23:59:59Z`,
			maxAttempts: 3,
			allowLateSubmissions: true,
			requireTextSubmission: true,
			requireFileSubmission: false,
			overrideAccess: true,
		} satisfies CreateAssignmentModuleArgs;

		const activityModuleResult =
			await tryCreateAssignmentModule(activityModuleArgs);
		if (!activityModuleResult.ok) {
			throw new Error("Test Error: Failed to create test activity module");
		}
		expect(activityModuleResult.ok).toBe(true);
		if (!activityModuleResult.ok) {
			throw new Error("Test Error: Failed to create test activity module");
		}
		activityModuleId = activityModuleResult.value.id;
		console.log("Created activity module with ID:", activityModuleId);
		// Get the assignment ID from the activity module
		// Since AssignmentModuleResult is a discriminated union, we need to check the type first
		if (activityModuleResult.value.type === "assignment") {
			// Fetch the activity module with depth to get the assignment relationship
			const module = await payload.findByID({
				collection: "activity-modules",
				id: activityModuleId,
				depth: 1,
			});
			if (module.assignment) {
				assignmentId =
					typeof module.assignment === "object" && "id" in module.assignment
						? module.assignment.id
						: (module.assignment as number);
				console.log("Extracted assignment ID:", assignmentId);
			}
		}

		// Create a section for the course
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: courseId,
				title: "Test Section",
				description: "Test section for assignment submissions",
			},
			overrideAccess: true,
		});

		if (!sectionResult.ok) {
			throw new Error("Failed to create section");
		}

		// Create course-activity-module-link
		const courseActivityModuleLinkArgs: CreateCourseActivityModuleLinkArgs = {
			payload,
			req: mockRequest,
			course: courseId,
			activityModule: activityModuleId,
			section: sectionResult.value.id,
			order: 0,
			overrideAccess: true,
		};

		const courseActivityModuleLinkResult =
			await tryCreateCourseActivityModuleLink(courseActivityModuleLinkArgs);
		expect(courseActivityModuleLinkResult.ok).toBe(true);
		if (!courseActivityModuleLinkResult.ok) {
			throw new Error(
				"Test Error: Failed to create course-activity-module-link",
			);
		}
		courseActivityModuleLinkId = courseActivityModuleLinkResult.value.id;
		console.log(
			"Created course-activity-module-link with ID:",
			courseActivityModuleLinkId,
		);

		// Verify gradebook exists
		const verifyGradebook = await payload.findByID({
			collection: "gradebooks",
			id: courseResult.value.gradebook.id,
		});
		console.log(
			"Gradebook verification result:",
			verifyGradebook ? "Found" : "Not found",
		);

		// Create gradebook item for the assignment
		console.log(
			"Creating gradebook item with courseActivityModuleLinkId:",
			courseActivityModuleLinkId,
			"gradebookId:",
			courseResult.value.gradebook.id,
		);
		const gradebookItemResult = await tryCreateGradebookItem({
			payload,
			courseId: courseResult.value.gradebook.id,
			name: "Test Assignment",
			description: "Assignment submission test",
			activityModuleId: courseActivityModuleLinkId,
			maxGrade: 100,
			weight: 25,
			sortOrder: 1,
			user: null,
			req: mockRequest,
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

	test("should create assignment submission (student workflow)", async () => {
		const args: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 1,
			content:
				"This is my first attempt at the assignment. I will write about the importance of education.",
			timeSpent: 30,
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const result = await tryCreateAssignmentSubmission({
			...args,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;

		// Verify submission (activityModule and assignment are now virtual fields accessed through courseModuleLink)
		expect(submission.courseModuleLink.id).toBe(courseActivityModuleLinkId);
		expect(submission.student.id).toBe(studentId);
		expect(submission.enrollment.id).toBe(enrollmentId);
		expect(submission.attemptNumber).toBe(1);
		expect(submission.status).toBe("draft");
		expect(submission.content).toBe(args.content);
		expect(submission.timeSpent).toBe(30);
		expect(submission.isLate).toBe(false); // Not late yet
		expect(submission.id).toBeDefined();
		expect(submission.createdAt).toBeDefined();
	});

	test("should update assignment submission (student editing draft)", async () => {
		// First create a submission
		const createArgs: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 2,
			content: "Initial draft content",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const createResult = await tryCreateAssignmentSubmission({
			...createArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Update the submission
		const updateArgs: UpdateAssignmentSubmissionArgs = {
			payload,
			id: submissionId,
			content: "Updated content with more detailed analysis of the topic",
			timeSpent: 45,
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const updateResult = await tryUpdateAssignmentSubmission({
			...updateArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(updateResult.ok).toBe(true);
		if (!updateResult.ok) return;

		const updatedSubmission = updateResult.value;
		expect(updatedSubmission.content).toBe(updateArgs.content);
		expect(updatedSubmission.timeSpent).toBe(45);
		expect(updatedSubmission.status).toBe("draft"); // Should remain draft
	});

	test("should submit assignment (student submits for grading)", async () => {
		// First create a submission
		const createArgs: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 3,
			content: "Final submission ready for grading",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const createResult = await tryCreateAssignmentSubmission({
			...createArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Submit the assignment
		const submitResult = await trySubmitAssignment({
			payload,
			submissionId,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		const submittedSubmission = submitResult.value;
		expect(submittedSubmission.status).toBe("submitted");
		expect(submittedSubmission.submittedAt).toBeDefined();
		expect(submittedSubmission.content).toBe(
			"Final submission ready for grading",
		);
	});

	test("should grade assignment submission (teacher grades student work)", async () => {
		// First create and submit an assignment
		const createArgs: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 4,
			content:
				"This is a well-written essay that demonstrates good understanding of the topic.",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const createResult = await tryCreateAssignmentSubmission({
			...createArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Submit the assignment
		const submitResult = await trySubmitAssignment({
			payload,
			submissionId,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		// Grade the assignment (only updates submission, does NOT create user-grade)
		const gradeResult = await tryGradeAssignmentSubmission({
			payload,
			req: mockRequest,
			id: submissionId,
			grade: 85,
			feedback:
				"Good work! Your analysis was thorough and well-structured. Consider adding more examples in the conclusion.",
			gradedBy: teacherId,
			user: null,
			overrideAccess: true,
		});

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) return;

		const gradedSubmission = gradeResult.value;
		expect(gradedSubmission.status).toBe("graded");
		const submissionWithGrade = gradedSubmission as typeof gradedSubmission & {
			grade?: number | null;
			feedback?: string | null;
			gradedBy?: number | { id: number } | null;
			gradedAt?: string | null;
		};
		expect(submissionWithGrade.grade).toBe(85);
		expect(submissionWithGrade.feedback).toBe(
			"Good work! Your analysis was thorough and well-structured. Consider adding more examples in the conclusion.",
		);
		const gradedByValue =
			typeof submissionWithGrade.gradedBy === "number"
				? submissionWithGrade.gradedBy
				: submissionWithGrade.gradedBy?.id;
		expect(gradedByValue).toBe(teacherId);
		expect(submissionWithGrade.gradedAt).toBeDefined();

		// Verify that user-grade was NOT created (grading only updates submission)
		const { tryFindUserGradeByEnrollmentAndItem } = await import(
			"./user-grade-management"
		);
		const userGradeResult = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			user: null,
			req: mockRequest,
			overrideAccess: true,
			enrollmentId,
			gradebookItemId,
		});
		expect(userGradeResult.ok).toBe(false); // User-grade should not exist yet
	});

	test("should get assignment submission by ID", async () => {
		// First create a submission
		const createArgs: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 6,
			content: "Submission for get by ID test",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const createResult = await tryCreateAssignmentSubmission({
			...createArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Get the submission by ID
		const getResult = await tryGetAssignmentSubmissionById({
			payload,
			id: submissionId,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedSubmission = getResult.value;
		expect(retrievedSubmission.id).toBe(submissionId);
		expect(retrievedSubmission.courseModuleLink.id).toBe(
			courseActivityModuleLinkId,
		);
		// activityModule and assignment are virtual fields, resolved as strings
		expect(retrievedSubmission.student.id).toBe(studentId);
		expect(retrievedSubmission.enrollment.id).toBe(enrollmentId);
		expect(retrievedSubmission.content).toBe("Submission for get by ID test");
	});

	test("should list assignment submissions with filtering", async () => {
		// List all submissions for this activity module
		const listResult = await tryListAssignmentSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			overrideAccess: true,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		const submissions = listResult.value;
		expect(submissions.docs.length).toBeGreaterThan(0);
		expect(submissions.totalDocs).toBeGreaterThan(0);

		// All submissions should be for the same course module link
		submissions.docs.forEach((submission) => {
			expect(submission.courseModuleLink).toBe(courseActivityModuleLinkId);
		});

		// Test filtering by student
		const studentListResult = await tryListAssignmentSubmissions({
			payload,
			studentId,
			overrideAccess: true,
		});

		expect(studentListResult.ok).toBe(true);
		if (!studentListResult.ok) return;

		const studentSubmissions = studentListResult.value;
		studentSubmissions.docs.forEach((submission) => {
			expect(submission.student.id).toBe(studentId);
		});

		// Test filtering by status
		const draftListResult = await tryListAssignmentSubmissions({
			payload,
			status: "draft",
			overrideAccess: true,
		});

		expect(draftListResult.ok).toBe(true);
		if (!draftListResult.ok) return;

		const draftSubmissions = draftListResult.value;
		draftSubmissions.docs.forEach((submission) => {
			expect(submission.status).toBe("draft");
		});
	});

	test("should handle late submissions", async () => {
		// Create a submission after the due date (simulate late submission)
		const lateArgs: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 7,
			content: "This is a late submission",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const result = await tryCreateAssignmentSubmission({
			...lateArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;
		// Note: isLate calculation depends on the assignment's due date
		// In a real scenario, you might need to mock the current time
		expect(submission.attemptNumber).toBe(7);
		expect(submission.content).toBe("This is a late submission");
	});

	test("should prevent duplicate submissions for same attempt", async () => {
		const args: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 8,
			content: "First submission for attempt 8",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		// Create first submission
		const firstResult = await tryCreateAssignmentSubmission({
			...args,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(firstResult.ok).toBe(true);

		// Try to create duplicate submission for same attempt
		const duplicateResult = await tryCreateAssignmentSubmission({
			...args,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(duplicateResult.ok).toBe(false);
	});

	test("should validate grade limits", async () => {
		// Create and submit an assignment
		const createArgs: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 9,
			content: "Submission for grade validation test",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const createResult = await tryCreateAssignmentSubmission({
			...createArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Submit the assignment
		const submitResult = await trySubmitAssignment({
			payload,
			submissionId,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		// Try to grade with negative grade
		const negativeGradeResult = await tryGradeAssignmentSubmission({
			payload,
			req: mockRequest,
			id: submissionId,
			grade: -10,
			feedback: "Invalid grade",
			gradedBy: teacherId,
			user: null,
			overrideAccess: true,
		});

		expect(negativeGradeResult.ok).toBe(false);

		// Try to grade with grade exceeding maximum
		const excessiveGradeResult = await tryGradeAssignmentSubmission({
			payload,
			req: mockRequest,
			id: submissionId,
			grade: 150,
			feedback: "Grade too high",
			gradedBy: teacherId,
			user: null,
			overrideAccess: true,
		});

		expect(excessiveGradeResult.ok).toBe(false);
	});

	test("should only allow grading of submitted assignments", async () => {
		// Create a draft submission
		const createArgs: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 10,
			content: "Draft submission that should not be gradable",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const createResult = await tryCreateAssignmentSubmission({
			...createArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Try to grade a draft submission
		const gradeResult = await tryGradeAssignmentSubmission({
			payload,
			req: mockRequest,
			id: submissionId,
			grade: 80,
			feedback: "Should not be able to grade draft",
			gradedBy: teacherId,
			user: null,
			overrideAccess: true,
		});

		expect(gradeResult.ok).toBe(false);
	});

	test("should delete assignment submission", async () => {
		// Create a submission
		const createArgs: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			attemptNumber: 11,
			content: "Submission to be deleted",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const createResult = await tryCreateAssignmentSubmission({
			...createArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Delete the submission
		const deleteResult = await tryDeleteAssignmentSubmission({
			payload,
			id: submissionId,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(deleteResult.ok).toBe(true);

		// Verify submission is deleted
		const getResult = await tryGetAssignmentSubmissionById({
			payload,
			id: submissionId,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(getResult.ok).toBe(false);
	});

	test("should handle pagination in listing", async () => {
		// Create multiple submissions for pagination testing
		for (let i = 0; i < 5; i++) {
			const createArgs: CreateAssignmentSubmissionArgs = {
				payload,
				courseModuleLinkId: courseActivityModuleLinkId,
				studentId,
				enrollmentId,
				attemptNumber: 20 + i,
				content: `Pagination test submission ${i + 1}`,
				user: null,
				req: undefined,
				overrideAccess: true,
			};

			const createResult = await tryCreateAssignmentSubmission({
				...createArgs,
				payload,
				user: null,
				req: undefined,
				overrideAccess: true,
			});
			expect(createResult.ok).toBe(true);
		}

		// Test pagination
		const page1Result = await tryListAssignmentSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
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

	test("should fail with invalid arguments", async () => {
		// Test missing course module link ID
		const invalidArgs1: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: undefined as never,
			studentId,
			enrollmentId,
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const result1 = await tryCreateAssignmentSubmission({
			...invalidArgs1,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(result1.ok).toBe(false);

		// Test missing student ID
		const invalidArgs2: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId: undefined as never,
			enrollmentId,
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const result2 = await tryCreateAssignmentSubmission({
			...invalidArgs2,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(result2.ok).toBe(false);

		// Test missing enrollment ID
		const invalidArgs3: CreateAssignmentSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId: undefined as never,
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const result3 = await tryCreateAssignmentSubmission({
			...invalidArgs3,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(result3.ok).toBe(false);
	});

	test("should fail to get non-existent submission", async () => {
		const result = await tryGetAssignmentSubmissionById({
			payload,
			id: 99999,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to update non-existent submission", async () => {
		const updateArgs: UpdateAssignmentSubmissionArgs = {
			payload,
			id: 99999,
			content: "Updated content",
			user: null,
			req: undefined,
			overrideAccess: true,
		};

		const result = await tryUpdateAssignmentSubmission({
			...updateArgs,
			payload,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(result.ok).toBe(false);
	});

	test("should fail to delete non-existent submission", async () => {
		const result = await tryDeleteAssignmentSubmission({
			payload,
			id: 99999,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
		expect(result.ok).toBe(false);
	});
});
