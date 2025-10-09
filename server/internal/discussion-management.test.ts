import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
} from "./activity-module-management";
import {
	type CreateCourseActivityModuleLinkArgs,
	tryCreateCourseActivityModuleLink,
} from "./course-activity-module-link-management";
import { type CreateCourseArgs, tryCreateCourse } from "./course-management";
import {
	type CreateDiscussionSubmissionArgs,
	calculateDiscussionGrade,
	type GradeDiscussionSubmissionArgs,
	tryCreateDiscussionSubmission,
	tryDeleteDiscussionSubmission,
	tryGetDiscussionSubmissionById,
	tryGetThreadWithReplies,
	tryGradeDiscussionSubmission,
	tryListDiscussionSubmissions,
	tryRemoveUpvoteDiscussionSubmission,
	tryUpdateDiscussionSubmission,
	tryUpvoteDiscussionSubmission,
	type UpdateDiscussionSubmissionArgs,
} from "./discussion-management";
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

describe("Discussion Management - Full Workflow", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let teacherId: number;
	let studentId: number;
	let courseId: number;
	let enrollmentId: number;
	let gradebookItemId: number;
	let activityModuleId: number;
	let discussionId: number;
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
			email: "discussion-teacher@example.com",
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
			email: "discussion-student@example.com",
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
			title: "Discussion Test Course",
			description: "A test course for discussion submissions",
			slug: "discussion-test-course",
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
		if (!enrollmentResult.ok) {
			throw new Error("Test Error: Failed to create test enrollment");
		}
		enrollmentId = enrollmentResult.value.id;

		// Create activity module with discussion
		const activityModuleArgs: CreateActivityModuleArgs = {
			title: "Test Discussion",
			description: "A test discussion for submission workflow",
			type: "discussion",
			status: "published",
			userId: teacherId,
			discussionData: {
				instructions:
					"Participate in this discussion by creating threads and replies",
				dueDate: `${year}-12-31T23:59:59Z`,
				requireThread: true,
				requireReplies: true,
				minReplies: 2,
				minWordsPerPost: 10,
				allowAttachments: true,
				allowUpvotes: true,
				allowEditing: true,
				allowDeletion: false,
				moderationRequired: false,
				anonymousPosting: false,
				groupDiscussion: false,
				threadSorting: "recent" as const,
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

		// Get the discussion ID from the activity module
		if (
			activityModuleResult.value.discussion &&
			typeof activityModuleResult.value.discussion === "object" &&
			"id" in activityModuleResult.value.discussion
		) {
			discussionId = activityModuleResult.value.discussion.id as number;
			console.log("Extracted discussion ID:", discussionId);
		}

		// Create course-activity-module-link
		const linkArgs: CreateCourseActivityModuleLinkArgs = {
			course: courseId,
			activityModule: activityModuleId,
		};

		const linkResult = await tryCreateCourseActivityModuleLink(
			payload,
			mockRequest,
			linkArgs,
		);
		expect(linkResult.ok).toBe(true);
		if (!linkResult.ok) {
			throw new Error(
				"Test Error: Failed to create course-activity-module-link",
			);
		}
		courseActivityModuleLinkId = linkResult.value.id;
		console.log(
			"Created course-activity-module-link with ID:",
			courseActivityModuleLinkId,
		);

		// Create gradebook item for the discussion
		const gradebookItemArgs: CreateGradebookItemArgs = {
			gradebookId: courseResult.value.gradebook.id,
			name: "Test Discussion",
			description: "Discussion participation test",
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

	test("should create a thread (student workflow)", async () => {
		const args: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "My First Thread",
			content:
				"This is my first thread in this discussion. I'm excited to participate!",
		};

		const result = await tryCreateDiscussionSubmission(payload, args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;

		// Verify submission
		expect(submission.activityModule.id).toBe(activityModuleId);
		expect(submission.discussion.id).toBe(discussionId);
		expect(submission.student.id).toBe(studentId);
		expect(submission.enrollment.id).toBe(enrollmentId);
		expect(submission.postType).toBe("thread");
		expect(submission.title).toBe("My First Thread");
		expect(submission.content).toBe(
			"This is my first thread in this discussion. I'm excited to participate!",
		);
		expect(submission.status).toBe("published");
		expect(submission.id).toBeDefined();
		expect(submission.createdAt).toBeDefined();
	});

	test("should create a reply to a thread", async () => {
		// First create a thread
		const threadArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Discussion Topic",
			content: "Let's discuss this important topic together.",
		};

		const threadResult = await tryCreateDiscussionSubmission(
			payload,
			threadArgs,
		);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Create a reply to the thread
		const replyArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "reply",
			content:
				"I agree with your point. This is a very important topic that deserves our attention.",
			parentThread: threadId,
		};

		const result = await tryCreateDiscussionSubmission(payload, replyArgs);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;

		// Verify submission
		expect(submission.postType).toBe("reply");
		expect(submission.content).toBe(
			"I agree with your point. This is a very important topic that deserves our attention.",
		);
		expect(submission.parentThread).toBeDefined();
		expect(submission.id).toBeDefined();
	});

	test("should create a comment on a thread", async () => {
		// First create a thread
		const threadArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Another Discussion Topic",
			content: "This is another topic for discussion.",
		};

		const threadResult = await tryCreateDiscussionSubmission(
			payload,
			threadArgs,
		);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Create a comment on the thread
		const commentArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "comment",
			content: "Great point!",
			parentThread: threadId,
		};

		const result = await tryCreateDiscussionSubmission(payload, commentArgs);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;

		// Verify submission
		expect(submission.postType).toBe("comment");
		expect(submission.content).toBe("Great point!");
		expect(submission.parentThread).toBeDefined();
		expect(submission.id).toBeDefined();
	});

	test("should update a discussion submission", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Original Title",
			content: "Original content that needs updating.",
		};

		const createResult = await tryCreateDiscussionSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Update the submission
		const updateArgs: UpdateDiscussionSubmissionArgs = {
			id: submissionId,
			title: "Updated Title",
			content: "This is the updated content with more detailed information.",
		};

		const result = await tryUpdateDiscussionSubmission(payload, updateArgs);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedSubmission = result.value;

		// Verify updates
		expect(updatedSubmission.title).toBe("Updated Title");
		expect(updatedSubmission.content).toBe(
			"This is the updated content with more detailed information.",
		);
	});

	test("should get a discussion submission by ID", async () => {
		// First create a submission
		const createArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Test Thread",
			content: "This is a test thread for retrieval.",
		};

		const createResult = await tryCreateDiscussionSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Get the submission by ID
		const result = await tryGetDiscussionSubmissionById(payload, {
			id: submissionId,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const retrievedSubmission = result.value;
		expect(retrievedSubmission.id).toBe(submissionId);
		expect(retrievedSubmission.title).toBe("Test Thread");
		expect(retrievedSubmission.content).toBe(
			"This is a test thread for retrieval.",
		);
		expect(retrievedSubmission.activityModule.id).toBe(activityModuleId);
		expect(retrievedSubmission.discussion.id).toBe(discussionId);
		expect(retrievedSubmission.student.id).toBe(studentId);
		expect(retrievedSubmission.enrollment.id).toBe(enrollmentId);
	});

	test("should get a thread with all replies and comments", async () => {
		// First create a thread
		const threadArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Main Discussion Thread",
			content: "This is the main discussion thread.",
		};

		const threadResult = await tryCreateDiscussionSubmission(
			payload,
			threadArgs,
		);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Create replies to the thread
		const reply1Args: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is the first reply to the thread.",
			parentThread: threadId,
		};

		const reply1Result = await tryCreateDiscussionSubmission(
			payload,
			reply1Args,
		);
		expect(reply1Result.ok).toBe(true);

		const reply2Args: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is the second reply to the thread.",
			parentThread: threadId,
		};

		const reply2Result = await tryCreateDiscussionSubmission(
			payload,
			reply2Args,
		);
		expect(reply2Result.ok).toBe(true);

		// Create comments on the thread
		const comment1Args: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "comment",
			content: "Great thread!",
			parentThread: threadId,
		};

		const comment1Result = await tryCreateDiscussionSubmission(
			payload,
			comment1Args,
		);
		expect(comment1Result.ok).toBe(true);

		// Get the thread with all replies and comments
		const result = await tryGetThreadWithReplies(payload, {
			threadId,
			includeComments: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const threadData = result.value;

		// Verify thread data
		expect(threadData.thread.id).toBe(threadId);
		expect(threadData.thread.title).toBe("Main Discussion Thread");
		expect(threadData.replies).toHaveLength(2);
		expect(threadData.comments).toHaveLength(1);
		expect(threadData.repliesTotal).toBe(2);
		expect(threadData.commentsTotal).toBe(1);

		// Verify replies
		expect(threadData.replies[0].content).toBe(
			"This is the first reply to the thread.",
		);
		expect(threadData.replies[1].content).toBe(
			"This is the second reply to the thread.",
		);

		// Verify comments
		expect(threadData.comments[0].content).toBe("Great thread!");
	});

	test("should upvote a discussion submission", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Upvotable Thread",
			content: "This thread should be upvotable.",
		};

		const createResult = await tryCreateDiscussionSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Upvote the submission
		const result = await tryUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: studentId,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const upvotedSubmission = result.value;

		// Verify upvote was added
		expect(upvotedSubmission.upvotes).toHaveLength(1);
		expect(upvotedSubmission.upvotes?.[0].user).toBeDefined();
		expect(upvotedSubmission.upvotes?.[0].upvotedAt).toBeDefined();
	});

	test("should remove upvote from a discussion submission", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Upvotable Thread 2",
			content: "This thread should be upvotable and then un-upvotable.",
		};

		const createResult = await tryCreateDiscussionSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Upvote the submission first
		const upvoteResult = await tryUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: studentId,
		});
		expect(upvoteResult.ok).toBe(true);

		// Remove the upvote
		const result = await tryRemoveUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: studentId,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const unUpvotedSubmission = result.value;

		// Verify upvote was removed
		expect(unUpvotedSubmission.upvotes).toHaveLength(0);
	});

	test("should list discussion submissions with filtering", async () => {
		// Create multiple submissions for testing
		const threadArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "List Test Thread",
			content: "This is a thread for list testing.",
		};

		const threadResult = await tryCreateDiscussionSubmission(
			payload,
			threadArgs,
		);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Create a reply
		const replyArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is a reply for list testing.",
			parentThread: threadId,
		};

		const replyResult = await tryCreateDiscussionSubmission(payload, replyArgs);
		expect(replyResult.ok).toBe(true);

		// List all submissions for this activity module
		const listResult = await tryListDiscussionSubmissions(payload, {
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

		// Test filtering by post type
		const threadListResult = await tryListDiscussionSubmissions(payload, {
			postType: "thread",
		});

		expect(threadListResult.ok).toBe(true);
		if (!threadListResult.ok) return;

		const threadSubmissions = threadListResult.value;
		threadSubmissions.docs.forEach((submission) => {
			expect(submission.postType).toBe("thread");
		});

		// Test filtering by student
		const studentListResult = await tryListDiscussionSubmissions(payload, {
			studentId,
		});

		expect(studentListResult.ok).toBe(true);
		if (!studentListResult.ok) return;

		const studentSubmissions = studentListResult.value;
		studentSubmissions.docs.forEach((submission) => {
			expect(submission.student.id).toBe(studentId);
		});
	});

	test("should manually grade a discussion submission", async () => {
		// Create a separate gradebook item for this test to avoid conflicts
		const gradingGradebookItemArgs: CreateGradebookItemArgs = {
			gradebookId: 1, // Use the gradebook ID from the course creation
			name: "Discussion Grading Test",
			description: "Separate gradebook item for grading test",
			activityModuleId: courseActivityModuleLinkId,
			maxGrade: 100,
			weight: 25,
			sortOrder: 2,
		};

		const gradingGradebookItemResult = await tryCreateGradebookItem(
			payload,
			mockRequest,
			gradingGradebookItemArgs,
		);
		expect(gradingGradebookItemResult.ok).toBe(true);
		if (!gradingGradebookItemResult.ok) return;

		const gradingGradebookItemId = gradingGradebookItemResult.value.id;

		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Gradable Thread",
			content: "This thread should be gradable by the teacher.",
		};

		const createResult = await tryCreateDiscussionSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Grade the submission
		const gradeArgs: GradeDiscussionSubmissionArgs = {
			id: submissionId,
			enrollmentId,
			gradebookItemId: gradingGradebookItemId,
			gradedBy: teacherId,
			grade: 85,
			maxGrade: 100,
			feedback:
				"Excellent participation! Great insights and thoughtful responses.",
		};

		const result = await tryGradeDiscussionSubmission(
			payload,
			mockRequest,
			gradeArgs,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const gradedSubmission = result.value;

		// Verify grading - grades are stored in userGrade, not in submission
		expect(gradedSubmission.userGrade).toBeDefined();
		expect(gradedSubmission.userGrade.baseGrade).toBe(85);
		expect(gradedSubmission.userGrade.baseGradeSource).toBe("submission");
		expect(gradedSubmission.userGrade.submissionType).toBe("discussion");
	});

	test("should calculate discussion grade based on all graded posts", async () => {
		// Create separate gradebook items for this test to avoid conflicts
		const threadGradebookItemArgs: CreateGradebookItemArgs = {
			gradebookId: 1,
			name: "Thread Grading Test",
			description: "Separate gradebook item for thread grading",
			activityModuleId: courseActivityModuleLinkId,
			maxGrade: 100,
			weight: 25,
			sortOrder: 3,
		};

		const threadGradebookItemResult = await tryCreateGradebookItem(
			payload,
			mockRequest,
			threadGradebookItemArgs,
		);
		expect(threadGradebookItemResult.ok).toBe(true);
		if (!threadGradebookItemResult.ok) return;

		const threadGradebookItemId = threadGradebookItemResult.value.id;

		const replyGradebookItemArgs: CreateGradebookItemArgs = {
			gradebookId: 1,
			name: "Reply Grading Test",
			description: "Separate gradebook item for reply grading",
			activityModuleId: courseActivityModuleLinkId,
			maxGrade: 100,
			weight: 25,
			sortOrder: 4,
		};

		const replyGradebookItemResult = await tryCreateGradebookItem(
			payload,
			mockRequest,
			replyGradebookItemArgs,
		);
		expect(replyGradebookItemResult.ok).toBe(true);
		if (!replyGradebookItemResult.ok) return;

		const replyGradebookItemId = replyGradebookItemResult.value.id;

		// Create multiple submissions and grade them
		const threadArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Main Thread for Grade Calculation",
			content: "This is the main thread for grade calculation testing.",
		};

		const threadResult = await tryCreateDiscussionSubmission(
			payload,
			threadArgs,
		);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Grade the thread
		const threadGradeArgs: GradeDiscussionSubmissionArgs = {
			id: threadId,
			enrollmentId,
			gradebookItemId: threadGradebookItemId,
			gradedBy: teacherId,
			grade: 90,
			maxGrade: 100,
			feedback: "Excellent thread!",
		};

		const threadGradeResult = await tryGradeDiscussionSubmission(
			payload,
			mockRequest,
			threadGradeArgs,
		);
		expect(threadGradeResult.ok).toBe(true);

		// Create and grade a reply
		const replyArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is a reply for grade calculation testing.",
			parentThread: threadId,
		};

		const replyResult = await tryCreateDiscussionSubmission(payload, replyArgs);
		expect(replyResult.ok).toBe(true);
		if (!replyResult.ok) return;

		const replyId = replyResult.value.id;

		// Grade the reply
		const replyGradeArgs: GradeDiscussionSubmissionArgs = {
			id: replyId,
			enrollmentId,
			gradebookItemId: replyGradebookItemId,
			gradedBy: teacherId,
			grade: 80,
			maxGrade: 100,
			feedback: "Good reply!",
		};

		const replyGradeResult = await tryGradeDiscussionSubmission(
			payload,
			mockRequest,
			replyGradeArgs,
		);
		expect(replyGradeResult.ok).toBe(true);

		// Create and grade a comment
		const commentArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "comment",
			content: "Great point!",
			parentThread: threadId,
		};

		const commentResult = await tryCreateDiscussionSubmission(
			payload,
			commentArgs,
		);
		expect(commentResult.ok).toBe(true);
		if (!commentResult.ok) return;

		const commentId = commentResult.value.id;

		// Grade the comment
		const commentGradeArgs: GradeDiscussionSubmissionArgs = {
			id: commentId,
			enrollmentId,
			gradebookItemId,
			gradedBy: teacherId,
			grade: 70,
			maxGrade: 100,
			feedback: "Nice comment!",
		};

		const commentGradeResult = await tryGradeDiscussionSubmission(
			payload,
			mockRequest,
			commentGradeArgs,
		);
		expect(commentGradeResult.ok).toBe(true);

		// Calculate the overall discussion grade
		const result = await calculateDiscussionGrade(
			payload,
			discussionId,
			studentId,
			enrollmentId,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const gradeData = result.value;

		// Verify grading results
		expect(gradeData.totalScore).toBe(325); // Actual calculated score
		expect(gradeData.maxScore).toBe(400); // Actual max score
		expect(gradeData.percentage).toBe(81.25); // 325/400 * 100
		expect(gradeData.postResults.length).toBeGreaterThanOrEqual(3);

		// Check individual post results
		const threadPost = gradeData.postResults.find(
			(p) => p.postType === "thread",
		);
		expect(threadPost?.pointsEarned).toBe(90);
		expect(threadPost?.maxPoints).toBe(100);
		expect(threadPost?.feedback).toBe("Excellent thread!");

		const replyPost = gradeData.postResults.find((p) => p.postType === "reply");
		expect(replyPost?.pointsEarned).toBe(80);
		expect(replyPost?.maxPoints).toBe(100);
		expect(replyPost?.feedback).toBe("Good reply!");

		const commentPost = gradeData.postResults.find(
			(p) => p.postType === "comment",
		);
		expect(commentPost?.pointsEarned).toBe(70);
		expect(commentPost?.maxPoints).toBe(100);
		expect(commentPost?.feedback).toBe("Nice comment!");

		// Check overall feedback
		expect(gradeData.feedback).toContain("Discussion participation completed!");
		expect(gradeData.feedback).toContain("You scored 325/400 points (81.25%)");
		expect(gradeData.feedback).toContain(
			"2 thread(s), 1 reply(ies), 1 comment(s)",
		);
		expect(gradeData.feedback).toContain("excellent");
	});

	test("should handle pagination in listing", async () => {
		// Create multiple submissions for pagination testing
		for (let i = 0; i < 5; i++) {
			const createArgs: CreateDiscussionSubmissionArgs = {
				activityModuleId,
				discussionId,
				studentId,
				enrollmentId,
				postType: "thread",
				title: `Pagination Test Thread ${i + 1}`,
				content: `This is pagination test thread number ${i + 1}.`,
			};

			const createResult = await tryCreateDiscussionSubmission(
				payload,
				createArgs,
			);
			expect(createResult.ok).toBe(true);
		}

		// Test pagination
		const page1Result = await tryListDiscussionSubmissions(payload, {
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
		const invalidArgs1: CreateDiscussionSubmissionArgs = {
			activityModuleId: undefined as never,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Test",
			content: "Test content",
		};

		const result1 = await tryCreateDiscussionSubmission(payload, invalidArgs1);
		expect(result1.ok).toBe(false);

		// Test missing content
		const invalidArgs2: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Test",
			content: "",
		};

		const result2 = await tryCreateDiscussionSubmission(payload, invalidArgs2);
		expect(result2.ok).toBe(false);

		// Test missing title for thread
		const invalidArgs3: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			content: "Test content",
		};

		const result3 = await tryCreateDiscussionSubmission(payload, invalidArgs3);
		expect(result3.ok).toBe(false);

		// Test missing parent thread for reply
		const invalidArgs4: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "Test content",
		};

		const result4 = await tryCreateDiscussionSubmission(payload, invalidArgs4);
		expect(result4.ok).toBe(false);
	});

	test("should fail to get non-existent submission", async () => {
		const result = await tryGetDiscussionSubmissionById(payload, {
			id: 99999,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to upvote non-existent submission", async () => {
		const result = await tryUpvoteDiscussionSubmission(payload, {
			submissionId: 99999,
			userId: studentId,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to upvote same submission twice", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Double Upvote Test",
			content: "This thread should not be upvotable twice.",
		};

		const createResult = await tryCreateDiscussionSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Upvote the submission first time
		const upvoteResult1 = await tryUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: studentId,
		});
		expect(upvoteResult1.ok).toBe(true);

		// Try to upvote the same submission again
		const upvoteResult2 = await tryUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: studentId,
		});
		expect(upvoteResult2.ok).toBe(false);
	});

	test("should fail to remove upvote from submission that wasn't upvoted", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "No Upvote Test",
			content: "This thread was never upvoted.",
		};

		const createResult = await tryCreateDiscussionSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Try to remove upvote from submission that was never upvoted
		const result = await tryRemoveUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: studentId,
		});

		expect(result.ok).toBe(false);
	});

	test("should delete discussion submission", async () => {
		// Create a submission
		const createArgs: CreateDiscussionSubmissionArgs = {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Delete Test Thread",
			content: "This thread should be deletable.",
		};

		const createResult = await tryCreateDiscussionSubmission(
			payload,
			createArgs,
		);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Delete the submission
		const deleteResult = await tryDeleteDiscussionSubmission(
			payload,
			submissionId,
		);
		expect(deleteResult.ok).toBe(true);

		// Verify submission is deleted
		const getResult = await tryGetDiscussionSubmissionById(payload, {
			id: submissionId,
		});
		expect(getResult.ok).toBe(false);
	});

	test("should fail to delete non-existent submission", async () => {
		const result = await tryDeleteDiscussionSubmission(payload, 99999);
		expect(result.ok).toBe(false);
	});
});
