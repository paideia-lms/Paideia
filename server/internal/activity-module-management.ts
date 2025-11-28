import { omit } from "es-toolkit";
import type { Payload, PayloadRequest, TypedUser } from "payload";
import type {
	LatestQuizConfig,
	LatestQuizConfig as QuizConfig,
} from "server/json/raw-quiz-config/version-resolver";
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
import {
	type BaseInternalFunctionArgs,
	interceptPayloadError,
	stripDepth,
} from "./utils/internal-function-utils";
import { ActivityModules } from "server/collections";

// Base args that are common to all module types
interface BaseCreateActivityModuleArgs extends BaseInternalFunctionArgs {
	title: string;
	description?: string;
	status?: "draft" | "published" | "archived";
	userId: number;
}

// Discriminated union for create args
export interface CreatePageModuleArgs extends BaseCreateActivityModuleArgs {
	content?: string;
}

export interface CreateWhiteboardModuleArgs
	extends BaseCreateActivityModuleArgs {
	content?: string;
}

export interface CreateAssignmentModuleArgs
	extends BaseCreateActivityModuleArgs {
	instructions?: string;
	requireTextSubmission?: boolean;
	requireFileSubmission?: boolean;
	allowedFileTypes?: Array<{ extension: string; mimeType: string }>;
	maxFileSize?: number;
	maxFiles?: number;
}

export interface CreateQuizModuleArgs extends BaseCreateActivityModuleArgs {
	description?: string;
	instructions?: string;
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
}

export interface CreateDiscussionModuleArgs
	extends BaseCreateActivityModuleArgs {
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
}

export interface CreateFileModuleArgs extends BaseCreateActivityModuleArgs {
	media?: number[];
}

export type CreateActivityModuleArgs =
	| ({ type: "page" } & CreatePageModuleArgs)
	| ({ type: "whiteboard" } & CreateWhiteboardModuleArgs)
	| ({ type: "file" } & CreateFileModuleArgs)
	| ({ type: "assignment" } & CreateAssignmentModuleArgs)
	| ({ type: "quiz" } & CreateQuizModuleArgs)
	| ({ type: "discussion" } & CreateDiscussionModuleArgs);

// Base args for update
export interface BaseUpdateActivityModuleArgs extends BaseInternalFunctionArgs {
	id: number;
	title?: string;
	description?: string;
	status?: "draft" | "published" | "archived";
}

// Discriminated union for update args
export interface UpdatePageModuleArgs extends BaseUpdateActivityModuleArgs {
	content?: string;
}

export interface UpdateWhiteboardModuleArgs
	extends BaseUpdateActivityModuleArgs {
	content?: string;
}

export interface UpdateAssignmentModuleArgs
	extends BaseUpdateActivityModuleArgs {
	instructions?: string;
	requireTextSubmission?: boolean;
	requireFileSubmission?: boolean;
	allowedFileTypes?: Array<{ extension: string; mimeType: string }>;
	maxFileSize?: number;
	maxFiles?: number;
}

export interface UpdateQuizModuleArgs extends BaseUpdateActivityModuleArgs {
	description?: string;
	instructions?: string;
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
}

export interface UpdateDiscussionModuleArgs
	extends BaseUpdateActivityModuleArgs {
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
}

export interface UpdateFileModuleArgs extends BaseUpdateActivityModuleArgs {
	media?: number[];
}

export type UpdateActivityModuleArgs =
	| ({ type: "page" } & UpdatePageModuleArgs)
	| ({ type: "whiteboard" } & UpdateWhiteboardModuleArgs)
	| ({ type: "file" } & UpdateFileModuleArgs)
	| ({ type: "assignment" } & UpdateAssignmentModuleArgs)
	| ({ type: "quiz" } & UpdateQuizModuleArgs)
	| ({ type: "discussion" } & UpdateDiscussionModuleArgs);

export interface GetActivityModuleByIdArgs extends BaseInternalFunctionArgs {
	id: number | string;
}

/**
 * Page type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
interface Page {
	id: number;
	content?: string | null;
	media?: number[] | null;
	updatedAt: string;
	createdAt: string;
}

/**
 * Whiteboard type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
interface Whiteboard {
	id: number;
	content?: string | null;
	updatedAt: string;
	createdAt: string;
}

/**
 * Raw File type from Payload - excludes createdBy as it's handled by BaseActivityModuleResult
 * Media is stored as IDs (number[])
 */
interface FileRaw {
	id: number;
	media?: number[] | null;
	updatedAt: string;
	createdAt: string;
}

/**
 * File type for ActivityModuleResult - excludes createdBy as it's handled by BaseActivityModuleResult
 * Media is enriched with full media objects (id, filename, mimeType, filesize)
 */
interface File {
	id: number;
	media?: Array<{
		id: number;
		filename?: string | null;
		mimeType?: string | null;
		filesize?: number | null;
	}> | null;
	updatedAt: string;
	createdAt: string;
}

/**
 * Assignment type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
interface Assignment {
	id: number;
	title: string;
	description?: string | null;
	instructions?: string | null;
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
}

/**
 * Quiz type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
interface Quiz {
	id: number;
	title: string;
	description?: string | null;
	instructions?: string | null;
	points?: number | null;
	timeLimit?: number | null; // Calculated from rawQuizConfig.globalTimer (in minutes)
	gradingType?: ("automatic" | "manual") | null;
	showCorrectAnswers?: boolean | null;
	allowMultipleAttempts?: boolean | null;
	shuffleQuestions?: boolean | null;
	shuffleAnswers?: boolean | null;
	showOneQuestionAtATime?: boolean | null;
	rawQuizConfig?: LatestQuizConfig | null;
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
}

/**
 * Discussion type - excludes createdBy as it's handled by BaseActivityModuleResult
 */
