import {
	ActionIcon,
	Avatar,
	Badge,
	Box,
	Button,
	Collapse,
	Container,
	Divider,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Title,
	Tooltip,
	Typography,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
	FileUpload,
	FileUploadHandler,
} from "@remix-run/form-data-parser";
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
} from "@remix-run/form-data-parser";
import {
	IconArrowBack,
	IconArrowBigUp,
	IconArrowBigUpFilled,
	IconCalendar,
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconChevronUp,
	IconClock,
	IconInfoCircle,
	IconMessage,
	IconPin,
	IconPlus,
} from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useQueryState } from "nuqs";
import { createLoader, parseAsString } from "nuqs/server";
import prettyBytes from "pretty-bytes";
import { href, Link, redirect, useFetcher, useRevalidator } from "react-router";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { SimpleRichTextEditor } from "~/components/simple-rich-text-editor";

dayjs.extend(relativeTime);
import { courseContextKey } from "server/contexts/course-context";
import type { CourseModuleContext } from "server/contexts/course-module-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateAssignmentSubmission,
	trySubmitAssignment,
	tryUpdateAssignmentSubmission,
} from "server/internal/assignment-submission-management";
import {
	tryCreateDiscussionSubmission,
	tryGetThreadWithReplies,
	tryListDiscussionSubmissions,
	tryRemoveUpvoteDiscussionSubmission,
	tryUpvoteDiscussionSubmission,
} from "server/internal/discussion-management";
import { tryCreateMedia } from "server/internal/media-management";
import {
	tryCheckInProgressSubmission,
	tryGetNextAttemptNumber,
	tryListQuizSubmissions,
	tryStartQuizAttempt,
	trySubmitQuiz,
} from "server/internal/quiz-submission-management";
import { flattenCourseStructureWithModuleInfo } from "server/utils/course-structure-utils";
import {
	canSubmitAssignment,
	canParticipateInDiscussion,
} from "server/utils/permissions";
import z from "zod";
import { AssignmentPreview } from "~/components/activity-modules-preview/assignment-preview";
import {
	type DiscussionData,
	type DiscussionReply,
	type DiscussionThread,
	CreateThreadForm,
} from "~/components/activity-modules-preview/discussion-preview";
import { PagePreview } from "~/components/activity-modules-preview/page-preview";
import { QuizInstructionsView } from "~/components/activity-modules-preview/quiz-instructions-view";
import { QuizPreview } from "~/components/activity-modules-preview/quiz-preview";
import type {
	Question,
	QuizAnswers,
	QuizConfig,
} from "server/json/raw-quiz-config.types.v2";
import { isRegularQuiz } from "server/json/raw-quiz-config.types.v2";
import { WhiteboardPreview } from "~/components/activity-modules-preview/whiteboard-preview";
import { SubmissionHistory } from "~/components/submission-history";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { ContentType } from "~/utils/get-content-type";
import {
	AssignmentActions,
	DiscussionActions,
	QuizActions,
} from "~/utils/module-actions";
import { parseFormDataWithFallback } from "~/utils/parse-form-data-with-fallback";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/module.$id";

const courseModuleSearchParams = {
	action: parseAsString.withDefault(""),
	showQuiz: parseAsString.withDefault(""),
	threadId: parseAsString.withDefault(""),
	replyTo: parseAsString.withDefault(""),
};

export const loadSearchParams = createLoader(courseModuleSearchParams);

