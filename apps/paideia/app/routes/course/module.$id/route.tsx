import { Alert, Button, Container, Group, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { Link, redirect } from "react-router";
import { courseModuleContextKey } from "server/contexts/utils/context-keys";
import { enrolmentContextKey } from "server/contexts/utils/context-keys";
import { globalContextKey } from "server/contexts/utils/context-keys";
import { userContextKey } from "server/contexts/utils/context-keys";
import { tryCreateAssignmentSubmission } from "@paideia/paideia-backend";
import {
	tryCreateDiscussionSubmission,
	tryRemoveUpvoteDiscussionSubmission,
	tryUpvoteDiscussionSubmission,
} from "@paideia/paideia-backend";
import {
	tryAnswerQuizQuestion,
	tryCheckInProgressSubmission,
	tryGetNextAttemptNumber,
	tryStartQuizAttempt,
	tryMarkQuizAttemptAsComplete,
	tryRemoveAnswerFromQuizQuestion,
	tryFlagQuizQuestion,
	tryUnflagQuizQuestion,
	tryStartNestedQuiz,
	tryMarkNestedQuizAsComplete,
	tryStartPreviewQuizAttempt,
} from "@paideia/paideia-backend";
import type { TypedQuestionAnswer } from "@paideia/paideia-backend";
import { permissions } from "@paideia/paideia-backend";
import z from "zod";
import {
	badRequest,
	forbidden,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "app/utils/router/responses";
import type { Route } from "./+types/route";
import { AssignmentPreview } from "app/routes/course/module.$id/components/assignment/assignment-preview";
import { PagePreview } from "app/components/activity-modules-preview/page-preview";
import { WhiteboardPreview } from "app/components/activity-modules-preview/whiteboard-preview";
import { FilePreview } from "app/components/activity-modules-preview/file-preview";
import { DiscussionThreadView } from "./components/discussion/discussion-thread-view";
import { ModuleDatesInfo } from "./components/module-dates-info";
import { AssignmentSubmissionHistory } from "./components/assignment/assignment-submission-history";
import { QuizSubmissionHistory } from "./components/quiz/quiz-submission-history";
import { QuizAttemptComponent } from "app/routes/course/module.$id/components/quiz/quiz-attempt-component";
import { QuizInstructionsView } from "app/routes/course/module.$id/components/quiz/quiz-instructions-view";
import { createParser, parseAsInteger, parseAsStringEnum } from "nuqs";
import { typeCreateLoader } from "app/utils/router/loader-utils";
import {
	typeCreateActionRpc,
	createActionMap,
} from "app/utils/router/action-utils";
import { getRouteUrl } from "app/utils/router/search-params-utils";

export type { Route };

/**
 * Type-safe constants for module actions
 * These actions are used in query parameters to control UI state
 */

export const AssignmentActions = {
	// GRADE_SUBMISSION: "gradesubmission",
	SUBMIT_ASSIGNMENT: "submitassignment",
} as const;

export const DiscussionActions = {
	CREATE_THREAD: "createthread",
	REPLY: "reply",
	UPVOTE_THREAD: "upvotethread",
	REMOVE_UPVOTE_THREAD: "removeupvotethread",
	UPVOTE_REPLY: "upvotereply",
	REMOVE_UPVOTE_REPLY: "removeupvotereply",
	// GRADE_SUBMISSION: "gradesubmission",
} as const;

export const QuizActions = {
	START_ATTEMPT: "startattempt",
	ANSWER_QUESTION: "answerquestion",
	UNANSWER_QUESTION: "unanswerquestion",
	FLAG_QUESTION: "flagquestion",
	UNFLAG_QUESTION: "unflagquestion",
	MARK_QUIZ_ATTEMPT_AS_COMPLETE: "markquizattemptascomplete",
	VIEW_SUBMISSION: "viewsubmission",
	START_NESTED_QUIZ: "startnestedquiz",
	MARK_NESTED_QUIZ_AS_COMPLETE: "marknestedquizascomplete",
	PREVIEW_QUIZ: "previewquiz",
	// GRADE_SUBMISSION: "gradesubmission",
} as const;

/**
 * Custom parser for replyTo parameter
 * Accepts either "thread" (string) or a number (comment/reply ID)
 */
const parseAsReplyTo = createParser({
	parse(queryValue) {
		if (queryValue === "thread") {
			return "thread";
		}
		const parsed = Number.parseInt(queryValue, 10);
		if (Number.isNaN(parsed) || parsed <= 0) {
			return null;
		}
		return parsed;
	},
	serialize(value) {
		if (value === "thread") {
			return "thread";
		}
		if (typeof value === "number") {
			return String(value);
		}
		return "thread"; // fallback
	},
});

/**
 * Custom parser for nestedQuizId parameter
 * Accepts a string or null
 */
const parseAsNestedQuizId = createParser({
	parse(queryValue) {
		if (!queryValue || queryValue.trim() === "") {
			return null;
		}
		return queryValue;
	},
	serialize(value) {
		if (value === null || value === undefined) {
			return "";
		}
		return String(value);
	},
});

export const loaderSearchParams = {
	view: parseAsStringEnum([
		...Object.values(AssignmentActions),
		...Object.values(DiscussionActions),
		...Object.values(QuizActions),
	]),
	threadId: parseAsInteger,
	replyTo: parseAsReplyTo,
	sortBy: parseAsStringEnum(["recent", "upvoted", "active"]).withDefault(
		"recent",
	),
	quizPageIndex: parseAsInteger.withDefault(0),
	/**
	 * the submission id to view
	 */
	viewSubmission: parseAsInteger,
	/**
	 * the nested quiz id to view (for container quizzes)
	 */
	nestedQuizId: parseAsNestedQuizId,
};

const createLoaderRpc = typeCreateLoader<Route.LoaderArgs>();

export const loader = createLoaderRpc({
	searchParams: loaderSearchParams,
})(async ({ context, params, searchParams }) => {
	const userSession = context.get(userContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const { moduleLinkId } = params;

	// Get course context to ensure user has access to this course
	if (!courseModuleContext) {
		throw new ForbiddenResponse("Course or module not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Check if user is a student
	const isStudent = enrolmentContext?.enrolment?.role === "student";

	// Handle viewSubmission for quiz modules
	let viewedSubmission = null;
	if (
		searchParams.viewSubmission &&
		courseModuleContext.type === "quiz" &&
		courseModuleContext.quiz?.rawQuizConfig
	) {
		const submission = courseModuleContext.userSubmissions.find(
			(submission) => submission.id === searchParams.viewSubmission,
		);
		if (!submission) {
			throw new ForbiddenResponse("Submission not found");
		}

		// Verify the submission belongs to this module
		if (submission.courseModuleLink !== courseModuleContext.id) {
			throw new ForbiddenResponse("Submission does not belong to this module");
		}

		// Verify the submission belongs to the current user
		const studentId = submission.student.id;
		if (studentId !== currentUser.id) {
			throw new ForbiddenResponse("You can only view your own submissions");
		}

		viewedSubmission = submission;
	}

	// For quiz modules, also expose activeSubmission if available
	// This is used when taking the quiz (not viewing a completed submission)
	const activeSubmission =
		courseModuleContext.type === "quiz" &&
		"activeSubmission" in courseModuleContext
			? courseModuleContext.activeSubmission
			: null;

	return {
		...courseModuleContext,
		moduleLinkId,
		isStudent,
		viewedSubmission,
		activeSubmission,
		searchParams,
		params,
		isDevelopment: process.env.NODE_ENV === "development",
	};
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/course/module/:moduleLinkId",
});

const createThreadRpc = createActionRpc({
	formDataSchema: z.object({
		title: z.string().min(1),
		content: z.string().min(1),
	}),
	method: "POST",
	action: DiscussionActions.CREATE_THREAD,
});

const createReplyRpc = createActionRpc({
	formDataSchema: z.object({
		content: z.string().min(1),
		parentThread: z.coerce.number(),
	}),
	method: "POST",
	action: DiscussionActions.REPLY,
	searchParams: {
		/**
		 * it is either "thread" or the comment id
		 */
		replyTo: parseAsReplyTo.withDefault("thread"),
	},
});

const upvoteThreadRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
	}),
	method: "POST",
	action: DiscussionActions.UPVOTE_THREAD,
});

const removeUpvoteThreadRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
	}),
	method: "POST",
	action: DiscussionActions.REMOVE_UPVOTE_THREAD,
});

const upvoteReplyRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
	}),
	method: "POST",
	action: DiscussionActions.UPVOTE_REPLY,
});

const removeUpvoteReplyRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
	}),
	method: "POST",
	action: DiscussionActions.REMOVE_UPVOTE_REPLY,
});

const markQuizAttemptAsCompleteRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
		// answers: z.string().nullish(),
		// timeSpent: z.string().nullish(),
	}),
	method: "POST",
	action: QuizActions.MARK_QUIZ_ATTEMPT_AS_COMPLETE,
});

const startQuizAttemptRpc = createActionRpc({
	method: "POST",
	action: QuizActions.START_ATTEMPT,
});

const answerQuizQuestionRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
		questionId: z.string().min(1),
		answerType: z.string().min(1),
		answerValue: z.string().min(1),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: QuizActions.ANSWER_QUESTION,
});

const unanswerQuizQuestionRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
		questionId: z.string().min(1),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: QuizActions.UNANSWER_QUESTION,
});

const flagQuizQuestionRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
		questionId: z.string().min(1),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: QuizActions.FLAG_QUESTION,
});

const unflagQuizQuestionRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
		questionId: z.string().min(1),
		nestedQuizId: z.string().optional(),
	}),
	method: "POST",
	action: QuizActions.UNFLAG_QUESTION,
});

const startNestedQuizRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
		nestedQuizId: z.string().min(1),
	}),
	method: "POST",
	action: QuizActions.START_NESTED_QUIZ,
});

const markNestedQuizAsCompleteRpc = createActionRpc({
	formDataSchema: z.object({
		submissionId: z.coerce.number(),
		nestedQuizId: z.string().min(1),
		bypassTimeLimit: z.coerce.boolean().optional(),
	}),
	method: "POST",
	action: QuizActions.MARK_NESTED_QUIZ_AS_COMPLETE,
});

const previewQuizRpc = createActionRpc({
	method: "POST",
	action: QuizActions.PREVIEW_QUIZ,
});

const submitAssignmentRpc = createActionRpc({
	formDataSchema: z.object({
		textContent: z.string().nullish(),
		files: z.file().array(),
	}),
	method: "POST",
	action: AssignmentActions.SUBMIT_ASSIGNMENT,
});

// Individual action functions
const createThreadAction = createThreadRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseModuleContext = context.get(courseModuleContextKey);
		const enrolmentContext = context.get(enrolmentContextKey);
		const { moduleLinkId } = params;

		// Access checks
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
			userSession.effectiveUser ?? userSession.authenticatedUser;
		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const title = formData.title;
		const content = formData.content;

		// Validate inputs
		if (!title || typeof title !== "string" || title.trim() === "") {
			return badRequest({ error: "Thread title is required" });
		}
		if (!content || typeof content !== "string" || content.trim() === "") {
			return badRequest({ error: "Thread content is required" });
		}

		// Check participation permissions
		const canParticipate = permissions.course.module.discussion.canParticipate(
			enrolmentContext.enrolment,
		);
		if (!canParticipate.allowed) {
			return unauthorized({ error: canParticipate.reason });
		}

		const createResult = await tryCreateDiscussionSubmission({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			postType: "thread",
			title: title.trim(),
			content: content.trim(),
			overrideAccess: false,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return redirect(
			getRouteUrl("/course/module/:moduleLinkId", {
				params: { moduleLinkId: String(moduleLinkId) },
				searchParams: {
					threadId: createResult.value.id,
				},
			}),
		);
	},
);

const useCreateThread = createThreadRpc.createHook<typeof createThreadAction>();

const upvoteThreadAction = upvoteThreadRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const upvoteResult = await tryUpvoteDiscussionSubmission({
			payload,
			submissionId: formData.submissionId,
			userId: currentUser.id,
			req: payloadRequest,
		});

		if (!upvoteResult.ok) {
			return badRequest({ error: upvoteResult.error.message });
		}

		return ok({ success: true, message: "Thread upvote added successfully" });
	},
);

const useUpvoteThread = upvoteThreadRpc.createHook<typeof upvoteThreadAction>();

const removeUpvoteThreadAction = removeUpvoteThreadRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const removeUpvoteResult = await tryRemoveUpvoteDiscussionSubmission({
			payload,
			submissionId: formData.submissionId,
			userId: currentUser.id,
			req: payloadRequest,
		});

		if (!removeUpvoteResult.ok) {
			return badRequest({ error: removeUpvoteResult.error.message });
		}

		return ok({
			success: true,
			message: "Thread upvote removed successfully",
		});
	},
);

const useRemoveUpvoteThread =
	removeUpvoteThreadRpc.createHook<typeof removeUpvoteThreadAction>();

const upvoteReplyAction = upvoteReplyRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const upvoteResult = await tryUpvoteDiscussionSubmission({
			payload,
			submissionId: formData.submissionId,
			userId: currentUser.id,
			req: payloadRequest,
		});

		if (!upvoteResult.ok) {
			return badRequest({ error: upvoteResult.error.message });
		}

		return ok({ success: true, message: "Reply upvote added successfully" });
	},
);

const useUpvoteReply = upvoteReplyRpc.createHook<typeof upvoteReplyAction>();

const removeUpvoteReplyAction = removeUpvoteReplyRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const removeUpvoteResult = await tryRemoveUpvoteDiscussionSubmission({
			payload,
			req: payloadRequest,
			submissionId: formData.submissionId,
			userId: currentUser.id,
		});

		if (!removeUpvoteResult.ok) {
			return badRequest({ error: removeUpvoteResult.error.message });
		}

		return ok({
			success: true,
			message: "Reply upvote removed successfully",
		});
	},
);

const useRemoveUpvoteReply =
	removeUpvoteReplyRpc.createHook<typeof removeUpvoteReplyAction>();

