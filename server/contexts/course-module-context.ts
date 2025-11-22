import { formatModuleSettingsForDisplay } from "app/routes/course/module.$id/utils";
import type { BasePayload, PayloadRequest, TypedUser } from "payload";
import { createContext } from "react-router";
import type { CourseModuleSettingsV1 } from "server/json/course-module-settings.types";
import type { QuizConfig } from "server/json/raw-quiz-config.types.v2";
import { Result } from "typescript-result";
import {
	NonExistingActivityModuleError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { tryListAssignmentSubmissions } from "../internal/assignment-submission-management";
import { tryFindCourseActivityModuleLinkById } from "../internal/course-activity-module-link-management";
import { tryGetCourseStructure } from "../internal/course-section-management";
import {
	tryGetDiscussionThreadsWithAllReplies,
	tryListDiscussionSubmissions,
} from "../internal/discussion-management";
import { tryListQuizSubmissions } from "../internal/quiz-submission-management";
import type {
	ActivityModule,
	AssignmentSubmission,
	DiscussionSubmission,
	Enrollment,
	QuizSubmission,
	User,
} from "../payload-types";
import {
	flattenCourseStructure,
	flattenCourseStructureWithModuleInfo,
} from "../utils/course-structure-utils";
import { canSubmitAssignment } from "../utils/permissions";

// Submission types with resolved relationships
export type AssignmentSubmissionResolved = Omit<
	AssignmentSubmission,
	"courseModuleLink" | "student" | "enrollment"
> & {
	courseModuleLink: number;
	student: User;
	enrollment: Enrollment;
};

export type QuizSubmissionResolved = Omit<
	QuizSubmission,
	"courseModuleLink" | "student" | "enrollment"
> & {
	courseModuleLink: number;
	student: User;
	enrollment: Enrollment;
};

export type DiscussionSubmissionResolved = Omit<
	DiscussionSubmission,
	"courseModuleLink" | "student" | "enrollment"
> & {
	courseModuleLink: number;
	student: User;
	enrollment: Enrollment;
};

export type CourseModuleUser = {
	id: number;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatar?:
		| number
		| {
				id: number;
				filename?: string | null;
		  }
		| null;
};

export type CourseModulePageData = {
	id: number;
	content: string | null;
};

export type CourseModuleWhiteboardData = {
	id: number;
	content: string | null;
};

export type CourseModuleAssignmentData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	allowLateSubmissions: boolean | null;
	requireTextSubmission: boolean | null;
	requireFileSubmission: boolean | null;
	allowedFileTypes: Array<{ extension: string; mimeType: string }> | null;
	maxFileSize: number | null;
	maxFiles: number | null;
};

export type CourseModuleQuizData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	points: number | null;
	timeLimit: number | null;
	gradingType: "automatic" | "manual" | null;
	rawQuizConfig: QuizConfig | null;
};

export type CourseModuleDiscussionData = {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	requireThread: boolean | null;
	requireReplies: boolean | null;
	minReplies: number | null;
};

export type CourseModuleFileData = {
	id: number;
	media: Array<
		| number
		| {
				id: number;
				filename?: string | null;
				mimeType?: string | null;
				filesize?: number | null;
		  }
	> | null;
};

export type CourseModule = {
	id: number;
	title: string;
	description: string | null;
	type: ActivityModule["type"];
	status: ActivityModule["status"];
	createdBy: CourseModuleUser;
	owner: CourseModuleUser;
	page: CourseModulePageData | null;
	whiteboard: CourseModuleWhiteboardData | null;
	file: CourseModuleFileData | null;
	assignment: CourseModuleAssignmentData | null;
	quiz: CourseModuleQuizData | null;
	discussion: CourseModuleDiscussionData | null;
	createdAt: string;
	updatedAt: string;
};

export type ModuleDateInfo = {
	label: string;
	value: string;
	isOverdue: boolean;
};

export type FormattedModuleSettings = {
	type: "assignment" | "quiz" | "discussion";
	name: string | undefined;
	dates: ModuleDateInfo[];
} | null;

export type DiscussionThread = {
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
};

export type DiscussionReply = {
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
};