// Helper to format dates consistently on the server
const formatDateForDisplay = (dateString: string) => {
	const date = new Date(dateString);
	return date.toLocaleString("en-US", {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

// Helper to format module settings with date strings
const formatModuleSettingsForDisplay = (
	moduleSettings: CourseModuleContext["moduleLinkSettings"],
) => {
	if (!moduleSettings?.settings) return null;

	const settings = moduleSettings.settings;
	const now = new Date();

	if (settings.type === "assignment") {
		return {
			type: "assignment" as const,
			name: settings.name,
			dates: [
				settings.allowSubmissionsFrom && {
					label: "Available from",
					value: formatDateForDisplay(settings.allowSubmissionsFrom),
					isOverdue: false,
				},
				settings.dueDate && {
					label: "Due",
					value: formatDateForDisplay(settings.dueDate),
					isOverdue: new Date(settings.dueDate) < now,
				},
				settings.cutoffDate && {
					label: "Final deadline",
					value: formatDateForDisplay(settings.cutoffDate),
					isOverdue: new Date(settings.cutoffDate) < now,
				},
			].filter(Boolean),
		};
	}

	if (settings.type === "quiz") {
		return {
			type: "quiz" as const,
			name: settings.name,
			dates: [
				settings.openingTime && {
					label: "Opens",
					value: formatDateForDisplay(settings.openingTime),
					isOverdue: false,
				},
				settings.closingTime && {
					label: "Closes",
					value: formatDateForDisplay(settings.closingTime),
					isOverdue: new Date(settings.closingTime) < now,
				},
			].filter(Boolean),
		};
	}

	if (settings.type === "discussion") {
		return {
			type: "discussion" as const,
			name: settings.name,
			dates: [
				settings.dueDate && {
					label: "Due",
					value: formatDateForDisplay(settings.dueDate),
					isOverdue: new Date(settings.dueDate) < now,
				},
				settings.cutoffDate && {
					label: "Final deadline",
					value: formatDateForDisplay(settings.cutoffDate),
					isOverdue: new Date(settings.cutoffDate) < now,
				},
			].filter(Boolean),
		};
	}

	return null;
};

export const loader = async ({
	context,
	params,
	request,
}: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const { action, threadId } = loadSearchParams(request);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const { moduleLinkId } = params;

	// Get course context to ensure user has access to this course
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	// Get course module context
	if (!courseModuleContext) {
		throw new ForbiddenResponse("Module not found or access denied");
	}

	// Get flattened list of modules from course structure
	const flattenedModules = flattenCourseStructureWithModuleInfo(
		courseContext.courseStructure,
	);

	// Find current module index
	const currentIndex = flattenedModules.findIndex(
		(m) => m.moduleLinkId === Number(moduleLinkId),
	);

	// Get previous and next modules
	const previousModule =
		currentIndex > 0
			? {
				id: flattenedModules[currentIndex - 1].moduleLinkId,
				title: flattenedModules[currentIndex - 1].title,
				type: flattenedModules[currentIndex - 1].type,
			}
			: null;

	const nextModule =
		currentIndex < flattenedModules.length - 1 && currentIndex !== -1
			? {
				id: flattenedModules[currentIndex + 1].moduleLinkId,
				title: flattenedModules[currentIndex + 1].title,
				type: flattenedModules[currentIndex + 1].type,
			}
			: null;

	// Get current user's submissions for assignments
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if user can submit assignments
	const enrolmentContext = context.get(enrolmentContextKey);
	const canSubmit = canSubmitAssignment(enrolmentContext?.enrolment).allowed;

	if (!canSubmit && action === AssignmentActions.EDIT_SUBMISSION) {
		throw new ForbiddenResponse("You cannot edit submissions");
	}

	// Format module settings with dates for display
	const formattedModuleSettings = formatModuleSettingsForDisplay(
		courseModuleContext.moduleLinkSettings,
	);

	// If this is an assignment module and user cannot submit, they can't see submissions
	if (courseModuleContext.module.type === "assignment" && !canSubmit) {
		return {
			module: courseModuleContext.module,
			moduleSettings: courseModuleContext.moduleLinkSettings,
			formattedModuleSettings,
			course: courseContext.course,
			previousModule,
			nextModule,
			userSubmission: null,
			userSubmissions: [],
			moduleLinkId: courseModuleContext.moduleLinkId,
			canSubmit: false,
			discussionThreads: [],
			discussionThread: null,
			discussionReplies: [],
		};
	}

	// Fetch discussion data if this is a discussion module
	let discussionThreads: Array<{
		id: string;
		title: string;
		content: string;
		author: string;
		authorAvatar: string;
		publishedAt: string;
		upvotes: number;
		replyCount: number;
		isPinned: boolean;
		isUpvoted: boolean;
	}> = [];
	let discussionThread: {
		id: string;
		title: string;
		content: string;
		author: string;
		authorAvatar: string;
		publishedAt: string;
		upvotes: number;
		replyCount: number;
		isPinned: boolean;
		isUpvoted: boolean;
	} | null = null;
	let discussionReplies: Array<{
		id: string;
		content: string;
		author: string;
		authorAvatar: string;
		publishedAt: string;
		upvotes: number;
		parentId: string | null;
		isUpvoted: boolean;
		replies?: Array<{
			id: string;
			content: string;
			author: string;
			authorAvatar: string;
			publishedAt: string;
			upvotes: number;
			parentId: string | null;
			isUpvoted: boolean;
		}>;
	}> = [];

	if (courseModuleContext.module.type === "discussion") {
		const payload = context.get(globalContextKey)?.payload;
		if (!payload) {
			throw new ForbiddenResponse("Payload not available");
		}

		// Always fetch all threads for this discussion (general data: title, author, upvotes, etc.)
		const threadsResult = await tryListDiscussionSubmissions({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			postType: "thread",
			status: "published",
			limit: 100,
			page: 1,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (threadsResult.ok) {
			// Get all replies for reply count calculation
			const allRepliesResult = await tryListDiscussionSubmissions({
				payload,
				courseModuleLinkId: Number(moduleLinkId),
				postType: "reply",
				status: "published",
				limit: 1000,
				page: 1,
				user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				},
				overrideAccess: false,
			});

			const allCommentsResult = await tryListDiscussionSubmissions({
				payload,
				courseModuleLinkId: Number(moduleLinkId),
				postType: "comment",
				status: "published",
				limit: 1000,
				page: 1,
				user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				},
				overrideAccess: false,
			});

			const allReplies = allRepliesResult.ok ? allRepliesResult.value.docs : [];
			const allComments = allCommentsResult.ok ? allCommentsResult.value.docs : [];

			// Count replies per thread
			const replyCountMap = new Map<string, number>();
			for (const reply of allReplies) {
				const parentThreadId = reply.parentThread;
				if (parentThreadId) {
					const threadIdStr = String(
						typeof parentThreadId === "object" && parentThreadId !== null && "id" in parentThreadId
							? parentThreadId.id
							: parentThreadId,
					);
					replyCountMap.set(threadIdStr, (replyCountMap.get(threadIdStr) || 0) + 1);
				}
			}

			// Count comments per thread (comments are also replies to threads)
			for (const comment of allComments) {
				const parentThreadId = comment.parentThread;
				if (parentThreadId) {
					const threadIdStr = String(
						typeof parentThreadId === "object" && parentThreadId !== null && "id" in parentThreadId
							? parentThreadId.id
							: parentThreadId,
					);
					replyCountMap.set(threadIdStr, (replyCountMap.get(threadIdStr) || 0) + 1);
				}
			}

			discussionThreads = threadsResult.value.docs.map((thread) => {
				const student =
					typeof thread.student === "object" && thread.student !== null
						? thread.student
						: null;
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
						(upvote: { user: number | { id: number }; upvotedAt: string; id?: string | null }) => {
							const upvoteUser =
								typeof upvote.user === "object" && upvote.user !== null
									? upvote.user
									: null;
							return upvoteUser?.id === currentUser.id;
						},
					) ?? false;

				return {
					id: String(thread.id),
					title: thread.title || "",
					content: thread.content,
					author: authorName,
					authorAvatar,
					authorId: student?.id ?? null,
					publishedAt: thread.createdAt,
					upvotes: thread.upvotes?.length ?? 0,
					replyCount: replyCountMap.get(String(thread.id)) || 0,
					isPinned: thread.isPinned ?? false,
					isUpvoted,
				};
			});
		}

		// If threadId is provided, fetch only the replies for that specific thread
		if (threadId) {
			const threadIdNum = Number.parseInt(threadId, 10);
			if (!Number.isNaN(threadIdNum)) {
				// Find the thread from the already-fetched threads list
				const foundThread = discussionThreads.find((t) => t.id === threadId);
				if (foundThread) {
					// Use the thread data from the list (no need to fetch again)
					discussionThread = foundThread;

					// Only fetch the replies for this thread
					const threadResult = await tryGetThreadWithReplies(payload, {
						threadId: threadIdNum,
						includeComments: true,
					});

					if (threadResult.ok) {
						const replies = threadResult.value.replies;
						const comments = threadResult.value.comments;

						// Transform replies and comments into a flat structure
						// Replies have parentThread pointing to the thread
						// Comments have parentThread pointing to either the thread or a reply
						const allRepliesData = [
							...replies.map((reply) => ({
								original: reply,
								type: "reply" as const,
							})),
							...comments.map((comment) => ({
								original: comment,
								type: "comment" as const,
							})),
						];

						// Build a map of all replies/comments by ID
						const replyMap = new Map<
							string,
							{
								id: string;
								content: string;
								author: string;
								authorAvatar: string;
								authorId: number | null;
								publishedAt: string;
								upvotes: number;
								parentId: string | null;
								isUpvoted: boolean;
								replies: Array<{
									id: string;
									content: string;
									author: string;
									authorAvatar: string;
									authorId: number | null;
									publishedAt: string;
									upvotes: number;
									parentId: string | null;
									isUpvoted: boolean;
								}>;
							}
						>();

						// First pass: create all reply/comment entries
						for (const item of allRepliesData) {
							const original = item.original;
							const student =
								typeof original.student === "object" && original.student !== null
									? original.student
									: null;
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
								original.upvotes?.some(
									(upvote: { user: number | { id: number }; upvotedAt: string; id?: string | null }) => {
										const upvoteUser =
											typeof upvote.user === "object" && upvote.user !== null
												? upvote.user
												: null;
										return upvoteUser?.id === currentUser.id;
									},
								) ?? false;

							// Get parentThread ID - for replies it's the thread, for comments it might be a reply
							const parentThreadId = original.parentThread;
							const parentId = parentThreadId
								? String(
									typeof parentThreadId === "object" &&
										parentThreadId !== null &&
										"id" in parentThreadId
										? parentThreadId.id
										: parentThreadId,
								)
								: null;

							// If parentId is the thread ID, this is a top-level reply
							// Otherwise, it's a nested comment
							const isTopLevel = parentId === String(threadIdNum);

							replyMap.set(String(original.id), {
								id: String(original.id),
								content: original.content,
								author: authorName,
								authorAvatar,
								authorId: student?.id ?? null,
								publishedAt: original.createdAt,
								upvotes: original.upvotes?.length ?? 0,
								parentId: isTopLevel ? null : parentId,
								isUpvoted,
								replies: [],
							});
						}

						// Second pass: build nested structure
						for (const item of allRepliesData) {
							const replyId = String(item.original.id);
							const replyEntry = replyMap.get(replyId);
							if (!replyEntry) continue;

							// If this has a parentId that's not the thread, it's nested
							if (replyEntry.parentId && replyEntry.parentId !== String(threadIdNum)) {
								const parent = replyMap.get(replyEntry.parentId);
								if (parent) {
									parent.replies.push(replyEntry);
								}
							}
						}

						// Get top-level replies (those with parentId === null or parentId === thread.id)
						discussionReplies = Array.from(replyMap.values()).filter(
							(reply) => reply.parentId === null || reply.parentId === String(threadIdNum),
						);
					}
				}
			}
		}
	}

	// For quizzes, fetch student's submissions separately because students
	// don't have permission to see all submissions from course module context
	let userSubmissions: typeof courseModuleContext.submissions = [];

	if (courseModuleContext.module.type === "quiz") {
		const payload = context.get(globalContextKey)?.payload;
		if (!payload) {
			throw new ForbiddenResponse("Payload not available");
		}


		// Fetch only the current student's quiz submissions
		const quizSubmissionsResult = await tryListQuizSubmissions({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			limit: 1000,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (quizSubmissionsResult.ok) {
			// Map quiz submissions to match the expected type structure
			// The submissions from tryListQuizSubmissions already have the correct structure
			userSubmissions = quizSubmissionsResult.value.docs as typeof courseModuleContext.submissions;
		}
	} else if (courseModuleContext.module.type === "assignment") {
		// For assignments, filter from course module context (admins can see all)
		userSubmissions = courseModuleContext.submissions.filter(
			(sub) => "student" in sub && sub.student.id === currentUser.id,
		);
	}

	// Get the latest submission (draft or most recent for assignments, in_progress or most recent for quizzes)
	const userSubmission =
		userSubmissions.length > 0
			? courseModuleContext.module.type === "assignment"
				? userSubmissions.find(
					(sub) =>
						"status" in sub && sub.status === "draft",
				) || userSubmissions[0]
				: courseModuleContext.module.type === "quiz"
					? // For quizzes, prioritize in_progress, then most recent
					userSubmissions.find(
						(sub) =>
							"status" in sub &&
							sub.status === "in_progress",
					) ||
					// Sort by createdAt descending and get the most recent
					[...userSubmissions].sort((a, b) => {
						const aDate =
							"createdAt" in a && typeof a.createdAt === "string"
								? new Date(a.createdAt).getTime()
								: 0;
						const bDate =
							"createdAt" in b && typeof b.createdAt === "string"
								? new Date(b.createdAt).getTime()
								: 0;
						return bDate - aDate;
					})[0]
					: null
			: null;

	return {
		module: courseModuleContext.module,
		moduleSettings: courseModuleContext.moduleLinkSettings,
		formattedModuleSettings,
		course: courseContext.course,
		previousModule,
		nextModule,
		userSubmission,
		userSubmissions,
		moduleLinkId: courseModuleContext.moduleLinkId,
		canSubmit,
		discussionThreads,
		discussionThread,
		discussionReplies,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	assertRequestMethod(request.method, "POST");

	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const { moduleLinkId } = params;
	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	if (!courseModuleContext) {
		return badRequest({ error: "Module not found" });
	}

	if (!enrolmentContext?.enrolment) {
		return badRequest({ error: "Enrollment not found" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if this is a quiz action
	const { action: actionParam, replyTo: replyToParam } = loadSearchParams(request);
	const isQuizStart =
		courseModuleContext.module.type === "quiz" &&
		actionParam === QuizActions.START_ATTEMPT;
	const isQuizSubmit =
		courseModuleContext.module.type === "quiz" &&
		actionParam === QuizActions.SUBMIT_QUIZ;
	const isCreateThread =
		courseModuleContext.module.type === "discussion" &&
		actionParam === DiscussionActions.CREATE_THREAD;
	const isUpvoteThread =
		courseModuleContext.module.type === "discussion" &&
		actionParam === DiscussionActions.UPVOTE_THREAD;
	const isRemoveUpvoteThread =
		courseModuleContext.module.type === "discussion" &&
		actionParam === DiscussionActions.REMOVE_UPVOTE_THREAD;
	const isUpvoteReply =
		courseModuleContext.module.type === "discussion" &&
		actionParam === DiscussionActions.UPVOTE_REPLY;
	const isRemoveUpvoteReply =
		courseModuleContext.module.type === "discussion" &&
		actionParam === DiscussionActions.REMOVE_UPVOTE_REPLY;
	// Reply action is now determined by replyTo parameter instead of action=REPLY
	const isReply =
		courseModuleContext.module.type === "discussion" &&
		replyToParam !== "";

	// Handle discussion thread creation
	if (isCreateThread) {
		const formData = await request.formData();
		const title = formData.get("title");
		const content = formData.get("content");

		if (!title || typeof title !== "string" || title.trim() === "") {
			return badRequest({ error: "Thread title is required" });
		}

		if (!content || typeof content !== "string" || content.trim() === "") {
			return badRequest({ error: "Thread content is required" });
		}

		// Check if user can participate in discussions
		const canParticipate = canParticipateInDiscussion(enrolmentContext.enrolment);
		if (!canParticipate.allowed) {
			throw new ForbiddenResponse(canParticipate.reason);
		}

		const createResult = await tryCreateDiscussionSubmission(payload, {
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			postType: "thread",
			title: title.trim(),
			content: content.trim(),
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		// Redirect to remove action parameter and show the new thread
		return redirect(
			href("/course/module/:moduleLinkId", { moduleLinkId: String(moduleLinkId) }) +
			`?threadId=${createResult.value.id}`,
		);
	}

	// Handle upvote thread
	if (isUpvoteThread) {
		const formData = await request.formData();
		const submissionIdParam = formData.get("submissionId");

		if (!submissionIdParam) {
			return badRequest({ error: "Submission ID is required" });
		}

		const submissionId = Number.parseInt(
			typeof submissionIdParam === "string" ? submissionIdParam : "",
			10,
		);
		if (Number.isNaN(submissionId)) {
			return badRequest({ error: "Invalid submission ID" });
		}

		const upvoteResult = await tryUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: currentUser.id,
		});

		if (!upvoteResult.ok) {
			return badRequest({ error: upvoteResult.error.message });
		}

		return ok({ success: true, message: "Thread upvote added successfully" });
	}

	// Handle remove upvote thread
	if (isRemoveUpvoteThread) {
		const formData = await request.formData();
		const submissionIdParam = formData.get("submissionId");

		if (!submissionIdParam) {
			return badRequest({ error: "Submission ID is required" });
		}

		const submissionId = Number.parseInt(
			typeof submissionIdParam === "string" ? submissionIdParam : "",
			10,
		);
		if (Number.isNaN(submissionId)) {
			return badRequest({ error: "Invalid submission ID" });
		}

		const removeUpvoteResult = await tryRemoveUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: currentUser.id,
		});

		if (!removeUpvoteResult.ok) {
			return badRequest({ error: removeUpvoteResult.error.message });
		}


		return ok({ success: true, message: "Thread upvote removed successfully" });
	}

	// Handle upvote reply
	if (isUpvoteReply) {
		const formData = await request.formData();
		const submissionIdParam = formData.get("submissionId");

		if (!submissionIdParam) {
			return badRequest({ error: "Submission ID is required" });
		}

		const submissionId = Number.parseInt(
			typeof submissionIdParam === "string" ? submissionIdParam : "",
			10,
		);
		if (Number.isNaN(submissionId)) {
			return badRequest({ error: "Invalid submission ID" });
		}

		const upvoteResult = await tryUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: currentUser.id,
		});

		if (!upvoteResult.ok) {
			return badRequest({ error: upvoteResult.error.message });
		}

		// Redirect to refresh the page and show updated upvote count
		const threadIdParam = formData.get("threadId");
		if (!threadIdParam || typeof threadIdParam !== "string") {
			return badRequest({ error: "Thread ID is required for reply upvote" });
		}
		return ok({ success: true, message: "Reply upvote added successfully" });
	}

	// Handle remove upvote reply
	if (isRemoveUpvoteReply) {
		const formData = await request.formData();
		const submissionIdParam = formData.get("submissionId");

		if (!submissionIdParam) {
			return badRequest({ error: "Submission ID is required" });
		}

		const submissionId = Number.parseInt(
			typeof submissionIdParam === "string" ? submissionIdParam : "",
			10,
		);
		if (Number.isNaN(submissionId)) {
			return badRequest({ error: "Invalid submission ID" });
		}

		const removeUpvoteResult = await tryRemoveUpvoteDiscussionSubmission(payload, {
			submissionId,
			userId: currentUser.id,
		});

		if (!removeUpvoteResult.ok) {
			return badRequest({ error: removeUpvoteResult.error.message });
		}

		// Redirect to refresh the page and show updated upvote count
		const threadIdParam = formData.get("threadId");
		if (!threadIdParam || typeof threadIdParam !== "string") {
			return badRequest({ error: "Thread ID is required for reply upvote removal" });
		}
		return ok({ success: true, message: "Reply upvote removed successfully" });
	}

	// Handle reply creation
	if (isReply) {
		const formData = await request.formData();
		const content = formData.get("content");
		const parentThreadParam = formData.get("parentThread");

		if (!content || typeof content !== "string" || content.trim() === "") {
			return badRequest({ error: "Reply content is required" });
		}

		if (!parentThreadParam) {
			return badRequest({ error: "Parent thread ID is required" });
		}

		const parentThreadId = Number.parseInt(
			typeof parentThreadParam === "string" ? parentThreadParam : "",
			10,
		);
		if (Number.isNaN(parentThreadId)) {
			return badRequest({ error: "Invalid parent thread ID" });
		}

		// Check if user can participate in discussions
		const canParticipate = canParticipateInDiscussion(enrolmentContext.enrolment);
		if (!canParticipate.allowed) {
			throw new ForbiddenResponse(canParticipate.reason);
		}

		// Determine post type and parent based on replyTo URL parameter
		// replyToParam === "thread" means replying to the thread (top-level reply)
		// replyToParam === <commentId> means replying to a comment (nested comment)
		const isReplyingToThread = replyToParam === "thread";
		const postType = isReplyingToThread ? "reply" : "comment";

		// For nested comments, parentThread should point to the parent comment/reply
		// For top-level replies, parentThread should point to the thread
		const actualParentThread = isReplyingToThread
			? parentThreadId
			: Number.parseInt(replyToParam, 10);

		if (Number.isNaN(actualParentThread)) {
			return badRequest({ error: "Invalid parent thread ID" });
		}

		const createResult = await tryCreateDiscussionSubmission(payload, {
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			postType,
			content: content.trim(),
			parentThread: actualParentThread,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		// Redirect to the thread detail view
		return redirect(
			href("/course/module/:moduleLinkId", { moduleLinkId: String(moduleLinkId) }) +
			`?threadId=${parentThreadId}`,
		);
	}

	// Only students can submit assignments or start quizzes
	if (!canSubmitAssignment(enrolmentContext.enrolment).allowed) {
		throw new ForbiddenResponse("Only students can submit assignments");
	}

	// Handle quiz submission
	if (isQuizSubmit) {
		const formData = await request.formData();
		const submissionIdParam = formData.get("submissionId");
		const answersJson = formData.get("answers");
		const timeSpentParam = formData.get("timeSpent");

		if (!submissionIdParam) {
			return badRequest({ error: "Submission ID is required" });
		}

		const submissionId = Number.parseInt(
			typeof submissionIdParam === "string" ? submissionIdParam : "",
			10,
		);
		if (Number.isNaN(submissionId)) {
			return badRequest({ error: "Invalid submission ID" });
		}

		// Parse answers if provided
		let answers: Array<{
			questionId: string;
			questionText: string;
			questionType:
			| "multiple_choice"
			| "true_false"
			| "short_answer"
			| "essay"
			| "fill_blank";
			selectedAnswer?: string;
			multipleChoiceAnswers?: Array<{
				option: string;
				isSelected: boolean;
			}>;
		}> | undefined;

		if (answersJson && typeof answersJson === "string") {
			try {
				answers = JSON.parse(answersJson) as typeof answers;
			} catch {
				return badRequest({ error: "Invalid answers format" });
			}
		}

		// Parse timeSpent if provided
		let timeSpent: number | undefined;
		if (timeSpentParam) {
			const parsed = Number.parseFloat(
				typeof timeSpentParam === "string" ? timeSpentParam : "",
			);
			if (!Number.isNaN(parsed)) {
				timeSpent = parsed;
			}
		}

		const submitResult = await trySubmitQuiz({
			payload,
			submissionId,
			answers,
			timeSpent,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!submitResult.ok) {
			return badRequest({ error: submitResult.error.message });
		}

		// Redirect to remove showQuiz parameter and show instructions view
		return redirect(
			href("/course/module/:moduleLinkId", { moduleLinkId: String(moduleLinkId) }),
		);
	}

	// Handle quiz start attempt
	if (isQuizStart) {
		// Check if there's already an in_progress submission
		const checkResult = await tryCheckInProgressSubmission({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!checkResult.ok) {
			return badRequest({ error: checkResult.error.message });
		}

		// If there's an in_progress submission, reuse it by redirecting with showQuiz parameter
		if (checkResult.value.hasInProgress) {
			return redirect(
				href("/course/module/:moduleLinkId", {
					moduleLinkId: String(moduleLinkId),
				}) + "?showQuiz=true",
			);
		}

		// No in_progress attempt exists, create a new one
		// Get next attempt number
		const nextAttemptResult = await tryGetNextAttemptNumber({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!nextAttemptResult.ok) {
			return badRequest({ error: nextAttemptResult.error.message });
		}

		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			attemptNumber: nextAttemptResult.value,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			overrideAccess: false,
		});

		if (!startResult.ok) {
			return badRequest({ error: startResult.error.message });
		}

		// Redirect with showQuiz parameter to show the quiz preview
		return redirect(
			href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + "?showQuiz=true",
		);
	}

	// Handle assignment submission (existing logic)
	if (courseModuleContext.module.type !== "assignment") {
		return badRequest({ error: "Invalid module type for this action" });
	}

	// Begin transaction for file uploads and submission
	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({
			error: "Failed to begin transaction",
		});
	}

	// Get upload limit from system globals
	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	try {
		const uploadedFileIds: number[] = [];

		const uploadHandler = async (fileUpload: FileUpload) => {
			if (fileUpload.fieldName === "files") {
				const arrayBuffer = await fileUpload.arrayBuffer();
				const fileBuffer = Buffer.from(arrayBuffer);

				const mediaResult = await tryCreateMedia({
					payload,
					file: fileBuffer,
					filename: fileUpload.name,
					mimeType: fileUpload.type,
					alt: `Assignment submission file - ${fileUpload.name}`,
					userId: currentUser.id,
					user: {
						...currentUser,
						collection: "users",
						avatar: currentUser.avatar?.id ?? undefined,
					},
					req: { transactionID },
				});

				if (!mediaResult.ok) {
					throw mediaResult.error;
				}

				const fileId = mediaResult.value.media.id;
				uploadedFileIds.push(fileId);
				return fileId;
			}
		};

		const formData = await parseFormDataWithFallback(
			request,
			uploadHandler as FileUploadHandler,
			maxFileSize !== undefined ? { maxFileSize } : undefined,
		);

		const parsed = z
			.object({
				textContent: z.string().nullish(),
			})
			.safeParse({
				textContent: formData.get("textContent"),
			});

		if (!parsed.success) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				error: parsed.error.message,
			});
		}

		const textContent = parsed.data.textContent || "";

		// Build attachments array from uploaded files
		const attachments = uploadedFileIds.map((fileId) => ({
			file: fileId,
		}));

		// Find existing draft submission
		const existingDraftSubmission = courseModuleContext.submissions.find(
			(sub) =>
				"student" in sub &&
				sub.student.id === currentUser.id &&
				sub.status === "draft",
		);

		// Calculate next attempt number
		const userSubmissions = courseModuleContext.submissions.filter(
			(sub): sub is typeof sub & { attemptNumber: unknown } =>
				"student" in sub &&
				sub.student.id === currentUser.id &&
				"attemptNumber" in sub,
		);
		const maxAttemptNumber =
			userSubmissions.length > 0
				? Math.max(...userSubmissions.map((sub) => sub.attemptNumber as number))
				: 0;
		const nextAttemptNumber =
			existingDraftSubmission && "attemptNumber" in existingDraftSubmission
				? (existingDraftSubmission.attemptNumber as number)
				: maxAttemptNumber + 1;

		let submissionId: number;

		if (existingDraftSubmission) {
			// Update existing draft submission
			const updateResult = await tryUpdateAssignmentSubmission({
				payload,
				id: existingDraftSubmission.id,
				content: textContent,
				attachments: attachments.length > 0 ? attachments : undefined,
				status: "draft",
				user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				},
				req: { transactionID },
				overrideAccess: false,
			});

			if (!updateResult.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: updateResult.error.message });
			}

			submissionId = existingDraftSubmission.id;
		} else {
			// Create new submission with next attempt number
			const createResult = await tryCreateAssignmentSubmission({
				payload,
				courseModuleLinkId: Number(moduleLinkId),
				studentId: currentUser.id,
				enrollmentId: enrolmentContext.enrolment.id,
				content: textContent,
				attachments: attachments.length > 0 ? attachments : undefined,
				attemptNumber: nextAttemptNumber,
				user: {
					...currentUser,
					collection: "users",
					avatar: currentUser.avatar?.id ?? undefined,
				},
				req: { transactionID },
				overrideAccess: false,
			});

			if (!createResult.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: createResult.error.message });
			}

			submissionId = createResult.value.id;
		}

		// Submit the assignment (change status to submitted)
		const submitResult = await trySubmitAssignment({
			payload,
			submissionId,
			user: {
				...currentUser,
				collection: "users",
				avatar: currentUser.avatar?.id ?? undefined,
			},
			req: { transactionID },
			overrideAccess: false,
		});

		if (!submitResult.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: submitResult.error.message });
		}

		await payload.db.commitTransaction(transactionID);

		return redirect(
			href("/course/module/:moduleLinkId", { moduleLinkId: String(moduleLinkId) }),
		);
	} catch (error) {
		await payload.db.rollbackTransaction(transactionID);
		console.error("Assignment submission error:", error);

		// Handle file size and count limit errors
		if (error instanceof MaxFileSizeExceededError) {
			return badRequest({
				error: `File size exceeds maximum allowed size of ${prettyBytes(maxFileSize ?? 0)}`,
			});
		}

		if (error instanceof MaxFilesExceededError) {
			return badRequest({
				error: error.message,
			});
		}

		return badRequest({
			error:
				error instanceof Error ? error.message : "Failed to submit assignment",
		});
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData &&
		"status" in actionData &&
		(actionData.status === StatusCode.BadRequest ||
			actionData.status === StatusCode.Unauthorized)
	) {
		notifications.show({
			title: "Error",
			message:
				typeof actionData.error === "string"
					? actionData.error
					: "Failed to complete operation",
			color: "red",
		});
	} else if (actionData && "success" in actionData && actionData.success) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});
	}

	return actionData;
}

