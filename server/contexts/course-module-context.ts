import { formatModuleSettingsForDisplay } from "app/routes/course/module.$id/utils";
import { createContext } from "react-router";
import type { BaseInternalFunctionArgs } from "server/internal/utils/internal-function-utils";
import type {
	LatestCourseModuleSettings,
	LatestQuizConfig,
	LatestQuizSettings,
} from "server/json";
import { calculateTotalPoints } from "server/json/raw-quiz-config/types.v2";
import { Result } from "typescript-result";
import {
	NonExistingActivityModuleError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryListAssignmentSubmissions } from "../internal/assignment-submission-management";
import { tryFindCourseActivityModuleLinkById } from "../internal/course-activity-module-link-management";
import { tryGetPreviousNextModule } from "../internal/course-section-management";
import {
	tryGetDiscussionThreadWithReplies,
	tryGetDiscussionThreadsWithAllReplies,
	tryListDiscussionSubmissions,
	type DiscussionReply,
} from "../internal/discussion-management";
import { tryListQuizSubmissions } from "../internal/quiz-submission-management";

import { canSubmitAssignment, permissions } from "../utils/permissions";
export { courseModuleContextKey } from "./utils/context-keys";

export interface ModuleDateInfo {
	label: string;
	value: string;
	isOverdue: boolean;
}

export interface BaseFormattedModuleSettings {
	type: "assignment" | "quiz" | "discussion";
	name: string | undefined;
	dates: ModuleDateInfo[];
}
export type FormattedModuleSettings = BaseFormattedModuleSettings | null;

export interface DiscussionThread {
	id: string;
	title: string;
	content: string;
	author: string;
	authorAvatar: string;
	authorId: number | null;
	publishedAt: string;
	upvotes: number;
	replyCount: number;
	isPinned: boolean;
	isUpvoted: boolean;
}

// type CourseModuleContext = {
// 	module: CourseModule;

// 	moduleLinkSettings: LatestCourseModuleSettings | null;
// 	formattedModuleSettings: FormattedModuleSettings;
// 	previousModuleLinkId: number | null;
// 	nextModuleLinkId: number | null;
// 	previousModule: PreviousNextModule;
// 	nextModule: PreviousNextModule;
// 	// Whether user can submit assignments
// 	canSubmit: boolean;
// };

export type CourseModuleContext = NonNullable<
	Awaited<ReturnType<typeof tryGetCourseModuleContext>>["value"]
>;

export const courseModuleContext = createContext<CourseModuleContext | null>(
	null,
);

export interface DiscussionData {
	id: number;
	instructions: string | null;
	requireThread: boolean | null;
	requireReplies: boolean | null;
	minReplies: number | null;
}

export interface AssignmentData {
	id: number;
	instructions: string | null;
	dueDate?: string | null;
	maxAttempts?: number | null;
	requireTextSubmission: boolean | null;
	requireFileSubmission: boolean | null;
	maxFileSize?: number | null;
	maxFiles?: number | null;
	allowedFileTypes?: Array<{
		extension: string;
		mimeType: string;
	}> | null;
}

export interface AssignmentSubmissionData {
	id: number;
	status: "draft" | "submitted" | "graded" | "returned";
	content?: string | null;
	attachments?: Array<{
		file: number;
		description?: string;
	}> | null;
	submittedAt?: string | null;
	attemptNumber: number;
}

export interface QuizData {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	timeLimit: number | null; // in minutes
	points: number | null;
	rawQuizConfig: LatestQuizConfig | null;
}

export interface QuizSubmissionData {
	id: number;
	status: "in_progress" | "completed" | "graded" | "returned";
	submittedAt?: string | null;
	startedAt?: string | null;
	attemptNumber: number;
}

export interface TryGetCourseModuleContextArgs
	extends BaseInternalFunctionArgs {
	moduleLinkId: number;
	courseId: number;
	enrolment: { role?: "student" | "teacher" | "ta" | "manager" } | null;
	threadId?: string | null;
}

/**
 * Get course module context for a given module link ID
 * This includes the full module data and next/previous navigation
 */