export type PreviousNextModule = {
	id: number;
	title: string;
	type: ActivityModule["type"];
} | null;

export type QuizSubmissionDisplayData = {
	id: number;
	status: QuizSubmission["status"];
	submittedAt: string | null;
	startedAt: string | null;
	attemptNumber: number;
};

export type ModuleSpecificData =
	| {
			type: "quiz";
			quizSubmissionsForDisplay: QuizSubmissionDisplayData[];
			hasActiveQuizAttempt: boolean;
			quizRemainingTime: number | undefined;
			submissions: QuizSubmissionResolved[];
			userSubmissions: QuizSubmissionResolved[];
			userSubmission: QuizSubmissionResolved | null;
	  }
	| {
			type: "assignment";
			// Assignment-specific data can be added here in the future
			submissions: AssignmentSubmissionResolved[];
			userSubmissions: AssignmentSubmissionResolved[];
			userSubmission: AssignmentSubmissionResolved | null;
	  }
	| {
			type: "discussion";
			// Discussion-specific data can be added here in the future
			submissions: DiscussionSubmissionResolved[];
			userSubmissions: DiscussionSubmissionResolved[];
			userSubmission: null;
			threads: DiscussionThread[];
	  }
	| {
			type: "page" | "whiteboard" | "file";
			// Page/whiteboard/file modules don't have module-specific data
	  };

export type CourseModuleContext = {
	module: CourseModule;
	moduleLinkId: number;
	moduleLinkCreatedAt: string;
	moduleLinkUpdatedAt: string;
	moduleLinkSettings: CourseModuleSettingsV1 | null;
	formattedModuleSettings: FormattedModuleSettings;
	previousModuleLinkId: number | null;
	nextModuleLinkId: number | null;
	previousModule: PreviousNextModule;
	nextModule: PreviousNextModule;
	// Whether user can submit assignments
	canSubmit: boolean;
	// Module-specific data based on module type (discriminated union)
	moduleSpecificData: ModuleSpecificData;
};

export const courseModuleContext = createContext<CourseModuleContext | null>(
	null,
);

export const courseModuleContextKey =
	"courseModuleContext" as unknown as typeof courseModuleContext;

/**
 * Get a single discussion thread with all nested replies
 * This transforms the thread data from tryGetDiscussionThreadsWithAllReplies
 * into the DiscussionReply format used in the route
 */
