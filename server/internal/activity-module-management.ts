import type { Payload, User } from "payload";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
import { assertZodInternal, MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingActivityModuleError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryFindAutoGrantedModulesForInstructor } from "./activity-module-access";

// Base args that are common to all module types
type BaseCreateActivityModuleArgs = {
	title: string;
	description?: string;
	status?: "draft" | "published" | "archived";
	userId: number;
};

// Discriminated union for create args
type CreatePageModuleArgs = BaseCreateActivityModuleArgs & {
	type: "page";
	pageData: {
		content?: string;
	};
};

type CreateWhiteboardModuleArgs = BaseCreateActivityModuleArgs & {
	type: "whiteboard";
	whiteboardData: {
		content?: string;
	};
};

type CreateAssignmentModuleArgs = BaseCreateActivityModuleArgs & {
	type: "assignment";
	assignmentData: {
		instructions?: string;
		dueDate?: string;
		maxAttempts?: number;
		allowLateSubmissions?: boolean;
		requireTextSubmission?: boolean;
		requireFileSubmission?: boolean;
		allowedFileTypes?: Array<{ extension: string; mimeType: string }>;
		maxFileSize?: number;
		maxFiles?: number;
	};
};

type CreateQuizModuleArgs = BaseCreateActivityModuleArgs & {
	type: "quiz";
	quizData: {
		description?: string;
		instructions?: string;
		dueDate?: string;
		maxAttempts?: number;
		allowLateSubmissions?: boolean;
		points?: number;
		gradingType?: "automatic" | "manual";
		timeLimit?: number;
		showCorrectAnswers?: boolean;
		allowMultipleAttempts?: boolean;
		shuffleQuestions?: boolean;
		shuffleAnswers?: boolean;
		showOneQuestionAtATime?: boolean;
		rawQuizConfig?: QuizConfig;
		questions?: Array<{
			questionText: string;
			questionType:
				| "multiple_choice"
				| "true_false"
				| "short_answer"
				| "essay"
				| "fill_blank"
				| "matching"
				| "ordering";
			points: number;
			options?: Array<{
				text: string;
				isCorrect: boolean;
				feedback?: string;
			}>;
			correctAnswer?: string;
			explanation?: string;
			hints?: Array<{ hint: string }>;
		}>;
	};
};

type CreateDiscussionModuleArgs = BaseCreateActivityModuleArgs & {
	type: "discussion";
	discussionData: {
		description?: string;
		instructions?: string;
		dueDate?: string;
		requireThread?: boolean;
		requireReplies?: boolean;
		minReplies?: number;
		minWordsPerPost?: number;
		allowAttachments?: boolean;
		allowUpvotes?: boolean;
		allowEditing?: boolean;
		allowDeletion?: boolean;
		moderationRequired?: boolean;
		anonymousPosting?: boolean;
		groupDiscussion?: boolean;
		maxGroupSize?: number;
		threadSorting?: "recent" | "upvoted" | "active" | "alphabetical";
	};
};

export type CreateActivityModuleArgs =
	| CreatePageModuleArgs
	| CreateWhiteboardModuleArgs
	| CreateAssignmentModuleArgs
	| CreateQuizModuleArgs
	| CreateDiscussionModuleArgs;

// Base args for update
type BaseUpdateActivityModuleArgs = {
	id: number;
	title?: string;
	description?: string;
	status?: "draft" | "published" | "archived";
};

// Discriminated union for update args
type UpdatePageModuleArgs = BaseUpdateActivityModuleArgs & {
	type: "page";
	pageData: {
		content?: string;
	};
};

type UpdateWhiteboardModuleArgs = BaseUpdateActivityModuleArgs & {
	type: "whiteboard";
	whiteboardData: {
		content?: string;
	};
};

type UpdateAssignmentModuleArgs = BaseUpdateActivityModuleArgs & {
	type: "assignment";
	assignmentData: {
		instructions?: string;
		dueDate?: string;
		maxAttempts?: number;
		allowLateSubmissions?: boolean;
		requireTextSubmission?: boolean;
		requireFileSubmission?: boolean;
		allowedFileTypes?: Array<{ extension: string; mimeType: string }>;
		maxFileSize?: number;
		maxFiles?: number;
	};
};