export const tryGetCourseModuleContext = Result.wrap(
	async (args: TryGetCourseModuleContextArgs) => {
		const {
			payload,
			moduleLinkId,
			courseId,
			enrolment,
			threadId,

			req,
			overrideAccess = false,
		} = args;

		const user = req?.user;

		// Fetch the module link
		const moduleLinkResult = await tryFindCourseActivityModuleLinkById({
			payload,
			linkId: moduleLinkId,
			req,
			overrideAccess,
		});

		if (!moduleLinkResult.ok) {
			throw new NonExistingActivityModuleError("Module link not found");
		}

		const moduleLink = moduleLinkResult.value;

		// Get module link settings
		const moduleLinkSettings =
			moduleLink.settings as unknown as LatestCourseModuleSettings | null;

		// console.log(moduleLinkSettings, moduleLink);

		// Format module settings for display (using function from utils.ts)
		const formattedModuleSettings = formatModuleSettingsForDisplay(
			moduleLinkSettings,
		) as FormattedModuleSettings;

		// Get previous and next modules for navigation
		const previousNextResult = await tryGetPreviousNextModule({
			payload,
			courseId,
			moduleLinkId,
			req,
			overrideAccess,
		});

		if (!previousNextResult.ok) {
			throw previousNextResult.error;
		}

		const previousModule = previousNextResult.value.previousModule;
		const nextModule = previousNextResult.value.nextModule;

		if (moduleLink.type === "assignment") {
			const submissionsResult = await tryListAssignmentSubmissions({
				payload,
				courseModuleLinkId: moduleLinkId,
				limit: 1000,
				req,
				overrideAccess,
			});
			if (!submissionsResult.ok) throw submissionsResult.error;
			const allSubmissions = submissionsResult.value.docs;

			// Filter user-specific submissions
			const userSubmissions = user
				? allSubmissions.filter((sub) => sub.student.id === user.id)
				: [];

			// Get the latest submission (draft or most recent)
			const userSubmission =
				userSubmissions.find((sub) => sub.status === "draft") ||
				userSubmissions[0] ||
				null;

			const canSubmit = enrolment
				? canSubmitAssignment(enrolment).allowed
				: false;

			// Construct AssignmentData from activityModule and settings
			const assignmentSettings =
				moduleLink.settings && moduleLink.settings.type === "assignment"
					? moduleLink.settings
					: null;
			const assignment: AssignmentData = {
				id: moduleLink.activityModule.id,
				instructions: moduleLink.activityModule.instructions ?? null,
				dueDate: assignmentSettings?.dueDate ?? null,
				maxAttempts: assignmentSettings?.maxAttempts ?? null,
				requireTextSubmission:
					moduleLink.activityModule.requireTextSubmission ?? null,
				requireFileSubmission:
					moduleLink.activityModule.requireFileSubmission ?? null,
				maxFileSize: moduleLink.activityModule.maxFileSize ?? null,
				maxFiles: moduleLink.activityModule.maxFiles ?? null,
				allowedFileTypes: moduleLink.activityModule.allowedFileTypes ?? null,
			};

			// Transform userSubmission to AssignmentSubmissionData format
			const assignmentSubmission: AssignmentSubmissionData | null =
				userSubmission &&
				"content" in userSubmission &&
				"attachments" in userSubmission
					? {
							id: userSubmission.id,
							status: userSubmission.status as
								| "draft"
								| "submitted"
								| "graded"
								| "returned",
							content: (userSubmission.content as string) || null,
							attachments: userSubmission.attachments
								? userSubmission.attachments.map((att) => ({
										file:
											typeof att.file === "object" &&
											att.file !== null &&
											"id" in att.file
												? att.file.id
												: Number(att.file),
										description: att.description as string | undefined,
									}))
								: null,
							submittedAt: ("submittedAt" in userSubmission
								? userSubmission.submittedAt
								: null) as string | null,
							attemptNumber: ("attemptNumber" in userSubmission
								? userSubmission.attemptNumber
								: 1) as number,
						}
					: null;

			// Transform all user submissions for display - filter assignment submissions only
			const allSubmissionsForDisplay: AssignmentSubmissionData[] =
				userSubmissions
					.filter(
						(
							sub,
						): sub is typeof sub & {
							content: unknown;
							attemptNumber: unknown;
						} => "content" in sub && "attemptNumber" in sub,
					)
					.map((sub) => ({
						id: sub.id,
						status: sub.status as "draft" | "submitted" | "graded" | "returned",
						content: (sub.content as string) || null,
						submittedAt: ("submittedAt" in sub ? sub.submittedAt : null) as
							| string
							| null,
						attemptNumber: (sub.attemptNumber as number) || 1,
						attachments:
							"attachments" in sub && sub.attachments
								? sub.attachments.map((att) => ({
										file:
											typeof att.file === "object" &&
											att.file !== null &&
											"id" in att.file
												? att.file.id
												: typeof att.file === "number"
													? att.file
													: Number(att.file),
										description: att.description as string | undefined,
									}))
								: null,
					}));

			return {
				...moduleLink,
				submissions: allSubmissions,
				userSubmissions,
				userSubmission,
				assignment,
				assignmentSubmission,
				allSubmissionsForDisplay,
				canSubmit,
				formattedModuleSettings,
				previousModule,
				nextModule,
			};
		} else if (moduleLink.type === "quiz") {
			// Fetch quiz submissions
			// Only filter by studentId if user is a student
			// Teachers/admins should see all submissions in the submissions table
			const isStudent = enrolment?.role === "student";
			const submissionsResult = await tryListQuizSubmissions({
				payload,
				courseModuleLinkId: moduleLinkId,
				studentId: isStudent ? req?.user?.id : undefined,
				limit: 1000,
				req,
				overrideAccess,
			}).getOrThrow();

			const allSubmissions = submissionsResult.docs;

			// userSubmissions should always be filtered to current user's submissions
			// regardless of role (for display in module page)
			// submissions field contains all submissions (for admin/teacher view in submissions table)
			const userSubmissions = allSubmissions.filter(
				(sub) => sub.student.id === req?.user?.id,
			);

			// Get the latest submission (in_progress or most recent)
			const userSubmission =
				userSubmissions.find((sub) => sub.status === "in_progress") ||
				[...userSubmissions].sort((a, b) => {
					const aDate =
						typeof a.createdAt === "string"
							? new Date(a.createdAt).getTime()
							: 0;
					const bDate =
						typeof b.createdAt === "string"
							? new Date(b.createdAt).getTime()
							: 0;
					return bDate - aDate;
				})[0] ||
				null;

			// Calculate quiz-specific display data
			const quizSubmissionsForDisplay = userSubmissions.map((sub) => ({
				id: sub.id,
				status: sub.status as
					| "in_progress"
					| "completed"
					| "graded"
					| "returned",
				submittedAt: sub.submittedAt ?? null,
				startedAt: sub.startedAt ?? null,
				attemptNumber: sub.attemptNumber ?? 1,
			}));

			const hasActiveQuizAttempt = userSubmissions.some(
				(sub) => sub.status === "in_progress",
			);

			// Calculate quiz remaining time if applicable
			let quizRemainingTime: number | undefined;
			if (
				userSubmission &&
				userSubmission.status === "in_progress" &&
				userSubmission.startedAt &&
				moduleLink.activityModule.rawQuizConfig?.globalTimer
			) {
				const startedAt = new Date(userSubmission.startedAt);
				const now = new Date();
				const elapsedSeconds = Math.floor(
					(now.getTime() - startedAt.getTime()) / 1000,
				);
				const globalTimer =
					moduleLink.activityModule.rawQuizConfig?.globalTimer;
				const remaining = Math.max(0, globalTimer - elapsedSeconds);
				quizRemainingTime = remaining;
			}

			// Construct QuizData from activityModule and settings
			const quizSettings = moduleLink.settings as LatestQuizSettings | null;
			const rawQuizConfig = moduleLink.activityModule.rawQuizConfig ?? null;
			const timeLimit =
				rawQuizConfig?.globalTimer !== undefined
					? Math.floor(rawQuizConfig.globalTimer / 60) // Convert seconds to minutes
					: null;
			const points = rawQuizConfig ? calculateTotalPoints(rawQuizConfig) : null;

			const quiz: QuizData = {
				id: moduleLink.activityModule.id,
				instructions: moduleLink.activityModule.instructions ?? null,
				dueDate:
					quizSettings && quizSettings.type === "quiz"
						? (quizSettings.closingTime ?? null)
						: null,
				maxAttempts:
					quizSettings && quizSettings.type === "quiz"
						? (quizSettings.maxAttempts ?? null)
						: null,
				timeLimit,
				points,
				rawQuizConfig,
			};

			// Transform quiz submissions for display
			const allQuizSubmissionsForDisplay = quizSubmissionsForDisplay;

			return {
				...moduleLink,
				submissions: allSubmissions,
				userSubmissions,
				userSubmission,
				quiz,
				allQuizSubmissionsForDisplay,
				hasActiveQuizAttempt,
				quizRemainingTime,
				formattedModuleSettings,
				previousModule,
				nextModule,
				permissions: {
					canPreview: permissions.quiz.canPreview(
						user ?? undefined,
						enrolment ?? undefined,
					),
					canStartAttempt: permissions.quiz.canStartAttempt(
						quiz?.maxAttempts ?? null,
						allQuizSubmissionsForDisplay.length,
						hasActiveQuizAttempt,
					),
					canDeleteSubmissions: permissions.quiz.canDeleteSubmissions(
						user ?? undefined,
						enrolment ?? undefined,
					),
				},
			};
		} else if (moduleLink.type === "discussion") {
			// Fetch discussion submissions

			const submissionsResult = await tryListDiscussionSubmissions({
				payload,
				courseModuleLinkId: moduleLinkId,
				limit: 1000,
				req,
				overrideAccess,
			});
			if (!submissionsResult.ok) throw submissionsResult.error;

			const allSubmissions = submissionsResult.value;

			// For discussions, userSubmissions are empty (discussions use threads instead)
			const userSubmissions = allSubmissions.filter(
				(sub) => sub.student.id === req?.user?.id,
			);

			// Fetch discussion threads

			const threadsResult = await tryGetDiscussionThreadsWithAllReplies({
				payload,
				courseModuleLinkId: moduleLinkId,
				req,
				overrideAccess,
			});

			if (!threadsResult.ok) {
				throw threadsResult.error;
			}

			const threads = threadsResult.value.threads.map((threadData) => {
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
					thread.upvotes?.some(
						(upvote: { user: number | { id: number }; upvotedAt: string }) => {
							const upvoteUser =
								typeof upvote.user === "object" && upvote.user !== null
									? upvote.user
									: null;
							return upvoteUser?.id === req?.user?.id;
						},
					) ?? false;

				// Calculate total reply count (replies + comments)
				const replyCount = threadData.repliesTotal + threadData.commentsTotal;

				return {
					...threadData,
					id: String(thread.id),
					title: thread.title || "",
					content: thread.content,
					author: authorName,
					authorAvatar,
					authorId: student?.id ?? null,
					publishedAt: thread.createdAt,
					upvotes: thread.upvotes?.length ?? 0,
					replyCount,
					isPinned: thread.isPinned ?? false,
					isUpvoted,
				};
			});

			// Construct DiscussionData from activityModule
			const discussion: DiscussionData = {
				id: moduleLink.activityModule.id,
				instructions: moduleLink.activityModule.instructions ?? null,
				requireThread: moduleLink.activityModule.requireThread ?? null,
				requireReplies: moduleLink.activityModule.requireReplies ?? null,
				minReplies: moduleLink.activityModule.minReplies ?? null,
			};

			// Fetch thread and replies if threadId is provided
			let thread: DiscussionThread | null = null;
			let replies: DiscussionReply[] = [];

			if (threadId) {
				const threadIdNumber = Number.parseInt(threadId, 10);
				if (!Number.isNaN(threadIdNumber)) {
					const threadResult = await tryGetDiscussionThreadWithReplies({
						payload,
						threadId: threadIdNumber,
						courseModuleLinkId: moduleLinkId,
						req,
						overrideAccess,
					});

					if (threadResult.ok) {
						thread = threadResult.value.thread;
						replies = threadResult.value.replies;
					}
				}
			}

			return {
				...moduleLink,
				submissions: allSubmissions,
				userSubmissions,
				threads,
				discussion,
				thread,
				replies,
				previousModule,
				nextModule,
				formattedModuleSettings,
			};
		} else {
			return {
				...moduleLink,
				previousModule,
				nextModule,
				formattedModuleSettings,
			};
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get course module context", { cause: error }),
);
