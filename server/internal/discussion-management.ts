import { DiscussionSubmissions } from "server/collections";
import { assertZodInternal, MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingActivityModuleError,
	NonExistingDiscussionSubmissionError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryFindGradebookItemByCourseModuleLink } from "./gradebook-item-management";
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	type BaseInternalFunctionArgs,
	Depth,
	interceptPayloadError,
	stripDepth,
} from "./utils/internal-function-utils";
import { DiscussionSubmission } from "server/payload-types";

export interface CreateDiscussionSubmissionArgs
	extends BaseInternalFunctionArgs {
	courseModuleLinkId: number;
	studentId: number;
	enrollmentId: number;
	postType: "thread" | "reply" | "comment";
	title?: string; // Required for threads
	content: string;
	parentThread?: number; // Required for replies and comments
}

export interface UpdateDiscussionSubmissionArgs
	extends BaseInternalFunctionArgs {
	id: number;
	title?: string;
	content?: string;
	isPinned?: boolean;
	isLocked?: boolean;
}

export interface GradeDiscussionSubmissionArgs
	extends BaseInternalFunctionArgs {
	id: number;
	grade: number;
	feedback?: string;
	gradedBy: number;
}

export interface GetDiscussionSubmissionByIdArgs
	extends BaseInternalFunctionArgs {
	id: number | string;
}

export interface ListDiscussionSubmissionsArgs
	extends BaseInternalFunctionArgs {
	courseModuleLinkId?: number;
	studentId?: number;
	enrollmentId?: number;
	postType?: "thread" | "reply" | "comment";
	parentThread?: number;
	status?: "draft" | "published" | "archived";
	limit?: number;
	page?: number;
	sortBy?: "recent" | "upvoted" | "active" | "alphabetical";
}

export interface GetDiscussionThreadsWithAllRepliesArgs
	extends BaseInternalFunctionArgs {
	courseModuleLinkId: number;
}

export interface UpvoteDiscussionSubmissionArgs
	extends BaseInternalFunctionArgs {
	submissionId: number;
	userId: number;
}

export interface RemoveUpvoteDiscussionSubmissionArgs
	extends BaseInternalFunctionArgs {
	submissionId: number;
	userId: number;
}

export interface DiscussionGradingResult extends BaseInternalFunctionArgs {
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
export function tryCreateDiscussionSubmission(
	args: CreateDiscussionSubmissionArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				courseModuleLinkId,
				studentId,
				enrollmentId,
				postType,
				title,
				content,
				parentThread,
			} = args;

