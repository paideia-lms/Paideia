import {
	Button,
	Container,
	Group,
	Stack,
	Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, Link, redirect } from "react-router";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryCreateAssignmentSubmission } from "server/internal/assignment-submission-management";
import {
	tryCreateDiscussionSubmission,
	tryRemoveUpvoteDiscussionSubmission,
	tryUpvoteDiscussionSubmission,
} from "server/internal/discussion-management";
import {
	tryCheckInProgressSubmission,
	tryGetNextAttemptNumber,
	tryStartQuizAttempt,
	tryMarkQuizAttemptAsComplete,
} from "server/internal/quiz-submission-management";
import { permissions } from "server/utils/permissions";
import z from "zod";
import {
	badRequest,
	forbidden,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/route";
import {
	PagePreview,
	WhiteboardPreview,
	AssignmentPreview,
} from "app/components/activity-module-forms";
import { FilePreview } from "app/components/activity-modules-preview/file-preview";
import { DiscussionThreadView } from "./components/discussion-thread-view";
import { ModuleDatesInfo } from "./components/module-dates-info";
import { SubmissionHistory } from "app/components/submission-history";
import { QuizPreview } from "app/components/activity-modules-preview/quiz-preview";
import { QuizInstructionsView } from "app/components/activity-modules-preview/quiz-instructions-view";
import { transformQuizAnswersToSubmissionFormat } from "./utils";
import { parseAsBoolean } from "nuqs";
import {
	createParser,
	parseAsInteger,
	parseAsStringEnum,
} from "nuqs/server";
import { typeCreateLoader } from "app/utils/loader-utils";
import type { QuizAnswers } from "server/json/raw-quiz-config/types.v2";
import { JsonTree } from "@gfazioli/mantine-json-tree";
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { getRouteUrl } from "app/utils/search-params-utils";

export type { Route }

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
	MARK_QUIZ_ATTEMPT_AS_COMPLETE: "markquizattemptascomplete",
	// GRADE_SUBMISSION: "gradesubmission",
} as const;



export const loaderSearchParams = {
	action: parseAsStringEnum([
		...Object.values(AssignmentActions),
		...Object.values(DiscussionActions),
		...Object.values(QuizActions),
	]),
	threadId: parseAsInteger,
	showQuiz: parseAsBoolean.withDefault(false)
};

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
}).withDefault("thread");

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

	// Check if user is a student
	const isStudent = enrolmentContext?.enrolment?.role === "student";

	return {
		...courseModuleContext,
		moduleLinkId,
		isStudent,
		searchParams,
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
		replyTo: parseAsReplyTo,
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
		answers: z.string().nullish(),
		timeSpent: z.string().nullish(),
	}),
	method: "POST",
	action: QuizActions.MARK_QUIZ_ATTEMPT_AS_COMPLETE,
});