interface Discussion {
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
}

/**
 * Base type for activity module result with common fields
 */
interface BaseActivityModuleResult {
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
}

/**
 * Page module result
 */
interface PageModuleResult extends BaseActivityModuleResult, Page {
	type: "page";
}

/**
 * Whiteboard module result
 */
interface WhiteboardModuleResult extends BaseActivityModuleResult, Whiteboard {
	type: "whiteboard";
}

/**
 * File module result
 */
interface FileModuleResult extends BaseActivityModuleResult, File {
	type: "file";
}

/**
 * Assignment module result
 */
interface AssignmentModuleResult extends BaseActivityModuleResult, Assignment {
	type: "assignment";
}

/**
 * Quiz module result
 */
interface QuizModuleResult extends BaseActivityModuleResult, Quiz {
	type: "quiz";
}

/**
 * Discussion module result
 */
interface DiscussionModuleResult extends BaseActivityModuleResult, Discussion {
	type: "discussion";
}

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
interface ActivityModuleData {
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
	page?: (Page & { createdBy?: number | TypedUser }) | null;
	whiteboard?:
		| (Whiteboard & { createdBy?: number | TypedUser | unknown })
		| null;
	file?: (FileRaw & { createdBy?: number | TypedUser | unknown }) | null;
	assignment?:
		| (Assignment & { createdBy?: number | TypedUser | unknown })
		| null;
	quiz?: (Quiz & { createdBy?: number | TypedUser | unknown }) | null;
	discussion?:
		| (Discussion & { createdBy?: number | TypedUser | unknown })
		| null;
}

/**
 * Enriches media IDs to full media objects
 */
async function enrichMedia(
	mediaIds: number[] | null | undefined,
	payload: Payload,
	req: Partial<PayloadRequest> | undefined,
	overrideAccess: boolean,
): Promise<Array<{
	id: number;
	filename?: string | null;
	mimeType?: string | null;
	filesize?: number | null;
}> | null> {
	if (!mediaIds || mediaIds.length === 0) {
		return null;
	}

	try {
		const mediaResult = await payload.find({
			collection: "media",
			where: {
				id: {
					in: mediaIds,
				},
			},
			limit: mediaIds.length,
			req,
			depth: 0,
			overrideAccess,
		});

		return mediaResult.docs.map((media) => ({
			id: media.id,
			filename: media.filename ?? null,
			mimeType: media.mimeType ?? null,
			filesize: media.filesize ?? null,
		}));
	} catch (error) {
		console.error("Failed to fetch media data:", error);
		return null;
	}
}

/**
 * Builds a discriminated union result from base result and activity module data
 * Excludes createdBy from payload types since it's in BaseActivityModuleResult
 * Enriches media for file modules and calculates timeLimit for quiz modules
 */
