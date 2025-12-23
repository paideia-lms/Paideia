import type { Simplify } from "node_modules/type-fest";
import type { LatestQuizConfig as QuizConfig } from "server/json/raw-quiz-config/version-resolver";
import type { ActivityModule } from "server/payload-types";
import { z } from "zod";
import { presetValuesToFileTypes } from "./file-types";

/**
 * Base schema with common fields for all activity module types
 */
const baseActivityModuleSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	status: z.enum(["draft", "published", "archived"]).optional(),
});

/**
 * Page module schema
 */
const pageModuleSchema = baseActivityModuleSchema.extend({
	type: z.literal("page"),
	pageContent: z.string().optional(),
});

/**
 * Whiteboard module schema
 */
const whiteboardModuleSchema = baseActivityModuleSchema.extend({
	type: z.literal("whiteboard"),
	whiteboardContent: z.string().optional(),
});

/**
 * File module schema
 */
const fileModuleSchema = baseActivityModuleSchema.extend({
	type: z.literal("file"),
	fileMedia: z.array(z.number()).optional(),
});

/**
 * Assignment module schema
 */
const assignmentModuleSchema = baseActivityModuleSchema.extend({
	type: z.literal("assignment"),
	assignmentInstructions: z.string().optional(),
	assignmentRequireTextSubmission: z.boolean().optional(),
	assignmentRequireFileSubmission: z.boolean().optional(),
	assignmentAllowedFileTypes: z.array(z.string()).optional(),
	assignmentMaxFileSize: z.number().optional(),
	assignmentMaxFiles: z.number().optional(),
});

/**
 * Quiz module schema
 */
const quizModuleSchema = baseActivityModuleSchema.extend({
	type: z.literal("quiz"),
	quizInstructions: z.string().optional(),
	quizPoints: z.number().optional(),
	quizTimeLimit: z.number().optional(),
	quizGradingType: z.enum(["automatic", "manual"]).optional(),
	rawQuizConfig: z.custom<QuizConfig>().optional(), // QuizConfig JSON
});

/**
 * Discussion module schema
 */
const discussionModuleSchema = baseActivityModuleSchema.extend({
	type: z.literal("discussion"),
	discussionInstructions: z.string().optional(),
	discussionDueDate: z.string().optional(),
	discussionRequireThread: z.boolean().optional(),
	discussionRequireReplies: z.boolean().optional(),
	discussionMinReplies: z.number().optional(),
});

/**
 * Shared schema for activity module forms (create and update)
 * Uses discriminated union to ensure type safety
 */
export const activityModuleSchema = z.discriminatedUnion("type", [
	pageModuleSchema,
	whiteboardModuleSchema,
	fileModuleSchema,
	assignmentModuleSchema,
	quizModuleSchema,
	discussionModuleSchema,
]);

/**
 * Base form values with common fields for all activity module types
 */
type BaseActivityModuleFormValues = {
	title: string;
	description: string;
	status: ActivityModule["status"];
};

/**
 * Page module form values
 */
export type PageModuleFormValues = Simplify<
	BaseActivityModuleFormValues & {
		type: "page";
		pageContent: string;
	}
>;

/**
 * Whiteboard module form values
 */
export type WhiteboardModuleFormValues = Simplify<
	BaseActivityModuleFormValues & {
		type: "whiteboard";
		whiteboardContent: string;
	}
>;

/**
 * File module form values
 */
export type FileModuleFormValues = Simplify<
	BaseActivityModuleFormValues & {
		type: "file";
		fileMedia: number[];
		fileFiles: File[]; // Files to upload (before they become media IDs)
	}
>;

/**
 * Assignment module form values
 */
export type AssignmentModuleFormValues = Simplify<
	BaseActivityModuleFormValues & {
		type: "assignment";
		assignmentInstructions: string;
		assignmentRequireTextSubmission: boolean;
		assignmentRequireFileSubmission: boolean;
		assignmentAllowedFileTypes: string[];
		assignmentMaxFileSize: number;
		assignmentMaxFiles: number;
	}