type UpdateQuizModuleArgs = BaseUpdateActivityModuleArgs & {
	type: "quiz";
	quizData: {
		description?: string;
		instructions?: string;
		dueDate?: string;
		maxAttempts?: number;
		allowLateSubmissions?: boolean;
		points?: number;
		gradingType?: "automatic" | "manual";
		timeLimit?: number;
		showCorrectAnswers?: boolean;
		allowMultipleAttempts?: boolean;
		shuffleQuestions?: boolean;
		shuffleAnswers?: boolean;
		showOneQuestionAtATime?: boolean;
		rawQuizConfig?: QuizConfig;
		questions?: Array<{
			questionText: string;
			questionType:
				| "multiple_choice"
				| "true_false"
				| "short_answer"
				| "essay"
				| "fill_blank"
				| "matching"
				| "ordering";
			points: number;
			options?: Array<{
				text: string;
				isCorrect: boolean;
				feedback?: string;
			}>;
			correctAnswer?: string;
			explanation?: string;
			hints?: Array<{ hint: string }>;
		}>;
	};
};

type UpdateDiscussionModuleArgs = BaseUpdateActivityModuleArgs & {
	type: "discussion";
	discussionData: {
		description?: string;
		instructions?: string;
		dueDate?: string;
		requireThread?: boolean;
		requireReplies?: boolean;
		minReplies?: number;
		minWordsPerPost?: number;
		allowAttachments?: boolean;
		allowUpvotes?: boolean;
		allowEditing?: boolean;
		allowDeletion?: boolean;
		moderationRequired?: boolean;
		anonymousPosting?: boolean;
		groupDiscussion?: boolean;
		maxGroupSize?: number;
		threadSorting?: "recent" | "upvoted" | "active" | "alphabetical";
	};
};

export type UpdateActivityModuleArgs =
	| UpdatePageModuleArgs
	| UpdateWhiteboardModuleArgs
	| UpdateAssignmentModuleArgs
	| UpdateQuizModuleArgs
	| UpdateDiscussionModuleArgs;

export interface GetActivityModuleByIdArgs {
	id: number | string;
}

/**
 * Creates a new activity module using Payload local API
 */
