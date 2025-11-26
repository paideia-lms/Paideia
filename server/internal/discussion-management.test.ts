import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	CreateDiscussionModuleArgs,
	tryCreateDiscussionModule,
	type CreateActivityModuleArgs,
} from "./activity-module-management";
import {
	type CreateCourseActivityModuleLinkArgs,
	tryCreateCourseActivityModuleLink,
} from "./course-activity-module-link-management";
import { type CreateCourseArgs, tryCreateCourse } from "./course-management";
import { tryCreateSection } from "./course-section-management";
import {
	type CreateDiscussionSubmissionArgs,
	calculateDiscussionGrade,
	type GradeDiscussionSubmissionArgs,
	tryCreateDiscussionSubmission,
	tryDeleteDiscussionSubmission,
	tryGetDiscussionSubmissionById,
	tryGetDiscussionThreadsWithAllReplies,
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
import { type CreateUserArgs, tryCreateUser } from "./user-management";

const year = new Date().getFullYear();

describe("Discussion Management - Full Workflow", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let teacherId: number;
	let studentId: number;
	let courseId: number;
	let enrollmentId: number;
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
			payload,
			data: {
				email: "discussion-teacher@example.com",
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
				email: "discussion-student@example.com",
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

		// Create course
		const courseArgs: CreateCourseArgs = {
			payload,
			data: {
				title: "Discussion Test Course",
				description: "A test course for discussion submissions",
				slug: "discussion-test-course",
				createdBy: teacherId,
			},
			overrideAccess: true,
		};

		const courseResult = await tryCreateCourse(courseArgs);
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
			overrideAccess: true,
		};

		const enrollmentResult = await tryCreateEnrollment(enrollmentArgs);
		expect(enrollmentResult.ok).toBe(true);
		if (!enrollmentResult.ok) {
			throw new Error("Test Error: Failed to create test enrollment");
		}
		enrollmentId = enrollmentResult.value.id;

		// Create activity module with discussion
		const activityModuleArgs = {
			payload,
			title: "Test Discussion",
			description: "A test discussion for submission workflow",
			status: "published",
			userId: teacherId,

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
			overrideAccess: true,
		} satisfies CreateDiscussionModuleArgs;

		const activityModuleResult =
			await tryCreateDiscussionModule(activityModuleArgs);
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
		// Since DiscussionModuleResult is a discriminated union, we need to check the type first
		if (activityModuleResult.value.type === "discussion") {
			// Fetch the activity module with depth to get the discussion relationship
			const module = await payload.findByID({
				collection: "activity-modules",
				id: activityModuleId,
				depth: 1,
			});
			if (module.discussion) {
				discussionId =
					typeof module.discussion === "object" && "id" in module.discussion
						? module.discussion.id
						: (module.discussion as number);
				console.log("Extracted discussion ID:", discussionId);
			}
		}

		// Create a section for the course
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: courseId,
				title: "Test Section",
				description: "Test section for discussion submissions",
			},
			overrideAccess: true,
		});

		if (!sectionResult.ok) {
			throw new Error("Failed to create section");
		}

		// Create course-activity-module-link
		const linkArgs: CreateCourseActivityModuleLinkArgs = {
			payload,
			req: mockRequest,
			course: courseId,
			activityModule: activityModuleId,
			section: sectionResult.value.id,
			order: 0,
			overrideAccess: true,
		};

		const linkResult = await tryCreateCourseActivityModuleLink(linkArgs);
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

		// Note: Gradebook items are no longer required for grading discussion submissions
		// Grades are stored directly on submissions, not in user-grades
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
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "My First Thread",
			content:
				"This is my first thread in this discussion. I'm excited to participate!",
		};

		const result = await tryCreateDiscussionSubmission(args);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const submission = result.value;

		// Verify submission
		expect(submission.courseModuleLink).toBe(courseActivityModuleLinkId);
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
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Discussion Topic",
			content: "Let's discuss this important topic together.",
		};

		const threadResult = await tryCreateDiscussionSubmission(threadArgs);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Create a reply to the thread
		const replyArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "reply",
			content:
				"I agree with your point. This is a very important topic that deserves our attention.",
			parentThread: threadId,
		};

		const result = await tryCreateDiscussionSubmission(replyArgs);

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
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Another Discussion Topic",
			content: "This is another topic for discussion.",
		};

		const threadResult = await tryCreateDiscussionSubmission(threadArgs);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Create a comment on the thread
		const commentArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "comment",
			content: "Great point!",
			parentThread: threadId,
		};

		const result = await tryCreateDiscussionSubmission(commentArgs);

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
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Original Title",
			content: "Original content that needs updating.",
		};

		const createResult = await tryCreateDiscussionSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Update the submission
		const updateArgs: UpdateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			id: submissionId,
			title: "Updated Title",
			content: "This is the updated content with more detailed information.",
		};

		const result = await tryUpdateDiscussionSubmission(updateArgs);

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
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Test Thread",
			content: "This is a test thread for retrieval.",
		};

		const createResult = await tryCreateDiscussionSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Get the submission by ID
		const result = await tryGetDiscussionSubmissionById({
			payload,
			req: mockRequest,
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
		expect(retrievedSubmission.courseModuleLink).toBe(
			courseActivityModuleLinkId,
		);
		expect(retrievedSubmission.student.id).toBe(studentId);
		expect(retrievedSubmission.enrollment.id).toBe(enrollmentId);
	});

	test("should get all threads with nested replies (reply to reply)", async () => {
		// Create a thread
		const threadArgs: CreateDiscussionSubmissionArgs = {
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Thread with Nested Replies",
			content: "This is a thread that will have nested replies.",
		};

		const threadResult = await tryCreateDiscussionSubmission(threadArgs);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;
		console.log("Created thread with ID:", threadId);

		// Create a reply to the thread
		const reply1Args: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is the first reply to the thread.",
			parentThread: threadId,
		};

		const reply1Result = await tryCreateDiscussionSubmission(reply1Args);
		expect(reply1Result.ok).toBe(true);
		if (!reply1Result.ok) return;

		const reply1Id = reply1Result.value.id;
		console.log("Created reply 1 with ID:", reply1Id);

		// Create a reply to the reply (nested reply)
		const reply2Args: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is a reply to the first reply (nested reply).",
			parentThread: reply1Id,
		};

		const reply2Result = await tryCreateDiscussionSubmission(reply2Args);
		expect(reply2Result.ok).toBe(true);
		if (!reply2Result.ok) return;

		const reply2Id = reply2Result.value.id;
		console.log("Created reply 2 (nested) with ID:", reply2Id);

		// Get all threads with all replies
		const result = await tryGetDiscussionThreadsWithAllReplies({
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const threadsData = result.value;

		// Find the thread we created
		const threadData = threadsData.threads.find(
			(t) => t.thread.id === threadId,
		);
		expect(threadData).toBeDefined();
		if (!threadData) return;

		// Verify thread structure
		expect(threadData.thread.id).toBe(threadId);
		expect(threadData.thread.title).toBe("Thread with Nested Replies");
		expect(threadData.replies.length).toBe(1); // Should have one top-level reply

		// Verify the first reply exists and has nested replies
		const firstReply = threadData.replies[0]!;
		expect(firstReply).toBeDefined();
		expect(firstReply.id).toBe(reply1Id);
		expect(firstReply.content).toBe("This is the first reply to the thread.");
		expect(firstReply.postType).toBe("reply");
		expect(firstReply.replies.length).toBe(1); // Should have one nested reply

		// Verify the nested reply (reply to reply)
		const nestedReply = firstReply.replies[0]!;
		expect(nestedReply).toBeDefined();
		expect(nestedReply.id).toBe(reply2Id);
		expect(nestedReply.content).toBe(
			"This is a reply to the first reply (nested reply).",
		);
		expect(nestedReply.postType).toBe("reply");
		expect(nestedReply.parentThreadId).toBe(reply1Id); // Parent should be reply1, not thread

		// Verify the data shape: thread: { replies: { replies, ... }[], ... }
		expect(threadData.thread).toBeDefined();
		expect(Array.isArray(threadData.replies)).toBe(true);
		expect(firstReply.replies).toBeDefined();
		expect(Array.isArray(firstReply.replies)).toBe(true);
	});

	test("should get all threads with all replies and comments for a course module link", async () => {
		// First create a thread
		const threadArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Main Discussion Thread",
			content: "This is the main discussion thread.",
		};

		const threadResult = await tryCreateDiscussionSubmission(threadArgs);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Create replies to the thread
		const reply1Args: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is the first reply to the thread.",
			parentThread: threadId,
		};

		const reply1Result = await tryCreateDiscussionSubmission(reply1Args);
		expect(reply1Result.ok).toBe(true);

		const reply2Args: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is the second reply to the thread.",
			parentThread: threadId,
		};

		const reply2Result = await tryCreateDiscussionSubmission(reply2Args);
		expect(reply2Result.ok).toBe(true);

		// Create comments on the thread
		const comment1Args: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "comment",
			content: "Great thread!",
			parentThread: threadId,
		};

		const comment1Result = await tryCreateDiscussionSubmission(comment1Args);
		expect(comment1Result.ok).toBe(true);

		// Get all threads with all replies and comments for this course module link
		const result = await tryGetDiscussionThreadsWithAllReplies({
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const threadsData = result.value;

		// Verify we got at least one thread
		expect(threadsData.totalThreads).toBeGreaterThan(0);
		expect(threadsData.threads.length).toBeGreaterThan(0);

		// Find the thread we created
		const threadData = threadsData.threads.find(
			(t) => t.thread.id === threadId,
		);
		expect(threadData).toBeDefined();
		if (!threadData) return;

		// Verify thread data
		expect(threadData.thread.id).toBe(threadId);
		expect(threadData.thread.title).toBe("Main Discussion Thread");
		expect(threadData.replies.length).toBeGreaterThanOrEqual(2);
		expect(threadData.repliesTotal).toBeGreaterThanOrEqual(2);
		expect(threadData.commentsTotal).toBeGreaterThanOrEqual(1);

		// Verify replies exist
		const replyContents = threadData.replies.map((r) => r.content);
		expect(replyContents).toContain("This is the first reply to the thread.");
		expect(replyContents).toContain("This is the second reply to the thread.");

		// Verify comments exist (they should be nested in replies or as top-level items)
		// Comments are now part of the replies structure, so we need to check all replies recursively
		type NestedReply = (typeof threadData.replies)[number];
		const getAllContents = (replies: NestedReply[]): string[] => {
			const contents: string[] = [];
			for (const reply of replies) {
				contents.push(reply.content);
				if (reply.replies.length > 0) {
					contents.push(...getAllContents(reply.replies));
				}
			}
			return contents;
		};
		const allContents = getAllContents(threadData.replies);
		expect(allContents).toContain("Great thread!");
	});

	test("should upvote a discussion submission", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Upvotable Thread",
			content: "This thread should be upvotable.",
		};

		const createResult = await tryCreateDiscussionSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Upvote the submission
		const result = await tryUpvoteDiscussionSubmission({
			payload,
			req: mockRequest,
			submissionId,
			userId: studentId,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const upvotedSubmission = result.value;

		// Verify upvote was added
		expect(upvotedSubmission.upvotes).toHaveLength(1);
		const firstUpvote = upvotedSubmission.upvotes?.[0]!;
		expect(firstUpvote.user).toBeDefined();
		expect(firstUpvote.upvotedAt).toBeDefined();
	});

	test("should remove upvote from a discussion submission", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Upvotable Thread 2",
			content: "This thread should be upvotable and then un-upvotable.",
			overrideAccess: true,
		};

		const createResult = await tryCreateDiscussionSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Upvote the submission first
		const upvoteResult = await tryUpvoteDiscussionSubmission({
			payload,
			req: mockRequest,
			submissionId,
			userId: studentId,
			overrideAccess: true,
		});
		expect(upvoteResult.ok).toBe(true);

		// Remove the upvote
		const result = await tryRemoveUpvoteDiscussionSubmission({
			payload,
			req: mockRequest,
			submissionId,
			userId: studentId,
			overrideAccess: true,
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
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "List Test Thread",
			content: "This is a thread for list testing.",
		};

		const threadResult = await tryCreateDiscussionSubmission(threadArgs);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Create a reply
		const replyArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is a reply for list testing.",
			parentThread: threadId,
		};

		const replyResult = await tryCreateDiscussionSubmission(replyArgs);
		expect(replyResult.ok).toBe(true);

		// List all submissions for this course module link
		const listResult = await tryListDiscussionSubmissions({
			payload,
			courseModuleLinkId: courseActivityModuleLinkId,
			overrideAccess: true,
		});

		expect(listResult.ok).toBe(true);
		if (!listResult.ok) return;

		const submissions = listResult.value;
		expect(submissions.length).toBeGreaterThan(0);

		// All submissions should be for the same course module link
		submissions.forEach((submission) => {
			expect(submission.courseModuleLink.id).toBe(courseActivityModuleLinkId);
		});

		// Test filtering by post type
		const threadListResult = await tryListDiscussionSubmissions({
			payload,
			postType: "thread",
			overrideAccess: true,
		});

		expect(threadListResult.ok).toBe(true);
		if (!threadListResult.ok) return;

		const threadSubmissions = threadListResult.value;
		threadSubmissions.forEach((submission) => {
			expect(submission.postType).toBe("thread");
		});

		// Test filtering by student
		const studentListResult = await tryListDiscussionSubmissions({
			payload,
			studentId,
			overrideAccess: true,
		});

		expect(studentListResult.ok).toBe(true);
		if (!studentListResult.ok) return;

		const studentSubmissions = studentListResult.value;

		studentSubmissions.forEach((submission) => {
			expect(submission.student.id).toBe(studentId);
		});
	});

	test("should manually grade a discussion submission", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Gradable Thread",
			content: "This thread should be gradable by the teacher.",
		};

		const createResult = await tryCreateDiscussionSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Grade the submission
		const gradeArgs: GradeDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			id: submissionId,
			gradedBy: teacherId,
			grade: 85,
			feedback:
				"Excellent participation! Great insights and thoughtful responses.",
			overrideAccess: true,
		};

		const result = await tryGradeDiscussionSubmission(gradeArgs);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const gradedSubmission = result.value;

		// Verify grading - grades are now stored directly on the submission
		const submissionWithGrade = gradedSubmission as typeof gradedSubmission & {
			grade?: number | null;
			feedback?: string | null;
			gradedBy?: number | { id: number } | null;
			gradedAt?: string | null;
		};
		expect(submissionWithGrade.grade).toBe(85);
		expect(submissionWithGrade.feedback).toBe(
			"Excellent participation! Great insights and thoughtful responses.",
		);
		expect(submissionWithGrade.gradedBy).toBeDefined();
		expect(submissionWithGrade.gradedAt).toBeDefined();

		// Verify gradedBy is the teacher
		const gradedById =
			typeof submissionWithGrade.gradedBy === "object" &&
			submissionWithGrade.gradedBy !== null &&
			"id" in submissionWithGrade.gradedBy
				? submissionWithGrade.gradedBy.id
				: submissionWithGrade.gradedBy;
		expect(gradedById).toBe(teacherId);
	});

	test("should calculate discussion grade based on all graded posts", async () => {
		// Note: This test may need updates when calculateDiscussionGrade is updated
		// to read grades from submissions instead of user-grades

		// Create multiple submissions and grade them
		const threadArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Main Thread for Grade Calculation",
			content: "This is the main thread for grade calculation testing.",
		};

		const threadResult = await tryCreateDiscussionSubmission(threadArgs);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) return;

		const threadId = threadResult.value.id;

		// Grade the thread
		const threadGradeArgs: GradeDiscussionSubmissionArgs = {
			payload,
			req: {
				...mockRequest,
			},
			id: threadId,
			gradedBy: teacherId,
			grade: 90,
			feedback: "Excellent thread!",
			overrideAccess: true,
		};

		const threadGradeResult =
			await tryGradeDiscussionSubmission(threadGradeArgs);
		expect(threadGradeResult.ok).toBe(true);

		// Create and grade a reply
		const replyArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "This is a reply for grade calculation testing.",
			parentThread: threadId,
		};

		const replyResult = await tryCreateDiscussionSubmission(replyArgs);
		expect(replyResult.ok).toBe(true);
		if (!replyResult.ok) return;

		const replyId = replyResult.value.id;

		// Grade the reply
		const replyGradeArgs: GradeDiscussionSubmissionArgs = {
			payload,
			req: {
				...mockRequest,
			},
			id: replyId,
			gradedBy: teacherId,
			grade: 80,
			feedback: "Good reply!",
			overrideAccess: true,
		};

		const replyGradeResult = await tryGradeDiscussionSubmission(replyGradeArgs);
		expect(replyGradeResult.ok).toBe(true);

		// Create and grade a comment
		const commentArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "comment",
			content: "Great point!",
			parentThread: threadId,
		};

		const commentResult = await tryCreateDiscussionSubmission(commentArgs);
		expect(commentResult.ok).toBe(true);
		if (!commentResult.ok) return;

		const commentId = commentResult.value.id;

		// Grade the comment
		const commentGradeArgs: GradeDiscussionSubmissionArgs = {
			payload,
			req: {
				...mockRequest,
			},
			id: commentId,
			gradedBy: teacherId,
			grade: 70,
			feedback: "Nice comment!",
			overrideAccess: true,
		};

		const commentGradeResult =
			await tryGradeDiscussionSubmission(commentGradeArgs);
		expect(commentGradeResult.ok).toBe(true);

		// Calculate the overall discussion grade
		const result = await calculateDiscussionGrade({
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
		});

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

	test("should fail with invalid arguments", async () => {
		// Test missing course module link ID
		const invalidArgs1: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: undefined as never,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Test",
			content: "Test content",
		};

		const result1 = await tryCreateDiscussionSubmission(invalidArgs1);
		expect(result1.ok).toBe(false);

		// Test missing content
		const invalidArgs2: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Test",
			content: "",
		};

		const result2 = await tryCreateDiscussionSubmission(invalidArgs2);
		expect(result2.ok).toBe(false);

		// Test missing title for thread
		const invalidArgs3: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			content: "Test content",
		};

		const result3 = await tryCreateDiscussionSubmission(invalidArgs3);
		expect(result3.ok).toBe(false);

		// Test missing parent thread for reply
		const invalidArgs4: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "reply",
			content: "Test content",
		};

		const result4 = await tryCreateDiscussionSubmission(invalidArgs4);
		expect(result4.ok).toBe(false);
	});

	test("should fail to get non-existent submission", async () => {
		const result = await tryGetDiscussionSubmissionById({
			payload,
			req: mockRequest,
			id: 99999,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to upvote non-existent submission", async () => {
		const result = await tryUpvoteDiscussionSubmission({
			payload,
			req: mockRequest,
			submissionId: 99999,
			userId: studentId,
		});

		expect(result.ok).toBe(false);
	});

	test("should fail to upvote same submission twice", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Double Upvote Test",
			content: "This thread should not be upvotable twice.",
		};

		const createResult = await tryCreateDiscussionSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Upvote the submission first time
		const upvoteResult1 = await tryUpvoteDiscussionSubmission({
			payload,
			req: mockRequest,
			submissionId,
			userId: studentId,
		});
		expect(upvoteResult1.ok).toBe(true);

		// Try to upvote the same submission again
		const upvoteResult2 = await tryUpvoteDiscussionSubmission({
			payload,
			req: mockRequest,
			submissionId,
			userId: studentId,
		});
		expect(upvoteResult2.ok).toBe(false);
	});

	test("should fail to remove upvote from submission that wasn't upvoted", async () => {
		// First create a thread
		const createArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "No Upvote Test",
			content: "This thread was never upvoted.",
		};

		const createResult = await tryCreateDiscussionSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Try to remove upvote from submission that was never upvoted
		const result = await tryRemoveUpvoteDiscussionSubmission({
			payload,
			req: mockRequest,
			submissionId,
			userId: studentId,
		});

		expect(result.ok).toBe(false);
	});

	test("should delete discussion submission", async () => {
		// Create a submission
		const createArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: mockRequest,
			courseModuleLinkId: courseActivityModuleLinkId,
			studentId,
			enrollmentId,
			postType: "thread",
			title: "Delete Test Thread",
			content: "This thread should be deletable.",
			overrideAccess: true,
		};

		const createResult = await tryCreateDiscussionSubmission(createArgs);
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const submissionId = createResult.value.id;

		// Delete the submission
		const deleteResult = await tryDeleteDiscussionSubmission({
			payload,
			req: mockRequest,
			id: submissionId,
			overrideAccess: true,
		});
		expect(deleteResult.ok).toBe(true);

		// Verify submission is deleted
		const getResult = await tryGetDiscussionSubmissionById({
			payload,
			req: mockRequest,
			id: submissionId,
			overrideAccess: true,
		});
		expect(getResult.ok).toBe(false);
	});

	test("should fail to delete non-existent submission", async () => {
		const result = await tryDeleteDiscussionSubmission({
			payload,
			req: mockRequest,
			id: 99999,
			overrideAccess: true,
		});
		expect(result.ok).toBe(false);
	});
});