>;

/**
 * Quiz module form values
 */
export type QuizModuleFormValues = Simplify<
	BaseActivityModuleFormValues & {
		type: "quiz";
		quizInstructions: string;
		quizPoints: number;
		quizTimeLimit: number;
		quizGradingType: "automatic" | "manual";
		rawQuizConfig: QuizConfig | null;
	}
>;

/**
 * Discussion module form values
 */
export type DiscussionModuleFormValues = Simplify<
	BaseActivityModuleFormValues & {
		type: "discussion";
		discussionInstructions: string;
		discussionDueDate: Date | null;
		discussionRequireThread: boolean;
		discussionRequireReplies: boolean;
		discussionMinReplies: number;
	}
>;

/**
 * Discriminated union of all activity module form values
 */
export type ActivityModuleFormValues =
	| PageModuleFormValues
	| WhiteboardModuleFormValues
	| FileModuleFormValues
	| AssignmentModuleFormValues
	| QuizModuleFormValues
	| DiscussionModuleFormValues;

/**
 * Transform form values to submission data
 * Converts Date objects to ISO strings and removes fileFiles (not sent to server)
 */
export function transformFormValues(
	values: ActivityModuleFormValues,
): z.infer<typeof activityModuleSchema> {
	if (values.type === "page") {
		const result: z.infer<typeof pageModuleSchema> = {
			title: values.title,
			type: "page",
			...(values.description && { description: values.description }),
			...(values.status && { status: values.status }),
			...(values.pageContent && { pageContent: values.pageContent }),
		};
		return result;
	} else if (values.type === "whiteboard") {
		const result: z.infer<typeof whiteboardModuleSchema> = {
			title: values.title,
			type: "whiteboard",
			...(values.description && { description: values.description }),
			...(values.status && { status: values.status }),
			...(values.whiteboardContent && {
				whiteboardContent: values.whiteboardContent,
			}),
		};
		return result;
	} else if (values.type === "file") {
		const result: z.infer<typeof fileModuleSchema> = {
			title: values.title,
			type: "file",
			...(values.description && { description: values.description }),
			...(values.status && { status: values.status }),
			...(values.fileMedia.length > 0 && { fileMedia: values.fileMedia }),
		};
		return result;
	} else if (values.type === "assignment") {
		const result: z.infer<typeof assignmentModuleSchema> = {
			title: values.title,
			type: "assignment",
			...(values.description && { description: values.description }),
			...(values.status && { status: values.status }),
			...(values.assignmentInstructions && {
				assignmentInstructions: values.assignmentInstructions,
			}),
			...(values.assignmentRequireTextSubmission !== undefined && {
				assignmentRequireTextSubmission: values.assignmentRequireTextSubmission,
			}),
			...(values.assignmentRequireFileSubmission !== undefined && {
				assignmentRequireFileSubmission: values.assignmentRequireFileSubmission,
			}),
			...(values.assignmentAllowedFileTypes.length > 0 && {
				assignmentAllowedFileTypes: values.assignmentAllowedFileTypes,
			}),
			...(values.assignmentMaxFileSize !== undefined && {
				assignmentMaxFileSize: values.assignmentMaxFileSize,
			}),
			...(values.assignmentMaxFiles !== undefined && {
				assignmentMaxFiles: values.assignmentMaxFiles,
			}),
		};
		return result;
	} else if (values.type === "quiz") {
		const result: z.infer<typeof quizModuleSchema> = {
			title: values.title,
			type: "quiz",
			...(values.description && { description: values.description }),
			...(values.status && { status: values.status }),
			...(values.quizInstructions && {
				quizInstructions: values.quizInstructions,
			}),
			...(values.quizPoints !== undefined && {
				quizPoints: values.quizPoints,
			}),
			...(values.quizTimeLimit !== undefined && {
				quizTimeLimit: values.quizTimeLimit,
			}),
			...(values.quizGradingType && {
				quizGradingType: values.quizGradingType,
			}),
			...(values.rawQuizConfig && {
				rawQuizConfig: values.rawQuizConfig,
			}),
		};
		return result;
	} else {
		// discussion
		const result: z.infer<typeof discussionModuleSchema> = {
			title: values.title,
			type: "discussion",
			...(values.description && { description: values.description }),
			...(values.status && { status: values.status }),
			...(values.discussionInstructions && {
				discussionInstructions: values.discussionInstructions,
			}),
			...(values.discussionDueDate && {
				discussionDueDate: values.discussionDueDate.toISOString(),
			}),
			...(values.discussionRequireThread !== undefined && {
				discussionRequireThread: values.discussionRequireThread,
			}),
			...(values.discussionRequireReplies !== undefined && {
				discussionRequireReplies: values.discussionRequireReplies,
			}),
			...(values.discussionMinReplies !== undefined && {
				discussionMinReplies: values.discussionMinReplies,
			}),
		};
		return result;
	}
}

