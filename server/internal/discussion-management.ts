import type { Payload } from "payload";
import { DiscussionSubmissions } from "server/collections";
import type { DiscussionSubmission } from "server/payload-types";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingDiscussionSubmissionError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryCreateUserGrade } from "./user-grade-management";

export interface CreateDiscussionSubmissionArgs {
	activityModuleId: number;
	discussionId: number;
	studentId: number;
	enrollmentId: number;
	postType: "thread" | "reply" | "comment";
	title?: string; // Required for threads
	content: string;
	parentThread?: number; // Required for replies and comments
}

export interface UpdateDiscussionSubmissionArgs {
	id: number;
	title?: string;
	content?: string;
	isPinned?: boolean;
	isLocked?: boolean;
}

export interface GradeDiscussionSubmissionArgs {
	id: number;
	enrollmentId: number;
	gradebookItemId: number;
	gradedBy: number;
	grade: number;
	maxGrade: number;
	feedback?: string;
	submittedAt?: string | number;
}

export interface GetDiscussionSubmissionByIdArgs {
	id: number | string;
}

export interface ListDiscussionSubmissionsArgs {
	activityModuleId?: number;
	discussionId?: number;
	studentId?: number;
	enrollmentId?: number;
	postType?: "thread" | "reply" | "comment";
	parentThread?: number;
	status?: "draft" | "published" | "archived";
	limit?: number;
	page?: number;
	sortBy?: "recent" | "upvoted" | "active" | "alphabetical";
}

export interface GetThreadWithRepliesArgs {
	threadId: number | string;
	includeComments?: boolean;
	limit?: number;
	page?: number;
}

export interface UpvoteDiscussionSubmissionArgs {
	submissionId: number;
	userId: number;
}

export interface RemoveUpvoteDiscussionSubmissionArgs {
	submissionId: number;
	userId: number;
}

export interface DiscussionGradingResult {
	totalScore: number;
	maxScore: number;
	percentage: number;
	postResults: Array<{
		postId: string;
		postType: string;
		title?: string;
		pointsEarned: number;
		maxPoints: number;
		feedback: string;
		gradedAt: string;
	}>;
	feedback: string;
}

/**
 * Creates a new discussion submission (thread, reply, or comment)
 */
