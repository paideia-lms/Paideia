import { isUndefined, omitBy } from "es-toolkit";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
import type { ActivityModule } from "server/payload-types";
import { z } from "zod";

/**
 * Shared schema for activity module forms (create and update)
 */
export const activityModuleSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	type: z.enum(["page", "whiteboard", "assignment", "quiz", "discussion"]),
	status: z.enum(["draft", "published", "archived"]).optional(),
	// Page fields
	pageContent: z.string().optional(),
	// Whiteboard fields
	whiteboardContent: z.string().optional(),
	// Assignment fields
	assignmentInstructions: z.string().optional(),
	assignmentDueDate: z.string().optional(),
	assignmentMaxAttempts: z.number().optional(),
	assignmentAllowLateSubmissions: z.boolean().optional(),
	assignmentRequireTextSubmission: z.boolean().optional(),
	assignmentRequireFileSubmission: z.boolean().optional(),
	// Quiz fields
	quizInstructions: z.string().optional(),
	quizDueDate: z.string().optional(),
	quizMaxAttempts: z.number().optional(),
	quizPoints: z.number().optional(),
	quizTimeLimit: z.number().optional(),
	quizGradingType: z.enum(["automatic", "manual"]).optional(),
	rawQuizConfig: z.any().optional(),
	// Discussion fields
	discussionInstructions: z.string().optional(),
	discussionDueDate: z.string().optional(),
	discussionRequireThread: z.boolean().optional(),
	discussionRequireReplies: z.boolean().optional(),
	discussionMinReplies: z.number().optional(),
});

export type ActivityModuleFormValues = {
	title: string;
	description: string;
	type: ActivityModule["type"];
	status: ActivityModule["status"];
	// Page fields
	pageContent: string;
	// Whiteboard fields
	whiteboardContent: string;
	// Assignment fields
	assignmentInstructions: string;
	assignmentDueDate: Date | null;
	assignmentMaxAttempts: number;
	assignmentAllowLateSubmissions: boolean;
	assignmentRequireTextSubmission: boolean;
	assignmentRequireFileSubmission: boolean;
	// Quiz fields
	quizInstructions: string;
	quizDueDate: Date | null;
	quizMaxAttempts: number;
	quizPoints: number;
	quizTimeLimit: number;
	quizGradingType: "automatic" | "manual";
	rawQuizConfig: QuizConfig | null;
	// Discussion fields
	discussionInstructions: string;
	discussionDueDate: Date | null;
	discussionRequireThread: boolean;
	discussionRequireReplies: boolean;
	discussionMinReplies: number;
};

/**
 * Get initial form values for creating a new module
 */
export function getInitialFormValues(): ActivityModuleFormValues {
	return {
		title: "",
		description: "",
		type: "page",
		status: "draft",
		// Page fields
		pageContent: "",
		// Whiteboard fields
		whiteboardContent: "",
		// Assignment fields
		assignmentInstructions: "",
		assignmentDueDate: null,
		assignmentMaxAttempts: 1,
		assignmentAllowLateSubmissions: false,
		assignmentRequireTextSubmission: false,
		assignmentRequireFileSubmission: false,
		// Quiz fields
		quizInstructions: "",
		quizDueDate: null,
		quizMaxAttempts: 1,
		quizPoints: 100,
		quizTimeLimit: 60,
		quizGradingType: "automatic",
		rawQuizConfig: null,
		// Discussion fields
		discussionInstructions: "",
		discussionDueDate: null,
		discussionRequireThread: false,
		discussionRequireReplies: false,
		discussionMinReplies: 1,
	};
}

/**
 * Transform form values to submission data
 */
export function transformFormValues(values: ActivityModuleFormValues) {
	return omitBy(
		{
			...values,
			assignmentDueDate: values.assignmentDueDate
				? values.assignmentDueDate.toISOString()
				: undefined,
			quizDueDate: values.quizDueDate
				? values.quizDueDate.toISOString()
				: undefined,
			discussionDueDate: values.discussionDueDate
				? values.discussionDueDate.toISOString()
				: undefined,
		},
		isUndefined,
	);
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
			rawQuizConfig?: unknown;
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

	if (parsedData.type === "page") {
		pageData = {
			content: parsedData.pageContent,
		};
	} else if (parsedData.type === "whiteboard") {
		whiteboardData = {
			content: parsedData.whiteboardContent,
		};
	} else if (parsedData.type === "assignment") {
		assignmentData = {
			instructions: parsedData.assignmentInstructions,
			dueDate: parsedData.assignmentDueDate,
			maxAttempts: parsedData.assignmentMaxAttempts,
			allowLateSubmissions: parsedData.assignmentAllowLateSubmissions,
			requireTextSubmission: parsedData.assignmentRequireTextSubmission,
			requireFileSubmission: parsedData.assignmentRequireFileSubmission,
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
	} else if (parsedData.type === "discussion") {
		discussionData = {
			instructions: parsedData.discussionInstructions,
			dueDate: parsedData.discussionDueDate,
			requireThread: parsedData.discussionRequireThread,
			requireReplies: parsedData.discussionRequireReplies,
			minReplies: parsedData.discussionMinReplies,
		};
	}

	return { pageData, whiteboardData, assignmentData, quizData, discussionData };
}