const useSubmitAssignment = () => {
	const fetcher = useFetcher<typeof clientAction>();

	const submitAssignment = (textContent: string, files: File[]) => {
		const formData = new FormData();
		formData.append("textContent", textContent);

		// Add all files to form data
		for (const file of files) {
			formData.append("files", file);
		}

		fetcher.submit(formData, {
			method: "POST",
			encType: ContentType.MULTIPART,
		});
	};

	return {
		submitAssignment,
		isSubmitting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

const useStartQuizAttempt = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();

	const startQuizAttempt = () => {
		const formData = new FormData();
		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?action=${QuizActions.START_ATTEMPT}`,
		});
	};

	return {
		startQuizAttempt,
		isStarting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

const useSubmitQuiz = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();

	const submitQuiz = (
		submissionId: number,
		answers: Array<{
			questionId: string;
			questionText: string;
			questionType:
			| "multiple_choice"
			| "true_false"
			| "short_answer"
			| "essay"
			| "fill_blank";
			selectedAnswer?: string;
			multipleChoiceAnswers?: Array<{
				option: string;
				isSelected: boolean;
			}>;
		}>,
		timeSpent?: number,
	) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());
		formData.append("answers", JSON.stringify(answers));
		if (timeSpent !== undefined) {
			formData.append("timeSpent", timeSpent.toString());
		}

		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?action=${QuizActions.SUBMIT_QUIZ}`,
		});
	};

	return {
		submitQuiz,
		isSubmitting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useCreateThread = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();

	const createThread = (title: string, content: string) => {
		const formData = new FormData();
		formData.append("title", title);
		formData.append("content", content);

		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?action=${DiscussionActions.CREATE_THREAD}`,
		});
	};

	return {
		createThread,
		isCreating: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
		fetcher,
	};
};

export const useUpvoteThread = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();
	const revalidator = useRevalidator();

	const upvoteThread = (submissionId: number, threadId?: string) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());
		if (threadId) {
			formData.append("threadId", threadId);
		}

		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?action=${DiscussionActions.UPVOTE_THREAD}`,
		});
	};

	// Revalidate when action completes successfully
	useEffect(() => {
		if (fetcher.data && "success" in fetcher.data && fetcher.data.success) {
			revalidator.revalidate();
		}
	}, [fetcher.data, revalidator]);

	return {
		upvoteThread,
		isUpvoting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useRemoveUpvoteThread = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();
	const revalidator = useRevalidator();

	const removeUpvoteThread = (submissionId: number, threadId?: string) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());
		if (threadId) {
			formData.append("threadId", threadId);
		}

		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?action=${DiscussionActions.REMOVE_UPVOTE_THREAD}`,
		});
	};

	// Revalidate when action completes successfully
	useEffect(() => {
		if (fetcher.data && "success" in fetcher.data && fetcher.data.success) {
			revalidator.revalidate();
		}
	}, [fetcher.data, revalidator]);

	return {
		removeUpvoteThread,
		isRemovingUpvote: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useUpvoteReply = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();
	const revalidator = useRevalidator();

	const upvoteReply = (submissionId: number, threadId: string) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());
		formData.append("threadId", threadId);

		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?action=${DiscussionActions.UPVOTE_REPLY}`,
		});
	};

	// Revalidate when action completes successfully
	useEffect(() => {
		if (fetcher.data && "success" in fetcher.data && fetcher.data.success) {
			revalidator.revalidate();
		}
	}, [fetcher.data, revalidator]);

	return {
		upvoteReply,
		isUpvoting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useRemoveUpvoteReply = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();
	const revalidator = useRevalidator();

	const removeUpvoteReply = (submissionId: number, threadId: string) => {
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());
		formData.append("threadId", threadId);

		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?action=${DiscussionActions.REMOVE_UPVOTE_REPLY}`,
		});
	};

	// Revalidate when action completes successfully
	useEffect(() => {
		if (fetcher.data && "success" in fetcher.data && fetcher.data.success) {
			revalidator.revalidate();
		}
	}, [fetcher.data, revalidator]);

	return {
		removeUpvoteReply,
		isRemovingUpvote: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

export const useCreateReply = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();

	const createReply = (
		content: string,
		parentThreadId: number,
		replyToId?: string | null,
	) => {
		const formData = new FormData();
		formData.append("content", content);
		formData.append("parentThread", parentThreadId.toString());

		// Use replyTo URL parameter instead of action=REPLY
		// replyTo=thread for thread-level replies, replyTo=<commentId> for nested comments
		const replyToParam = replyToId || "thread";

		fetcher.submit(formData, {
			method: "POST",
			action: href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?replyTo=${replyToParam}`,
		});
	};

	return {
		createReply,
		isSubmitting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};