export const tryCreateActivityModule = Result.wrap(
	async (payload: Payload, args: CreateActivityModuleArgs) => {
		const { title, description, type, status = "draft", userId } = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Start transaction for creating activity module and related entity
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Create the related entity first based on discriminated type
			let relatedEntityId: number | undefined;

			if (type === "page") {
				const page = await payload.create({
					collection: "pages",
					data: {
						content: args.pageData.content || "",
						createdBy: userId,
					},
					req: { transactionID },
				});
				relatedEntityId = page.id;
			} else if (type === "whiteboard") {
				const whiteboard = await payload.create({
					collection: "whiteboards",
					data: {
						content: args.whiteboardData.content || "",
						createdBy: userId,
					},
					req: { transactionID },
				});
				relatedEntityId = whiteboard.id;
			} else if (type === "assignment") {
				const assignment = await payload.create({
					collection: "assignments",
					data: {
						title,
						description: args.assignmentData.instructions || description,
						instructions: args.assignmentData.instructions,
						dueDate: args.assignmentData.dueDate,
						maxAttempts: args.assignmentData.maxAttempts,
						allowLateSubmissions: args.assignmentData.allowLateSubmissions,
						requireTextSubmission: args.assignmentData.requireTextSubmission,
						requireFileSubmission: args.assignmentData.requireFileSubmission,
						allowedFileTypes: args.assignmentData.allowedFileTypes,
						maxFileSize: args.assignmentData.maxFileSize,
						maxFiles: args.assignmentData.maxFiles,
						createdBy: userId,
					},
					req: { transactionID },
				});
				relatedEntityId = assignment.id;
			} else if (type === "quiz") {
				const quiz = await payload.create({
					collection: "quizzes",
					data: {
						title,
						description: args.quizData.description || description,
						instructions: args.quizData.instructions,
						dueDate: args.quizData.dueDate,
						maxAttempts: args.quizData.maxAttempts,
						allowLateSubmissions: args.quizData.allowLateSubmissions,
						points: args.quizData.points,
						gradingType: args.quizData.gradingType,
						timeLimit: args.quizData.timeLimit,
						showCorrectAnswers: args.quizData.showCorrectAnswers,
						allowMultipleAttempts: args.quizData.allowMultipleAttempts,
						shuffleQuestions: args.quizData.shuffleQuestions,
						shuffleAnswers: args.quizData.shuffleAnswers,
						showOneQuestionAtATime: args.quizData.showOneQuestionAtATime,
						rawQuizConfig: args.quizData.rawQuizConfig as unknown as {
							[x: string]: unknown;
						},
						questions: args.quizData.questions,
						createdBy: userId,
					},
					req: { transactionID },
				});
				relatedEntityId = quiz.id;
			} else if (type === "discussion") {
				const discussion = await payload.create({
					collection: "discussions",
					data: {
						title,
						description: args.discussionData.description || description,
						instructions: args.discussionData.instructions,
						dueDate: args.discussionData.dueDate,
						requireThread: args.discussionData.requireThread,
						requireReplies: args.discussionData.requireReplies,
						minReplies: args.discussionData.minReplies,
						minWordsPerPost: args.discussionData.minWordsPerPost,
						allowAttachments: args.discussionData.allowAttachments,
						allowUpvotes: args.discussionData.allowUpvotes,
						allowEditing: args.discussionData.allowEditing,
						allowDeletion: args.discussionData.allowDeletion,
						moderationRequired: args.discussionData.moderationRequired,
						anonymousPosting: args.discussionData.anonymousPosting,
						groupDiscussion: args.discussionData.groupDiscussion,
						maxGroupSize: args.discussionData.maxGroupSize,
						threadSorting: args.discussionData.threadSorting || "recent",
						createdBy: userId,
					},
					req: { transactionID },
				});
				relatedEntityId = discussion.id;
			}

			// Create the activity module with reference to the related entity
			const activityModuleData = {
				title,
				description,
				type,
				status,
				createdBy: userId,
				owner: userId,
				...(type === "page" && relatedEntityId && { page: relatedEntityId }),
				...(type === "whiteboard" &&
					relatedEntityId && { whiteboard: relatedEntityId }),
				...(type === "assignment" &&
					relatedEntityId && { assignment: relatedEntityId }),
				...(type === "quiz" && relatedEntityId && { quiz: relatedEntityId }),
				...(type === "discussion" &&
					relatedEntityId && { discussion: relatedEntityId }),
			};

			const activityModule = await payload.create({
				collection: "activity-modules",
				data: activityModuleData,
				req: { transactionID },
			});

			// Commit the transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const createdBy = activityModule.createdBy;
			assertZodInternal(
				"tryCreateActivityModule: Created by is required",
				createdBy,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...activityModule,
				createdBy,
			};
		} catch (error) {
			// Rollback the transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create activity module", {
			cause: error,
		}),
);

/**
 * Get an activity module by ID
 */
export const tryGetActivityModuleById = Result.wrap(
	async (payload: Payload, args: GetActivityModuleByIdArgs) => {
		const { id } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Fetch the activity module with related data
		const activityModuleResult = await payload
			.find({
				collection: "activity-modules",
				where: {
					and: [
						{
							id: { equals: id },
						},
					],
				},
				joins: {
					// NOTE: Submissions are no longer joined here as they now link to
					// course-activity-module-links instead of activity-modules directly.
					// To access submissions, query through course-activity-module-links.
					grants: {
						limit: MOCK_INFINITY,
					},
				},
				depth: 1, // Fetch related assignment/quiz/discussion data
			})
			.then((r) => {
				if (r.docs.length === 0) {
					return null;
				}
				const am = r.docs[0];
				const createdBy = am.createdBy;
				const owner = am.owner;
				const page = am.page;
				const whiteboard = am.whiteboard;
				const assignment = am.assignment;
				const quiz = am.quiz;
				const discussion = am.discussion;
				assertZodInternal(
					"tryGetActivityModuleById: Created by is required",
					createdBy,
					z.object({ id: z.number() }),
				);
				const createdByAvatar = createdBy.avatar;
				assertZodInternal(
					"tryGetActivityModuleById: Created by avatar is required",
					createdByAvatar,
					z.number().nullish(),
				);

				assertZodInternal(
					"tryGetActivityModuleById: Owner is required",
					owner,
					z.object({ id: z.number() }),
				);
				const ownerAvatar = owner.avatar;
				assertZodInternal(
					"tryGetActivityModuleById: Owner avatar is required",
					ownerAvatar,
					z.number().nullish(),
				);
				// ! page, whiteboard, assignment, quiz, discussion can be null
				assertZodInternal(
					"tryGetActivityModuleById: Page is required",
					page,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryGetActivityModuleById: Whiteboard is required",
					whiteboard,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryGetActivityModuleById: Assignment is required",
					assignment,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryGetActivityModuleById: Quiz is required",
					quiz,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryGetActivityModuleById: Discussion is required",
					discussion,
					z.object({ id: z.number() }).nullish(),
				);

				// NOTE: Submissions are no longer joined on activity-modules.
				// They now link to course-activity-module-links instead.

				const grants = am.grants?.docs?.map((g) => {
					assertZodInternal(
						"tryGetActivityModuleById: Grants is required",
						g,
						z.object({ id: z.number() }),
					);
					const grantedTo = g.grantedTo;
					assertZodInternal(
						"tryGetActivityModuleById: Granted to is required",
						grantedTo,
						z.number(),
					);
					const grantedBy = g.grantedBy;
					assertZodInternal(
						"tryGetActivityModuleById: Granted by is required",
						grantedBy,
						z.number(),
					);
					return {
						...g,
						grantedTo,
						grantedBy,
					};
				});

				return {
					...am,
					createdBy: {
						...createdBy,
						avatar: createdByAvatar,
					},
					owner: {
						...owner,
						avatar: ownerAvatar,
					},
					page,
					whiteboard,
					assignment,
					quiz,
					discussion,
					grants,
				};
			});

		if (!activityModuleResult) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		// narrow the type
		return activityModuleResult;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get activity module", {
			cause: error,
		}),
);