			// Validate required fields
			if (!courseModuleLinkId) {
				throw new InvalidArgumentError("Course module link ID is required");
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

			// Get course module link to verify it exists
			const courseModuleLink = await payload.findByID({
				collection: "course-activity-module-links",
				id: courseModuleLinkId,
			});

			if (!courseModuleLink) {
				throw new InvalidArgumentError("Course module link not found");
			}

			const submission = await payload.create({
				collection: "discussion-submissions",
				data: {
					courseModuleLink: courseModuleLinkId,
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

			const courseModuleLinkRef = submission.courseModuleLink;
			assertZodInternal(
				"tryCreateDiscussionSubmission: Course module link is required",
				courseModuleLinkRef,
				z.object({
					id: z.number(),
				}),
			);

			const student = submission.student;
			assertZodInternal(
				"tryCreateDiscussionSubmission: Student is required",
				student,
				z.object({
					id: z.number(),
				}),
			);

			const enrollment = submission.enrollment;
			assertZodInternal(
				"tryCreateDiscussionSubmission: Enrollment is required",
				enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...submission,
				courseModuleLink: courseModuleLinkRef.id,
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
}

/**
 * Updates a discussion submission
 */
export function tryUpdateDiscussionSubmission(
	args: UpdateDiscussionSubmissionArgs,
) {
	return Result.try(
		async () => {
			const { payload, id, title, content, isPinned, isLocked } = args;

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

			const courseModuleLinkRef = updatedSubmission.courseModuleLink;
			assertZodInternal(
				"tryUpdateDiscussionSubmission: Course module link is required",
				courseModuleLinkRef,
				z.object({
					id: z.number(),
				}),
			);

			const student = updatedSubmission.student;
			assertZodInternal(
				"tryUpdateDiscussionSubmission: Student is required",
				student,
				z.object({
					id: z.number(),
				}),
			);

			const enrollment = updatedSubmission.enrollment;
			assertZodInternal(
				"tryUpdateDiscussionSubmission: Enrollment is required",
				enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef,
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
}

/**
 * Gets a discussion submission by ID
 */
export function tryGetDiscussionSubmissionById(
	args: GetDiscussionSubmissionByIdArgs,
) {
	return Result.try(
		async () => {
			const { payload, id } = args;

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

			const courseModuleLinkRef = submission.courseModuleLink;
			assertZodInternal(
				"tryGetDiscussionSubmissionById: Course module link is required",
				courseModuleLinkRef,
				z.object({
					id: z.number(),
				}),
			);

			const student = submission.student;
			assertZodInternal(
				"tryGetDiscussionSubmissionById: Student is required",
				student,
				z.object({
					id: z.number(),
				}),
			);

			const enrollment = submission.enrollment;
			assertZodInternal(
				"tryGetDiscussionSubmissionById: Enrollment is required",
				enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...submission,
				courseModuleLink: courseModuleLinkRef.id,
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
}

/**
 * Gets all threads with all their replies and comments for a course module link
 * This is more efficient than fetching thread-by-thread
 */
export function tryGetDiscussionThreadsWithAllReplies(
	args: GetDiscussionThreadsWithAllRepliesArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				courseModuleLinkId,

				req,
				overrideAccess = false,
			} = args;

			// Validate course module link ID
			if (!courseModuleLinkId) {
				throw new InvalidArgumentError("Course module link ID is required");
			}

			// Get all threads for this course module link
			const threadsResult = await tryListDiscussionSubmissions({
				payload,
				courseModuleLinkId,
				postType: "thread",
				status: "published",
				limit: MOCK_INFINITY,
				page: 1,
				req,
				overrideAccess,
			});

			if (!threadsResult.ok) {
				throw threadsResult.error;
			}

			const threads = threadsResult.value;

			// Get all replies and comments for this course module link
			const allRepliesAndCommentsResult = await payload
				.find({
					collection: DiscussionSubmissions.slug,
					where: {
						and: [
							{ courseModuleLink: { equals: courseModuleLinkId } },
							{
								or: [
									{ postType: { equals: "reply" } },
									{ postType: { equals: "comment" } },
								],
							},
							{ status: { equals: "published" } },
						],
					},
					depth: 1,
					pagination: false,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			// Process all replies and comments with type narrowing
			const allRepliesAndComments = allRepliesAndCommentsResult.docs.map(
				(item) => {
					// Handle courseModuleLink - can be object or number
					const courseModuleLinkId = item.courseModuleLink.id;

					// Get parentThread ID
					const parentThreadId = item.parentThread?.id ?? null;

					return {
						...item,
						courseModuleLink: courseModuleLinkId,
						parentThread: parentThreadId,
					};
				},
			);

			type Reply = (typeof allRepliesAndComments)[number];

			// Build a map of thread ID to its replies/comments
			const threadRepliesMap = new Map<number, Reply[]>();

			// Group replies/comments by their parent thread
			for (const item of allRepliesAndComments) {
				const parentThreadId = item.parentThread;
				if (parentThreadId) {
					if (!threadRepliesMap.has(parentThreadId)) {
						threadRepliesMap.set(parentThreadId, [] as unknown as Reply[]);
					}
					threadRepliesMap.get(parentThreadId)?.push(item);
				}
			}

			// Build nested structure for each thread
			const threadsWithReplies = threads.map((thread) => {
				// Type for nested reply structure
				type NestedReply = {
					id: number;
					postType: "reply" | "comment";
					content: string;
					student: (typeof allRepliesAndComments)[number]["student"];
					enrollment: (typeof allRepliesAndComments)[number]["enrollment"];
					createdAt: string;
					upvotes?: Array<{ user: number | { id: number }; upvotedAt: string }>;
					parentThreadId: number | null;
					replies: NestedReply[];
				};

				// Get all items that belong to this thread (directly or indirectly)
				// Start with items that have parentThreadId === thread.id
				const directReplies = threadRepliesMap.get(thread.id) || [];

				// Recursively find all nested items
				const allThreadItems = new Set<number>();
				const itemsToProcess = [...directReplies.map((item) => item.id)];

				while (itemsToProcess.length > 0) {
					const currentId = itemsToProcess.pop();
					if (!currentId || allThreadItems.has(currentId)) continue;

					allThreadItems.add(currentId);

					// Find all items that have this item as their parent
					const nestedItems = threadRepliesMap.get(currentId) || [];
					for (const nestedItem of nestedItems) {
						itemsToProcess.push(nestedItem.id);
					}
				}

				// Create a map of all items by ID for efficient lookup
				const itemMap = new Map<number, NestedReply>();

				// Initialize all items that belong to this thread
				for (const item of allRepliesAndComments) {
					if (allThreadItems.has(item.id)) {
						itemMap.set(item.id, {
							id: item.id,
							postType: item.postType as "reply" | "comment",
							content: item.content,
							student: item.student,
							enrollment: item.enrollment,
							createdAt: item.createdAt,
							upvotes: item.upvotes ?? undefined,
							parentThreadId: item.parentThread,
							replies: [],
						});
					}
				}

				// Build nested structure: items can be nested under replies (both replies and comments)
				// An item is nested if its parentThreadId points to another reply (not the thread)
				for (const item of allRepliesAndComments) {
					if (!allThreadItems.has(item.id)) continue;

					const itemEntry = itemMap.get(item.id);
					if (!itemEntry) continue;

					// Check if this item's parent is a reply (not the thread)
					// If parentThreadId is the thread ID, it's a top-level item
					// If parentThreadId is another reply's ID, it should be nested under that reply
					if (item.parentThread && item.parentThread !== thread.id) {
						const parentItem = itemMap.get(item.parentThread);
						if (parentItem) {
							// This item is nested under a reply (could be a reply to reply or a comment to reply)
							parentItem.replies.push(itemEntry);
						}
					}
				}

				// Get top-level items (replies and comments whose parentThreadId is the thread ID)
				// Both replies and comments can be top-level, and both can have nested items
				const topLevelItems = directReplies
					.map((item) => itemMap.get(item.id))
					.filter(
						(item): item is NonNullable<typeof item> => item !== undefined,
					);

				// Count all replies and comments (including nested ones)
				const allReplies = Array.from(itemMap.values()).filter(
					(item) => item.postType === "reply",
				);
				const allComments = Array.from(itemMap.values()).filter(
					(item) => item.postType === "comment",
				);

				return {
					thread,
					replies: topLevelItems,
					repliesTotal: allReplies.length,
					commentsTotal: allComments.length,
				};
			});

			return {
				threads: threadsWithReplies,
				totalThreads: threads.length,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get discussion threads with replies", {
				cause: error,
			}),
	);
}

/**
 * Upvotes a discussion submission
 */
export function tryUpvoteDiscussionSubmission(
	args: UpvoteDiscussionSubmissionArgs,
) {
	return Result.try(
		async () => {
			const { payload, submissionId, userId, req, overrideAccess } = args;

			// Validate required fields
			if (!submissionId) {
				throw new InvalidArgumentError("Submission ID is required");
			}
			if (!userId) {
				throw new InvalidArgumentError("User ID is required");
			}

			// Get the current submission
			const submission = await payload
				.findByID({
					collection: "discussion-submissions",
					id: submissionId,
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "findByID">())
				.then((submission) => {
					return {
						...submission,
						upvotes:
							(submission.upvotes as unknown as Depth<
								DiscussionSubmission["upvotes"],
								1
							>) ?? [],
					};
				})
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryUpvoteDiscussionSubmission",
						args,
					});
					throw error;
				});

			// Check if user has already upvoted
			const existingUpvotes = submission.upvotes || [];
			const hasUpvoted = existingUpvotes.some(
				(upvote) => upvote.user.id === userId,
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

			const updatedSubmission = await payload
				.update({
					collection: "discussion-submissions",
					id: submissionId,
					data: {
						upvotes: [...existingUpvotes, newUpvote],
					},
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "update">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryUpvoteDiscussionSubmission",
						args,
					});
					throw error;
				});

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const courseModuleLinkRef = updatedSubmission.courseModuleLink;

			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef.id,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to upvote discussion submission", {
				cause: error,
			}),
	);
}

/**
 * Removes upvote from a discussion submission
 */
export function tryRemoveUpvoteDiscussionSubmission(
	args: RemoveUpvoteDiscussionSubmissionArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,

				req,
				submissionId,
				userId,
				overrideAccess = false,
			} = args;

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
				req,
				overrideAccess,
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
				req,
				overrideAccess,
			});

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const courseModuleLinkRef = updatedSubmission.courseModuleLink;
			assertZodInternal(
				"tryRemoveUpvoteDiscussionSubmission: Course module link is required",
				courseModuleLinkRef,
				z.object({
					id: z.number(),
				}),
			);

			const student = updatedSubmission.student;
			assertZodInternal(
				"tryRemoveUpvoteDiscussionSubmission: Student is required",
				student,
				z.object({
					id: z.number(),
				}),
			);

			const enrollment = updatedSubmission.enrollment;
			assertZodInternal(
				"tryRemoveUpvoteDiscussionSubmission: Enrollment is required",
				enrollment,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...updatedSubmission,
				courseModuleLink: courseModuleLinkRef.id,
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
}

/**
 * Lists discussion submissions with filtering
 */
export function tryListDiscussionSubmissions(
	args: ListDiscussionSubmissionsArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				courseModuleLinkId,
				studentId,
				enrollmentId,
				postType,
				parentThread,
				status = "published",
				sortBy = "recent",
				limit = 10,
				page = 1,

				req,
				overrideAccess = false,
			} = args;

			const where: Record<string, { equals: unknown }> = {};

			if (courseModuleLinkId) {
				where.courseModuleLink = { equals: courseModuleLinkId };
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
				default:
					sort = "-createdAt";
					break;
			}

			const result = await payload
				.find({
					collection: "discussion-submissions",
					where,
					limit,
					page,
					sort,
					depth: 1, // Fetch related data
					pagination: false,
					joins: {
						replies: {
							limit: MOCK_INFINITY,
						},
					},
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">())
				.then((result) => {
					return result.docs.map((doc) => {
						assertZodInternal(
							"tryListDiscussionSubmissions: Course module link is required",
							doc.courseModuleLink,
							z.object({
								id: z.number(),
							}),
						);
						assertZodInternal(
							"tryListDiscussionSubmissions: Student is required",
							doc.student,
							z.object({
								id: z.number(),
							}),
						);
						assertZodInternal(
							"tryListDiscussionSubmissions: Enrollment is required",
							doc.enrollment,
							z.object({
								id: z.number(),
							}),
						);
						assertZodInternal(
							"tryListDiscussionSubmissions: Parent thread should be object or null",
							doc.parentThread,
							z
								.object({
									id: z.number(),
								})
								.nullish(),
						);

						const replies =
							doc.replies?.docs?.map((r) => {
								assertZodInternal(
									"tryListDiscussionSubmissions: Reply should be object",
									r,
									z.object({
										id: z.number(),
									}),
								);
								return r;
							}) ?? [];
						const attachments =
							doc.attachments?.map((a) => {
								assertZodInternal(
									"tryListDiscussionSubmissions: Attachment should be object",
									a.file,
									z.number(),
								);
								return {
									...a,
									file: a.file,
								};
							}) ?? [];

						return {
							...doc,
							courseModuleLink: doc.courseModuleLink,
							student: doc.student,
							enrollment: doc.enrollment,
							parentThread: doc.parentThread,
							replies,
							attachments,
						};
					});
				});

			return result;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to list discussion submissions", {
				cause: error,
			}),
	);
}

/**
 * Manually grades a discussion submission
 * Updates the submission directly with grade, feedback, gradedBy, and gradedAt
 * Does NOT create user-grade entries (that's done via tryReleaseDiscussionGrade)
 */
export function tryGradeDiscussionSubmission(
	args: GradeDiscussionSubmissionArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				id,
				grade,
				feedback,
				gradedBy,

				req,
				overrideAccess = false,
			} = args;