/**
 * Transform QuizAnswers from quiz preview format to submission format
 */
function transformQuizAnswersToSubmissionFormat(
	quizConfig: QuizConfig,
	answers: QuizAnswers,
): Array<{
	questionId: string;
	questionText: string;
	questionType:
	| "multiple_choice"
	| "true_false"
	| "short_answer"
	| "essay"
	| "fill_blank";
	selectedAnswer?: string;
	multipleChoiceAnswers?: Array<{
		option: string;
		isSelected: boolean;
	}>;
}> {
	const result: Array<{
		questionId: string;
		questionText: string;
		questionType:
		| "multiple_choice"
		| "true_false"
		| "short_answer"
		| "essay"
		| "fill_blank";
		selectedAnswer?: string;
		multipleChoiceAnswers?: Array<{
			option: string;
			isSelected: boolean;
		}>;
	}> = [];

	// Helper to map question type from quiz config to submission format
	const mapQuestionType = (
		type: Question["type"],
	): "multiple_choice" | "true_false" | "short_answer" | "essay" | "fill_blank" => {
		switch (type) {
			case "multiple-choice":
				return "multiple_choice";
			case "short-answer":
				return "short_answer";
			case "long-answer":
			case "article":
				return "essay";
			case "fill-in-the-blank":
				return "fill_blank";
			case "choice":
				return "multiple_choice";
			case "ranking":
			case "single-selection-matrix":
			case "multiple-selection-matrix":
			case "whiteboard":
				// These types don't have direct mapping, use essay as fallback
				return "essay";
			default:
				return "essay";
		}
	};

	// Get all questions from quiz config
	const questions: Question[] = [];
	if (isRegularQuiz(quizConfig)) {
		for (const page of quizConfig.pages || []) {
			questions.push(...page.questions);
		}
	} else {
		// For container quizzes, we'd need to handle nested quizzes
		// For now, we'll only handle regular quizzes
	}

	// Transform each answer
	for (const [questionId, answerValue] of Object.entries(answers)) {
		const question = questions.find((q) => q.id === questionId);
		if (!question) continue;

		const questionType = mapQuestionType(question.type);
		const submissionAnswer: {
			questionId: string;
			questionText: string;
			questionType:
			| "multiple_choice"
			| "true_false"
			| "short_answer"
			| "essay"
			| "fill_blank";
			selectedAnswer?: string;
			multipleChoiceAnswers?: Array<{
				option: string;
				isSelected: boolean;
			}>;
		} = {
			questionId,
			questionText: question.prompt,
			questionType,
		};

		// Handle different answer value types
		if (typeof answerValue === "string") {
			// Single string answer (multiple-choice, short-answer, long-answer, article)
			if (question.type === "multiple-choice" || question.type === "short-answer") {
				submissionAnswer.selectedAnswer = answerValue;
			} else {
				// For long-answer and article, store as selectedAnswer
				submissionAnswer.selectedAnswer = answerValue;
			}
		} else if (Array.isArray(answerValue)) {
			// Array answer (fill-in-the-blank, choice, ranking)
			if (question.type === "choice" && "options" in question) {
				// For choice questions, create multipleChoiceAnswers
				const options = question.options;
				submissionAnswer.multipleChoiceAnswers = Object.keys(options).map(
					(optionKey) => ({
						option: optionKey,
						isSelected: answerValue.includes(optionKey),
					}),
				);
			} else {
				// For other array types, join as comma-separated string
				submissionAnswer.selectedAnswer = answerValue.join(", ");
			}
		} else if (typeof answerValue === "object" && answerValue !== null) {
			// Object answer (fill-in-the-blank with blanks, matrix questions)
			if (question.type === "fill-in-the-blank") {
				// Join object values as comma-separated string
				submissionAnswer.selectedAnswer = Object.values(answerValue).join(", ");
			} else {
				// For matrix questions, stringify the object
				submissionAnswer.selectedAnswer = JSON.stringify(answerValue);
			}
		}

		result.push(submissionAnswer);
	}

	return result;
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

// Wrapper components that use hooks directly

// CreateThreadForm wrapper that uses useCreateThread hook
interface CreateThreadFormWrapperProps {
	moduleLinkId: number;
	onCancel: () => void;
}

function CreateThreadFormWrapper({
	moduleLinkId,
	onCancel,
}: CreateThreadFormWrapperProps) {
	const { createThread, isCreating, fetcher } = useCreateThread(moduleLinkId);

	return (
		<CreateThreadForm
			onSubmit={(title, content) => {
				console.log("Creating thread", title, content);
				createThread(title, content);
			}}
			onCancel={onCancel}
			isSubmitting={isCreating}
			fetcher={fetcher}
		/>
	);
}

// ThreadUpvoteButton wrapper that uses upvote hooks
interface ThreadUpvoteButtonProps {
	thread: DiscussionThread;
	moduleLinkId: number;
	threadId?: string;
}

function ThreadUpvoteButton({
	thread,
	moduleLinkId,
	threadId,
}: ThreadUpvoteButtonProps) {
	const { upvoteThread } = useUpvoteThread(moduleLinkId);
	const { removeUpvoteThread } = useRemoveUpvoteThread(moduleLinkId);

	const handleUpvote = (e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation();
		}
		const submissionId = Number.parseInt(thread.id, 10);
		if (Number.isNaN(submissionId)) return;

		if (thread.isUpvoted) {
			removeUpvoteThread(submissionId, threadId);
		} else {
			upvoteThread(submissionId, threadId);
		}
	};

	return (
		<Stack gap="xs" align="center" style={{ minWidth: 50 }}>
			<Tooltip label={thread.isUpvoted ? "Remove upvote" : "Upvote"}>
				<ActionIcon
					variant={thread.isUpvoted ? "filled" : "subtle"}
					color={thread.isUpvoted ? "blue" : "gray"}
					onClick={handleUpvote}
				>
					{thread.isUpvoted ? (
						<IconArrowBigUpFilled size={20} />
					) : (
						<IconArrowBigUp size={20} />
					)}
				</ActionIcon>
			</Tooltip>
			<Text size="sm" fw={500}>
				{thread.upvotes}
			</Text>
		</Stack>
	);
}

