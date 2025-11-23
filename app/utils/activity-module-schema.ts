import type { Simplify } from "node_modules/type-fest";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
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
	assignmentDueDate: z.string().optional(),
	assignmentMaxAttempts: z.number().optional(),
	assignmentAllowLateSubmissions: z.boolean().optional(),
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
	quizDueDate: z.string().optional(),
	quizMaxAttempts: z.number().optional(),
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
		assignmentDueDate: Date | null;
		assignmentMaxAttempts: number;
		assignmentAllowLateSubmissions: boolean;
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
		quizDueDate: Date | null;
		quizMaxAttempts: number;
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
 * Get initial form values for creating a new module
 * Returns page module as default
 */
export function getInitialFormValues(): PageModuleFormValues {
	return {
		title: "",
		description: "",
		type: "page",
		status: "draft",
		pageContent: "",
	};
}

/**
 * Get initial form values for a specific module type
 */
export function getInitialFormValuesForType(type: "page"): PageModuleFormValues;
export function getInitialFormValuesForType(
	type: "whiteboard",
): WhiteboardModuleFormValues;
export function getInitialFormValuesForType(type: "file"): FileModuleFormValues;
export function getInitialFormValuesForType(
	type: "assignment",
): AssignmentModuleFormValues;
export function getInitialFormValuesForType(type: "quiz"): QuizModuleFormValues;
export function getInitialFormValuesForType(
	type: "discussion",
): DiscussionModuleFormValues;
export function getInitialFormValuesForType(
	type: ActivityModuleFormValues["type"],
): ActivityModuleFormValues {
	switch (type) {
		case "page":
			return {
				title: "",
				description: "",
				type: "page",
				status: "draft",
				pageContent: "",
			};

		case "whiteboard":
			return {
				title: "",
				description: "",
				type: "whiteboard",
				status: "draft",
				whiteboardContent: "",
			};

		case "file":
			return {
				title: "",
				description: "",
				type: "file",
				status: "draft",
				fileMedia: [],
				fileFiles: [],
			};

		case "assignment":
			return {
				title: "",
				description: "",
				type: "assignment",
				status: "draft",
				assignmentInstructions: "",
				assignmentDueDate: null,
				assignmentMaxAttempts: 1,
				assignmentAllowLateSubmissions: false,
				assignmentRequireTextSubmission: false,
				assignmentRequireFileSubmission: false,
				assignmentAllowedFileTypes: [],
				assignmentMaxFileSize: 10,
				assignmentMaxFiles: 5,
			};

		case "quiz":
			return {
				title: "",
				description: "",
				type: "quiz",
				status: "draft",
				quizInstructions: "",
				quizDueDate: null,
				quizMaxAttempts: 1,
				quizPoints: 100,
				quizTimeLimit: 60,
				quizGradingType: "automatic",
				rawQuizConfig: null,
			};

		case "discussion":
			return {
				title: "",
				description: "",
				type: "discussion",
				status: "draft",
				discussionInstructions: "",
				discussionDueDate: null,
				discussionRequireThread: false,
				discussionRequireReplies: false,
				discussionMinReplies: 1,
			};

		default: {
			// TypeScript pattern: exhaustive check
			const _exhaustive: never = type;
			throw new Error(`Unknown module type: ${_exhaustive}`);
		}
	}
}

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
			...(values.assignmentDueDate && {
				assignmentDueDate: values.assignmentDueDate.toISOString(),
			}),
			...(values.assignmentMaxAttempts !== undefined && {
				assignmentMaxAttempts: values.assignmentMaxAttempts,
			}),
			...(values.assignmentAllowLateSubmissions !== undefined && {
				assignmentAllowLateSubmissions: values.assignmentAllowLateSubmissions,
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
			...(values.quizDueDate && {
				quizDueDate: values.quizDueDate.toISOString(),
			}),
			...(values.quizMaxAttempts !== undefined && {
				quizMaxAttempts: values.quizMaxAttempts,
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
				dueDate?: string;
				maxAttempts?: number;
				allowLateSubmissions?: boolean;
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
				dueDate?: string;
				maxAttempts?: number;
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
			dueDate: parsedData.assignmentDueDate,
			maxAttempts: parsedData.assignmentMaxAttempts,
			allowLateSubmissions: parsedData.assignmentAllowLateSubmissions,
			requireTextSubmission: parsedData.assignmentRequireTextSubmission,
			requireFileSubmission: parsedData.assignmentRequireFileSubmission,
			allowedFileTypes,
			maxFileSize: parsedData.assignmentMaxFileSize,
			maxFiles: parsedData.assignmentMaxFiles,
		};
	} else if (parsedData.type === "quiz") {
		quizData = {
			instructions: parsedData.quizInstructions,
			dueDate: parsedData.quizDueDate,
			maxAttempts: parsedData.quizMaxAttempts,
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