export const tryCreateDiscussionSubmission = Result.wrap(
	async (payload: Payload, args: CreateDiscussionSubmissionArgs) => {
		const {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType,
			title,
			content,
			parentThread,
		} = args;

		// Validate required fields
		if (!activityModuleId) {
			throw new InvalidArgumentError("Activity module ID is required");
		}
		if (!discussionId) {
			throw new InvalidArgumentError("Discussion ID is required");
		}
		if (!studentId) {
			throw new InvalidArgumentError("Student ID is required");
		}
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}
		if (!postType) {
			throw new InvalidArgumentError("Post type is required");
		}
		if (!content || content.trim() === "") {
			throw new InvalidArgumentError("Content is required");
		}

		// Validate post type specific requirements
		if (postType === "thread" && (!title || title.trim() === "")) {
			throw new InvalidArgumentError("Title is required for threads");
		}
		if ((postType === "reply" || postType === "comment") && !parentThread) {
			throw new InvalidArgumentError(
				"Parent thread is required for replies and comments",
			);
		}

		// Get discussion to check due date and calculate if late
		const discussion = await payload.findByID({
			collection: "discussions",
			id: discussionId,
		});

		if (!discussion) {
			throw new InvalidArgumentError("Discussion not found");
		}

		const submission = await payload.create({
			collection: "discussion-submissions",
			data: {
				activityModule: activityModuleId,
				discussion: discussionId,
				student: studentId,
				enrollment: enrollmentId,
				postType,
				title: postType === "thread" ? title : undefined,
				content,
				parentThread: postType !== "thread" ? parentThread : undefined,
				status: "published",
				lastActivityAt: new Date().toISOString(),
			},
		});

		// If this is a reply or comment, update the parent thread's lastActivityAt
		if (parentThread && (postType === "reply" || postType === "comment")) {
			await payload.update({
				collection: "discussion-submissions",
				id: parentThread,
				data: {
					lastActivityAt: new Date().toISOString(),
				},
			});
		}

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = submission.activityModule;
		assertZod(
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const discussionRef = submission.discussion;
		assertZod(
			discussionRef,
			z.object({
				id: z.number(),
			}),
		);

		const student = submission.student;
		assertZod(
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = submission.enrollment;
		assertZod(
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...submission,
			activityModule,
			discussion: discussionRef,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create discussion submission", {
			cause: error,
		}),
);

/**
 * Updates a discussion submission
 */
export const tryUpdateDiscussionSubmission = Result.wrap(
	async (payload: Payload, args: UpdateDiscussionSubmissionArgs) => {
		const { id, title, content, isPinned, isLocked } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Discussion submission ID is required");
		}

		// Build update data object
		const updateData: Record<string, unknown> = {};
		if (title !== undefined) updateData.title = title;
		if (content !== undefined) {
			updateData.content = content;
			// Recalculate word count
			updateData.wordCount = content.trim().split(/\s+/).length;
		}
		if (isPinned !== undefined) updateData.isPinned = isPinned;
		if (isLocked !== undefined) updateData.isLocked = isLocked;

		// Update lastActivityAt
		updateData.lastActivityAt = new Date().toISOString();

		// Validate that at least one field is being updated
		if (Object.keys(updateData).length === 0) {
			throw new InvalidArgumentError(
				"At least one field must be provided for update",
			);
		}

		const updatedSubmission = await payload.update({
			collection: "discussion-submissions",
			id,
			data: updateData,
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = updatedSubmission.activityModule;
		assertZod(
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const discussion = updatedSubmission.discussion;
		assertZod(
			discussion,
			z.object({
				id: z.number(),
			}),
		);

		const student = updatedSubmission.student;
		assertZod(
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = updatedSubmission.enrollment;
		assertZod(
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedSubmission,
			activityModule,
			discussion,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update discussion submission", {
			cause: error,
		}),
);

/**
 * Gets a discussion submission by ID
 */
export const tryGetDiscussionSubmissionById = Result.wrap(
	async (payload: Payload, args: GetDiscussionSubmissionByIdArgs) => {
		const { id } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Discussion submission ID is required");
		}

		// Fetch the discussion submission
		const submissionResult = await payload.find({
			collection: "discussion-submissions",
			where: {
				and: [
					{
						id: { equals: id },
					},
				],
			},
			depth: 1, // Fetch related data
		});

		const submission = submissionResult.docs[0];

		if (!submission) {
			throw new NonExistingDiscussionSubmissionError(
				`Discussion submission with id '${id}' not found`,
			);
		}

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = submission.activityModule;
		assertZod(
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const discussion = submission.discussion;
		assertZod(
			discussion,
			z.object({
				id: z.number(),
			}),
		);

		const student = submission.student;
		assertZod(
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = submission.enrollment;
		assertZod(
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...submission,
			activityModule,
			discussion,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get discussion submission", {
			cause: error,
		}),
);

/**
 * Gets a thread with all its replies and comments
 */
export const tryGetThreadWithReplies = Result.wrap(
	async (payload: Payload, args: GetThreadWithRepliesArgs) => {
		const { threadId, includeComments = true, limit = 50, page = 1 } = args;

		// Validate ID
		if (!threadId) {
			throw new InvalidArgumentError("Thread ID is required");
		}

		// Get the main thread
		const threadResult = await tryGetDiscussionSubmissionById(payload, {
			id: threadId,
		});

		if (!threadResult.ok) {
			throw new InvalidArgumentError("Thread not found");
		}

		const thread = threadResult.value;

		// Verify it's actually a thread
		if (thread.postType !== "thread") {
			throw new InvalidArgumentError("Submission is not a thread");
		}

		// Get replies to the thread
		const repliesResult = await payload.find({
			collection: "discussion-submissions",
			where: {
				and: [
					{ parentThread: { equals: threadId } },
					{ postType: { equals: "reply" } },
					{ status: { equals: "published" } },
				],
			},
			depth: 1,
			limit,
			page,
			sort: "createdAt",
		});

		let comments: any[] = [];

		// Get comments if requested
		if (includeComments) {
			const commentsResult = await payload.find({
				collection: "discussion-submissions",
				where: {
					and: [
						{ parentThread: { equals: threadId } },
						{ postType: { equals: "comment" } },
						{ status: { equals: "published" } },
					],
				},
				depth: 1,
				limit: 100, // Comments are usually more numerous
				page: 1,
				sort: "createdAt",
			});

			comments = commentsResult.docs;
		}

		// Process replies and comments with type narrowing
		const replies = repliesResult.docs.map((reply) => {
			assertZod(
				reply.activityModule,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				reply.discussion,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				reply.student,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				reply.enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...reply,
				activityModule: reply.activityModule,
				discussion: reply.discussion,
				student: reply.student,
				enrollment: reply.enrollment,
			};
		});

		const processedComments = comments.map((comment) => {
			assertZod(
				comment.activityModule,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				comment.discussion,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				comment.student,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				comment.enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...comment,
				activityModule: comment.activityModule,
				discussion: comment.discussion,
				student: comment.student,
				enrollment: comment.enrollment,
			};
		});

		return {
			thread,
			replies,
			comments: processedComments,
			repliesTotal: repliesResult.totalDocs,
			commentsTotal: comments.length,
			repliesPage: repliesResult.page,
			repliesLimit: repliesResult.limit,
			hasNextRepliesPage: repliesResult.hasNextPage,
			hasPrevRepliesPage: repliesResult.hasPrevPage,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get thread with replies", {
			cause: error,
		}),
);

/**
 * Upvotes a discussion submission
 */
export const tryUpvoteDiscussionSubmission = Result.wrap(
	async (payload: Payload, args: UpvoteDiscussionSubmissionArgs) => {
		const { submissionId, userId } = args;

		// Validate required fields
		if (!submissionId) {
			throw new InvalidArgumentError("Submission ID is required");
		}
		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Get the current submission
		const submission = await payload.findByID({
			collection: "discussion-submissions",
			id: submissionId,
		});

		if (!submission) {
			throw new NonExistingDiscussionSubmissionError(
				`Discussion submission with id '${submissionId}' not found`,
			);
		}

		// Check if user has already upvoted
		const existingUpvotes = submission.upvotes || [];
		const hasUpvoted = existingUpvotes.some(
			(upvote: { user: number | { id: number } }) =>
				typeof upvote.user === "number"
					? upvote.user === userId
					: upvote.user.id === userId,
		);

		if (hasUpvoted) {
			throw new InvalidArgumentError(
				"User has already upvoted this submission",
			);
		}

		// Add the upvote
		const newUpvote = {
			user: userId,
			upvotedAt: new Date().toISOString(),
		};

		const updatedSubmission = await payload.update({
			collection: "discussion-submissions",
			id: submissionId,
			data: {
				upvotes: [...existingUpvotes, newUpvote],
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = updatedSubmission.activityModule;
		assertZod(
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const discussion = updatedSubmission.discussion;
		assertZod(
			discussion,
			z.object({
				id: z.number(),
			}),
		);

		const student = updatedSubmission.student;
		assertZod(
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = updatedSubmission.enrollment;
		assertZod(
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedSubmission,
			activityModule,
			discussion,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to upvote discussion submission", {
			cause: error,
		}),
);

/**
 * Removes upvote from a discussion submission
 */
export const tryRemoveUpvoteDiscussionSubmission = Result.wrap(
	async (payload: Payload, args: RemoveUpvoteDiscussionSubmissionArgs) => {
		const { submissionId, userId } = args;

		// Validate required fields
		if (!submissionId) {
			throw new InvalidArgumentError("Submission ID is required");
		}
		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Get the current submission
		const submission = await payload.findByID({
			collection: "discussion-submissions",
			id: submissionId,
		});

		if (!submission) {
			throw new NonExistingDiscussionSubmissionError(
				`Discussion submission with id '${submissionId}' not found`,
			);
		}

		// Remove the upvote
		const existingUpvotes = submission.upvotes || [];
		const filteredUpvotes = existingUpvotes.filter(
			(upvote: { user: number | { id: number } }) =>
				typeof upvote.user === "number"
					? upvote.user !== userId
					: upvote.user.id !== userId,
		);

		if (filteredUpvotes.length === existingUpvotes.length) {
			throw new InvalidArgumentError("User has not upvoted this submission");
		}

		const updatedSubmission = await payload.update({
			collection: "discussion-submissions",
			id: submissionId,
			data: {
				upvotes: filteredUpvotes,
			},
		});

		////////////////////////////////////////////////////
		// type narrowing
		////////////////////////////////////////////////////

		const activityModule = updatedSubmission.activityModule;
		assertZod(
			activityModule,
			z.object({
				id: z.number(),
			}),
		);

		const discussion = updatedSubmission.discussion;
		assertZod(
			discussion,
			z.object({
				id: z.number(),
			}),
		);

		const student = updatedSubmission.student;
		assertZod(
			student,
			z.object({
				id: z.number(),
			}),
		);

		const enrollment = updatedSubmission.enrollment;
		assertZod(
			enrollment,
			z.object({
				id: z.number(),
			}),
		);

		return {
			...updatedSubmission,
			activityModule,
			discussion,
			student,
			enrollment,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to remove upvote from discussion submission", {
			cause: error,
		}),
);

/**
 * Lists discussion submissions with filtering
 */
export const tryListDiscussionSubmissions = Result.wrap(
	async (payload: Payload, args: ListDiscussionSubmissionsArgs = {}) => {
		const {
			activityModuleId,
			discussionId,
			studentId,
			enrollmentId,
			postType,
			parentThread,
			status,
			limit = 10,
			page = 1,
			sortBy = "recent",
		} = args;

		const where: Record<string, { equals: unknown }> = {};

		if (activityModuleId) {
			where.activityModule = { equals: activityModuleId };
		}
		if (discussionId) {
			where.discussion = { equals: discussionId };
		}
		if (studentId) {
			where.student = { equals: studentId };
		}
		if (enrollmentId) {
			where.enrollment = { equals: enrollmentId };
		}
		if (postType) {
			where.postType = { equals: postType };
		}
		if (parentThread) {
			where.parentThread = { equals: parentThread };
		}
		if (status) {
			where.status = { equals: status };
		}

		// Determine sort order
		let sort: string;
		switch (sortBy) {
			case "upvoted":
				sort = "-upvoteCount";
				break;
			case "active":
				sort = "-lastActivityAt";
				break;
			case "alphabetical":
				sort = "title";
				break;
			case "recent":
			default:
				sort = "-createdAt";
				break;
		}

		const result = await payload.find({
			collection: "discussion-submissions",
			where,
			limit,
			page,
			sort,
			depth: 1, // Fetch related data
		});

		// type narrowing
		const docs = result.docs.map((doc) => {
			assertZod(
				doc.activityModule,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				doc.discussion,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				doc.student,
				z.object({
					id: z.number(),
				}),
			);
			assertZod(
				doc.enrollment,
				z.object({
					id: z.number(),
				}),
			);
			return {
				...doc,
				activityModule: doc.activityModule,
				discussion: doc.discussion,
				student: doc.student,
				enrollment: doc.enrollment,
			};
		});

		return {
			docs,
			totalDocs: result.totalDocs,
			totalPages: result.totalPages,
			page: result.page,
			limit: result.limit,
			hasNextPage: result.hasNextPage,
			hasPrevPage: result.hasPrevPage,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to list discussion submissions", {
			cause: error,
		}),
);

/**
 * Manually grades a discussion submission
 */
export const tryGradeDiscussionSubmission = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		args: GradeDiscussionSubmissionArgs,
	) => {
		const {
			id,
			enrollmentId,
			gradebookItemId,
			gradedBy,
			grade,
			maxGrade,
			feedback,
			submittedAt,
		} = args;

		// Validate required fields
		if (!id) {
			throw new InvalidArgumentError("Discussion submission ID is required");
		}
		if (!enrollmentId) {
			throw new InvalidArgumentError(
				"Enrollment ID is required for gradebook integration",
			);
		}
		if (!gradebookItemId) {
			throw new InvalidArgumentError(
				"Gradebook item ID is required for gradebook integration",
			);
		}
		if (grade < 0) {
			throw new InvalidArgumentError("Grade cannot be negative");
		}
		if (grade > maxGrade) {
			throw new InvalidArgumentError("Grade cannot exceed maximum grade");
		}

		// Start transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Get the current submission
			const currentSubmission = await payload.findByID({
				collection: DiscussionSubmissions.slug,
				id,
				req: { transactionID },
			});

			if (!currentSubmission) {
				throw new NonExistingDiscussionSubmissionError(
					`Discussion submission with id '${id}' not found`,
				);
			}

			// Get the current submission (no need to update it with grade info)
			const updatedSubmission = currentSubmission;

			// Create user grade in gradebook
			const submittedAtString =
				submittedAt !== undefined
					? String(submittedAt)
					: updatedSubmission.createdAt !== undefined
						? String(updatedSubmission.createdAt)
						: undefined;

			const userGradeResult = await tryCreateUserGrade(payload, request, {
				enrollmentId,
				gradebookItemId,
				baseGrade: grade,
				baseGradeSource: "submission",
				submission: id,
				submissionType: "discussion",
				feedback,
				gradedBy,
				submittedAt: submittedAtString,
				transactionID,
			});

			if (!userGradeResult.ok) {
				throw new Error(
					`Failed to create gradebook entry: ${userGradeResult.error}`,
				);
			}

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const activityModule = updatedSubmission.activityModule;
			assertZod(
				activityModule,
				z.object({
					id: z.number(),
				}),
			);

			const discussion = updatedSubmission.discussion;
			assertZod(
				discussion,
				z.object({
					id: z.number(),
				}),
			);

			const student = updatedSubmission.student;
			assertZod(
				student,
				z.object({
					id: z.number(),
				}),
			);

			const enrollment = updatedSubmission.enrollment;
			assertZod(
				enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...updatedSubmission,
				activityModule,
				discussion,
				student,
				enrollment,
				userGrade: userGradeResult.value,
			};
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to grade discussion submission", {
			cause: error,
		}),
);

/**
 * Calculates discussion grade based on all graded posts for a student
 */
export const calculateDiscussionGrade = Result.wrap(
	async (
		payload: Payload,
		discussionId: number,
		studentId: number,
		enrollmentId: number,
	): Promise<DiscussionGradingResult> => {
		// Get all discussion submissions for this student in this discussion
		const submissions = await payload
			.find({
				collection: "discussion-submissions",
				where: {
					and: [
						{ discussion: { equals: discussionId } },
						{ student: { equals: studentId } },
						{ enrollment: { equals: enrollmentId } },
						{ status: { equals: "published" } },
					],
				},
				pagination: false,
				depth: 1,
			})
			.then((result) => {
				// type narrowing
				return result.docs.map((doc) => {
					assertZod(
						doc.activityModule,
						z.object({
							id: z.number(),
						}),
					);

					assertZod(
						doc.discussion,
						z.object({
							id: z.number(),
						}),
					);

					assertZod(
						doc.student,
						z.object({
							id: z.number(),
						}),
					);

					assertZod(
						doc.enrollment,
						z.object({
							id: z.number(),
						}),
					);

					assertZod(
						doc.parentThread,
						z
							.object({
								id: z.number(),
							})
							.nullish(),
					);

					return {
						...doc,
						activityModule: doc.activityModule,
						discussion: doc.discussion,
						student: doc.student,
						enrollment: doc.enrollment,
						parentThread: doc.parentThread,
					};
				});
			});

		if (submissions.length === 0) {
			return {
				totalScore: 0,
				maxScore: 0,
				percentage: 0,
				postResults: [],
				feedback: "No posts found for this discussion.",
			};
		}

		// Get user grades for this enrollment and discussion type
		const userGradesResult = await payload
			.find({
				collection: "user-grades",
				where: {
					and: [
						{ enrollment: { equals: enrollmentId } },
						{ submissionType: { equals: "discussion" } },
					],
				},
				depth: 1,
			})
			.then((result) => {
				return result.docs.map((doc) => {
					// type narrowing
					assertZod(
						doc.submission,
						z
							.object({
								relationTo: z.string(),
								value: z.object({
									id: z.number(),
								}),
							})
							.nullish(),
					);

					return {
						...doc,
						submission: doc.submission as unknown as {
							relationTo: "discussion-submissions";
							value: DiscussionSubmission;
						},
					};
				});
			});

		const userGrades = userGradesResult;

		let totalScore = 0;
		let maxScore = 0;
		const postResults: Array<{
			postId: string;
			postType: string;
			title?: string;
			pointsEarned: number;
			maxPoints: number;
			feedback: string;
			gradedAt: string;
		}> = [];

		// Process each submission
		for (const submission of submissions) {
			const userGrade = userGrades.find((ug) => {
				return ug.submission?.value?.id === submission.id;
			});

			if (userGrade) {
				const pointsEarned = userGrade.baseGrade || 0;
				const maxPoints = userGrade.maxGrade || 100; // Default max grade

				totalScore += pointsEarned;
				maxScore += maxPoints;

				postResults.push({
					postId: submission.id.toString(),
					postType: submission.postType,
					title: submission.title || undefined,
					pointsEarned,
					maxPoints,
					feedback: userGrade.feedback || "No feedback provided",
					gradedAt: userGrade.gradedAt || submission.createdAt,
				});
			}
		}

		// Calculate percentage
		const percentage =
			maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 100) / 100 : 0;

		// Generate overall feedback
		const threadCount = postResults.filter(
			(p) => p.postType === "thread",
		).length;
		const replyCount = postResults.filter((p) => p.postType === "reply").length;
		const commentCount = postResults.filter(
			(p) => p.postType === "comment",
		).length;

		const overallFeedback = `Discussion participation completed! You scored ${totalScore}/${maxScore} points (${percentage}%). 
		Participation breakdown: ${threadCount} thread(s), ${replyCount} reply(ies), ${commentCount} comment(s). 
		Your overall performance in this discussion was ${percentage >= 80 ? "excellent" : percentage >= 60 ? "good" : "needs improvement"}.`;

		return {
			totalScore,
			maxScore,
			percentage,
			postResults,
			feedback: overallFeedback,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to calculate discussion grade", {
			cause: error,
		}),
);

/**
 * Deletes a discussion submission
 */
export const tryDeleteDiscussionSubmission = Result.wrap(
	async (payload: Payload, id: number) => {
		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Discussion submission ID is required");
		}

		// Check if submission exists
		const existingSubmission = await payload.findByID({
			collection: "discussion-submissions",
			id,
		});

		if (!existingSubmission) {
			throw new NonExistingDiscussionSubmissionError(
				`Discussion submission with id '${id}' not found`,
			);
		}

		const deletedSubmission = await payload.delete({
			collection: "discussion-submissions",
			id,
		});

		return deletedSubmission;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete discussion submission", {
			cause: error,
		}),
);