// ReplyUpvoteButton wrapper that uses reply upvote hooks
interface ReplyUpvoteButtonProps {
	reply: DiscussionReply;
	moduleLinkId: number;
	threadId: string;
}

function ReplyUpvoteButton({
	reply,
	moduleLinkId,
	threadId,
}: ReplyUpvoteButtonProps) {
	const { upvoteReply } = useUpvoteReply(moduleLinkId);
	const { removeUpvoteReply } = useRemoveUpvoteReply(moduleLinkId);

	const handleUpvote = () => {
		const submissionId = Number.parseInt(reply.id, 10);
		if (Number.isNaN(submissionId)) return;

		if (reply.isUpvoted) {
			removeUpvoteReply(submissionId, threadId);
		} else {
			upvoteReply(submissionId, threadId);
		}
	};

	return (
		<Group gap="xs">
			<ActionIcon
				variant={reply.isUpvoted ? "filled" : "subtle"}
				color={reply.isUpvoted ? "blue" : "gray"}
				size="sm"
				onClick={handleUpvote}
			>
				{reply.isUpvoted ? (
					<IconArrowBigUpFilled size={16} />
				) : (
					<IconArrowBigUp size={16} />
				)}
			</ActionIcon>
			<Text size="sm">{reply.upvotes}</Text>
		</Group>
	);
}