/**
 * Updates an activity module
 */
export const tryUpdateActivityModule = Result.wrap(
	async (payload: Payload, args: UpdateActivityModuleArgs) => {
		const { id, title, description, type, status } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Get the existing activity module to check its current type
		const existingModule = await payload.findByID({
			collection: "activity-modules",
			id,
		});

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		// Verify type matches if updating content
		const currentType = existingModule.type as string;
		if (currentType !== type) {
			throw new InvalidArgumentError(
				`Cannot update ${type} data for a ${currentType} module`,
			);
		}

		// Start transaction for updating activity module and related entity
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Build update data object for activity module
			const updateData: Record<string, unknown> = {};
			if (title !== undefined) updateData.title = title;
			if (description !== undefined) updateData.description = description;
			if (status !== undefined) updateData.status = status;

			// Update related entity based on discriminated type
			if (type === "page") {
				const pageId = existingModule.page;
				if (
					pageId &&
					typeof pageId === "object" &&
					"id" in pageId &&
					pageId.id
				) {
					await payload.update({
						collection: "pages",
						id: pageId.id,
						data: {
							content: args.pageData.content,
						},
						req: { transactionID },
					});
				}
			} else if (type === "whiteboard") {
				const whiteboardId = existingModule.whiteboard;
				if (
					whiteboardId &&
					typeof whiteboardId === "object" &&
					"id" in whiteboardId &&
					whiteboardId.id
				) {
					await payload.update({
						collection: "whiteboards",
						id: whiteboardId.id,
						data: {
							content: args.whiteboardData.content,
						},
						req: { transactionID },
					});
				}
			} else if (type === "assignment") {
				const assignmentId = existingModule.assignment;
				if (
					assignmentId &&
					typeof assignmentId === "object" &&
					"id" in assignmentId &&
					assignmentId.id
				) {
					await payload.update({
						collection: "assignments",
						id: assignmentId.id,
						data: {
							title: title || existingModule.title,
							description:
								args.assignmentData.instructions ||
								description ||
								existingModule.description,
							instructions: args.assignmentData.instructions,
							dueDate: args.assignmentData.dueDate,
							maxAttempts: args.assignmentData.maxAttempts,
							allowLateSubmissions: args.assignmentData.allowLateSubmissions,
							requireTextSubmission: args.assignmentData.requireTextSubmission,
							requireFileSubmission: args.assignmentData.requireFileSubmission,
							allowedFileTypes: args.assignmentData.allowedFileTypes,
							maxFileSize: args.assignmentData.maxFileSize,
							maxFiles: args.assignmentData.maxFiles,
						},
						req: { transactionID },
					});
				}
			} else if (type === "quiz") {
				const quizId = existingModule.quiz;
				if (
					quizId &&
					typeof quizId === "object" &&
					"id" in quizId &&
					quizId.id
				) {
					await payload.update({
						collection: "quizzes",
						id: quizId.id,
						data: {
							title: title || existingModule.title,
							description:
								args.quizData.description ||
								description ||
								existingModule.description,
							instructions: args.quizData.instructions,
							dueDate: args.quizData.dueDate,
							maxAttempts: args.quizData.maxAttempts,
							allowLateSubmissions: args.quizData.allowLateSubmissions,
							points: args.quizData.points,
							gradingType: args.quizData.gradingType,
							timeLimit: args.quizData.timeLimit,
							showCorrectAnswers: args.quizData.showCorrectAnswers,
							allowMultipleAttempts: args.quizData.allowMultipleAttempts,
							shuffleQuestions: args.quizData.shuffleQuestions,
							shuffleAnswers: args.quizData.shuffleAnswers,
							showOneQuestionAtATime: args.quizData.showOneQuestionAtATime,
							rawQuizConfig: args.quizData.rawQuizConfig as unknown as {
								[x: string]: unknown;
							},
							questions: args.quizData.questions,
						},
						req: { transactionID },
					});
				}
			} else if (type === "discussion") {
				const discussionId = existingModule.discussion;
				if (
					discussionId &&
					typeof discussionId === "object" &&
					"id" in discussionId &&
					discussionId.id
				) {
					await payload.update({
						collection: "discussions",
						id: discussionId.id,
						data: {
							title: title || existingModule.title,
							description:
								args.discussionData.description ||
								description ||
								existingModule.description,
							instructions: args.discussionData.instructions,
							dueDate: args.discussionData.dueDate,
							requireThread: args.discussionData.requireThread,
							requireReplies: args.discussionData.requireReplies,
							minReplies: args.discussionData.minReplies,
							minWordsPerPost: args.discussionData.minWordsPerPost,
							allowAttachments: args.discussionData.allowAttachments,
							allowUpvotes: args.discussionData.allowUpvotes,
							allowEditing: args.discussionData.allowEditing,
							allowDeletion: args.discussionData.allowDeletion,
							moderationRequired: args.discussionData.moderationRequired,
							anonymousPosting: args.discussionData.anonymousPosting,
							groupDiscussion: args.discussionData.groupDiscussion,
							maxGroupSize: args.discussionData.maxGroupSize,
							threadSorting: args.discussionData.threadSorting,
						},
						req: { transactionID },
					});
				}
			}

			// Validate that at least one field is being updated
			if (Object.keys(updateData).length === 0) {
				throw new InvalidArgumentError(
					"At least one field must be provided for update",
				);
			}

			const updatedActivityModule = await payload.update({
				collection: "activity-modules",
				id,
				data: updateData,
				req: { transactionID },
			});

			// Commit the transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const createdBy = updatedActivityModule.createdBy;
			assertZodInternal(
				"tryUpdateActivityModule: Created by is required",
				createdBy,
				z.object({
					id: z.number(),
				}),
			);

			return {
				...updatedActivityModule,
				createdBy,
			};
		} catch (error) {
			// Rollback the transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update activity module", {
			cause: error,
		}),
);