const startQuizAttemptRpc = createActionRpc({
	method: "POST",
	action: QuizActions.START_ATTEMPT,
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
		const { payload } = context.get(globalContextKey);
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
		});

		if (!createResult.ok) {
			return badRequest({ error: createResult.error.message });
		}

		return redirect(
			href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?threadId=${createResult.value.id}`,
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
		const actualParentThread = searchParams.replyTo === "thread"
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
			redirectTo:
				href("/course/module/:moduleLinkId", {
					moduleLinkId: String(moduleLinkId),
				}) + `?threadId=${actualParentThread}`,
		});
	},
);

const useCreateReply = createReplyRpc.createHook<typeof createReplyAction>();

const markQuizAttemptAsCompleteAction = markQuizAttemptAsCompleteRpc.createAction(
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
			return forbidden({ error: courseModuleContext.permissions.quiz.canStartAttempt.reason });
		}

		// Parse answers if provided
		let answers:
			| Array<{
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
			}>
			| undefined;

		if (formData.answers) {
			try {
				answers = JSON.parse(formData.answers) as typeof answers;
			} catch {
				return badRequest({ error: "Invalid answers format" });
			}
		}

		// Parse timeSpent if provided
		let timeSpent: number | undefined;
		if (formData.timeSpent) {
			const parsed = Number.parseFloat(formData.timeSpent);
			if (!Number.isNaN(parsed)) {
				timeSpent = parsed;
			}
		}

		const submitResult = await tryMarkQuizAttemptAsComplete({
			payload,
			submissionId: formData.submissionId,
			answers,
			timeSpent,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!submitResult.ok) {
			return badRequest({ error: submitResult.error.message });
		}

		// Redirect to remove showQuiz parameter and show instructions view
		return redirect(
			getRouteUrl("/course/module/:moduleLinkId", {
				params: { moduleLinkId: String(moduleLinkId) },
				searchParams: { showQuiz: false, action: null, threadId: null, }
			})
		);
	},
);

const useMarkQuizAttemptAsComplete =
	markQuizAttemptAsCompleteRpc.createHook<typeof markQuizAttemptAsCompleteAction>();

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
			return forbidden({ error: courseModuleContext.permissions.quiz.canStartAttempt.reason });
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

		// If there's an in_progress submission, reuse it by redirecting with showQuiz parameter
		if (checkResult.value.hasInProgress) {
			return redirect(
				getRouteUrl("/course/module/:moduleLinkId", {
					params: { moduleLinkId: String(moduleLinkId) },
					searchParams: { showQuiz: true, action: null, threadId: null, }
				})
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
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			enrollmentId: enrolmentContext.enrolment.id,
			attemptNumber: nextAttemptResult.value,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!startResult.ok) {
			return badRequest({ error: startResult.error.message });
		}

		// Redirect with showQuiz parameter to show the quiz preview
		return redirect(
			getRouteUrl("/course/module/:moduleLinkId", {
				params: { moduleLinkId: String(moduleLinkId) },
				searchParams: { showQuiz: true, action: null, threadId: null, }
			})
		);
	},
);

const useStartQuizAttempt =
	startQuizAttemptRpc.createHook<typeof startQuizAttemptAction>();

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
			return forbidden({ error: courseModuleContext.permissions.assignment.canSubmitAssignment.reason });
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
				? Math.max(
					...userSubmissions.map((sub) => sub.attemptNumber as number),
				)
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
			href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
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
	useSubmitAssignment,
	useCreateThread,
	useCreateReply,
	useMarkQuizAttemptAsComplete,
};

const [action] = createActionMap({
	[DiscussionActions.REPLY]: createReplyAction,
	[DiscussionActions.CREATE_THREAD]: createThreadAction,
	[DiscussionActions.UPVOTE_THREAD]: upvoteThreadAction,
	[DiscussionActions.REMOVE_UPVOTE_THREAD]: removeUpvoteThreadAction,
	[DiscussionActions.UPVOTE_REPLY]: upvoteReplyAction,
	[DiscussionActions.REMOVE_UPVOTE_REPLY]: removeUpvoteReplyAction,
	[QuizActions.MARK_QUIZ_ATTEMPT_AS_COMPLETE]: markQuizAttemptAsCompleteAction,
	[QuizActions.START_ATTEMPT]: startQuizAttemptAction,
	[AssignmentActions.SUBMIT_ASSIGNMENT]: submitAssignmentAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized ||
		actionData?.status === StatusCode.Forbidden
	) {
		notifications.show({
			title: "Error",
			message:
				actionData.error
			,
			color: "red",
		});
	} else if (actionData && "success" in actionData && actionData.success) {
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
			/>
			{loaderData.allSubmissionsForDisplay.length > 0 && (
				<SubmissionHistory
					submissions={loaderData.allSubmissionsForDisplay}
					variant="compact"
				/>
			)}
		</>
	);
}

type QuizModuleViewProps = {
	loaderData: Extract<Route.ComponentProps["loaderData"], { type: "quiz" }>;
	showQuiz: boolean;
};

function QuizModuleView({ loaderData, showQuiz }: QuizModuleViewProps) {
	const { submit: startQuizAttempt, isLoading: isStartingQuiz } =
		useStartQuizAttempt();
	const {
		submit: markQuizAttemptAsComplete,
		isLoading: isMarkingQuizAttemptAsComplete,
	} = useMarkQuizAttemptAsComplete();

	const quizConfig = loaderData.quiz.rawQuizConfig;
	if (!quizConfig) {
		return (
			<Text c="red">
				No quiz configuration available
				<JsonTree
					data={loaderData}
					showIndentGuides
					showItemsCount
					withCopyToClipboard
					withExpandAll
				/>
			</Text>
		);
	}

	// Use server-calculated values
	const allQuizSubmissionsForDisplay =
		loaderData.allQuizSubmissionsForDisplay ?? [];

	// Show QuizPreview only if showQuiz parameter is true AND there's an active attempt
	if (showQuiz && loaderData.hasActiveQuizAttempt) {
		// Use userSubmission which is already the active in_progress submission
		const activeSubmission =
			loaderData.userSubmission &&
				"status" in loaderData.userSubmission &&
				loaderData.userSubmission.status === "in_progress"
				? loaderData.userSubmission
				: null;

		const handleQuizSubmit = async (answers: QuizAnswers) => {
			if (!activeSubmission) return;

			const _transformedAnswers = transformQuizAnswersToSubmissionFormat(
				quizConfig,
				answers,
			);

			// Calculate time spent if startedAt exists
			let _timeSpent: number | undefined;
			if (
				activeSubmission &&
				"startedAt" in activeSubmission &&
				activeSubmission.startedAt
			) {
				const startedAt = new Date(activeSubmission.startedAt);
				const now = new Date();
				_timeSpent = (now.getTime() - startedAt.getTime()) / (1000 * 60); // Convert to minutes
			}

			await markQuizAttemptAsComplete({
				params: { moduleLinkId: loaderData.id },
				values: {
					submissionId: activeSubmission.id,
				},
			});
		};

		return (
			<>
				<ModuleDatesInfo settings={loaderData.settings} />
				<QuizPreview
					quizConfig={quizConfig}
					submissionId={activeSubmission?.id}
					onSubmit={handleQuizSubmit}
					remainingTime={loaderData.quizRemainingTime}
				/>
			</>
		);
	}

	// Always show instructions view with start button
	// The start button will either reuse existing in_progress attempt or create new one
	return (
		<>
			<ModuleDatesInfo settings={loaderData.settings} />
			<QuizInstructionsView
				quiz={loaderData.quiz}
				allSubmissions={allQuizSubmissionsForDisplay}
				onStartQuiz={() => {
					startQuizAttempt({
						params: { moduleLinkId: loaderData.id },
					});
				}}
				canStartAttempt={loaderData.permissions.quiz?.canStartAttempt.allowed ?? false}
				quizRemainingTime={loaderData.quizRemainingTime}
				canPreview={loaderData.permissions.quiz?.canPreview.allowed ?? false}
			/>
			{allQuizSubmissionsForDisplay.length > 0 && (
				<SubmissionHistory
					submissions={allQuizSubmissionsForDisplay.map((sub) => ({
						id: sub.id,
						// Map quiz statuses to SubmissionHistory statuses
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

type DiscussionModuleViewProps = {
	loaderData: Extract<
		Route.ComponentProps["loaderData"],
		{ type: "discussion" }
	>;
};

function DiscussionModuleView({ loaderData }: DiscussionModuleViewProps) {
	return (
		<>
			<ModuleDatesInfo settings={loaderData.settings} />
			<DiscussionThreadView
				discussion={loaderData.discussion || null}
				threads={loaderData.threads}
				thread={loaderData.thread ?? null}
				replies={loaderData.replies ?? []}
				moduleLinkId={Number(loaderData.moduleLinkId)}
				courseId={loaderData.course.id}
			/>
		</>
	);
}

type FileModuleViewProps = {
	loaderData: Extract<Route.ComponentProps["loaderData"], { type: "file" }>;
};

function FileModuleView({ loaderData }: FileModuleViewProps) {
	return (
		<>
			<ModuleDatesInfo settings={loaderData.settings} />
			<FilePreview files={loaderData.activityModule.media || []} />
		</>
	);
}

type PageModuleViewProps = {
	loaderData: Extract<Route.ComponentProps["loaderData"], { type: "page" }>;
};

function PageModuleView({ loaderData }: PageModuleViewProps) {
	const content = loaderData.activityModule.content;
	return (
		<>
			<ModuleDatesInfo settings={loaderData.settings} />
			<PagePreview content={content || "<p>No content available</p>"} />
		</>
	);
}

type WhiteboardModuleViewProps = {
	loaderData: Extract<
		Route.ComponentProps["loaderData"],
		{ type: "whiteboard" }
	>;
};


function WhiteboardModuleView({ loaderData }: WhiteboardModuleViewProps) {
	return (
		<>
			<ModuleDatesInfo settings={loaderData.settings} />
			<WhiteboardPreview content={loaderData.activityModule.content ?? ""} />
		</>
	);
}

export default function ModulePage({ loaderData }: Route.ComponentProps) {
	const {
		activityModule,
		settings,
		course,
		previousModule,
		nextModule,
	} = loaderData;

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
					<QuizModuleView loaderData={loaderData} showQuiz={loaderData.searchParams.showQuiz} />
				) : loaderData.type === "discussion" ? (
					<DiscussionModuleView loaderData={loaderData} />
				) : loaderData.type === "file" ? (
					<FileModuleView loaderData={loaderData} />
				) : loaderData.type === "page" ? (
					<PageModuleView loaderData={loaderData} />
				) : loaderData.type === "whiteboard" ? (
					<WhiteboardModuleView loaderData={loaderData} />
				) : null}

				<PreviousNextNavigation
					previousModule={previousModule}
					nextModule={nextModule}
				/>
			</Stack>
		</Container>
	);
}