// ReplyFormWrapper that uses useCreateReply hook
interface ReplyFormWrapperProps {
	moduleLinkId: number;
	threadId: string;
	replyTo?: string | null;
	onCancel: () => void;
}

function ReplyFormWrapper({
	moduleLinkId,
	threadId,
	replyTo: _replyTo,
	onCancel,
}: ReplyFormWrapperProps) {
	const [replyContent, setReplyContent] = useState("");
	const { createReply, isSubmitting } = useCreateReply(moduleLinkId);

	const handleSubmit = () => {
		if (replyContent.trim()) {
			const threadIdNum = Number.parseInt(threadId, 10);
			if (!Number.isNaN(threadIdNum)) {
				// For thread-level replies, pass null/undefined to use "thread" as default
				// For comment replies, pass the comment ID
				createReply(replyContent.trim(), threadIdNum, _replyTo || undefined);
				setReplyContent("");
			}
		}
	};

	return (
		<Paper withBorder p="md" radius="sm" bg="gray.0">
			<Stack gap="md">
				<Text size="sm" fw={500}>
					Write a reply
				</Text>
				<SimpleRichTextEditor
					content={replyContent}
					onChange={setReplyContent}
					placeholder="Write your reply..."
				/>
				<Group justify="flex-end">
					<Button variant="default" onClick={onCancel} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} loading={isSubmitting}>
						Post Reply
					</Button>
				</Group>
			</Stack>
		</Paper>
	);
}

// Discussion Thread List View Component
interface DiscussionThreadListViewProps {
	threads: DiscussionThread[];
	discussion: DiscussionData;
	moduleLinkId: number;
	courseId: number;
	onThreadClick: (id: string) => void;
}

function DiscussionThreadListView({
	threads,
	discussion,
	moduleLinkId,
	courseId,
	onThreadClick,
}: DiscussionThreadListViewProps) {
	const [sortBy, setSortBy] = useState<string>("recent");
	const [action, setAction] = useQueryState("action");

	const sortedThreads = [...threads].sort((a, b) => {
		switch (sortBy) {
			case "upvoted":
				return b.upvotes - a.upvotes;
			case "active":
				return b.replyCount - a.replyCount;
			case "recent":
			default:
				return (
					new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
				);
		}
	});

	if (action === DiscussionActions.CREATE_THREAD) {
		return (
			<CreateThreadFormWrapper
				moduleLinkId={moduleLinkId}
				onCancel={() => setAction(null)}
			/>
		);
	}

	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="lg">
				{/* Header */}
				<Group justify="space-between" align="flex-start">
					<div>
						<Title order={3} mb="xs">
							Discussion Board
						</Title>
						{discussion.instructions && (
							<Typography
								className="tiptap"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
								dangerouslySetInnerHTML={{ __html: discussion.instructions }}
								style={{
									fontSize: "0.875rem",
									color: "var(--mantine-color-dimmed)",
								}}
							/>
						)}
					</div>
					<Button leftSection={<IconPlus size={16} />} onClick={() => setAction(DiscussionActions.CREATE_THREAD)}>
						New Thread
					</Button>
				</Group>

				{/* Sorting */}
				<Group justify="space-between">
					<Text size="sm" c="dimmed">
						{threads.length} {threads.length === 1 ? "thread" : "threads"}
					</Text>
					<Select
						size="sm"
						value={sortBy}
						onChange={(value) => setSortBy(value || "recent")}
						data={[
							{ value: "recent", label: "Most Recent" },
							{ value: "upvoted", label: "Most Upvoted" },
							{ value: "active", label: "Most Active" },
						]}
						style={{ width: 180 }}
					/>
				</Group>

				<Divider />

				{/* Thread List */}
				<Stack gap="md">
					{sortedThreads.map((thread) => (
						<Paper
							key={thread.id}
							withBorder
							p="md"
							radius="sm"
							style={{ cursor: "pointer" }}
							onClick={() => onThreadClick(thread.id)}
						>
							<Group align="flex-start" gap="md" wrap="nowrap">
								{/* Upvote Section */}
								<ThreadUpvoteButton
									thread={thread}
									moduleLinkId={moduleLinkId}
								/>

								{/* Thread Content */}
								<Stack gap="xs" style={{ flex: 1 }}>
									<Group gap="sm">
										{thread.isPinned && (
											<Badge
												size="sm"
												color="yellow"
												leftSection={<IconPin size={12} />}
											>
												Pinned
											</Badge>
										)}
										<Title order={4}>{thread.title}</Title>
									</Group>

									<Typography
										className="tiptap"
										// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
										dangerouslySetInnerHTML={{ __html: thread.content }}
										style={{
											fontSize: "0.875rem",
											color: "var(--mantine-color-dimmed)",
											display: "-webkit-box",
											WebkitLineClamp: 2,
											WebkitBoxOrient: "vertical",
											overflow: "hidden",
										}}
									/>

									<Group gap="md">
										<Link
											to={
												courseId && thread.authorId
													? href("/course/:courseId/participants/profile", {
														courseId: String(courseId),
													}) + `?userId=${thread.authorId}`
													: "#"
											}
											style={{ textDecoration: "none", color: "inherit" }}
											onClick={(e) => e.stopPropagation()}
										>
											<Group gap="xs">
												<Avatar size="sm" radius="xl">
													{thread.authorAvatar}
												</Avatar>
												<Text size="sm" style={{ cursor: "pointer" }}>
													{thread.author}
												</Text>
											</Group>
										</Link>
										<Text size="sm" c="dimmed">
											{dayjs(thread.publishedAt).fromNow()}
										</Text>
										<Group gap="xs">
											<IconMessage size={16} />
											<Text size="sm">{thread.replyCount} replies</Text>
										</Group>
									</Group>
								</Stack>
							</Group>
						</Paper>
					))}
				</Stack>
			</Stack>
		</Paper>
	);
}

// Discussion Thread Detail View Component
interface DiscussionThreadDetailViewProps {
	thread: DiscussionThread;
	replies: DiscussionReply[];
	discussion: DiscussionData;
	moduleLinkId: number;
	threadId: string;
	courseId: number;
	onBack: () => void;
}