			// Validate ID
			if (!id) {
				throw new InvalidArgumentError("Discussion submission ID is required");
			}

			// Validate grade
			if (grade < 0) {
				throw new InvalidArgumentError("Grade cannot be negative");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return transactionInfo.tx(async ({ reqWithTransaction }) => {
				// Get the current submission with depth to access course module link
				const currentSubmission = await payload.findByID({
					collection: DiscussionSubmissions.slug,
					id,
					depth: 1,
					req: reqWithTransaction,
					overrideAccess,
				});

				if (!currentSubmission) {
					throw new NonExistingDiscussionSubmissionError(
						`Discussion submission with id '${id}' not found`,
					);
				}

				if (currentSubmission.status !== "published") {
					throw new InvalidArgumentError(
						"Only published discussion posts can be graded",
					);
				}

				// Optionally validate grade against gradebook item limits if gradebook item exists
				const courseModuleLinkId =
					typeof currentSubmission.courseModuleLink === "number"
						? currentSubmission.courseModuleLink
						: currentSubmission.courseModuleLink.id;

				const gradebookItemResult =
					await tryFindGradebookItemByCourseModuleLink({
						payload,
						req: reqWithTransaction,
						overrideAccess,
						courseModuleLinkId,
					});

				if (gradebookItemResult.ok) {
					const gradebookItem = gradebookItemResult.value;
					if (
						grade < gradebookItem.minGrade ||
						grade > gradebookItem.maxGrade
					) {
						throw new InvalidArgumentError(
							`Grade must be between ${gradebookItem.minGrade} and ${gradebookItem.maxGrade}`,
						);
					}
				}

				const now = new Date().toISOString();

				// Update submission with grade, feedback, gradedBy, and gradedAt
				// Note: Using Record<string, unknown> because Payload types haven't been regenerated yet
				await payload.update({
					collection: DiscussionSubmissions.slug,
					id,
					data: {
						grade,
						feedback,
						gradedBy,
						gradedAt: now,
					} as Record<string, unknown>,
					req: reqWithTransaction,
					overrideAccess,
				});

				// Fetch the updated submission with depth for return value
				const updatedSubmission = await payload.findByID({
					collection: DiscussionSubmissions.slug,
					id,
					depth: 1,
					req: reqWithTransaction,
					overrideAccess,
				});

				if (!updatedSubmission) {
					throw new NonExistingDiscussionSubmissionError(
						`Failed to fetch updated submission with id '${id}'`,
					);
				}

				////////////////////////////////////////////////////
				// type narrowing
				////////////////////////////////////////////////////

				const courseModuleLinkRef = updatedSubmission.courseModuleLink;
				assertZodInternal(
					"tryGradeDiscussionSubmission: Course module link is required",
					courseModuleLinkRef,
					z.object({
						id: z.number(),
					}),
				);

				const student = updatedSubmission.student;
				assertZodInternal(
					"tryGradeDiscussionSubmission: Student is required",
					student,
					z.object({
						id: z.number(),
					}),
				);

				const enrollment = updatedSubmission.enrollment;
				assertZodInternal(
					"tryGradeDiscussionSubmission: Enrollment is required",
					enrollment,
					z.object({
						id: z.number(),
					}),
				);

				return {
					...updatedSubmission,
					courseModuleLink: courseModuleLinkRef,
					student,
					enrollment,
				};
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to grade discussion submission", {
				cause: error,
			}),
	);
}