/**
 * Deletes an activity module
 */
export const tryDeleteActivityModule = Result.wrap(
	async (payload: Payload, id: number) => {
		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Check if activity module exists
		const existingModule = await payload.findByID({
			collection: "activity-modules",
			id,
		});

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		// Start transaction for cascading delete
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Delete related entity first
			const moduleType = existingModule.type as string;
			if (moduleType === "assignment" && existingModule.assignment) {
				const assignmentId = existingModule.assignment;
				if (
					typeof assignmentId === "object" &&
					"id" in assignmentId &&
					assignmentId.id
				) {
					await payload.delete({
						collection: "assignments",
						id: assignmentId.id,
						req: { transactionID },
					});
				}
			} else if (moduleType === "quiz" && existingModule.quiz) {
				const quizId = existingModule.quiz;
				if (typeof quizId === "object" && "id" in quizId && quizId.id) {
					await payload.delete({
						collection: "quizzes",
						id: quizId.id,
						req: { transactionID },
					});
				}
			} else if (moduleType === "discussion" && existingModule.discussion) {
				const discussionId = existingModule.discussion;
				if (
					typeof discussionId === "object" &&
					"id" in discussionId &&
					discussionId.id
				) {
					await payload.delete({
						collection: "discussions",
						id: discussionId.id,
						req: { transactionID },
					});
				}
			}

			// Delete the activity module
			const deletedActivityModule = await payload.delete({
				collection: "activity-modules",
				id,
				req: { transactionID },
			});

			// Commit the transaction
			await payload.db.commitTransaction(transactionID);

			return deletedActivityModule;
		} catch (error) {
			// Rollback the transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete activity module", {
			cause: error,
		}),
);