function DiscussionThreadDetailView({
	thread,
	replies,
	discussion: _discussion,
	moduleLinkId,
	threadId,
	courseId,
	onBack,
}: DiscussionThreadDetailViewProps) {
	const [replyTo, setReplyTo] = useQueryState("replyTo");

	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="lg">
				{/* Header */}
				<Group>
					<ActionIcon variant="subtle" onClick={onBack}>
						<IconArrowBack size={20} />
					</ActionIcon>
					<Text size="sm" c="dimmed">
						Back to threads
					</Text>
				</Group>

				{/* Thread Content */}
				<Stack gap="md">
					{thread.isPinned && (
						<Badge size="lg" color="yellow" leftSection={<IconPin size={14} />}>
							Pinned Thread
						</Badge>
					)}
					<Title order={2}>{thread.title}</Title>

					<Group gap="md" justify="space-between">
						<Group gap="xs">
							<Link
								to={
									courseId && thread.authorId
										? href("/course/:courseId/participants/profile", {
											courseId: String(courseId),
										}) + `?userId=${thread.authorId}`
										: "#"
								}
								style={{ textDecoration: "none", color: "inherit" }}
							>
								<Group gap="xs">
									<Avatar size="md" radius="xl">
										{thread.authorAvatar}
									</Avatar>
									<Stack gap={0}>
										<Text size="sm" fw={500} style={{ cursor: "pointer" }}>
											{thread.author}
										</Text>
									</Stack>
								</Group>
							</Link>
							<Text size="xs" c="dimmed">
								{dayjs(thread.publishedAt).fromNow()}
							</Text>
						</Group>
						<ThreadUpvoteButton
							thread={thread}
							moduleLinkId={moduleLinkId}
							threadId={threadId}
						/>
					</Group>

					<Typography
						className="tiptap"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
						dangerouslySetInnerHTML={{ __html: thread.content }}
						style={{ lineHeight: "1.6" }}
					/>

					<Group>
						<Button
							variant="light"
							leftSection={<IconMessage size={16} />}
							onClick={() => setReplyTo("thread")}
						>
							Reply
						</Button>
					</Group>
				</Stack>

				<Divider />

				{/* Reply Form - Only show when replying to thread (replyTo=thread) */}
				{replyTo === "thread" && (
					<ReplyFormWrapper
						moduleLinkId={moduleLinkId}
						threadId={threadId}
						replyTo={null}
						onCancel={() => {
							setReplyTo(null);
						}}
					/>
				)}

				{/* Replies */}
				<Stack gap="md">
					<Title order={4}>
						{replies.length} {replies.length === 1 ? "Reply" : "Replies"}
					</Title>
					{replies
						.filter((r) => r.parentId === null)
						.map((reply) => (
							<ReplyCardWithUpvote
								key={reply.id}
								reply={reply}
								allReplies={replies}
								moduleLinkId={moduleLinkId}
								threadId={threadId}
								courseId={courseId}
								onReply={(id) => {
									setReplyTo(id);
								}}
								level={0}
								replyTo={replyTo}
								onCancelReply={() => {
									setReplyTo(null);
								}}
							/>
						))}
				</Stack>
			</Stack>
		</Paper>
	);
}

// ReplyCard wrapper that includes upvote button
interface ReplyCardWithUpvoteProps {
	reply: DiscussionReply;
	allReplies: DiscussionReply[];
	moduleLinkId: number;
	threadId: string;
	courseId: number;
	onReply: (id: string) => void;
	level: number;
	replyTo?: string | null;
	onCancelReply?: () => void;
}

function ReplyCardWithUpvote({
	reply,
	allReplies,
	moduleLinkId,
	threadId,
	courseId,
	onReply,
	level,
	replyTo,
	onCancelReply,
}: ReplyCardWithUpvoteProps) {
	const [opened, { toggle }] = useDisclosure(false);
	const [replyContent, setReplyContent] = useState("");
	const { createReply, isSubmitting, data } = useCreateReply(moduleLinkId);
	const revalidator = useRevalidator();
	const nestedReplies = allReplies.filter((r) => r.parentId === reply.id);

	// Revalidate when reply is successfully submitted
	useEffect(() => {
		if (data && "status" in data && data.status === StatusCode.Ok) {
			revalidator.revalidate();
		}
	}, [data, revalidator]);

	// Count total nested replies recursively
	const countNestedReplies = (replyId: string): number => {
		const directReplies = allReplies.filter((r) => r.parentId === replyId);
		return directReplies.reduce(
			(count, r) => count + 1 + countNestedReplies(r.id),
			0,
		);
	};

	const totalNestedCount = countNestedReplies(reply.id);
	const isReplyingToThis = replyTo === reply.id;

	const handleReplySubmit = () => {
		if (replyContent.trim()) {
			const threadIdNum = Number.parseInt(threadId, 10);
			if (!Number.isNaN(threadIdNum)) {
				createReply(replyContent.trim(), threadIdNum, reply.id);
				setReplyContent("");
				if (onCancelReply) {
					onCancelReply();
				}
			}
		}
	};

	return (
		<Box
			style={{
				marginLeft: level > 0 ? 6 : 0,
				borderLeft:
					level > 0 ? "2px solid var(--mantine-color-gray-3)" : undefined,
				paddingLeft: level > 0 ? 12 : 0,
			}}
		>
			<Paper withBorder p="md" radius="sm">
				<Stack gap="sm">
					<Group justify="space-between" align="flex-start">
						<Group gap="xs">
							<Link
								to={
									courseId && reply.authorId
										? href("/course/:courseId/participants/profile", {
											courseId: String(courseId),
										}) + `?userId=${reply.authorId}`
										: "#"
								}
								style={{ textDecoration: "none", color: "inherit" }}
							>
								<Group gap="xs">
									<Avatar size="sm" radius="xl">
										{reply.authorAvatar}
									</Avatar>
									<Stack gap={0}>
										<Text size="sm" fw={500} style={{ cursor: "pointer" }}>
											{reply.author}
										</Text>
									</Stack>
								</Group>
							</Link>
							<Text size="xs" c="dimmed">
								{dayjs(reply.publishedAt).fromNow()}
							</Text>
						</Group>

						<ReplyUpvoteButton
							reply={reply}
							moduleLinkId={moduleLinkId}
							threadId={threadId}
						/>
					</Group>

					<Typography
						className="tiptap"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
						dangerouslySetInnerHTML={{ __html: reply.content }}
						style={{ fontSize: "0.875rem", lineHeight: "1.6" }}
					/>

					<Group>
						<Button variant="subtle" size="xs" onClick={() => onReply(reply.id)}>
							Reply
						</Button>
						{totalNestedCount > 0 && (
							<Button
								variant="subtle"
								size="xs"
								onClick={toggle}
								leftSection={
									opened ? (
										<IconChevronUp size={14} />
									) : (
										<IconChevronDown size={14} />
									)
								}
							>
								{opened
									? "Hide replies"
									: `Show ${totalNestedCount} ${totalNestedCount === 1 ? "reply" : "replies"}`}
							</Button>
						)}
					</Group>
				</Stack>
			</Paper>

			{/* Inline Reply Form */}
			{isReplyingToThis && (
				<Paper withBorder p="md" radius="sm" bg="gray.0" mt="sm">
					<Stack gap="md">
						<Text size="sm" fw={500}>
							Replying to {reply.author}...
						</Text>
						<SimpleRichTextEditor
							content={replyContent}
							onChange={setReplyContent}
							placeholder="Write your reply..."
							readonly={isSubmitting}
						/>
						<Group justify="flex-end">
							<Button
								variant="default"
								onClick={() => {
									setReplyContent("");
									if (onCancelReply) {
										onCancelReply();
									}
								}}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
							<Button onClick={handleReplySubmit} loading={isSubmitting}>
								Post Reply
							</Button>
						</Group>
					</Stack>
				</Paper>
			)}

			{/* Nested Replies */}
			{nestedReplies.length > 0 && (
				<Collapse in={opened}>
					<Stack gap="sm" mt="sm">
						{nestedReplies.map((nestedReply) => (
							<ReplyCardWithUpvote
								key={nestedReply.id}
								reply={nestedReply}
								allReplies={allReplies}
								moduleLinkId={moduleLinkId}
								threadId={threadId}
								courseId={courseId}
								onReply={onReply}
								level={level + 1}
								replyTo={replyTo}
								onCancelReply={onCancelReply}
							/>
						))}
					</Stack>
				</Collapse>
			)}
		</Box>
	);
}

// Main Discussion Thread View Router
interface DiscussionThreadViewProps {
	discussion: DiscussionData | null;
	threads: DiscussionThread[];
	thread: DiscussionThread | null;
	replies: DiscussionReply[];
	moduleLinkId: number;
	courseId: number;
}

