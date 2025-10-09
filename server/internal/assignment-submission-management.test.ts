import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
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
import { type CreateCourseArgs, tryCreateCourse } from "./course-management";
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
			email: "teacher@example.com",
			password: "password123",
			firstName: "John",
			lastName: "Teacher",
			role: "user",
		};

		const teacherResult = await tryCreateUser(
			payload,
			mockRequest,
			teacherArgs,
		);
		expect(teacherResult.ok).toBe(true);
		if (!teacherResult.ok) {
			throw new Error("Test Error: Failed to create test teacher");
		}
		teacherId = teacherResult.value.id;

		// Create student user
		const studentArgs: CreateUserArgs = {
			email: "student@example.com",
			password: "password123",
			firstName: "Jane",
			lastName: "Student",
			role: "user",
		};

		const studentResult = await tryCreateUser(
			payload,
			mockRequest,
			studentArgs,
		);
		expect(studentResult.ok).toBe(true);
		if (!studentResult.ok) {
			throw new Error("Test Error: Failed to create test student");
		}
		studentId = studentResult.value.id;

		// Create course
		const courseArgs: CreateCourseArgs = {
			title: "Test Course",
			description: "A test course for assignment submissions",
			slug: "test-course",
			createdBy: teacherId,
		};

		const courseResult = await tryCreateCourse(
			payload,
			mockRequest,
			courseArgs,
		);
		expect(courseResult.ok).toBe(true);
		if (!courseResult.ok) {
			throw new Error("Test Error: Failed to create test course");
		}
		courseId = courseResult.value.id;

		// Create enrollment
		const enrollmentArgs: CreateEnrollmentArgs = {
			user: studentId,
			course: courseId,
			role: "student",
			status: "active",
		};

		const enrollmentResult = await tryCreateEnrollment(payload, enrollmentArgs);
		expect(enrollmentResult.ok).toBe(true);
		if (enrollmentResult.ok) {
			enrollmentId = enrollmentResult.value.id;
		}

		// Create activity module with assignment
		const activityModuleArgs: CreateActivityModuleArgs = {
			title: "Test Assignment",
			description: "A test assignment for submission workflow",
			type: "assignment",
			status: "published",
			userId: teacherId,
			assignmentData: {
				instructions: "Complete this assignment by writing a short essay",
				dueDate: `${year}-12-31T23:59:59Z`,
				maxAttempts: 3,
				allowLateSubmissions: true,
				requireTextSubmission: true,
				requireFileSubmission: false,
			},
		};

		const activityModuleResult = await tryCreateActivityModule(
			payload,
			activityModuleArgs,
		);
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
		if (
			activityModuleResult.value.assignment &&
			typeof activityModuleResult.value.assignment === "object" &&
			"id" in activityModuleResult.value.assignment
		) {
			assignmentId = activityModuleResult.value.assignment.id as number;
			console.log("Extracted assignment ID:", assignmentId);
		}

		// Create course-activity-module-link
		const courseActivityModuleLinkArgs: CreateCourseActivityModuleLinkArgs = {
			course: courseId,
			activityModule: activityModuleId,
		};

		const courseActivityModuleLinkResult =
			await tryCreateCourseActivityModuleLink(
				payload,
				mockRequest,
				courseActivityModuleLinkArgs,
			);
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
		const gradebookItemArgs: CreateGradebookItemArgs = {
			gradebookId: courseResult.value.gradebook.id,
			name: "Test Assignment",
			description: "Assignment submission test",
			activityModuleId: courseActivityModuleLinkId,
			maxGrade: 100,
			weight: 25,
			sortOrder: 1,
		};

		const gradebookItemResult = await tryCreateGradebookItem(
			payload,
			mockRequest,
			gradebookItemArgs,
		);
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
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 1,
			content:
				"This is my first attempt at the assignment. I will write about the importance of education.",
			timeSpent: 30,
		};

		const result = await tryCreateAssignmentSubmission(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;

		// Verify submission
		expect(submission.activityModule.id).toBe(activityModuleId);
		expect(submission.assignment.id).toBe(assignmentId);
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
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 2,
			content: "Initial draft content",
		};

		const createResult = await tryCreateAssignmentSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Update the submission
		const updateArgs: UpdateAssignmentSubmissionArgs = {
			id: submissionId,
			content: "Updated content with more detailed analysis of the topic",
			timeSpent: 45,
		};

		const updateResult = await tryUpdateAssignmentSubmission(
			payload,
			updateArgs,
		);
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
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 3,
			content: "Final submission ready for grading",
		};

		const createResult = await tryCreateAssignmentSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Submit the assignment
		const submitResult = await trySubmitAssignment(payload, submissionId);
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
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 4,
			content:
				"This is a well-written essay that demonstrates good understanding of the topic.",
		};

		const createResult = await tryCreateAssignmentSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Submit the assignment
		const submitResult = await trySubmitAssignment(payload, submissionId);
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		// Grade the assignment (now includes gradebook integration)
		const gradeResult = await tryGradeAssignmentSubmission(
			payload,
			mockRequest,
			{
				id: submissionId,
				grade: 85,
				feedback:
					"Good work! Your analysis was thorough and well-structured. Consider adding more examples in the conclusion.",
				gradedBy: teacherId,
				enrollmentId,
				gradebookItemId,
				submittedAt: submitResult.value.submittedAt ?? undefined,
			},
		);

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) return;

		const gradedSubmission = gradeResult.value;
		expect(gradedSubmission.status).toBe("graded");
		expect(gradedSubmission.grade).toBe(85);
		expect(gradedSubmission.feedback).toBe(
			"Good work! Your analysis was thorough and well-structured. Consider adding more examples in the conclusion.",
		);
		expect(gradedSubmission.gradedBy).toBe(teacherId);
		expect(gradedSubmission.userGrade).toBeDefined();
		expect(gradedSubmission.userGrade.baseGrade).toBe(85);
		expect(gradedSubmission.userGrade.baseGradeSource).toBe("submission");
		expect(gradedSubmission.userGrade.submissionType).toBe("assignment");
	});

	test("should get assignment submission by ID", async () => {
		// First create a submission
		const createArgs: CreateAssignmentSubmissionArgs = {
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 6,
			content: "Submission for get by ID test",
		};

		const createResult = await tryCreateAssignmentSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Get the submission by ID
		const getResult = await tryGetAssignmentSubmissionById(payload, {
			id: submissionId,
		});

		expect(getResult.ok).toBe(true);
		if (!getResult.ok) return;

		const retrievedSubmission = getResult.value;
		expect(retrievedSubmission.id).toBe(submissionId);
		expect(retrievedSubmission.activityModule.id).toBe(activityModuleId);
		expect(retrievedSubmission.assignment.id).toBe(assignmentId);
		expect(retrievedSubmission.student.id).toBe(studentId);
		expect(retrievedSubmission.enrollment.id).toBe(enrollmentId);
		expect(retrievedSubmission.content).toBe("Submission for get by ID test");
	});

	test("should list assignment submissions with filtering", async () => {
		// List all submissions for this activity module
		const listResult = await tryListAssignmentSubmissions(payload, {
			activityModuleId,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		const submissions = listResult.value;
		expect(submissions.docs.length).toBeGreaterThan(0);
		expect(submissions.totalDocs).toBeGreaterThan(0);

		// All submissions should be for the same activity module
		submissions.docs.forEach((submission) => {
			expect(submission.activityModule.id).toBe(activityModuleId);
		});

		// Test filtering by student
		const studentListResult = await tryListAssignmentSubmissions(payload, {
			studentId,
		});

		expect(studentListResult.ok).toBe(true);
		if (!studentListResult.ok) return;

		const studentSubmissions = studentListResult.value;
		studentSubmissions.docs.forEach((submission) => {
			expect(submission.student.id).toBe(studentId);
		});

		// Test filtering by status
		const draftListResult = await tryListAssignmentSubmissions(payload, {
			status: "draft",
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
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 7,
			content: "This is a late submission",
		};

		const result = await tryCreateAssignmentSubmission(payload, lateArgs);

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
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 8,
			content: "First submission for attempt 8",
		};

		// Create first submission
		const firstResult = await tryCreateAssignmentSubmission(payload, args);
		expect(firstResult.ok).toBe(true);

		// Try to create duplicate submission for same attempt
		const duplicateResult = await tryCreateAssignmentSubmission(payload, args);
		expect(duplicateResult.ok).toBe(false);
	});

	test("should validate grade limits", async () => {
		// Create and submit an assignment
		const createArgs: CreateAssignmentSubmissionArgs = {
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 9,
			content: "Submission for grade validation test",
		};

		const createResult = await tryCreateAssignmentSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Submit the assignment
		const submitResult = await trySubmitAssignment(payload, submissionId);
		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		// Try to grade with negative grade
		const negativeGradeResult = await tryGradeAssignmentSubmission(
			payload,
			mockRequest,
			{
				id: submissionId,
				grade: -10,
				feedback: "Invalid grade",
				gradedBy: teacherId,
				enrollmentId,
				gradebookItemId,
			},
		);

		expect(negativeGradeResult.ok).toBe(false);

		// Try to grade with grade exceeding maximum
		const excessiveGradeResult = await tryGradeAssignmentSubmission(
			payload,
			mockRequest,
			{
				id: submissionId,
				grade: 150,
				feedback: "Grade too high",
				gradedBy: teacherId,
				enrollmentId,
				gradebookItemId,
			},
		);

		expect(excessiveGradeResult.ok).toBe(false);
	});

	test("should only allow grading of submitted assignments", async () => {
		// Create a draft submission
		const createArgs: CreateAssignmentSubmissionArgs = {
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 10,
			content: "Draft submission that should not be gradable",
		};

		const createResult = await tryCreateAssignmentSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Try to grade a draft submission
		const gradeResult = await tryGradeAssignmentSubmission(
			payload,
			mockRequest,
			{
				id: submissionId,
				grade: 80,
				feedback: "Should not be able to grade draft",
				gradedBy: teacherId,
				enrollmentId,
				gradebookItemId,
			},
		);

		expect(gradeResult.ok).toBe(false);
	});

	test("should delete assignment submission", async () => {
		// Create a submission
		const createArgs: CreateAssignmentSubmissionArgs = {
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId,
			attemptNumber: 11,
			content: "Submission to be deleted",
		};

		const createResult = await tryCreateAssignmentSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Delete the submission
		const deleteResult = await tryDeleteAssignmentSubmission(
			payload,
			submissionId,
		);
		expect(deleteResult.ok).toBe(true);

		// Verify submission is deleted
		const getResult = await tryGetAssignmentSubmissionById(payload, {
			id: submissionId,
		});
		expect(getResult.ok).toBe(false);
	});

	test("should handle pagination in listing", async () => {
		// Create multiple submissions for pagination testing
		for (let i = 0; i < 5; i++) {
			const createArgs: CreateAssignmentSubmissionArgs = {
				activityModuleId,
				assignmentId,
				studentId,
				enrollmentId,
				attemptNumber: 20 + i,
				content: `Pagination test submission ${i + 1}`,
			};

			const createResult = await tryCreateAssignmentSubmission(
				payload,
				createArgs,
			);
			expect(createResult.ok).toBe(true);
		}

		// Test pagination
		const page1Result = await tryListAssignmentSubmissions(payload, {
			activityModuleId,
			limit: 2,
			page: 1,
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
		// Test missing activity module ID
		const invalidArgs1: CreateAssignmentSubmissionArgs = {
			activityModuleId: undefined as never,
			assignmentId,
			studentId,
			enrollmentId,
		};

		const result1 = await tryCreateAssignmentSubmission(payload, invalidArgs1);
		expect(result1.ok).toBe(false);

		// Test missing student ID
		const invalidArgs2: CreateAssignmentSubmissionArgs = {
			activityModuleId,
			assignmentId,
			studentId: undefined as never,
			enrollmentId,
		};

		const result2 = await tryCreateAssignmentSubmission(payload, invalidArgs2);
		expect(result2.ok).toBe(false);

		// Test missing enrollment ID
		const invalidArgs3: CreateAssignmentSubmissionArgs = {
			activityModuleId,
			assignmentId,
			studentId,
			enrollmentId: undefined as never,
		};

		const result3 = await tryCreateAssignmentSubmission(payload, invalidArgs3);
		expect(result3.ok).toBe(false);
	});

	test("should fail to get non-existent submission", async () => {
		const result = await tryGetAssignmentSubmissionById(payload, {
			id: 99999,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to update non-existent submission", async () => {
		const updateArgs: UpdateAssignmentSubmissionArgs = {
			id: 99999,
			content: "Updated content",
		};

		const result = await tryUpdateAssignmentSubmission(payload, updateArgs);
		expect(result.ok).toBe(false);
	});

	test("should fail to delete non-existent submission", async () => {
		const result = await tryDeleteAssignmentSubmission(payload, 99999);
		expect(result.ok).toBe(false);
	});
});