type CalculateDiscussionGradeArgs = BaseInternalFunctionArgs & {
	courseModuleLinkId: number;
	studentId: number;
	enrollmentId: number;
};

/**
 * Calculates discussion grade based on all graded posts for a student
 */
export function calculateDiscussionGrade(args: CalculateDiscussionGradeArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				req,
				overrideAccess = false,
				courseModuleLinkId,
				studentId,
				enrollmentId,
			} = args;
			// Get all discussion submissions for this student in this course module link
			const submissions = await payload
				.find({
					collection: "discussion-submissions",
					where: {
						and: [
							{ courseModuleLink: { equals: courseModuleLinkId } },
							{ student: { equals: studentId } },
							{ enrollment: { equals: enrollmentId } },
							{ status: { equals: "published" } },
						],
					},
					req,
					overrideAccess,
					pagination: false,
					depth: 1,
				})
				.then(stripDepth<1, "find">())
				.then((result) => {
					// type narrowing
					return result.docs.map((doc) => {
						assertZodInternal(
							"calculateDiscussionGrade: Course module link is required",
							doc.courseModuleLink,
							z.object({
								id: z.number(),
							}),
						);

						assertZodInternal(
							"calculateDiscussionGrade: Student is required",
							doc.student,
							z.object({
								id: z.number(),
							}),
						);

						assertZodInternal(
							"calculateDiscussionGrade: Enrollment is required",
							doc.enrollment,
							z.object({
								id: z.number(),
							}),
						);

						assertZodInternal(
							"calculateDiscussionGrade: Parent thread is required",
							doc.parentThread,
							z
								.object({
									id: z.number(),
								})
								.nullish(),
						);

						return {
							...doc,
							courseModuleLink: doc.courseModuleLink.id,
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

			// Get gradebook item to determine maxGrade
			const gradebookItemResult = await tryFindGradebookItemByCourseModuleLink({
				payload,
				req,
				overrideAccess: true,
				courseModuleLinkId,
			});

			const maxGrade = gradebookItemResult.ok
				? (gradebookItemResult.value.maxGrade ?? 100)
				: 100; // Default max grade

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

			// Process each submission - read grades directly from submissions
			for (const submission of submissions) {
				const submissionWithGrade = submission as typeof submission & {
					grade?: number | null;
					feedback?: string | null;
					gradedAt?: string | null;
				};

				// Only count submissions that have been graded
				if (
					submissionWithGrade.grade !== null &&
					submissionWithGrade.grade !== undefined
				) {
					const pointsEarned = submissionWithGrade.grade;
					const maxPoints = maxGrade;

					totalScore += pointsEarned;
					maxScore += maxPoints;

					postResults.push({
						postId: submission.id.toString(),
						postType: submission.postType,
						title: submission.title || undefined,
						pointsEarned,
						maxPoints,
						feedback: submissionWithGrade.feedback || "No feedback provided",
						gradedAt: submissionWithGrade.gradedAt || submission.createdAt,
					});
				}
			}

			// Calculate percentage
			const percentage =
				maxScore > 0
					? Math.round((totalScore / maxScore) * 100 * 100) / 100
					: 0;

			// Generate overall feedback
			const threadCount = postResults.filter(
				(p) => p.postType === "thread",
			).length;
			const replyCount = postResults.filter(
				(p) => p.postType === "reply",
			).length;
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
}

type DeleteDiscussionSubmissionArgs = BaseInternalFunctionArgs & {
	id: number;
};
/**
 * Deletes a discussion submission
 */
export function tryDeleteDiscussionSubmission(
	args: DeleteDiscussionSubmissionArgs,
) {
	return Result.try(
		async () => {
			const { payload, req, id, overrideAccess = false } = args;

			const deletedSubmission = await payload
				.delete({
					collection: "discussion-submissions",
					id,
					req,
					overrideAccess,
				})
				.then(stripDepth<0, "delete">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryDeleteDiscussionSubmission",
						args,
					});
					throw error;
				});

			return deletedSubmission;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete discussion submission", {
				cause: error,
			}),
	);
}

