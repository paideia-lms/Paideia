import type { Payload } from "payload";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingActivityModuleError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";

export interface CreateActivityModuleArgs {
	title: string;
	description?: string;
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	userId: number;
	// Activity-specific configuration data
	assignmentData?: {
		instructions?: string;
		dueDate?: string;
		maxAttempts?: number;
		allowLateSubmissions?: boolean;
		allowedFileTypes?: Array<{ extension: string; mimeType: string }>;
		maxFileSize?: number;
		maxFiles?: number;
		requireTextSubmission?: boolean;
		requireFileSubmission?: boolean;
	};
	quizData?: {
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
		requirePassword?: boolean;
		accessPassword?: string;
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
	discussionData?: {
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
	// Access control
	requirePassword?: boolean;
	accessPassword?: string;
}

export interface UpdateActivityModuleArgs {
	id: number;
	title?: string;
	description?: string;
	type?: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	// Activity-specific configuration data
	assignmentData?: {
		instructions?: string;
		dueDate?: string;
		maxAttempts?: number;
		allowLateSubmissions?: boolean;
		allowedFileTypes?: Array<{ extension: string; mimeType: string }>;
		maxFileSize?: number;
		maxFiles?: number;
		requireTextSubmission?: boolean;
		requireFileSubmission?: boolean;
	};
	quizData?: {
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
		requirePassword?: boolean;
		accessPassword?: string;
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
	discussionData?: {
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
	// Access control
	requirePassword?: boolean;
	accessPassword?: string;
}

export interface GetActivityModuleByIdArgs {
	id: number | string;
}

/**
 * Creates a new activity module using Payload local API
 */
export const tryCreateActivityModule = Result.wrap(
	async (payload: Payload, args: CreateActivityModuleArgs) => {
		const {
			title,
			description,
			type,
			status = "draft",
			userId,
			assignmentData,
			quizData,
			discussionData,
			requirePassword = false,
			accessPassword,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!type) {
			throw new InvalidArgumentError("Type is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Validate that activity-specific data is provided when needed
		if (type === "assignment" && !assignmentData) {
			throw new InvalidArgumentError(
				"Assignment data is required for assignment type",
			);
		}
		if (type === "quiz" && !quizData) {
			throw new InvalidArgumentError("Quiz data is required for quiz type");
		}
		if (type === "discussion" && !discussionData) {
			throw new InvalidArgumentError(
				"Discussion data is required for discussion type",
			);
		}

		// Start transaction for creating activity module and related entity
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Create the related entity first
			let relatedEntityId: number | undefined;

			if (type === "assignment" && assignmentData) {
				const assignment = await payload.create({
					collection: "assignments",
					data: {
						title,
						description: assignmentData.instructions || description,
						instructions: assignmentData.instructions,
						dueDate: assignmentData.dueDate,
						maxAttempts: assignmentData.maxAttempts,
						allowLateSubmissions: assignmentData.allowLateSubmissions,
						allowedFileTypes: assignmentData.allowedFileTypes,
						maxFileSize: assignmentData.maxFileSize,
						maxFiles: assignmentData.maxFiles,
						requireTextSubmission: assignmentData.requireTextSubmission,
						requireFileSubmission: assignmentData.requireFileSubmission,
						createdBy: userId,
					},
					req: { transactionID },
				});
				relatedEntityId = assignment.id;
			} else if (type === "quiz" && quizData) {
				const quiz = await payload.create({
					collection: "quizzes",
					data: {
						title,
						description: quizData.description || description,
						instructions: quizData.instructions,
						dueDate: quizData.dueDate,
						maxAttempts: quizData.maxAttempts,
						allowLateSubmissions: quizData.allowLateSubmissions,
						points: quizData.points,
						gradingType: quizData.gradingType,
						timeLimit: quizData.timeLimit,
						showCorrectAnswers: quizData.showCorrectAnswers,
						allowMultipleAttempts: quizData.allowMultipleAttempts,
						shuffleQuestions: quizData.shuffleQuestions,
						shuffleAnswers: quizData.shuffleAnswers,
						showOneQuestionAtATime: quizData.showOneQuestionAtATime,
						requirePassword: quizData.requirePassword,
						accessPassword: quizData.accessPassword,
						questions: quizData.questions,
						createdBy: userId,
					},
					req: { transactionID },
				});
				relatedEntityId = quiz.id;
			} else if (type === "discussion" && discussionData) {
				const discussion = await payload.create({
					collection: "discussions",
					data: {
						title,
						description: discussionData.description || description,
						instructions: discussionData.instructions,
						dueDate: discussionData.dueDate,
						requireThread: discussionData.requireThread,
						requireReplies: discussionData.requireReplies,
						minReplies: discussionData.minReplies,
						minWordsPerPost: discussionData.minWordsPerPost,
						allowAttachments: discussionData.allowAttachments,
						allowUpvotes: discussionData.allowUpvotes,
						allowEditing: discussionData.allowEditing,
						allowDeletion: discussionData.allowDeletion,
						moderationRequired: discussionData.moderationRequired,
						anonymousPosting: discussionData.anonymousPosting,
						groupDiscussion: discussionData.groupDiscussion,
						maxGroupSize: discussionData.maxGroupSize,
						threadSorting: discussionData.threadSorting || "recent",
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
				requirePassword,
				...(accessPassword && { accessPassword }),
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
			assertZod(
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
		const activityModuleResult = await payload.find({
			collection: "activity-modules",
			where: {
				and: [
					{
						id: { equals: id },
					},
				],
			},
			depth: 1, // Fetch related assignment/quiz/discussion data
		});

		const activityModule = activityModuleResult.docs[0];

		if (!activityModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		const createdBy = activityModule.createdBy;
		assertZod(
			createdBy,
			z.object({
				id: z.number(),
			}),
		);

		// narrow the type
		return {
			...activityModule,
			createdBy,
		};
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
		const {
			id,
			title,
			description,
			type,
			status,
			assignmentData,
			quizData,
			discussionData,
			requirePassword,
			accessPassword,
		} = args;

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
			if (type !== undefined) updateData.type = type;
			if (status !== undefined) updateData.status = status;
			if (requirePassword !== undefined)
				updateData.requirePassword = requirePassword;
			if (accessPassword !== undefined)
				updateData.accessPassword = accessPassword;

			// Update related entity if data is provided
			const currentType = existingModule.type as string;
			if (assignmentData && currentType === "assignment") {
				// Update assignment
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
								assignmentData.instructions ||
								description ||
								existingModule.description,
							instructions: assignmentData.instructions,
							dueDate: assignmentData.dueDate,
							maxAttempts: assignmentData.maxAttempts,
							allowLateSubmissions: assignmentData.allowLateSubmissions,
							allowedFileTypes: assignmentData.allowedFileTypes,
							maxFileSize: assignmentData.maxFileSize,
							maxFiles: assignmentData.maxFiles,
							requireTextSubmission: assignmentData.requireTextSubmission,
							requireFileSubmission: assignmentData.requireFileSubmission,
						},
						req: { transactionID },
					});
				}
			} else if (quizData && currentType === "quiz") {
				// Update quiz
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
								quizData.description ||
								description ||
								existingModule.description,
							instructions: quizData.instructions,
							dueDate: quizData.dueDate,
							maxAttempts: quizData.maxAttempts,
							allowLateSubmissions: quizData.allowLateSubmissions,
							points: quizData.points,
							gradingType: quizData.gradingType,
							timeLimit: quizData.timeLimit,
							showCorrectAnswers: quizData.showCorrectAnswers,
							allowMultipleAttempts: quizData.allowMultipleAttempts,
							shuffleQuestions: quizData.shuffleQuestions,
							shuffleAnswers: quizData.shuffleAnswers,
							showOneQuestionAtATime: quizData.showOneQuestionAtATime,
							requirePassword: quizData.requirePassword,
							accessPassword: quizData.accessPassword,
							questions: quizData.questions,
						},
						req: { transactionID },
					});
				}
			} else if (discussionData && currentType === "discussion") {
				// Update discussion
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
								discussionData.description ||
								description ||
								existingModule.description,
							instructions: discussionData.instructions,
							dueDate: discussionData.dueDate,
							requireThread: discussionData.requireThread,
							requireReplies: discussionData.requireReplies,
							minReplies: discussionData.minReplies,
							minWordsPerPost: discussionData.minWordsPerPost,
							allowAttachments: discussionData.allowAttachments,
							allowUpvotes: discussionData.allowUpvotes,
							allowEditing: discussionData.allowEditing,
							allowDeletion: discussionData.allowDeletion,
							moderationRequired: discussionData.moderationRequired,
							anonymousPosting: discussionData.anonymousPosting,
							groupDiscussion: discussionData.groupDiscussion,
							maxGroupSize: discussionData.maxGroupSize,
							threadSorting: discussionData.threadSorting,
						},
						req: { transactionID },
					});
				}
			}

			// Validate that at least one field is being updated
			if (
				Object.keys(updateData).length === 0 &&
				!assignmentData &&
				!quizData &&
				!discussionData
			) {
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
			assertZod(
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