export const tryGetDiscussionThreadWithReplies = Result.wrap(
	async (
		payload: BasePayload,
		threadId: number,
		courseModuleLinkId: number,
		currentUser: User | null,
		req?: Partial<PayloadRequest>,
	) => {
		const formattedUser: TypedUser | null = currentUser
			? {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar
						? typeof currentUser.avatar === "number"
							? currentUser.avatar
							: currentUser.avatar.id
						: undefined,
				}
			: null;

		const threadsResult = await tryGetDiscussionThreadsWithAllReplies(payload, {
			courseModuleLinkId,
			user: formattedUser,
			req,
			overrideAccess: false,
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
			thread.upvotes?.some(
				(upvote: { user: number | { id: number }; upvotedAt: string }) => {
					const upvoteUser =
						typeof upvote.user === "object" && upvote.user !== null
							? upvote.user
							: null;
					return upvoteUser?.id === currentUser?.id;
				},
			) ?? false;

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
						return upvoteUser?.id === currentUser?.id;
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

/**
 * Get course module context for a given module link ID
 * This includes the full module data and next/previous navigation
 */
export const tryGetCourseModuleContext = Result.wrap(
	async (
		payload: BasePayload,
		moduleLinkId: number,
		courseId: number,
		currentUser: User | null,
		enrolment: { role?: "student" | "teacher" | "ta" | "manager" } | null,
		req?: Partial<PayloadRequest>,
	) => {
		// Fetch the module link
		const moduleLinkResult = await tryFindCourseActivityModuleLinkById(
			payload,
			moduleLinkId,
		);

		if (!moduleLinkResult.ok) {
			throw new NonExistingActivityModuleError("Module link not found");
		}

		const moduleLink = moduleLinkResult.value;

		// Get the activity module ID
		const activityModuleId =
			typeof moduleLink.activityModule === "number"
				? moduleLink.activityModule
				: moduleLink.activityModule.id;

		// Fetch full activity module with depth 2
		const activityModule = await payload.findByID({
			collection: "activity-modules",
			id: activityModuleId,
			depth: 2,
			overrideAccess: true,
		});

		// Transform module data
		const transformedModule: CourseModule = {
			id: activityModule.id,
			title: activityModule.title || "",
			description: activityModule.description || null,
			type: activityModule.type,
			status: activityModule.status,
			createdBy: {
				id:
					typeof activityModule.createdBy === "number"
						? activityModule.createdBy
						: activityModule.createdBy.id,
				email:
					typeof activityModule.createdBy === "number"
						? ""
						: activityModule.createdBy.email,
				firstName:
					typeof activityModule.createdBy === "number"
						? null
						: (activityModule.createdBy.firstName ?? null),
				lastName:
					typeof activityModule.createdBy === "number"
						? null
						: (activityModule.createdBy.lastName ?? null),
				avatar:
					typeof activityModule.createdBy === "number"
						? null
						: (activityModule.createdBy.avatar ?? null),
			},
			owner: {
				id:
					typeof activityModule.owner === "number"
						? activityModule.owner
						: activityModule.owner.id,
				email:
					typeof activityModule.owner === "number"
						? ""
						: activityModule.owner.email,
				firstName:
					typeof activityModule.owner === "number"
						? null
						: (activityModule.owner.firstName ?? null),
				lastName:
					typeof activityModule.owner === "number"
						? null
						: (activityModule.owner.lastName ?? null),
				avatar:
					typeof activityModule.owner === "number"
						? null
						: (activityModule.owner.avatar ?? null),
			},
			page:
				activityModule.type === "page" &&
				typeof activityModule.page === "object" &&
				activityModule.page !== null
					? {
							id: activityModule.page.id,
							content: activityModule.page.content || null,
						}
					: null,
			whiteboard:
				activityModule.type === "whiteboard" &&
				typeof activityModule.whiteboard === "object" &&
				activityModule.whiteboard !== null
					? {
							id: activityModule.whiteboard.id,
							content: activityModule.whiteboard.content || null,
						}
					: null,
			file:
				activityModule.type === "file" &&
				typeof activityModule.file === "object" &&
				activityModule.file !== null
					? {
							id: activityModule.file.id,
							media: activityModule.file.media || null,
						}
					: null,
			assignment:
				activityModule.type === "assignment" &&
				typeof activityModule.assignment === "object" &&
				activityModule.assignment !== null
					? {
							id: activityModule.assignment.id,
							instructions: activityModule.assignment.instructions || null,
							dueDate: activityModule.assignment.dueDate || null,
							maxAttempts: activityModule.assignment.maxAttempts || null,
							allowLateSubmissions:
								activityModule.assignment.allowLateSubmissions || null,
							requireTextSubmission:
								activityModule.assignment.requireTextSubmission || null,
							requireFileSubmission:
								activityModule.assignment.requireFileSubmission || null,
							allowedFileTypes:
								activityModule.assignment.allowedFileTypes || null,
							maxFileSize: activityModule.assignment.maxFileSize || null,
							maxFiles: activityModule.assignment.maxFiles || null,
						}
					: null,
			quiz:
				activityModule.type === "quiz" &&
				typeof activityModule.quiz === "object" &&
				activityModule.quiz !== null
					? (() => {
							// Get rawQuizConfig to check for globalTimer
							const rawConfig = activityModule.quiz
								.rawQuizConfig as unknown as QuizConfig | null;

							// Calculate timeLimit from globalTimer in config (convert seconds to minutes)
							const timeLimit = rawConfig?.globalTimer
								? rawConfig.globalTimer / 60
								: null;

							return {
								id: activityModule.quiz.id,
								instructions: activityModule.quiz.instructions || null,
								dueDate: activityModule.quiz.dueDate || null,
								maxAttempts: activityModule.quiz.maxAttempts || null,
								points: activityModule.quiz.points || null,
								timeLimit,
								gradingType: activityModule.quiz.gradingType || null,
								rawQuizConfig: rawConfig,
							};
						})()
					: null,
			discussion:
				activityModule.type === "discussion" &&
				typeof activityModule.discussion === "object" &&
				activityModule.discussion !== null
					? {
							id: activityModule.discussion.id,
							instructions: activityModule.discussion.instructions || null,
							dueDate: activityModule.discussion.dueDate || null,
							requireThread: activityModule.discussion.requireThread || null,
							requireReplies: activityModule.discussion.requireReplies || null,
							minReplies: activityModule.discussion.minReplies || null,
						}
					: null,
			createdAt: activityModule.createdAt,
			updatedAt: activityModule.updatedAt,
		};

		// Format user for internal functions
		const formattedUser: TypedUser | null = currentUser
			? {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar
						? typeof currentUser.avatar === "number"
							? currentUser.avatar
							: currentUser.avatar.id
						: undefined,
				}
			: null;

		// Get course structure to determine next/previous modules
		const courseStructureResult = await tryGetCourseStructure({
			payload,
			courseId,
			user: formattedUser,
			overrideAccess: false,
		});

		if (!courseStructureResult.ok) {
			throw courseStructureResult.error;
		}

		// Flatten course structure to get sequential list of module link IDs
		const flatModuleLinkIds = flattenCourseStructure(
			courseStructureResult.value,
		);

		// Find current position and determine next/previous
		const currentIndex = flatModuleLinkIds.indexOf(moduleLinkId);
		const previousModuleLinkId =
			currentIndex > 0 ? flatModuleLinkIds[currentIndex - 1] : null;
		const nextModuleLinkId =
			currentIndex < flatModuleLinkIds.length - 1
				? flatModuleLinkIds[currentIndex + 1]
				: null;

		// Get module link settings
		const moduleLinkSettings =
			(moduleLink.settings as unknown as CourseModuleSettingsV1) ?? null;

		// Format module settings for display (using function from utils.ts)
		const formattedModuleSettings = formatModuleSettingsForDisplay(
			moduleLinkSettings,
		) as FormattedModuleSettings;

		// Get flattened modules with info for previous/next calculation
		const flattenedModules = flattenCourseStructureWithModuleInfo(
			courseStructureResult.value,
		);
		const currentModuleIndex = flattenedModules.findIndex(
			(m) => m.moduleLinkId === moduleLinkId,
		);

		const previousModule: PreviousNextModule =
			currentModuleIndex > 0
				? {
						id: flattenedModules[currentModuleIndex - 1].moduleLinkId,
						title: flattenedModules[currentModuleIndex - 1].title,
						type: flattenedModules[currentModuleIndex - 1].type,
					}
				: null;

		const nextModule: PreviousNextModule =
			currentModuleIndex < flattenedModules.length - 1 &&
			currentModuleIndex !== -1
				? {
						id: flattenedModules[currentModuleIndex + 1].moduleLinkId,
						title: flattenedModules[currentModuleIndex + 1].title,
						type: flattenedModules[currentModuleIndex + 1].type,
					}
				: null;

		// Check if user can submit assignments
		const canSubmit = enrolment
			? canSubmitAssignment(enrolment).allowed
			: false;

		// Build module-specific data based on module type using discriminated union
		let moduleSpecificData: ModuleSpecificData;

		if (transformedModule.type === "assignment") {
			// Fetch assignment submissions
			let allSubmissions: AssignmentSubmissionResolved[] = [];
			const submissionsResult = await tryListAssignmentSubmissions({
				payload,
				courseModuleLinkId: moduleLinkId,
				limit: 1000,
				user: formattedUser,
				req,
				overrideAccess: false,
			});
			if (submissionsResult.ok) {
				allSubmissions = submissionsResult.value
					.docs as AssignmentSubmissionResolved[];
			}

			// Filter user-specific submissions
			const userSubmissions = currentUser
				? allSubmissions.filter((sub) => sub.student.id === currentUser.id)
				: [];

			// Get the latest submission (draft or most recent)
			const userSubmission =
				userSubmissions.find((sub) => sub.status === "draft") ||
				userSubmissions[0] ||
				null;

			moduleSpecificData = {
				type: "assignment",
				submissions: allSubmissions,
				userSubmissions,
				userSubmission,
			};
		} else if (transformedModule.type === "quiz") {
			// Fetch quiz submissions
			// Only filter by studentId if user is a student
			// Teachers/admins should see all submissions in the submissions table
			const isStudent = enrolment?.role === "student";
			let allSubmissions: QuizSubmissionResolved[] = [];
			const submissionsResult = await tryListQuizSubmissions({
				payload,
				courseModuleLinkId: moduleLinkId,
				studentId: isStudent ? currentUser?.id : undefined,
				limit: 1000,
				user: formattedUser,
				req,
				overrideAccess: false,
			});
			if (submissionsResult.ok) {
				allSubmissions = submissionsResult.value
					.docs as QuizSubmissionResolved[];
			}

			// userSubmissions should always be filtered to current user's submissions
			// regardless of role (for display in module page)
			// submissions field contains all submissions (for admin/teacher view in submissions table)
			const userSubmissions = allSubmissions.filter(
				(sub) => sub.student.id === currentUser?.id,
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
				transformedModule.quiz?.rawQuizConfig?.globalTimer
			) {
				const startedAt = new Date(userSubmission.startedAt);
				const now = new Date();
				const elapsedSeconds = Math.floor(
					(now.getTime() - startedAt.getTime()) / 1000,
				);
				const globalTimer = transformedModule.quiz.rawQuizConfig.globalTimer;
				const remaining = Math.max(0, globalTimer - elapsedSeconds);
				quizRemainingTime = remaining;
			}

			moduleSpecificData = {
				type: "quiz",
				submissions: allSubmissions,
				userSubmissions,
				userSubmission,
				quizSubmissionsForDisplay,
				hasActiveQuizAttempt,
				quizRemainingTime,
			};
		} else if (transformedModule.type === "discussion") {
			// Fetch discussion submissions
			let allSubmissions: DiscussionSubmissionResolved[] = [];
			const submissionsResult = await tryListDiscussionSubmissions({
				payload,
				courseModuleLinkId: moduleLinkId,
				limit: 1000,
				user: formattedUser,
				req,
				overrideAccess: false,
			});
			if (submissionsResult.ok) {
				allSubmissions = submissionsResult.value.map((sub) => ({
					...sub,
					courseModuleLink: sub.courseModuleLink.id,
				})) as DiscussionSubmissionResolved[];
			}

			// For discussions, userSubmissions are empty (discussions use threads instead)
			const userSubmissions: DiscussionSubmissionResolved[] = [];

			// Fetch discussion threads
			let threads: DiscussionThread[] = [];
			if (currentUser) {
				const threadsResult = await tryGetDiscussionThreadsWithAllReplies(
					payload,
					{
						courseModuleLinkId: moduleLinkId,
						user: formattedUser,
						req,
						overrideAccess: false,
					},
				);

				if (threadsResult.ok) {
					threads = threadsResult.value.threads.map((threadData) => {
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
								(upvote: {
									user: number | { id: number };
									upvotedAt: string;
								}) => {
									const upvoteUser =
										typeof upvote.user === "object" && upvote.user !== null
											? upvote.user
											: null;
									return upvoteUser?.id === currentUser.id;
								},
							) ?? false;

						// Calculate total reply count (replies + comments)
						const replyCount =
							threadData.repliesTotal + threadData.commentsTotal;

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
				}
			}

			moduleSpecificData = {
				type: "discussion",
				submissions: allSubmissions,
				userSubmissions,
				userSubmission: null,
				threads,
			};
		} else {
			// For page and whiteboard modules, no submissions
			moduleSpecificData = {
				type: transformedModule.type,
			};
		}

		return {
			module: transformedModule,
			moduleLinkId: moduleLink.id,
			moduleLinkCreatedAt: moduleLink.createdAt,
			moduleLinkUpdatedAt: moduleLink.updatedAt,
			moduleLinkSettings,
			formattedModuleSettings,
			previousModuleLinkId,
			nextModuleLinkId,
			previousModule,
			nextModule,
			canSubmit,
			moduleSpecificData,
		} satisfies CourseModuleContext;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get course module context", { cause: error }),
);