/**
 * Lists activity modules with optional filtering
 */
export const tryListActivityModules = Result.wrap(
	async (
		payload: Payload,
		args: {
			userId?: number;
			type?: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
			status?: "draft" | "published" | "archived";
			limit?: number;
			page?: number;
		} = {},
	) => {
		const { userId, type, status, limit = 10, page = 1 } = args;

		const where: Record<string, { equals: unknown }> = {};

		if (userId) {
			where.createdBy = {
				equals: userId,
			};
		}

		if (type) {
			where.type = {
				equals: type,
			};
		}

		if (status) {
			where.status = {
				equals: status,
			};
		}

		const result = await payload.find({
			collection: "activity-modules",
			where,
			limit,
			page,
			sort: "-createdAt",
		});

		return {
			docs: result.docs,
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
		new UnknownError("Failed to list activity modules", {
			cause: error,
		}),
);

/**
 * Gets all activity modules that a user owns or has access to
 * Includes modules where user is owner, creator, or has been granted access
 */
export const tryGetUserActivityModules = Result.wrap(
	async (
		payload: Payload,
		args: {
			userId: number;
			user?: User | null;
			overrideAccess?: boolean;
		},
	) => {
		const { userId, user, overrideAccess = false } = args;

		// Validate user ID
		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		const modulesOwnedOrGranted = await payload
			.find({
				collection: "activity-modules",
				where: {
					or: [
						{ owner: { equals: userId } },
						{ "grants.grantedTo": { equals: userId } },
					],
				},
				joins: {
					linkedCourses: {
						limit: MOCK_INFINITY,
					},
					// ! we don't care about the grants, submissions details here
					grants: false,
				},
				// ! we need to fix this. we use depth 2 to get the avatar but this might lead to many unnecessary queries.
				depth: 2,
				sort: "-createdAt",
				// ! we don't care about pagination and performance for now
				pagination: false,
				overrideAccess,
				user,
			})
			.then((result) => {
				const docs = result.docs.map((doc) => {
					const owner = doc.owner;
					assertZodInternal(
						"tryGetUserActivityModules: Owner is required",
						owner,
						z.object({
							id: z.number(),
						}),
					);
					const ownerAvatar = owner.avatar;
					assertZodInternal(
						"tryGetUserActivityModules: Owner avatar is required",
						ownerAvatar,
						z.object({ id: z.number() }).nullish(),
					);
					const createdBy = doc.createdBy;
					assertZodInternal(
						"tryGetUserActivityModules: Created by is required",
						createdBy,
						z.object(
							{
								id: z.number(),
							},
							{ error: "Created by is required" },
						),
					);
					const createdByAvatar = createdBy.avatar;
					assertZodInternal(
						"tryGetUserActivityModules: Created by avatar is required",
						createdByAvatar,
						z
							.object(
								{
									id: z.number(),
								},
								{ error: "Created by avatar is required" },
							)
							.nullish(),
					);
					const grants = doc.grants;
					assertZodInternal(
						"tryGetUserActivityModules: Grants is required",
						grants,
						z.undefined(),
					);
					const courses =
						doc.linkedCourses?.docs?.map((link) => {
							assertZodInternal(
								"tryGetUserActivityModules: Linked courses is required",
								link,
								z.object({ id: z.number() }),
							);
							const course = link.course;
							assertZodInternal(
								"tryGetUserActivityModules: Course is required",
								course,
								z.number(),
							);
							return course;
						}) ?? [];

					return {
						...doc,
						owner: {
							...owner,
							avatar: ownerAvatar,
						},
						createdBy: {
							...createdBy,
							avatar: createdByAvatar,
						},
						grants,
						linkedCourses: courses,
					};
				});

				return docs;
			});

		const autoGrantedModules = await tryFindAutoGrantedModulesForInstructor({
			payload,
			userId,
			user,
			overrideAccess,
		});

		if (!autoGrantedModules.ok) throw autoGrantedModules.error;

		return {
			modulesOwnedOrGranted,
			autoGrantedModules: autoGrantedModules.value,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user activity modules", {
			cause: error,
		}),
);