/**
 * Transform parsed data to activity-specific data structures
 */
export function transformToActivityData(
	parsedData: z.infer<typeof activityModuleSchema>,
) {
	let pageData:
		| {
				content?: string;
		  }
		| undefined;
	let whiteboardData:
		| {
				content?: string;
		  }
		| undefined;
	let assignmentData:
		| {
				instructions?: string;
				requireTextSubmission?: boolean;
				requireFileSubmission?: boolean;
				allowedFileTypes?: Array<{ extension: string; mimeType: string }>;
				maxFileSize?: number;
				maxFiles?: number;
		  }
		| undefined;
	let quizData:
		| {
				instructions?: string;
				points?: number;
				timeLimit?: number;
				gradingType?: "automatic" | "manual";
				rawQuizConfig?: QuizConfig;
		  }
		| undefined;
	let discussionData:
		| {
				instructions?: string;
				dueDate?: string;
				requireThread?: boolean;
				requireReplies?: boolean;
				minReplies?: number;
		  }
		| undefined;
	let fileData:
		| {
				media?: number[];
		  }
		| undefined;

	if (parsedData.type === "page") {
		pageData = {
			content: parsedData.pageContent,
		};
	} else if (parsedData.type === "whiteboard") {
		whiteboardData = {
			content: parsedData.whiteboardContent,
		};
	} else if (parsedData.type === "assignment") {
		// Convert preset values to file types
		const allowedFileTypes =
			parsedData.assignmentAllowedFileTypes &&
			parsedData.assignmentAllowedFileTypes.length > 0
				? presetValuesToFileTypes(parsedData.assignmentAllowedFileTypes)
				: undefined;

		assignmentData = {
			instructions: parsedData.assignmentInstructions,
			requireTextSubmission: parsedData.assignmentRequireTextSubmission,
			requireFileSubmission: parsedData.assignmentRequireFileSubmission,
			allowedFileTypes,
			maxFileSize: parsedData.assignmentMaxFileSize,
			maxFiles: parsedData.assignmentMaxFiles,
		};
	} else if (parsedData.type === "quiz") {
		quizData = {
			instructions: parsedData.quizInstructions,
			points: parsedData.quizPoints,
			timeLimit: parsedData.quizTimeLimit,
			gradingType: parsedData.quizGradingType,
			rawQuizConfig: parsedData.rawQuizConfig,
		};
	} else if (parsedData.type === "file") {
		fileData = {
			media: parsedData.fileMedia,
		};
	} else if (parsedData.type === "discussion") {
		discussionData = {
			instructions: parsedData.discussionInstructions,
			dueDate: parsedData.discussionDueDate,
			requireThread: parsedData.discussionRequireThread,
			requireReplies: parsedData.discussionRequireReplies,
			minReplies: parsedData.discussionMinReplies,
		};
	}

	return {
		pageData,
		whiteboardData,
		fileData,
		assignmentData,
		quizData,
		discussionData,
	};
}