function DiscussionThreadView({
	discussion,
	threads,
	thread,
	replies,
	moduleLinkId,
	courseId,
}: DiscussionThreadViewProps) {
	const [threadId, setThreadId] = useQueryState(
		"threadId",
		parseAsString.withOptions({ shallow: false }),
	);
	const [, setReplyTo] = useQueryState("replyTo");

	// Fallback: if threadId is set but thread is not provided, try to find it from threads list
	const selectedThread =
		thread ||
		(threadId ? threads.find((t) => t.id === threadId) || null : null);

	if (!discussion) {
		return (
			<Paper withBorder p="xl" radius="md">
				<Stack gap="md">
					<Title order={3}>Discussion Preview</Title>
					<Text c="dimmed">No discussion data available.</Text>
				</Stack>
			</Paper>
		);
	}

	// Show thread detail view
	if (threadId && selectedThread) {
		return (
			<DiscussionThreadDetailView
				thread={selectedThread}
				replies={replies}
				discussion={discussion}
				moduleLinkId={moduleLinkId}
				threadId={threadId}
				courseId={courseId}
				onBack={() => {
					setThreadId(null);
					setReplyTo(null);
				}}
			/>
		);
	}

	// Show thread list view
	return (
		<DiscussionThreadListView
			threads={threads}
			discussion={discussion}
			moduleLinkId={moduleLinkId}
			courseId={courseId}
			onThreadClick={(id) => setThreadId(id)}
		/>
	);
}

// Component to display module dates/times
function ModuleDatesInfo({
	moduleSettings,
}: {
	moduleSettings: Route.ComponentProps["loaderData"]["formattedModuleSettings"];
}) {
	if (!moduleSettings || moduleSettings.dates.length === 0) return null;

	return (
		<Paper withBorder p="md" radius="md">
			<Stack gap="sm">
				<Group gap="xs">
					<IconInfoCircle size={20} />
					<Title order={5}>Important Dates</Title>
				</Group>

				<Stack gap="xs">
					{moduleSettings.dates.map((dateInfo) => (
						<Group gap="xs" key={dateInfo.label}>
							{dateInfo.label.includes("Opens") ||
								dateInfo.label.includes("Available") ? (
								<IconCalendar size={16} />
							) : (
								<IconClock size={16} />
							)}
							<Text
								size="sm"
								fw={500}
								c={dateInfo.isOverdue ? "red" : undefined}
							>
								{dateInfo.label}:
							</Text>
							<Text size="sm" c={dateInfo.isOverdue ? "red" : undefined}>
								{dateInfo.value}
								{dateInfo.isOverdue &&
									(dateInfo.label.includes("Closes") ||
										dateInfo.label.includes("deadline")
										? " (Closed)"
										: " (Overdue)")}
							</Text>
						</Group>
					))}
				</Stack>
			</Stack>
		</Paper>
	);
}

export default function ModulePage({ loaderData }: Route.ComponentProps) {
	const {
		module,
		moduleSettings,
		formattedModuleSettings,
		course,
		previousModule,
		nextModule,
		userSubmission,
		userSubmissions,
		canSubmit,
	} = loaderData;
	const { submitAssignment, isSubmitting } = useSubmitAssignment();
	const { startQuizAttempt } = useStartQuizAttempt(loaderData.moduleLinkId);
	const { submitQuiz } = useSubmitQuiz(loaderData.moduleLinkId);
	const [showQuiz] = useQueryState(
		"showQuiz",
		parseAsString.withDefault(""),
	);

	// Handle different module types
	const renderModuleContent = () => {
		switch (module.type) {
			case "page": {
				const pageContent = module.page?.content || null;
				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<PagePreview
							content={pageContent || "<p>No content available</p>"}
						/>
					</>
				);
			}
			case "assignment": {
				// Type guard to ensure we have an assignment submission
				const assignmentSubmission =
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

				// Map all submissions for display - filter assignment submissions only
				const allSubmissionsForDisplay = userSubmissions
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
								? (sub.attachments as Array<{
									file: number | { id: number; filename: string };
									description?: string;
								}>)
								: null,
					}));

				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<AssignmentPreview
							assignment={module.assignment || null}
							submission={assignmentSubmission}
							allSubmissions={allSubmissionsForDisplay}
							onSubmit={({ textContent, files }) => {
								submitAssignment(textContent, files);
							}}
							isSubmitting={isSubmitting}
							canSubmit={canSubmit}
						/>
						{allSubmissionsForDisplay.length > 0 && (
							<SubmissionHistory
								submissions={allSubmissionsForDisplay}
								variant="compact"
							/>
						)}
					</>
				);
			}
			case "quiz": {
				const quizConfig = module.quiz?.rawQuizConfig || null;
				if (!quizConfig) {
					return <Text c="red">No quiz configuration available</Text>;
				}

				// Filter quiz submissions
				const quizSubmissions = userSubmissions.filter(
					(sub): sub is typeof sub & { attemptNumber: unknown; status: unknown } =>
						"attemptNumber" in sub && "status" in sub,
				);

				// Check if there's an active in_progress attempt
				const hasActiveAttempt = quizSubmissions.some(
					(sub) => sub.status === "in_progress",
				);

				// Map all quiz submissions for display
				const allQuizSubmissionsForDisplay = quizSubmissions.map((sub) => ({
					id: sub.id,
					status: sub.status as
						| "in_progress"
						| "completed"
						| "graded"
						| "returned",
					submittedAt: ("submittedAt" in sub ? sub.submittedAt : null) as
						| string
						| null,
					startedAt: ("startedAt" in sub ? sub.startedAt : null) as
						| string
						| null,
					attemptNumber: (sub.attemptNumber as number) || 1,
				}));

				// Show QuizPreview only if showQuiz parameter is true AND there's an active attempt
				if (showQuiz === "true" && hasActiveAttempt) {
					// Find the in_progress submission
					const activeSubmission = quizSubmissions.find(
						(sub) => sub.status === "in_progress",
					);

					const handleQuizSubmit = (answers: QuizAnswers) => {
						if (!activeSubmission) return;

						const transformedAnswers = transformQuizAnswersToSubmissionFormat(
							quizConfig,
							answers,
						);

						// Calculate time spent if startedAt exists
						let timeSpent: number | undefined;
						if (
							activeSubmission &&
							"startedAt" in activeSubmission &&
							activeSubmission.startedAt
						) {
							const startedAt = new Date(activeSubmission.startedAt);
							const now = new Date();
							timeSpent = (now.getTime() - startedAt.getTime()) / (1000 * 60); // Convert to minutes
						}

						submitQuiz(activeSubmission.id, transformedAnswers, timeSpent);
					};

					return (
						<>
							<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
							<QuizPreview
								quizConfig={quizConfig}
								submissionId={activeSubmission?.id}
								onSubmit={handleQuizSubmit}
							/>
						</>
					);
				}

				// Always show instructions view with start button
				// The start button will either reuse existing in_progress attempt or create new one
				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<QuizInstructionsView
							quiz={module.quiz}
							allSubmissions={allQuizSubmissionsForDisplay}
							onStartQuiz={startQuizAttempt}
							canSubmit={canSubmit}
						/>
						{allQuizSubmissionsForDisplay.length > 0 && (
							<SubmissionHistory
								submissions={allQuizSubmissionsForDisplay.map((sub) => ({
									id: sub.id,
									status:
										sub.status === "in_progress"
											? "draft"
											: sub.status === "completed"
												? "submitted"
												: sub.status === "graded"
													? "graded"
													: "returned",
									submittedAt: sub.submittedAt,
									startedAt: sub.startedAt,
									attemptNumber: sub.attemptNumber,
								}))}
								variant="compact"
							/>
						)}
					</>
				);
			}
			case "discussion":
				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<DiscussionThreadView
							discussion={module.discussion || null}
							threads={loaderData.discussionThreads}
							thread={loaderData.discussionThread}
							replies={loaderData.discussionReplies}
							moduleLinkId={loaderData.moduleLinkId}
							courseId={loaderData.course.id}
						/>
					</>
				);
			case "whiteboard": {
				const whiteboardContent = module.whiteboard?.content || null;
				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<WhiteboardPreview content={whiteboardContent || "{}"} />
					</>
				);
			}
			default:
				return <Text c="red">Unknown module type: {module.type}</Text>;
		}
	};

	const title = `${moduleSettings?.settings.name ?? module.title} | ${course.title} | Paideia LMS`;

	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content={`View ${module.title} in ${course.title}`}
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content={`View ${module.title} in ${course.title}`}
			/>

			<Stack gap="xl">
				{renderModuleContent()}

				{/* Navigation buttons */}
				<Group justify="space-between">
					{previousModule ? (
						<Button
							component={Link}
							to={href("/course/module/:moduleLinkId", {
								moduleLinkId: String(previousModule.id),
							})}
							leftSection={<IconChevronLeft size={16} />}
							variant="light"
						>
							Previous: {previousModule.title}
						</Button>
					) : (
						<div />
					)}
					{nextModule ? (
						<Button
							component={Link}
							to={href("/course/module/:moduleLinkId", {
								moduleLinkId: String(nextModule.id),
							})}
							rightSection={<IconChevronRight size={16} />}
							variant="light"
						>
							Next: {nextModule.title}
						</Button>
					) : (
						<div />
					)}
				</Group>
			</Stack>
		</Container>
	);
}