async function buildDiscriminatedUnionResult(
	baseResult: BaseActivityModuleResult,
	data: ActivityModuleData,
	payload: Payload,
	req: Partial<PayloadRequest> | undefined,
	overrideAccess: boolean,
): Promise<ActivityModuleResult> {
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

		// Enrich media: convert media IDs to full media objects
		const enrichedMedia = await enrichMedia(
			fileData.media ?? null,
			payload,
			req,
			overrideAccess,
		);

		const result: FileModuleResult = {
			...baseResult,
			type: "file" as const,
			...omit(fileData, ["createdBy", "id", "media"]),
			media: enrichedMedia,
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

		// Calculate timeLimit from rawQuizConfig.globalTimer (convert seconds to minutes)
		let timeLimit: number | null = null;
		if (quizData.rawQuizConfig && typeof quizData.rawQuizConfig === "object") {
			const rawConfig = quizData.rawQuizConfig as { globalTimer?: number };
			if (rawConfig.globalTimer) {
				timeLimit = rawConfig.globalTimer / 60;
			}
		}

		const result: QuizModuleResult = {
			...baseResult,
			type: "quiz",
			...omit(quizData, ["createdBy", "id"]),
			timeLimit,
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
 * Creates a new page activity module
 */
export const tryCreatePageModule = Result.wrap(
	async (args: CreatePageModuleArgs) => {
		const {
			payload,
			title,
			description,
			status = "draft",
			userId,

			req,
			overrideAccess = false,
			content,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Create the page entity
			const page = await payload
				.create({
					collection: "pages",
					data: {
						content: content || "",
						createdBy: userId,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "create">());

			// Create the activity module
			const activityModule = await payload
				.create({
					collection: "activity-modules",
					data: {
						title,
						description,
						type: "page",
						status,
						createdBy: userId,
						owner: userId,
						page: page.id,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "create">());

			// Build result directly since we know the type
			const createdBy = activityModule.createdBy;
			const owner = activityModule.owner;

			const result = {
				id: activityModule.id,
				title: activityModule.title,
				description: activityModule.description,
				status: activityModule.status,
				type: "page",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				content: page.content ?? null,
				media: page.media,
				updatedAt: activityModule.updatedAt,
				createdAt: activityModule.createdAt,
			} satisfies PageModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create page module", {
			cause: error,
		}),
);

/**
 * Creates a new whiteboard activity module
 */
export const tryCreateWhiteboardModule = Result.wrap(
	async (args: CreateWhiteboardModuleArgs) => {
		const {
			payload,
			title,
			description,
			status = "draft",
			userId,

			req,
			overrideAccess = false,
			content,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Create the whiteboard entity
			const whiteboard = await payload
				.create({
					collection: "whiteboards",
					data: {
						content: content || "",
						createdBy: userId,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "create">());

			// Create the activity module
			const activityModule = await payload
				.create({
					collection: "activity-modules",
					data: {
						title,
						description,
						type: "whiteboard",
						status,
						createdBy: userId,
						owner: userId,
						whiteboard: whiteboard.id,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "create">());

			// Build result directly since we know the type
			const createdBy = activityModule.createdBy;
			const owner = activityModule.owner;

			const result = {
				id: activityModule.id,
				title: activityModule.title,
				description: activityModule.description,
				status: activityModule.status,
				type: "whiteboard",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				content: whiteboard.content ?? null,
				updatedAt: activityModule.updatedAt,
				createdAt: activityModule.createdAt,
			} satisfies WhiteboardModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create whiteboard module", {
			cause: error,
		}),
);

/**
 * Creates a new file activity module
 */
export const tryCreateFileModule = Result.wrap(
	async (args: CreateFileModuleArgs) => {
		const {
			payload,
			title,
			description,
			status = "draft",
			userId,

			req,
			overrideAccess = false,
			media,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Create the file entity
			const file = await payload
				.create({
					collection: "files",
					data: {
						media: media || [],
						createdBy: userId,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "create">());

			// Create the activity module
			const activityModule = await payload
				.create({
					collection: "activity-modules",
					data: {
						title,
						description,
						type: "file",
						status,
						createdBy: userId,
						owner: userId,
						file: file.id,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "create">());

			// Build result directly since we know the type
			const createdBy = activityModule.createdBy;
			const owner = activityModule.owner;
			const fileMediaIds = file.media ?? null;

			// Enrich media
			const enrichedMedia = await enrichMedia(
				fileMediaIds,
				payload,
				reqWithTransaction,
				overrideAccess,
			);

			const result = {
				id: activityModule.id,
				title: activityModule.title,
				description: activityModule.description,
				status: activityModule.status,
				type: "file",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				media: enrichedMedia,
				updatedAt: activityModule.updatedAt,
				createdAt: activityModule.createdAt,
			} satisfies FileModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create file module", {
			cause: error,
		}),
);

/**
 * Creates a new assignment activity module
 */
export const tryCreateAssignmentModule = Result.wrap(
	async (args: CreateAssignmentModuleArgs) => {
		const {
			payload,
			title,
			description,
			status = "draft",
			userId,

			req,
			overrideAccess = false,
			instructions,
			requireTextSubmission,
			requireFileSubmission,
			allowedFileTypes,
			maxFileSize,
			maxFiles,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Create the assignment entity
			const assignment = await payload
				.create({
					collection: "assignments",
					data: {
						title,
						description: description,
						instructions: instructions,
						requireTextSubmission: requireTextSubmission,
						requireFileSubmission: requireFileSubmission,
						allowedFileTypes: allowedFileTypes,
						maxFileSize: maxFileSize,
						maxFiles: maxFiles,
						createdBy: userId,
					},
					req: reqWithTransaction,
					context: req?.context,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "create">())
				.catch((error) => {
					interceptPayloadError(
						error,
						"tryCreateAssignmentModule",
						`to create assignment`,
						args,
					);
					throw error;
				});

			// Create the activity module
			const activityModule = await payload
				.create({
					collection: "activity-modules",
					data: {
						title,
						description,
						type: "assignment",
						status,
						createdBy: userId,
						owner: userId,
						assignment: assignment.id,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "create">())
				.catch((error) => {
					interceptPayloadError(
						error,
						"tryCreateAssignmentModule",
						`to create activity module`,
						args,
					);
					throw error;
				});

			// Build result directly since we know the type
			const createdBy = activityModule.createdBy;
			const owner = activityModule.owner;

			const result = {
				id: activityModule.id,
				title: activityModule.title,
				description: activityModule.description,
				status: activityModule.status,
				type: "assignment",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				instructions: assignment.instructions ?? null,
				allowedFileTypes: assignment.allowedFileTypes ?? null,
				maxFileSize: assignment.maxFileSize ?? null,
				maxFiles: assignment.maxFiles ?? null,
				requireTextSubmission: assignment.requireTextSubmission ?? null,
				requireFileSubmission: assignment.requireFileSubmission ?? null,
				updatedAt: activityModule.updatedAt,
				createdAt: activityModule.createdAt,
			};

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create assignment module", {
			cause: error,
		}),
);

/**
 * Creates a new quiz activity module
 */
export const tryCreateQuizModule = Result.wrap(
	async (args: CreateQuizModuleArgs) => {
		const {
			payload,
			title,
			description,
			status = "draft",
			userId,

			req,
			overrideAccess = false,
			instructions,
			points,
			gradingType,
			showCorrectAnswers,
			allowMultipleAttempts,
			shuffleQuestions,
			shuffleAnswers,
			showOneQuestionAtATime,
			rawQuizConfig,
			questions,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Create the quiz entity
			const quiz = await payload
				.create({
					collection: "quizzes",
					data: {
						title,
						description: description,
						instructions: instructions,
						points: points,
						gradingType: gradingType,
						showCorrectAnswers: showCorrectAnswers,
						allowMultipleAttempts: allowMultipleAttempts,
						shuffleQuestions: shuffleQuestions,
						shuffleAnswers: shuffleAnswers,
						showOneQuestionAtATime: showOneQuestionAtATime,
						rawQuizConfig: rawQuizConfig as unknown as {
							[x: string]: unknown;
						},
						questions: questions,
						createdBy: userId,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "create">());

			// Create the activity module
			const activityModule = await payload
				.create({
					collection: "activity-modules",
					data: {
						title,
						description: description,
						type: "quiz",
						status,
						createdBy: userId,
						owner: userId,
						quiz: quiz.id,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "create">());

			// Build result directly since we know the type
			const createdBy = activityModule.createdBy;
			const owner = activityModule.owner;

			const result = {
				id: activityModule.id,
				title: activityModule.title,
				description: activityModule.description,
				status: activityModule.status,
				type: "quiz",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				instructions: quiz.instructions ?? null,
				points: quiz.points ?? null,
				gradingType: quiz.gradingType ?? null,
				showCorrectAnswers: quiz.showCorrectAnswers ?? null,
				allowMultipleAttempts: quiz.allowMultipleAttempts ?? null,
				shuffleQuestions: quiz.shuffleQuestions ?? null,
				shuffleAnswers: quiz.shuffleAnswers ?? null,
				showOneQuestionAtATime: quiz.showOneQuestionAtATime ?? null,
				rawQuizConfig:
					(quiz.rawQuizConfig as unknown as LatestQuizConfig) ?? null,
				questions: quiz.questions ?? null,
				updatedAt: activityModule.updatedAt,
				createdAt: activityModule.createdAt,
			} satisfies QuizModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create quiz module", {
			cause: error,
		}),
);

/**
 * Creates a new discussion activity module
 */
export const tryCreateDiscussionModule = Result.wrap(
	async (args: CreateDiscussionModuleArgs) => {
		const {
			payload,
			title,
			description,
			status = "draft",
			userId,

			req,
			overrideAccess = false,
			instructions,
			dueDate,
			requireThread,
			requireReplies,
			minReplies,
			minWordsPerPost,
			allowAttachments,
			allowUpvotes,
			allowEditing,
			allowDeletion,
			moderationRequired,
			anonymousPosting,
			groupDiscussion,
			maxGroupSize,
			threadSorting,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Create the discussion entity
			const discussion = await payload
				.create({
					collection: "discussions",
					data: {
						title,
						description: description,
						instructions: instructions,
						dueDate: dueDate,
						requireThread: requireThread,
						requireReplies: requireReplies,
						minReplies: minReplies,
						minWordsPerPost: minWordsPerPost,
						allowAttachments: allowAttachments,
						allowUpvotes: allowUpvotes,
						allowEditing: allowEditing,
						allowDeletion: allowDeletion,
						moderationRequired: moderationRequired,
						anonymousPosting: anonymousPosting,
						groupDiscussion: groupDiscussion,
						maxGroupSize: maxGroupSize,
						threadSorting: threadSorting || "recent",
						createdBy: userId,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "create">());

			// Create the activity module
			const activityModule = await payload
				.create({
					collection: "activity-modules",
					data: {
						title,
						description: description,
						type: "discussion",
						status,
						createdBy: userId,
						owner: userId,
						discussion: discussion.id,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "create">());

			// Build result directly since we know the type
			const createdBy = activityModule.createdBy;
			const owner = activityModule.owner;

			const result: DiscussionModuleResult = {
				id: activityModule.id,
				title: activityModule.title,
				description: activityModule.description,
				status: activityModule.status,
				type: "discussion",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
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
				updatedAt: activityModule.updatedAt,
				createdAt: activityModule.createdAt,
			} satisfies DiscussionModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create discussion module", {
			cause: error,
		}),
);

/**
 * Creates a new activity module using Payload local API
 * Delegates to type-specific create functions based on the module type
 */
// export const tryCreateActivityModule = Result.wrap(
// 	async (args: CreateActivityModuleArgs) => {
// 		if (args.type === "page") {
// 			const result = await tryCreatePageModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "whiteboard") {
// 			const result = await tryCreateWhiteboardModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "file") {
// 			const result = await tryCreateFileModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "assignment") {
// 			const result = await tryCreateAssignmentModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "quiz") {
// 			const result = await tryCreateQuizModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "discussion") {
// 			const result = await tryCreateDiscussionModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		throw new InvalidArgumentError(`Unknown module type`);
// 	},
// 	(error) =>
// 		transformError(error) ??
// 		new UnknownError("Failed to create activity module", {
// 			cause: error,
// 		}),
// );

/**
 * Get an activity module by ID
 */
export const tryGetActivityModuleById = Result.wrap(
	async (args: GetActivityModuleByIdArgs) => {
		const { payload, id, req, overrideAccess = false } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Fetch the activity module with related data
		const activityModuleResult = await payload
			.find({
				collection: ActivityModules.slug,
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
				pagination: false,
				depth: 1, // Fetch related assignment/quiz/discussion data
				req,
				context: req?.context,
				overrideAccess,
			})
			.then(stripDepth<1, "find">())
			.then((r) => {
				const am = r.docs[0];
				if (!am) {
					return null;
				}
				const createdBy = am.createdBy;
				const owner = am.owner;
				const page = am.page;
				const whiteboard = am.whiteboard;
				const file = am.file;
				const assignment = am.assignment;
				const quiz = am.quiz;
				const discussion = am.discussion;
				const createdByAvatar = createdBy.avatar;
				const ownerAvatar = owner.avatar;
				// NOTE: Submissions are no longer joined on activity-modules.
				// They now link to course-activity-module-links instead.

				const grants = am.grants?.docs ?? [];

				// type narrowing file
				const fileMedia = file?.media?.map((m) => {
					return m;
				});

				const pageMedia = page?.media;
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
			})
			.catch((error) => {
				interceptPayloadError(
					error,
					"tryGetActivityModuleById",
					`to get activity module by id '${id}'`,
					{ payload, req, overrideAccess },
				);
				throw error;
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
			quiz: activityModuleResult.quiz
				? {
						...activityModuleResult.quiz,
						rawQuizConfig:
							(activityModuleResult.quiz
								.rawQuizConfig as unknown as LatestQuizConfig) ?? null,
					}
				: null,
			discussion: activityModuleResult.discussion,
		};

		return buildDiscriminatedUnionResult(
			baseResult,
			moduleData,
			payload,
			req,
			overrideAccess,
		);
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get activity module", {
			cause: error,
		}),
);

/**
 * Updates a page activity module
 */
export const tryUpdatePageModule = Result.wrap(
	async (args: UpdatePageModuleArgs) => {
		const {
			payload,
			id,
			title,
			description,
			status,

			req,
			overrideAccess = false,
			content,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Get the existing activity module to check its current type
		const existingModule = await payload
			.findByID({
				collection: "activity-modules",
				id,
				req,
				depth: 0,
				overrideAccess,
			})
			.then(stripDepth<0, "findByID">());

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		// Verify type matches
		const currentType = existingModule.type;
		const pageId = existingModule.page;
		if (currentType !== "page" || !pageId) {
			throw new InvalidArgumentError(
				`Cannot update page data for a ${currentType} module`,
			);
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Build update data object for activity module
			const updateData: Record<string, unknown> = {};
			if (title !== undefined) updateData.title = title;
			if (description !== undefined) updateData.description = description;
			if (status !== undefined) updateData.status = status;

			// Update related entity
			await payload
				.update({
					collection: "pages",
					id: pageId,
					data: {
						content: content,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Validate that at least one field is being updated
			if (Object.keys(updateData).length === 0) {
				throw new InvalidArgumentError(
					"At least one field must be provided for update",
				);
			}

			await payload
				.update({
					collection: "activity-modules",
					id,
					data: updateData,
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Fetch updated module with depth 1 to get related data
			const updatedModule = await payload
				.findByID({
					collection: "activity-modules",
					id,
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			if (!updatedModule) {
				throw new NonExistingActivityModuleError(
					`Failed to retrieve updated activity module with id '${id}'`,
				);
			}

			// Build result directly since we know the type
			const createdBy = updatedModule.createdBy;
			const owner = updatedModule.owner;
			const pageRelation = updatedModule.page;

			const result = {
				id: updatedModule.id,
				title: updatedModule.title,
				description: updatedModule.description,
				status: updatedModule.status,
				type: "page",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				content: pageRelation?.content ?? null,
				media: pageRelation?.media ?? null,
				updatedAt: updatedModule.updatedAt,
				createdAt: updatedModule.createdAt,
			} satisfies PageModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update page module", {
			cause: error,
		}),
);

/**
 * Updates a whiteboard activity module
 */
export const tryUpdateWhiteboardModule = Result.wrap(
	async (args: UpdateWhiteboardModuleArgs) => {
		const {
			payload,
			id,
			title,
			description,
			status,

			req,
			overrideAccess = false,
			content,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Get the existing activity module to check its current type
		const existingModule = await payload
			.findByID({
				collection: "activity-modules",
				id,
				req,
				depth: 0,
				overrideAccess,
			})
			.then(stripDepth<0, "findByID">());

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		// Verify type matches
		const currentType = existingModule.type;
		const whiteboardId = existingModule.whiteboard;
		if (currentType !== "whiteboard" || !whiteboardId) {
			throw new InvalidArgumentError(
				`Cannot update whiteboard data for a ${currentType} module`,
			);
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Build update data object for activity module
			const updateData: Record<string, unknown> = {};
			if (title !== undefined) updateData.title = title;
			if (description !== undefined) updateData.description = description;
			if (status !== undefined) updateData.status = status;

			// Update related entity
			await payload
				.update({
					collection: "whiteboards",
					id: whiteboardId,
					data: {
						content: content,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Validate that at least one field is being updated
			if (Object.keys(updateData).length === 0) {
				throw new InvalidArgumentError(
					"At least one field must be provided for update",
				);
			}

			await payload
				.update({
					collection: "activity-modules",
					id,
					data: updateData,
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Fetch updated module with depth 1 to get related data
			const updatedModule = await payload
				.findByID({
					collection: "activity-modules",
					id,
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			if (!updatedModule) {
				throw new NonExistingActivityModuleError(
					`Failed to retrieve updated activity module with id '${id}'`,
				);
			}

			// Build result directly since we know the type
			const createdBy = updatedModule.createdBy;
			const owner = updatedModule.owner;
			const whiteboardRelation = updatedModule.whiteboard;

			const result = {
				id: updatedModule.id,
				title: updatedModule.title,
				description: updatedModule.description,
				status: updatedModule.status,
				type: "whiteboard",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				content: whiteboardRelation?.content ?? null,
				updatedAt: updatedModule.updatedAt,
				createdAt: updatedModule.createdAt,
			} satisfies WhiteboardModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update whiteboard module", {
			cause: error,
		}),
);

/**
 * Updates a file activity module
 */
export const tryUpdateFileModule = Result.wrap(
	async (args: UpdateFileModuleArgs) => {
		const {
			payload,
			id,
			title,
			description,
			status,

			req,
			overrideAccess = false,
			media,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Get the existing activity module to check its current type
		const existingModule = await payload
			.findByID({
				collection: "activity-modules",
				id,
				req,
				depth: 0,
				overrideAccess,
			})
			.then(stripDepth<0, "findByID">());

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		// Verify type matches
		const currentType = existingModule.type;
		const fileId = existingModule.file;
		if (currentType !== "file" || !fileId) {
			throw new InvalidArgumentError(
				`Cannot update file data for a ${currentType} module`,
			);
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Build update data object for activity module
			const updateData: Record<string, unknown> = {};
			if (title !== undefined) updateData.title = title;
			if (description !== undefined) updateData.description = description;
			if (status !== undefined) updateData.status = status;

			// Update related entity
			await payload
				.update({
					collection: "files",
					id: fileId,
					data: {
						media: media,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Validate that at least one field is being updated
			if (Object.keys(updateData).length === 0) {
				throw new InvalidArgumentError(
					"At least one field must be provided for update",
				);
			}

			await payload
				.update({
					collection: "activity-modules",
					id,
					data: updateData,
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Fetch updated module with depth 1 to get related data
			const updatedModule = await payload
				.findByID({
					collection: "activity-modules",
					id,
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			if (!updatedModule) {
				throw new NonExistingActivityModuleError(
					`Failed to retrieve updated activity module with id '${id}'`,
				);
			}

			// Build result directly since we know the type
			const createdBy = updatedModule.createdBy;
			const owner = updatedModule.owner;
			const fileRelation = updatedModule.file;
			const fileMediaIds = fileRelation?.media ?? null;

			// Enrich media
			const enrichedMedia = await enrichMedia(
				fileMediaIds,
				payload,
				reqWithTransaction,
				overrideAccess,
			);

			const result = {
				id: updatedModule.id,
				title: updatedModule.title,
				description: updatedModule.description,
				status: updatedModule.status,
				type: "file",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				media: enrichedMedia,
				updatedAt: updatedModule.updatedAt,
				createdAt: updatedModule.createdAt,
			} satisfies FileModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update file module", {
			cause: error,
		}),
);

/**
 * Updates an assignment activity module
 */
export const tryUpdateAssignmentModule = Result.wrap(
	async (args: UpdateAssignmentModuleArgs) => {
		const {
			payload,
			id,
			title,
			description,
			status,

			req,
			overrideAccess = false,
			instructions,
			requireTextSubmission,
			requireFileSubmission,
			allowedFileTypes,
			maxFileSize,
			maxFiles,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Get the existing activity module to check its current type
		const existingModule = await payload
			.findByID({
				collection: "activity-modules",
				id,
				req,
				depth: 0,
				overrideAccess,
			})
			.then(stripDepth<0, "findByID">());

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		// Verify type matches
		const currentType = existingModule.type;
		const assignmentId = existingModule.assignment;
		if (currentType !== "assignment" || !assignmentId) {
			throw new InvalidArgumentError(
				`Cannot update assignment data for a ${currentType} module`,
			);
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Build update data object for activity module
			const updateData: Record<string, unknown> = {};
			if (title !== undefined) updateData.title = title;
			if (description !== undefined) updateData.description = description;
			if (status !== undefined) updateData.status = status;

			// Update related entity
			await payload
				.update({
					collection: "assignments",
					id: assignmentId,
					data: {
						title: title || existingModule.title,
						description:
							instructions || description || existingModule.description,
						instructions: instructions,
						requireTextSubmission: requireTextSubmission,
						requireFileSubmission: requireFileSubmission,
						allowedFileTypes: allowedFileTypes,
						maxFileSize: maxFileSize,
						maxFiles: maxFiles,
					},
					req: reqWithTransaction,
					overrideAccess,
					context: req?.context,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Validate that at least one field is being updated
			if (Object.keys(updateData).length === 0) {
				throw new InvalidArgumentError(
					"At least one field must be provided for update",
				);
			}

			await payload
				.update({
					collection: "activity-modules",
					id,
					data: updateData,
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Fetch updated module with depth 1 to get related data
			const updatedModule = await payload
				.findByID({
					collection: "activity-modules",
					id,
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			if (!updatedModule) {
				throw new NonExistingActivityModuleError(
					`Failed to retrieve updated activity module with id '${id}'`,
				);
			}

			// Build result directly since we know the type
			const createdBy = updatedModule.createdBy;
			const owner = updatedModule.owner;
			const assignmentRelation = updatedModule.assignment;

			const result = {
				id: updatedModule.id,
				title: updatedModule.title,
				description: updatedModule.description,
				status: updatedModule.status,
				type: "assignment",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				instructions: assignmentRelation?.instructions ?? null,
				allowedFileTypes: assignmentRelation?.allowedFileTypes ?? null,
				maxFileSize: assignmentRelation?.maxFileSize ?? null,
				maxFiles: assignmentRelation?.maxFiles ?? null,
				requireTextSubmission:
					assignmentRelation?.requireTextSubmission ?? null,
				requireFileSubmission:
					assignmentRelation?.requireFileSubmission ?? null,
				updatedAt: updatedModule.updatedAt,
				createdAt: updatedModule.createdAt,
			} satisfies AssignmentModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update assignment module", {
			cause: error,
		}),
);

/**
 * Updates a quiz activity module
 */
export const tryUpdateQuizModule = Result.wrap(
	async (args: UpdateQuizModuleArgs) => {
		const {
			payload,
			id,
			title,
			description,
			status,

			req,
			overrideAccess = false,
			instructions,
			points,
			gradingType,
			showCorrectAnswers,
			allowMultipleAttempts,
			shuffleQuestions,
			shuffleAnswers,
			showOneQuestionAtATime,
			rawQuizConfig,
			questions,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Get the existing activity module to check its current type
		const existingModule = await payload
			.findByID({
				collection: "activity-modules",
				id,
				req,
				depth: 0,
				overrideAccess,
			})
			.then(stripDepth<0, "findByID">());

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		// Verify type matches
		const currentType = existingModule.type;
		const quizId = existingModule.quiz;
		if (currentType !== "quiz" || !quizId) {
			throw new InvalidArgumentError(
				`Cannot update quiz data for a ${currentType} module`,
			);
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Build update data object for activity module
			const updateData: Record<string, unknown> = {};
			if (title !== undefined) updateData.title = title;
			if (description !== undefined) updateData.description = description;
			if (status !== undefined) updateData.status = status;

			// Update related entity
			await payload
				.update({
					collection: "quizzes",
					id: quizId,
					data: {
						title: title ?? undefined,
						description: description ?? undefined,
						instructions: instructions,
						points: points,
						gradingType: gradingType,
						showCorrectAnswers: showCorrectAnswers,
						allowMultipleAttempts: allowMultipleAttempts,
						shuffleQuestions: shuffleQuestions,
						shuffleAnswers: shuffleAnswers,
						showOneQuestionAtATime: showOneQuestionAtATime,
						rawQuizConfig: rawQuizConfig as unknown as {
							[x: string]: unknown;
						},
						questions: questions,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Validate that at least one field is being updated
			if (Object.keys(updateData).length === 0) {
				throw new InvalidArgumentError(
					"At least one field must be provided for update",
				);
			}

			await payload
				.update({
					collection: "activity-modules",
					id,
					data: updateData,
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Fetch updated module with depth 1 to get related data
			const updatedModule = await payload
				.findByID({
					collection: "activity-modules",
					id,
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			if (!updatedModule) {
				throw new NonExistingActivityModuleError(
					`Failed to retrieve updated activity module with id '${id}'`,
				);
			}

			// Build result directly since we know the type
			const createdBy = updatedModule.createdBy;
			const owner = updatedModule.owner;
			const quizRelation = updatedModule.quiz;

			const result = {
				id: updatedModule.id,
				title: updatedModule.title,
				description: updatedModule.description,
				status: updatedModule.status,
				type: "quiz",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				instructions: quizRelation?.instructions ?? null,
				points: quizRelation?.points ?? null,
				gradingType: quizRelation?.gradingType ?? null,
				showCorrectAnswers: quizRelation?.showCorrectAnswers ?? null,
				allowMultipleAttempts: quizRelation?.allowMultipleAttempts ?? null,
				shuffleQuestions: quizRelation?.shuffleQuestions ?? null,
				shuffleAnswers: quizRelation?.shuffleAnswers ?? null,
				showOneQuestionAtATime: quizRelation?.showOneQuestionAtATime ?? null,
				rawQuizConfig:
					(quizRelation?.rawQuizConfig as unknown as LatestQuizConfig) ?? null,
				questions: quizRelation?.questions ?? null,
				updatedAt: updatedModule.updatedAt,
				createdAt: updatedModule.createdAt,
			} satisfies QuizModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update quiz module", {
			cause: error,
		}),
);

/**
 * Updates a discussion activity module
 */
export const tryUpdateDiscussionModule = Result.wrap(
	async (args: UpdateDiscussionModuleArgs) => {
		const {
			payload,
			id,
			title,
			description,
			status,

			req,
			overrideAccess = false,
			instructions,
			dueDate,
			requireThread,
			requireReplies,
			minReplies,
			minWordsPerPost,
			allowAttachments,
			allowUpvotes,
			allowEditing,
			allowDeletion,
			moderationRequired,
			anonymousPosting,
			groupDiscussion,
			maxGroupSize,
			threadSorting,
		} = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Get the existing activity module to check its current type
		const existingModule = await payload
			.findByID({
				collection: "activity-modules",
				id,
				req,
				depth: 0,
				overrideAccess,
			})
			.then(stripDepth<0, "findByID">());

		if (!existingModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		// Verify type matches
		const currentType = existingModule.type;
		const discussionId = existingModule.discussion;
		if (currentType !== "discussion" || !discussionId) {
			throw new InvalidArgumentError(
				`Cannot update discussion data for a ${currentType} module`,
			);
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Build update data object for activity module
			const updateData: Record<string, unknown> = {};
			if (title !== undefined) updateData.title = title;
			if (description !== undefined) updateData.description = description;
			if (status !== undefined) updateData.status = status;

			// Update related entity
			await payload
				.update({
					collection: "discussions",
					id: discussionId,
					data: {
						title: title ?? undefined,
						description: description ?? undefined,
						instructions: instructions,
						dueDate: dueDate,
						requireThread: requireThread,
						requireReplies: requireReplies,
						minReplies: minReplies,
						minWordsPerPost: minWordsPerPost,
						allowAttachments: allowAttachments,
						allowUpvotes: allowUpvotes,
						allowEditing: allowEditing,
						allowDeletion: allowDeletion,
						moderationRequired: moderationRequired,
						anonymousPosting: anonymousPosting,
						groupDiscussion: groupDiscussion,
						maxGroupSize: maxGroupSize,
						threadSorting: threadSorting,
					},
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Validate that at least one field is being updated
			if (Object.keys(updateData).length === 0) {
				throw new InvalidArgumentError(
					"At least one field must be provided for update",
				);
			}

			await payload
				.update({
					collection: "activity-modules",
					id,
					data: updateData,
					req: reqWithTransaction,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "update">());

			// Fetch updated module with depth 1 to get related data
			const updatedModule = await payload
				.findByID({
					collection: "activity-modules",
					id,
					req: reqWithTransaction,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			if (!updatedModule) {
				throw new NonExistingActivityModuleError(
					`Failed to retrieve updated activity module with id '${id}'`,
				);
			}

			// Build result directly since we know the type
			const createdBy = updatedModule.createdBy;
			const owner = updatedModule.owner;
			const discussionRelation = updatedModule.discussion;

			const result = {
				id: updatedModule.id,
				title: updatedModule.title,
				description: updatedModule.description,
				status: updatedModule.status,
				type: "discussion",
				createdBy: {
					id: createdBy.id,
					avatar: createdBy.avatar ?? null,
					email: createdBy.email ?? "",
					firstName: createdBy.firstName ?? "",
					lastName: createdBy.lastName ?? "",
				},
				owner: {
					id: owner.id,
					avatar: owner.avatar ?? null,
					email: owner.email ?? "",
					firstName: owner.firstName ?? "",
					lastName: owner.lastName ?? "",
				},
				instructions: discussionRelation?.instructions ?? null,
				dueDate: discussionRelation?.dueDate ?? null,
				requireThread: discussionRelation?.requireThread ?? null,
				requireReplies: discussionRelation?.requireReplies ?? null,
				minReplies: discussionRelation?.minReplies ?? null,
				minWordsPerPost: discussionRelation?.minWordsPerPost ?? null,
				allowAttachments: discussionRelation?.allowAttachments ?? null,
				allowUpvotes: discussionRelation?.allowUpvotes ?? null,
				allowEditing: discussionRelation?.allowEditing ?? null,
				allowDeletion: discussionRelation?.allowDeletion ?? null,
				moderationRequired: discussionRelation?.moderationRequired ?? null,
				anonymousPosting: discussionRelation?.anonymousPosting ?? null,
				groupDiscussion: discussionRelation?.groupDiscussion ?? null,
				maxGroupSize: discussionRelation?.maxGroupSize ?? null,
				threadSorting: discussionRelation?.threadSorting ?? null,
				pinnedThreads: discussionRelation?.pinnedThreads ?? null,
				updatedAt: updatedModule.updatedAt,
				createdAt: updatedModule.createdAt,
			} satisfies DiscussionModuleResult;

			return result;
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update discussion module", {
			cause: error,
		}),
);

// /**
//  * Updates an activity module
//  * Delegates to type-specific update functions based on the module type
//  */
// export const tryUpdateActivityModule = Result.wrap(
// 	async (args: UpdateActivityModuleArgs) => {
// 		if (args.type === "page") {
// 			const result = await tryUpdatePageModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "whiteboard") {
// 			const result = await tryUpdateWhiteboardModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "file") {
// 			const result = await tryUpdateFileModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "assignment") {
// 			const result = await tryUpdateAssignmentModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "quiz") {
// 			const result = await tryUpdateQuizModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		if (args.type === "discussion") {
// 			const result = await tryUpdateDiscussionModule(args);
// 			if (!result.ok) throw result.error;
// 			return result.value;
// 		}
// 		// TypeScript should never reach here, but handle it for safety
// 		const type = (args as { type: string }).type;
// 		throw new InvalidArgumentError(`Unknown module type: ${type}`);
// 	},
// 	(error) =>
// 		transformError(error) ??
// 		new UnknownError("Failed to update activity module", {
// 			cause: error,
// 		}),
// );

export interface DeleteActivityModuleArgs extends BaseInternalFunctionArgs {
	id: number;
}

/**
 * Deletes an activity module
 */
export const tryDeleteActivityModule = Result.wrap(
	async (args: DeleteActivityModuleArgs) => {
		const { payload, id, req, overrideAccess = false } = args;
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
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Delete related entity first
			const moduleType = existingModule.type as string;
			if (moduleType === "file" && existingModule.file) {
				const fileId = existingModule.file;
				if (typeof fileId === "object" && "id" in fileId && fileId.id) {
					await payload.delete({
						collection: "files",
						id: fileId.id,
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
						req: reqWithTransaction,
						context: req?.context,
						overrideAccess,
					});
				}
			} else if (moduleType === "quiz" && existingModule.quiz) {
				const quizId = existingModule.quiz;
				if (typeof quizId === "object" && "id" in quizId && quizId.id) {
					await payload.delete({
						collection: "quizzes",
						id: quizId.id,
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
						req: reqWithTransaction,
						overrideAccess,
					});
				}
			}

			// Delete the activity module
			const deletedActivityModule = await payload.delete({
				collection: "activity-modules",
				id,
				req: reqWithTransaction,
				overrideAccess,
			});

			return deletedActivityModule;
		});
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
export interface ListActivityModulesArgs extends BaseInternalFunctionArgs {
	userId?: number;
	type?: "page" | "whiteboard" | "file" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	limit?: number;
	page?: number;
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
		const { payload, userId, req, overrideAccess = false } = args;

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