const createReplyAction = createReplyRpc.createAction(
	async ({ context, formData, params, searchParams }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
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
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		// Check if user can participate in discussions
		const canParticipate = permissions.course.module.discussion.canParticipate(
			enrolmentContext.enrolment,
		);
		if (!canParticipate.allowed) {
			throw new ForbiddenResponse(canParticipate.reason);
		}

		// Determine post type and parent based on replyTo URL parameter
		const postType = searchParams.replyTo === "thread" ? "reply" : "comment";

		// For nested comments, parentThread should point to the parent comment/reply
		// For top-level replies, parentThread should point to the thread
		const actualParentThread =
			searchParams.replyTo === "thread"
				? formData.parentThread
				: searchParams.replyTo;

		const createResult = await tryCreateDiscussionSubmission({
			payload,
			courseModuleLinkId: moduleLinkId,
			studentId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			postType,
			content: formData.content.trim(),
			parentThread: actualParentThread,
			req: payloadRequest,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		// Redirect to the thread detail view
		return ok({
			success: true,
			message: "Reply created successfully",
			redirectTo: getRouteUrl("/course/module/:moduleLinkId", {
				params: { moduleLinkId: String(moduleLinkId) },
				searchParams: {
					view: null,
					threadId: actualParentThread,
					replyTo: null,
					viewSubmission: null,
					nestedQuizId: null,
				},
			}),
		});
	},
);

const useCreateReply = createReplyRpc.createHook<typeof createReplyAction>();

const markQuizAttemptAsCompleteAction =
	markQuizAttemptAsCompleteRpc.createAction(
		async ({ context, formData, params }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);
			const userSession = context.get(userContextKey);
			const enrolmentContext = context.get(enrolmentContextKey);
			const { moduleLinkId } = params;

			if (!userSession?.isAuthenticated) {
				return unauthorized({ error: "Unauthorized" });
			}

			if (!enrolmentContext?.enrolment) {
				return badRequest({ error: "Enrollment not found" });
			}

			const currentUser =
				userSession.effectiveUser ?? userSession.authenticatedUser;

			if (!currentUser) {
				return unauthorized({ error: "Unauthorized" });
			}

			const courseModuleContext = context.get(courseModuleContextKey);
			if (!courseModuleContext) {
				return badRequest({ error: "Module not found" });
			}

			// Only students can submit assignments or start quizzes
			if (
				courseModuleContext.type === "quiz" &&
				!courseModuleContext.permissions.quiz?.canStartAttempt.allowed
			) {
				return forbidden({
					error: courseModuleContext.permissions.quiz.canStartAttempt.reason,
				});
			}

			const submitResult = await tryMarkQuizAttemptAsComplete({
				payload,
				submissionId: formData.submissionId,
				// answers,
				// timeSpent,
				req: payloadRequest,
			});

			if (!submitResult.ok) {
				return badRequest({ error: submitResult.error.message });
			}

			// Redirect to show instructions view
			return redirect(
				getRouteUrl("/course/module/:moduleLinkId", {
					params: { moduleLinkId: String(moduleLinkId) },
					searchParams: {
						view: null,
						threadId: null,
						replyTo: null,
						viewSubmission: null,
						nestedQuizId: null,
					},
				}),
			);
		},
	);

const useMarkQuizAttemptAsComplete =
	markQuizAttemptAsCompleteRpc.createHook<
		typeof markQuizAttemptAsCompleteAction
	>();

const startQuizAttemptAction = startQuizAttemptRpc.createAction(
	async ({ context, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const enrolmentContext = context.get(enrolmentContextKey);
		const { moduleLinkId } = params;

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!enrolmentContext?.enrolment) {
			return badRequest({ error: "Enrollment not found" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const courseModuleContext = context.get(courseModuleContextKey);
		if (!courseModuleContext) {
			return badRequest({ error: "Module not found" });
		}

		// Only students can submit assignments or start quizzes
		if (
			courseModuleContext.type === "quiz" &&
			!courseModuleContext.permissions.quiz?.canStartAttempt.allowed
		) {
			return forbidden({
				error: courseModuleContext.permissions.quiz.canStartAttempt.reason,
			});
		}

		// Check if there's already an in_progress submission
		const checkResult = await tryCheckInProgressSubmission({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!checkResult.ok) {
			return badRequest({ error: checkResult.error.message });
		}

		// If there's an in_progress submission, reuse it by redirecting (will show active attempt)
		if (checkResult.value.hasInProgress) {
			return redirect(
				getRouteUrl("/course/module/:moduleLinkId", {
					params: { moduleLinkId: String(moduleLinkId) },
					searchParams: {
						view: null,
						threadId: null,
						replyTo: null,
						viewSubmission: checkResult.value.submission.id,
						nestedQuizId: null,
					},
				}),
			);
		}

		// No in_progress attempt exists, create a new one
		// Get next attempt number
		const nextAttemptResult = await tryGetNextAttemptNumber({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!nextAttemptResult.ok) {
			return badRequest({ error: nextAttemptResult.error.message });
		}

		const startResult = await tryStartQuizAttempt({
			payload,
			courseModuleLinkId: moduleLinkId,
			studentId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			attemptNumber: nextAttemptResult.value,
			req: payloadRequest,
		});

		if (!startResult.ok) {
			return badRequest({ error: startResult.error.message });
		}

		// Redirect to show the quiz (will show active attempt)
		return redirect(
			getRouteUrl("/course/module/:moduleLinkId", {
				params: { moduleLinkId: String(moduleLinkId) },
				searchParams: {
					view: null,
					threadId: null,
					replyTo: null,
					viewSubmission: startResult.value.id,
					nestedQuizId: null,
				},
			}),
		);
	},
);

const useStartQuizAttempt =
	startQuizAttemptRpc.createHook<typeof startQuizAttemptAction>();

const answerQuizQuestionAction = answerQuizQuestionRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const enrolmentContext = context.get(enrolmentContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!enrolmentContext?.enrolment) {
			return badRequest({ error: "Enrollment not found" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const courseModuleContext = context.get(courseModuleContextKey);
		if (!courseModuleContext) {
			return badRequest({ error: "Module not found" });
		}

		// Only students can answer quiz questions
		if (
			courseModuleContext.type === "quiz" &&
			!courseModuleContext.permissions.quiz?.canStartAttempt.allowed
		) {
			return forbidden({
				error: courseModuleContext.permissions.quiz.canStartAttempt.reason,
			});
		}

		// Reconstruct TypedQuestionAnswer from formData
		let answer: TypedQuestionAnswer;
		try {
			const parsedValue = JSON.parse(formData.answerValue);
			answer = {
				type: formData.answerType as TypedQuestionAnswer["type"],
				value: parsedValue,
			} as TypedQuestionAnswer;
		} catch {
			// If parsing fails, treat as string value
			answer = {
				type: formData.answerType as TypedQuestionAnswer["type"],
				value: formData.answerValue,
			} as TypedQuestionAnswer;
		}

		// Construct full questionId: for nested quizzes, use "nestedQuizId:questionId" format
		const fullQuestionId = formData.nestedQuizId
			? `${formData.nestedQuizId}:${formData.questionId}`
			: formData.questionId;

		const result = await tryAnswerQuizQuestion({
			payload,
			submissionId: formData.submissionId,
			questionId: fullQuestionId,
			answer,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		return ok({ success: true, message: "Question answered successfully" });
	},
);

const useAnswerQuizQuestion =
	answerQuizQuestionRpc.createHook<typeof answerQuizQuestionAction>();

const unanswerQuizQuestionAction = unanswerQuizQuestionRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const enrolmentContext = context.get(enrolmentContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!enrolmentContext?.enrolment) {
			return badRequest({ error: "Enrollment not found" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const courseModuleContext = context.get(courseModuleContextKey);
		if (!courseModuleContext) {
			return badRequest({ error: "Module not found" });
		}

		// Only students can unanswer quiz questions
		if (
			courseModuleContext.type === "quiz" &&
			!courseModuleContext.permissions.quiz?.canStartAttempt.allowed
		) {
			return forbidden({
				error: courseModuleContext.permissions.quiz.canStartAttempt.reason,
			});
		}

		// Construct full questionId: for nested quizzes, use "nestedQuizId:questionId" format
		const fullQuestionId = formData.nestedQuizId
			? `${formData.nestedQuizId}:${formData.questionId}`
			: formData.questionId;

		const result = await tryRemoveAnswerFromQuizQuestion({
			payload,
			submissionId: formData.submissionId,
			questionId: fullQuestionId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		return ok({
			success: true,
			message: "Question answer removed successfully",
		});
	},
);

const useUnanswerQuizQuestion =
	unanswerQuizQuestionRpc.createHook<typeof unanswerQuizQuestionAction>();

const flagQuizQuestionAction = flagQuizQuestionRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const enrolmentContext = context.get(enrolmentContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!enrolmentContext?.enrolment) {
			return badRequest({ error: "Enrollment not found" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const courseModuleContext = context.get(courseModuleContextKey);
		if (!courseModuleContext) {
			return badRequest({ error: "Module not found" });
		}

		// Only students can flag quiz questions
		if (
			courseModuleContext.type === "quiz" &&
			!courseModuleContext.permissions.quiz?.canStartAttempt.allowed
		) {
			return forbidden({
				error: courseModuleContext.permissions.quiz.canStartAttempt.reason,
			});
		}

		// Construct full questionId: for nested quizzes, use "nestedQuizId:questionId" format
		const fullQuestionId = formData.nestedQuizId
			? `${formData.nestedQuizId}:${formData.questionId}`
			: formData.questionId;

		const result = await tryFlagQuizQuestion({
			payload,
			submissionId: formData.submissionId,
			questionId: fullQuestionId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		return ok({ success: true, message: "Question flagged successfully" });
	},
);

const useFlagQuizQuestion =
	flagQuizQuestionRpc.createHook<typeof flagQuizQuestionAction>();

const unflagQuizQuestionAction = unflagQuizQuestionRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const enrolmentContext = context.get(enrolmentContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!enrolmentContext?.enrolment) {
			return badRequest({ error: "Enrollment not found" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const courseModuleContext = context.get(courseModuleContextKey);
		if (!courseModuleContext) {
			return badRequest({ error: "Module not found" });
		}

		// Only students can unflag quiz questions
		if (
			courseModuleContext.type === "quiz" &&
			!courseModuleContext.permissions.quiz?.canStartAttempt.allowed
		) {
			return forbidden({
				error: courseModuleContext.permissions.quiz.canStartAttempt.reason,
			});
		}

		// Construct full questionId: for nested quizzes, use "nestedQuizId:questionId" format
		const fullQuestionId = formData.nestedQuizId
			? `${formData.nestedQuizId}:${formData.questionId}`
			: formData.questionId;

		const result = await tryUnflagQuizQuestion({
			payload,
			submissionId: formData.submissionId,
			questionId: fullQuestionId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		return ok({ success: true, message: "Question unflagged successfully" });
	},
);

const useUnflagQuizQuestion =
	unflagQuizQuestionRpc.createHook<typeof unflagQuizQuestionAction>();

const startNestedQuizAction = startNestedQuizRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const enrolmentContext = context.get(enrolmentContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!enrolmentContext?.enrolment) {
			return badRequest({ error: "Enrollment not found" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const courseModuleContext = context.get(courseModuleContextKey);
		if (!courseModuleContext) {
			return badRequest({ error: "Module not found" });
		}

		// Only students can start nested quizzes
		if (
			courseModuleContext.type === "quiz" &&
			!courseModuleContext.permissions.quiz?.canStartAttempt.allowed
		) {
			return forbidden({
				error: courseModuleContext.permissions.quiz.canStartAttempt.reason,
			});
		}

		const result = await tryStartNestedQuiz({
			payload,
			submissionId: formData.submissionId,
			nestedQuizId: formData.nestedQuizId,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		// return ok({
		// 	success: true,
		// 	message: "Nested quiz started successfully",
		// });
		return redirect(
			getRouteUrl("/course/module/:moduleLinkId", {
				params: { moduleLinkId: params.moduleLinkId.toString() },
				searchParams: {
					viewSubmission: formData.submissionId,
					nestedQuizId: formData.nestedQuizId,
				},
			}),
		);
	},
);

const useStartNestedQuiz =
	startNestedQuizRpc.createHook<typeof startNestedQuizAction>();

const markNestedQuizAsCompleteAction = markNestedQuizAsCompleteRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const enrolmentContext = context.get(enrolmentContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		if (!enrolmentContext?.enrolment) {
			return badRequest({ error: "Enrollment not found" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const courseModuleContext = context.get(courseModuleContextKey);
		if (!courseModuleContext) {
			return badRequest({ error: "Module not found" });
		}

		// Only students can mark nested quizzes as complete
		if (
			courseModuleContext.type === "quiz" &&
			!courseModuleContext.permissions.quiz?.canStartAttempt.allowed
		) {
			return forbidden({
				error: courseModuleContext.permissions.quiz.canStartAttempt.reason,
			});
		}

		const result = await tryMarkNestedQuizAsComplete({
			payload,
			submissionId: formData.submissionId,
			nestedQuizId: formData.nestedQuizId,
			bypassTimeLimit: formData.bypassTimeLimit,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({ error: result.error.message });
		}

		return redirect(
			result.value.isLastNestedQuiz
				? getRouteUrl("/course/module/:moduleLinkId", {
						params: { moduleLinkId: params.moduleLinkId.toString() },
						searchParams: {},
					})
				: getRouteUrl("/course/module/:moduleLinkId", {
						params: { moduleLinkId: params.moduleLinkId.toString() },
						searchParams: {
							viewSubmission: formData.submissionId,
						},
					}),
		);
	},
);

const useMarkNestedQuizAsComplete =
	markNestedQuizAsCompleteRpc.createHook<
		typeof markNestedQuizAsCompleteAction
	>();

const previewQuizAction = previewQuizRpc.createAction(
	async ({ context, params }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
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

		// Check if this is a quiz module
		if (courseModuleContext.type !== "quiz") {
			return badRequest({ error: "Invalid module type for this action" });
		}

		// Check preview permission
		if (!courseModuleContext.permissions.quiz?.canPreview.allowed) {
			return forbidden({
				error: courseModuleContext.permissions.quiz.canPreview.reason,
			});
		}

		if (!enrolmentContext?.enrolment) {
			return badRequest({ error: "Enrollment not found" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		// Start preview quiz attempt
		const previewResult = await tryStartPreviewQuizAttempt({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			userId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!previewResult.ok) {
			return badRequest({ error: previewResult.error.message });
		}

		// Redirect to quiz view with the preview submission
		return redirect(
			getRouteUrl("/course/module/:moduleLinkId", {
				params: { moduleLinkId: String(moduleLinkId) },
				searchParams: {
					view: null,
					threadId: null,
					replyTo: null,
					viewSubmission: previewResult.value.id,
					nestedQuizId: null,
				},
			}),
		);
	},
);

const usePreviewQuiz = previewQuizRpc.createHook<typeof previewQuizAction>();

const submitAssignmentAction = submitAssignmentRpc.createAction(
	async ({ context, formData, params, request }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
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
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		// Only students can submit assignments or start quizzes
		if (
			courseModuleContext.type === "assignment" &&
			!courseModuleContext.permissions.assignment.canSubmitAssignment.allowed
		) {
			return forbidden({
				error:
					courseModuleContext.permissions.assignment.canSubmitAssignment.reason,
			});
		}

		// Handle assignment submission (existing logic)
		if (courseModuleContext.type !== "assignment") {
			return badRequest({ error: "Invalid module type for this action" });
		}

		// Calculate next attempt number
		const userSubmissions = courseModuleContext.submissions.filter(
			(sub): sub is typeof sub & { attemptNumber: unknown } =>
				sub.student.id === currentUser.id && "attemptNumber" in sub,
		);
		const maxAttemptNumber =
			userSubmissions.length > 0
				? Math.max(...userSubmissions.map((sub) => sub.attemptNumber as number))
				: 0;
		const nextAttemptNumber = maxAttemptNumber + 1;

		// Create new submission (status will be "submitted" automatically)
		const createResult = await tryCreateAssignmentSubmission({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			content: formData.textContent ?? "",
			attachments: formData.files,
			attemptNumber: nextAttemptNumber,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return redirect(
			getRouteUrl("/course/module/:moduleLinkId", {
				params: { moduleLinkId: String(moduleLinkId) },
				searchParams: {},
			}),
		);
	},
);

const useSubmitAssignment =
	submitAssignmentRpc.createHook<typeof submitAssignmentAction>();

export {
	useUpvoteThread,
	useRemoveUpvoteThread,
	useUpvoteReply,
	useRemoveUpvoteReply,
	useStartQuizAttempt,
	useAnswerQuizQuestion,
	useUnanswerQuizQuestion,
	useFlagQuizQuestion,
	useUnflagQuizQuestion,
	useSubmitAssignment,
	useCreateThread,
	useCreateReply,
	useMarkQuizAttemptAsComplete,
	useStartNestedQuiz,
	useMarkNestedQuizAsComplete,
	usePreviewQuiz,
};

const actionMap = {
	[DiscussionActions.REPLY]: createReplyAction,
	[DiscussionActions.CREATE_THREAD]: createThreadAction,
	[DiscussionActions.UPVOTE_THREAD]: upvoteThreadAction,
	[DiscussionActions.REMOVE_UPVOTE_THREAD]: removeUpvoteThreadAction,
	[DiscussionActions.UPVOTE_REPLY]: upvoteReplyAction,
	[DiscussionActions.REMOVE_UPVOTE_REPLY]: removeUpvoteReplyAction,
	[QuizActions.MARK_QUIZ_ATTEMPT_AS_COMPLETE]: markQuizAttemptAsCompleteAction,
	[QuizActions.START_ATTEMPT]: startQuizAttemptAction,
	[QuizActions.ANSWER_QUESTION]: answerQuizQuestionAction,
	[QuizActions.UNANSWER_QUESTION]: unanswerQuizQuestionAction,
	[QuizActions.FLAG_QUESTION]: flagQuizQuestionAction,
	[QuizActions.UNFLAG_QUESTION]: unflagQuizQuestionAction,
	[QuizActions.START_NESTED_QUIZ]: startNestedQuizAction,
	[QuizActions.MARK_NESTED_QUIZ_AS_COMPLETE]: markNestedQuizAsCompleteAction,
	[QuizActions.PREVIEW_QUIZ]: previewQuizAction,
	[AssignmentActions.SUBMIT_ASSIGNMENT]: submitAssignmentAction,
};

const [action] = createActionMap(actionMap);

export { action };

export async function clientAction({
	serverAction,
	request,
}: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized ||
		actionData?.status === StatusCode.Forbidden
	) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	} else if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message,
			color: "green",
		});

		if (
			"redirectTo" in actionData &&
			typeof actionData.redirectTo === "string" &&
			actionData.redirectTo
		) {
			return redirect(actionData.redirectTo);
		}
	}

	return actionData;
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

type PreviousNextNavigationProps = {
	previousModule: Route.ComponentProps["loaderData"]["previousModule"];
	nextModule: Route.ComponentProps["loaderData"]["nextModule"];
};

function PreviousNextNavigation({
	previousModule,
	nextModule,
}: PreviousNextNavigationProps) {
	return (
		<Group justify="space-between">
			{previousModule ? (
				<Button
					component={Link}
					to={getRouteUrl("/course/module/:moduleLinkId", {
						params: { moduleLinkId: String(previousModule.id) },
						searchParams: {},
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
					to={getRouteUrl("/course/module/:moduleLinkId", {
						params: { moduleLinkId: String(nextModule.id) },
						searchParams: {},
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
	);
}
type AssignmentModuleViewProps = {
	loaderData: Extract<
		Route.ComponentProps["loaderData"],
		{ type: "assignment" }
	>;
};

function AssignmentModuleView({ loaderData }: AssignmentModuleViewProps) {
	const { submit: submitAssignment, isLoading: isSubmitting } =
		useSubmitAssignment();

	return (
		<>
			<ModuleDatesInfo settings={loaderData.settings} />
			<AssignmentPreview
				assignment={loaderData.assignment || null}
				submission={loaderData.assignmentSubmission}
				allSubmissions={loaderData.allSubmissionsForDisplay}
				onSubmit={({ textContent, files }) => {
					submitAssignment({
						params: { moduleLinkId: loaderData.id },
						values: {
							textContent,
							files,
						},
					});
				}}
				isSubmitting={isSubmitting}
				canSubmit={loaderData.canSubmit.allowed}
				isStudent={loaderData.isStudent ?? false}
				view={loaderData.searchParams.view}
			/>
			{loaderData.allSubmissionsForDisplay.length > 0 && (
				<AssignmentSubmissionHistory
					submissions={loaderData.allSubmissionsForDisplay}
				/>
			)}
		</>
	);
}

type QuizLoaderData = Extract<
	Route.ComponentProps["loaderData"],
	{ type: "quiz" }
>;

type QuizModuleViewProps = {
	loaderData: QuizLoaderData;
};

function QuizModuleView({ loaderData }: QuizModuleViewProps) {
	// Determine which submission to use:
	// 1. If viewing a specific submission (viewSubmission param), use that
	// 2. Otherwise, if there's an active quiz attempt, use that
	// 3. Otherwise, show the instructions view
	const submissionToUse = loaderData.viewedSubmission
		? loaderData.viewedSubmission
		: loaderData.activeSubmission;

	const isPreview = submissionToUse?.isPreview === true;

	return (
		<>
			<ModuleDatesInfo settings={loaderData.settings} />
			{loaderData.searchParams.viewSubmission && submissionToUse ? (
				<>
					{isPreview && (
						<Alert color="blue" title="Preview Mode" variant="light" mb="md">
							You are currently previewing this quiz. This is a test attempt
							that will not be saved or graded. You can answer questions and
							explore the quiz, but you cannot submit it.
						</Alert>
					)}
					<QuizAttemptComponent
						quizConfig={loaderData.quiz.rawQuizConfig}
						submission={submissionToUse}
					/>
				</>
			) : (
				<>
					<QuizInstructionsView
						quiz={loaderData.quiz}
						allSubmissions={loaderData.allQuizSubmissionsForDisplay}
						canStartAttempt={
							loaderData.permissions.quiz.canStartAttempt.allowed ?? false
						}
						quizRemainingTime={loaderData.quizRemainingTime}
						canPreview={loaderData.permissions.quiz.canPreview.allowed ?? false}
					/>
					{loaderData.allQuizSubmissionsForDisplay.length > 0 && (
						<QuizSubmissionHistory
							submissions={loaderData.allQuizSubmissionsForDisplay}
						/>
					)}
				</>
			)}
		</>
	);
}

export default function ModulePage({ loaderData }: Route.ComponentProps) {
	const { activityModule, settings, course, previousModule, nextModule } =
		loaderData;

	const title = `${settings?.name ?? activityModule.title} | ${course.title} | Paideia LMS`;

	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content={`View ${activityModule.title} in ${course.title}`}
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content={`View ${activityModule.title} in ${course.title}`}
			/>

			<Stack gap="xl">
				{loaderData.type === "assignment" ? (
					<AssignmentModuleView loaderData={loaderData} />
				) : loaderData.type === "quiz" ? (
					<QuizModuleView loaderData={loaderData} />
				) : loaderData.type === "discussion" ? (
					<>
						<ModuleDatesInfo settings={loaderData.settings} />
						<DiscussionThreadView
							discussion={loaderData.discussion || null}
							threads={loaderData.threads}
							thread={loaderData.thread ?? null}
							replies={loaderData.replies ?? []}
							moduleLinkId={loaderData.moduleLinkId}
							courseId={loaderData.course.id}
							view={loaderData.searchParams.view}
							replyTo={loaderData.searchParams.replyTo}
							sortBy={loaderData.searchParams.sortBy}
						/>
					</>
				) : loaderData.type === "file" ? (
					<>
						<ModuleDatesInfo settings={loaderData.settings} />
						<FilePreview files={loaderData.activityModule.media || []} />
					</>
				) : loaderData.type === "page" ? (
					<>
						<ModuleDatesInfo settings={loaderData.settings} />
						<PagePreview
							content={
								loaderData.activityModule.content ??
								"<p>No content available</p>"
							}
						/>
					</>
				) : loaderData.type === "whiteboard" ? (
					<>
						<ModuleDatesInfo settings={loaderData.settings} />
						<WhiteboardPreview
							content={loaderData.activityModule.content ?? ""}
						/>
					</>
				) : null}

				<PreviousNextNavigation
					previousModule={previousModule}
					nextModule={nextModule}
				/>
			</Stack>
		</Container>
	);
}
