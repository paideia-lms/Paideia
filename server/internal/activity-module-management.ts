import { omit } from "es-toolkit";
import type { Payload, PayloadRequest, TypedUser, User } from "payload";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
import { assertZodInternal, MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingActivityModuleError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryFindAutoGrantedModulesForInstructor } from "./activity-module-access";
import { handleTransactionId } from "./utils/handle-transaction-id";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

// Base args that are common to all module types
type BaseCreateActivityModuleArgs = BaseInternalFunctionArgs & {
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

type CreateFileModuleArgs = BaseCreateActivityModuleArgs & {
	type: "file";
	fileData: {
		media?: number[];
	};
};

export type CreateActivityModuleArgs =
	| CreatePageModuleArgs
	| CreateWhiteboardModuleArgs
	| CreateFileModuleArgs
	| CreateAssignmentModuleArgs
	| CreateQuizModuleArgs
	| CreateDiscussionModuleArgs;

// Base args for update
type BaseUpdateActivityModuleArgs = BaseInternalFunctionArgs & {
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

type UpdateFileModuleArgs = BaseUpdateActivityModuleArgs & {
	type: "file";
	fileData: {
		media?: number[];
	};
};

export type UpdateActivityModuleArgs =
	| UpdatePageModuleArgs
	| UpdateWhiteboardModuleArgs
	| UpdateFileModuleArgs
	| UpdateAssignmentModuleArgs
	| UpdateQuizModuleArgs
	| UpdateDiscussionModuleArgs;

export type GetActivityModuleByIdArgs = BaseInternalFunctionArgs & {
	id: number | string;
};

/**
 * Page type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
type Page = {
	id: number;
	content?: string | null;
	media?: number[] | null;
	updatedAt: string;
	createdAt: string;
};

/**
 * Whiteboard type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
type Whiteboard = {
	id: number;
	content?: string | null;
	updatedAt: string;
	createdAt: string;
};

/**
 * File type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
/**
 * File type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
type File = {
	id: number;
	media?: number[] | null;
	updatedAt: string;
	createdAt: string;
};

/**
 * Assignment type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
type Assignment = {
	id: number;
	title: string;
	description?: string | null;
	instructions?: string | null;
	dueDate?: string | null;
	maxAttempts?: number | null;
	allowLateSubmissions?: boolean | null;
	allowedFileTypes?:
	| {
		extension: string;
		mimeType: string;
		id?: string | null;
	}[]
	| null;
	maxFileSize?: number | null;
	maxFiles?: number | null;
	requireTextSubmission?: boolean | null;
	requireFileSubmission?: boolean | null;
	updatedAt: string;
	createdAt: string;
};

/**
 * Quiz type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
type Quiz = {
	id: number;
	title: string;
	description?: string | null;
	instructions?: string | null;
	dueDate?: string | null;
	maxAttempts?: number | null;
	allowLateSubmissions?: boolean | null;
	points?: number | null;
	gradingType?: ("automatic" | "manual") | null;
	showCorrectAnswers?: boolean | null;
	allowMultipleAttempts?: boolean | null;
	shuffleQuestions?: boolean | null;
	shuffleAnswers?: boolean | null;
	showOneQuestionAtATime?: boolean | null;
	rawQuizConfig?:
	| {
		[k: string]: unknown;
	}
	| unknown[]
	| string
	| number
	| boolean
	| null;
	questions?:
	| {
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
		options?:
		| {
			text: string;
			isCorrect?: boolean | null;
			feedback?: string | null;
			id?: string | null;
		}[]
		| null;
		correctAnswer?: string | null;
		explanation?: string | null;
		hints?:
		| {
			hint: string;
			id?: string | null;
		}[]
		| null;
		id?: string | null;
	}[]
	| null;
	updatedAt: string;
	createdAt: string;
};

/**
 * Discussion type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
type Discussion = {
	id: number;
	title: string;
	description?: string | null;
	instructions?: string | null;
	dueDate?: string | null;
	requireThread?: boolean | null;
	requireReplies?: boolean | null;
	minReplies?: number | null;
	minWordsPerPost?: number | null;
	allowAttachments?: boolean | null;
	allowUpvotes?: boolean | null;
	allowEditing?: boolean | null;
	allowDeletion?: boolean | null;
	moderationRequired?: boolean | null;
	anonymousPosting?: boolean | null;
	groupDiscussion?: boolean | null;
	maxGroupSize?: number | null;
	threadSorting?: ("recent" | "upvoted" | "active" | "alphabetical") | null;
	pinnedThreads?:
	| {
		thread: number | { id: number };
		pinnedAt: string;
		pinnedBy: number | { id: number };
		id?: string | null;
	}[]
	| null;
	updatedAt: string;
	createdAt: string;
};

/**
 * Base type for activity module result with common fields
 */
type BaseActivityModuleResult = {
	id: number;
	title: string;
	description?: string | null;
	status: "draft" | "published" | "archived";
	createdBy: {
		id: number;
		avatar: number | null;
		email: string;
		firstName: string;
		lastName: string;
	};
	owner: {
		id: number;
		avatar: number | null;
		email: string;
		firstName: string;
		lastName: string;
	};
	grants?: Array<{
		id: number;
		grantedTo: number;
		grantedBy: number;
	}>;
	updatedAt: string;
	createdAt: string;
};

/**
 * Page module result
 */
type PageModuleResult = BaseActivityModuleResult & {
	type: "page";
} & Page;

/**
 * Whiteboard module result
 */
type WhiteboardModuleResult = BaseActivityModuleResult & {
	type: "whiteboard";
} & Whiteboard;

/**
 * File module result
 */
type FileModuleResult = BaseActivityModuleResult & {
	type: "file";
} & File;

/**
 * Assignment module result
 */
type AssignmentModuleResult = BaseActivityModuleResult & {
	type: "assignment";
} & Assignment;

/**
 * Quiz module result
 */
type QuizModuleResult = BaseActivityModuleResult & {
	type: "quiz";
} & Quiz;

/**
 * Discussion module result
 */
type DiscussionModuleResult = BaseActivityModuleResult & {
	type: "discussion";
} & Discussion;

/**
 * Discriminated union of all activity module result types
 */
export type ActivityModuleResult =
	| PageModuleResult
	| WhiteboardModuleResult
	| FileModuleResult
	| AssignmentModuleResult
	| QuizModuleResult
	| DiscussionModuleResult;

/**
 * Helper type for activity module data with all possible related entities
 * The related entities come from Payload and may have createdBy: number | User
 * but we'll exclude it when building the discriminated union
 */
type ActivityModuleData = {
	id: number;
	title: string;
	description?: string | null;
	status: "draft" | "published" | "archived";
	type: "page" | "whiteboard" | "file" | "assignment" | "quiz" | "discussion";
	createdBy: {
		id: number;
		avatar: number | null;
	};
	owner: {
		id: number;
		avatar: number | null;
	};
	grants?: Array<{
		id: number;
		grantedTo: number;
		grantedBy: number;
	}>;
	updatedAt: string;
	createdAt: string;
	// These come from Payload and may have createdBy: number | User, but we exclude it
	// Use unknown for createdBy to allow both number | User from Payload
	page?: (Page & { createdBy?: number | User | unknown }) | null;
	whiteboard?: (Whiteboard & { createdBy?: number | User | unknown }) | null;
	file?: (File & { createdBy?: number | User | unknown }) | null;
	assignment?: (Assignment & { createdBy?: number | User | unknown }) | null;
	quiz?: (Quiz & { createdBy?: number | User | unknown }) | null;
	discussion?: (Discussion & { createdBy?: number | User | unknown }) | null;
};

/**
 * Builds a discriminated union result from base result and activity module data
 * Excludes createdBy from payload types since it's in BaseActivityModuleResult
 */
function buildDiscriminatedUnionResult(
	baseResult: BaseActivityModuleResult,
	data: ActivityModuleData,
): ActivityModuleResult {
	const { type } = data;

	if (type === "page") {
		const pageData = data.page;
		if (!pageData) {
			throw new NonExistingActivityModuleError(
				`Page data not found for activity module with id '${data.id}'`,
			);
		}
		// Exclude createdBy and handle media conversion
		const result = {
			...baseResult,
			type: "page" as const,
			...omit(pageData, ["createdBy", "id"]),
		};
		return result;
	} else if (type === "whiteboard") {
		const whiteboardData = data.whiteboard;
		if (!whiteboardData) {
			throw new NonExistingActivityModuleError(
				`Whiteboard data not found for activity module with id '${data.id}'`,
			);
		}
		const result: WhiteboardModuleResult = {
			...baseResult,
			type: "whiteboard" as const,
			...omit(whiteboardData, ["createdBy", "id"]),
		};
		return result;
	} else if (type === "file") {
		const fileData = data.file;
		if (!fileData) {
			throw new NonExistingActivityModuleError(
				`File data not found for activity module with id '${data.id}'`,
			);
		}
		// File type has createdBy, but we exclude it since it's in baseResult
		const result = {
			...baseResult,
			type: "file" as const,
			...omit(fileData, ["createdBy", "id"]),
		};
		return result;
	} else if (type === "assignment") {
		const assignmentData = data.assignment;
		if (!assignmentData) {
			throw new NonExistingActivityModuleError(
				`Assignment data not found for activity module with id '${data.id}'`,
			);
		}
		const result: AssignmentModuleResult = {
			...baseResult,
			type: "assignment",
			...omit(assignmentData, ["createdBy", "id"]),
		};
		return result;
	} else if (type === "quiz") {
		const quizData = data.quiz;
		if (!quizData) {
			throw new NonExistingActivityModuleError(
				`Quiz data not found for activity module with id '${data.id}'`,
			);
		}
		const result: QuizModuleResult = {
			...baseResult,
			type: "quiz",
			...omit(quizData, ["createdBy", "id"]),
		};
		return result;
	} else {
		// discussion
		const discussionData = data.discussion;
		if (!discussionData) {
			throw new NonExistingActivityModuleError(
				`Discussion data not found for activity module with id '${data.id}'`,
			);
		}

		const result: DiscussionModuleResult = {
			...baseResult,
			type: "discussion",
			...omit(discussionData, ["createdBy", "id"]),
		};
		return result;
	}
}

/**
 * Creates a new activity module using Payload local API
 */
export const tryCreateActivityModule = Result.wrap(
	async (args: CreateActivityModuleArgs) => {
		const {
			payload,
			title,
			description,
			type,
			status = "draft",
			userId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Handle transaction ID
		const { transactionID, isTransactionCreated, reqWithTransaction } =
			await handleTransactionId(payload, req);

		try {
			// Create the related entity first based on discriminated type
			let relatedEntityId: number | undefined;
			let createdPage: Page | undefined;
			let createdWhiteboard: Whiteboard | undefined;
			let createdFile: File | undefined;
			let createdAssignment: Assignment | undefined;
			let createdQuiz: Quiz | undefined;
			let createdDiscussion: Discussion | undefined;

			if (type === "page") {
				const page = await payload.create({
					collection: "pages",
					data: {
						content: args.pageData.content || "",
						createdBy: userId,
					},
					user,
					req: reqWithTransaction,
					overrideAccess,
				});
				relatedEntityId = page.id;
				createdPage = {
					id: page.id,
					content: page.content ?? null,
					media: Array.isArray(page.media)
						? page.media.map((m) => (typeof m === "number" ? m : m.id))
						: null,
					updatedAt: page.updatedAt,
					createdAt: page.createdAt,
				};
			} else if (type === "whiteboard") {
				const whiteboard = await payload.create({
					collection: "whiteboards",
					data: {
						content: args.whiteboardData.content || "",
						createdBy: userId,
					},
					user,
					req: reqWithTransaction,
					overrideAccess,
				});
				relatedEntityId = whiteboard.id;
				createdWhiteboard = {
					id: whiteboard.id,
					content: whiteboard.content ?? null,
					updatedAt: whiteboard.updatedAt,
					createdAt: whiteboard.createdAt,
				};
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
					user,
					req: reqWithTransaction,
					overrideAccess,
				});
				relatedEntityId = assignment.id;
				createdAssignment = {
					id: assignment.id,
					title: assignment.title,
					description: assignment.description ?? null,
					instructions: assignment.instructions ?? null,
					dueDate: assignment.dueDate ?? null,
					maxAttempts: assignment.maxAttempts ?? null,
					allowLateSubmissions: assignment.allowLateSubmissions ?? null,
					allowedFileTypes: assignment.allowedFileTypes ?? null,
					maxFileSize: assignment.maxFileSize ?? null,
					maxFiles: assignment.maxFiles ?? null,
					requireTextSubmission: assignment.requireTextSubmission ?? null,
					requireFileSubmission: assignment.requireFileSubmission ?? null,
					updatedAt: assignment.updatedAt,
					createdAt: assignment.createdAt,
				};
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
					user,
					req: reqWithTransaction,
					overrideAccess,
				});
				relatedEntityId = quiz.id;
				createdQuiz = {
					id: quiz.id,
					title: quiz.title,
					description: quiz.description ?? null,
					instructions: quiz.instructions ?? null,
					dueDate: quiz.dueDate ?? null,
					maxAttempts: quiz.maxAttempts ?? null,
					allowLateSubmissions: quiz.allowLateSubmissions ?? null,
					points: quiz.points ?? null,
					gradingType: quiz.gradingType ?? null,
					showCorrectAnswers: quiz.showCorrectAnswers ?? null,
					allowMultipleAttempts: quiz.allowMultipleAttempts ?? null,
					shuffleQuestions: quiz.shuffleQuestions ?? null,
					shuffleAnswers: quiz.shuffleAnswers ?? null,
					showOneQuestionAtATime: quiz.showOneQuestionAtATime ?? null,
					rawQuizConfig: quiz.rawQuizConfig ?? null,
					questions: quiz.questions ?? null,
					updatedAt: quiz.updatedAt,
					createdAt: quiz.createdAt,
				};
			} else if (type === "file") {
				const file = await payload.create({
					collection: "files",
					data: {
						media: args.fileData.media || [],
						createdBy: userId,
					},
					user,
					req: reqWithTransaction,
					overrideAccess,
				});
				relatedEntityId = file.id;
				const fileMedia = Array.isArray(file.media)
					? file.media.map((m) => (typeof m === "number" ? m : m.id))
					: null;
				// Exclude createdBy since it's in baseResult
				createdFile = {
					id: file.id,
					media: fileMedia ?? null,
					updatedAt: file.updatedAt,
					createdAt: file.createdAt,
				};
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
					user,
					req: reqWithTransaction,
					overrideAccess,
				});
				relatedEntityId = discussion.id;
				createdDiscussion = {
					id: discussion.id,
					title: discussion.title,
					description: discussion.description ?? null,
					instructions: discussion.instructions ?? null,
					dueDate: discussion.dueDate ?? null,
					requireThread: discussion.requireThread ?? null,
					requireReplies: discussion.requireReplies ?? null,
					minReplies: discussion.minReplies ?? null,
					minWordsPerPost: discussion.minWordsPerPost ?? null,
					allowAttachments: discussion.allowAttachments ?? null,
					allowUpvotes: discussion.allowUpvotes ?? null,
					allowEditing: discussion.allowEditing ?? null,
					allowDeletion: discussion.allowDeletion ?? null,
					moderationRequired: discussion.moderationRequired ?? null,
					anonymousPosting: discussion.anonymousPosting ?? null,
					groupDiscussion: discussion.groupDiscussion ?? null,
					maxGroupSize: discussion.maxGroupSize ?? null,
					threadSorting: discussion.threadSorting ?? null,
					pinnedThreads: discussion.pinnedThreads ?? null,
					updatedAt: discussion.updatedAt,
					createdAt: discussion.createdAt,
				};
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
				...(type === "file" && relatedEntityId && { file: relatedEntityId }),
				...(type === "assignment" &&
					relatedEntityId && { assignment: relatedEntityId }),
				...(type === "quiz" && relatedEntityId && { quiz: relatedEntityId }),
				...(type === "discussion" &&
					relatedEntityId && { discussion: relatedEntityId }),
			};

			const activityModule = await payload.create({
				collection: "activity-modules",
				data: activityModuleData,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit the transaction only if we created it
			if (isTransactionCreated && transactionID) {
				await payload.db.commitTransaction(transactionID);
			}

			////////////////////////////////////////////////////
			// Build discriminated union result
			////////////////////////////////////////////////////

			const createdBy = activityModule.createdBy;
			assertZodInternal(
				"tryCreateActivityModule: Created by is required",
				createdBy,
				z.object({
					id: z.number(),
				}),
			);
			const createdByAvatar = createdBy.avatar;
			assertZodInternal(
				"tryCreateActivityModule: Created by avatar is required",
				createdByAvatar,
				z.number().nullish(),
			);

			const owner = activityModule.owner;
			assertZodInternal(
				"tryCreateActivityModule: Owner is required",
				owner,
				z.object({
					id: z.number(),
				}),
			);
			const ownerAvatar = owner.avatar;
			assertZodInternal(
				"tryCreateActivityModule: Owner avatar is required",
				ownerAvatar,
				z.number().nullish(),
			);

			const baseResult = {
				id: activityModule.id,
				title: activityModule.title,
				description: activityModule.description,
				status: activityModule.status,
				createdBy: {
					id: createdBy.id,
					avatar: createdByAvatar ?? null,
					email: createdBy.email,
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: ownerAvatar ?? null,
					email: owner.email,
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				grants: undefined,
				updatedAt: activityModule.updatedAt,
				createdAt: activityModule.createdAt,
			} satisfies BaseActivityModuleResult;

			// Build discriminated union result using helper function
			const moduleData: ActivityModuleData = {
				id: activityModule.id,
				title: activityModule.title,
				description: activityModule.description,
				status: activityModule.status,
				type,
				createdBy: baseResult.createdBy,
				owner: baseResult.owner,
				grants: baseResult.grants,
				updatedAt: activityModule.updatedAt,
				createdAt: activityModule.createdAt,
				// Cast created entities to allow createdBy from Payload
				page: createdPage,
				whiteboard: createdWhiteboard,
				file: createdFile,
				assignment: createdAssignment,
				quiz: createdQuiz,
				discussion: createdDiscussion,
			};

			return buildDiscriminatedUnionResult(baseResult, moduleData);
		} catch (error) {
			// Rollback the transaction on error only if we created it
			if (isTransactionCreated) {
				await payload.db.rollbackTransaction(transactionID);
			}
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
	async (args: GetActivityModuleByIdArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;

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
				user,
				req,
				overrideAccess,
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
				const file = am.file;
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
				assertZodInternal(
					"tryGetActivityModuleById: File is required",
					file,
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

				// type narrowing file
				const fileMedia = file?.media?.map((m) => {
					assertZodInternal(
						"tryGetActivityModuleById: Media should be number[]",
						m,
						z.number(),
					);
					return m;
				});

				const fileCreatedBy = file?.createdBy;
				if (fileCreatedBy) {
					assertZodInternal(
						"tryGetActivityModuleById: File created by should be number",
						fileCreatedBy,
						z.number(),
					);
				}

				const pageMedia = page?.media?.map((m) => {
					assertZodInternal(
						"tryGetActivityModuleById: Media should be number[]",
						m,
						z.number(),
					);
					return m;
				});

				return {
					...am,
					createdBy: {
						...createdBy,
						avatar: createdByAvatar ?? null,
					},
					owner: {
						...owner,
						avatar: ownerAvatar ?? null,
					},
					page: page
						? {
							...page,
							media: pageMedia ?? null,
						}
						: null,
					whiteboard,
					file: file
						? {
							id: file.id,
							media: fileMedia ?? null,
							updatedAt: file.updatedAt,
							createdAt: file.createdAt,
						}
						: null,
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

		// Refine the result to a discriminated union based on type
		const baseResult = {
			id: activityModuleResult.id,
			title: activityModuleResult.title,
			description: activityModuleResult.description,
			status: activityModuleResult.status,
			createdBy: {
				...activityModuleResult.createdBy,
				firstName: activityModuleResult.createdBy.firstName ?? "",
				lastName: activityModuleResult.createdBy.lastName ?? "",
			},
			owner: {
				...activityModuleResult.owner,
				firstName: activityModuleResult.owner.firstName ?? "",
				lastName: activityModuleResult.owner.lastName ?? "",
			},
			grants: activityModuleResult.grants,
			updatedAt: activityModuleResult.updatedAt,
			createdAt: activityModuleResult.createdAt,
		} satisfies BaseActivityModuleResult;

		// Build discriminated union result using helper function
		const moduleData: ActivityModuleData = {
			id: activityModuleResult.id,
			title: activityModuleResult.title,
			description: activityModuleResult.description,
			status: activityModuleResult.status,
			type: activityModuleResult.type,
			createdBy: baseResult.createdBy,
			owner: baseResult.owner,
			grants: baseResult.grants,
			updatedAt: activityModuleResult.updatedAt,
			createdAt: activityModuleResult.createdAt,
			// Cast to ActivityModuleData types to allow createdBy from Payload
			page: activityModuleResult.page,
			whiteboard: activityModuleResult.whiteboard,
			file: activityModuleResult.file,
			assignment: activityModuleResult.assignment,
			quiz: activityModuleResult.quiz,
			discussion: activityModuleResult.discussion,
		};

		return buildDiscriminatedUnionResult(baseResult, moduleData);
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
	async (args: UpdateActivityModuleArgs) => {
		const {
			payload,
			id,
			title,
			description,
			type,
			status,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Get the existing activity module to check its current type
		const existingModule = await payload.findByID({
			collection: "activity-modules",
			id,
			user,
			req,
			overrideAccess,
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

		// Handle transaction ID
		const { transactionID, isTransactionCreated, reqWithTransaction } =
			await handleTransactionId(payload, req);

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
						user,
						req: reqWithTransaction,
						overrideAccess,
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
						user,
						req: reqWithTransaction,
						overrideAccess,
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
						user,
						req: reqWithTransaction,
						overrideAccess,
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
						user,
						req: reqWithTransaction,
						overrideAccess,
					});
				}
			} else if (type === "file") {
				const fileId = existingModule.file;
				if (
					fileId &&
					typeof fileId === "object" &&
					"id" in fileId &&
					fileId.id
				) {
					await payload.update({
						collection: "files",
						id: fileId.id,
						data: {
							media: args.fileData.media,
						},
						user,
						req: reqWithTransaction,
						overrideAccess,
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
						user,
						req: reqWithTransaction,
						overrideAccess,
					});
				}
			}

			// Validate that at least one field is being updated
			if (Object.keys(updateData).length === 0) {
				throw new InvalidArgumentError(
					"At least one field must be provided for update",
				);
			}

			await payload.update({
				collection: "activity-modules",
				id,
				data: updateData,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit the transaction only if we created it
			if (isTransactionCreated && transactionID) {
				await payload.db.commitTransaction(transactionID);
			}

			////////////////////////////////////////////////////
			// Fetch updated module with discriminated union
			////////////////////////////////////////////////////

			// Use tryGetActivityModuleById to fetch the updated module with all related data
			// This ensures we return the same discriminated union type
			const getResult = await tryGetActivityModuleById({
				payload,
				id,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			if (!getResult.ok) {
				throw new NonExistingActivityModuleError(
					`Failed to retrieve updated activity module with id '${id}'`,
				);
			}

			return getResult.value;
		} catch (error) {
			// Rollback the transaction on error only if we created it
			if (isTransactionCreated && transactionID) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update activity module", {
			cause: error,
		}),
);

export interface DeleteActivityModuleArgs {
	payload: Payload;
	id: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

/**
 * Deletes an activity module
 */
export const tryDeleteActivityModule = Result.wrap(
	async (args: DeleteActivityModuleArgs) => {
		const { payload, id, user = null, req, overrideAccess = false } = args;
		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Check if activity module exists
		const existingModule = await payload.findByID({
			collection: "activity-modules",
			joins: {
				linkedCourses: {
					limit: MOCK_INFINITY,
				},
			},
			id,
			user,
			req,
			overrideAccess,
		});

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		if (
			existingModule.linkedCourses?.docs &&
			existingModule.linkedCourses.docs.length > 0
		) {
			throw new InvalidArgumentError(
				"Activity module is linked to courses and cannot be deleted",
			);
		}

		// Handle transaction ID
		const { transactionID, isTransactionCreated, reqWithTransaction } =
			await handleTransactionId(payload, req);

		try {
			// Delete related entity first
			const moduleType = existingModule.type as string;
			if (moduleType === "file" && existingModule.file) {
				const fileId = existingModule.file;
				if (typeof fileId === "object" && "id" in fileId && fileId.id) {
					await payload.delete({
						collection: "files",
						id: fileId.id,
						user,
						req: reqWithTransaction,
						overrideAccess,
					});
				}
			} else if (moduleType === "assignment" && existingModule.assignment) {
				const assignmentId = existingModule.assignment;
				if (
					typeof assignmentId === "object" &&
					"id" in assignmentId &&
					assignmentId.id
				) {
					await payload.delete({
						collection: "assignments",
						id: assignmentId.id,
						user,
						req: reqWithTransaction,
						overrideAccess,
					});
				}
			} else if (moduleType === "quiz" && existingModule.quiz) {
				const quizId = existingModule.quiz;
				if (typeof quizId === "object" && "id" in quizId && quizId.id) {
					await payload.delete({
						collection: "quizzes",
						id: quizId.id,
						user,
						req: reqWithTransaction,
						overrideAccess,
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
						user,
						req: reqWithTransaction,
						overrideAccess,
					});
				}
			}

			// Delete the activity module
			const deletedActivityModule = await payload.delete({
				collection: "activity-modules",
				id,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit the transaction only if we created it
			if (isTransactionCreated && transactionID) {
				await payload.db.commitTransaction(transactionID);
			}

			return deletedActivityModule;
		} catch (error) {
			// Rollback the transaction on error only if we created it
			if (isTransactionCreated && transactionID) {
				await payload.db.rollbackTransaction(transactionID);
			}
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
export interface ListActivityModulesArgs {
	payload: Payload;
	userId?: number;
	type?: "page" | "whiteboard" | "file" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	limit?: number;
	page?: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export const tryListActivityModules = Result.wrap(
	async (args: ListActivityModulesArgs) => {
		const {
			payload,
			userId,
			type,
			status,
			limit = 10,
			page = 1,
			user = null,
			req,
			overrideAccess = false,
		} = args;

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
			user,
			req,
			overrideAccess,
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

type GetUserActivityModulesArgs = BaseInternalFunctionArgs & {
	userId: number;
};

/**
 * Gets all activity modules that a user owns or has access to
 * Includes modules where user is owner, creator, or has been granted access
 */
export const tryGetUserActivityModules = Result.wrap(
	async (args: GetUserActivityModulesArgs) => {
		const { payload, userId, user = null, req, overrideAccess = false } = args;

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
				req,
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
			req,
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