export interface DiscussionReply {
	id: string;
	content: string;
	author: string;
	authorAvatar: string;
	authorId: number | null;
	publishedAt: string;
	upvotes: number;
	parentId: string | null;
	isUpvoted: boolean;
	replies?: DiscussionReply[];
}

type tryGetDiscussionThreadWithRepliesArgs = BaseInternalFunctionArgs & {
	threadId: number;
	courseModuleLinkId: number;
};

/**
 * Get a single discussion thread with all nested replies
 * This transforms the thread data from tryGetDiscussionThreadsWithAllReplies
 * into the DiscussionReply format used in the route
 */
export function tryGetDiscussionThreadWithReplies(
	args: tryGetDiscussionThreadWithRepliesArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				threadId,
				courseModuleLinkId,

				req,
				overrideAccess = false,
			} = args;

			const user = req?.user;

			const threadsResult = await tryGetDiscussionThreadsWithAllReplies({
				payload,
				courseModuleLinkId,
				req,
				overrideAccess,
			});

			if (!threadsResult.ok) {
				throw threadsResult.error;
			}

			// Find the specific thread
			const threadData = threadsResult.value.threads.find(
				(t) => t.thread.id === threadId,
			);

			if (!threadData) {
				throw new NonExistingActivityModuleError(
					`Thread with id '${threadId}' not found`,
				);
			}

			const thread = threadData.thread;
			const student = thread.student;
			const authorName = student
				? `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
					student.email ||
					"Unknown"
				: "Unknown";
			const authorAvatar = student
				? `${student.firstName?.[0] || ""}${student.lastName?.[0] || ""}`.trim() ||
					student.email?.[0]?.toUpperCase() ||
					"U"
				: "U";

			const isUpvoted =
				thread.upvotes?.some((upvote) => {
					return upvote.user === user?.id;
				}) ?? false;

			// Transform nested replies into DiscussionReply format
			const transformReply = (
				reply: (typeof threadData.replies)[number],
			): DiscussionReply => {
				const replyStudent = reply.student;
				const replyAuthorName = replyStudent
					? `${replyStudent.firstName || ""} ${replyStudent.lastName || ""}`.trim() ||
						replyStudent.email ||
						"Unknown"
					: "Unknown";
				const replyAuthorAvatar = replyStudent
					? `${replyStudent.firstName?.[0] || ""}${replyStudent.lastName?.[0] || ""}`.trim() ||
						replyStudent.email?.[0]?.toUpperCase() ||
						"U"
					: "U";

				const replyIsUpvoted =
					reply.upvotes?.some(
						(upvote: { user: number | { id: number }; upvotedAt: string }) => {
							const upvoteUser =
								typeof upvote.user === "object" && upvote.user !== null
									? upvote.user
									: null;
							return upvoteUser?.id === user?.id;
						},
					) ?? false;

				return {
					id: String(reply.id),
					content: reply.content,
					author: replyAuthorName,
					authorAvatar: replyAuthorAvatar,
					authorId: replyStudent?.id ?? null,
					publishedAt: reply.createdAt,
					upvotes: reply.upvotes?.length ?? 0,
					parentId:
						reply.parentThreadId === threadId
							? null
							: String(reply.parentThreadId),
					isUpvoted: replyIsUpvoted,
					replies: reply.replies.map(transformReply),
				};
			};

			// Transform all top-level replies (nested structure is preserved)
			const transformedReplies = threadData.replies.map(transformReply);

			return {
				thread: {
					id: String(thread.id),
					title: thread.title || "",
					content: thread.content,
					author: authorName,
					authorAvatar,
					authorId: student?.id ?? null,
					publishedAt: thread.createdAt,
					upvotes: thread.upvotes?.length ?? 0,
					replyCount: threadData.repliesTotal + threadData.commentsTotal,
					isPinned: thread.isPinned ?? false,
					isUpvoted,
				},
				replies: transformedReplies,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get discussion thread with replies", {
				cause: error,
			}),
	);
}
