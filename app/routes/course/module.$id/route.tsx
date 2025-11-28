import { Button, Container, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, Link, redirect } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
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
	tryRemoveUpvoteDiscussionSubmission,
	tryUpvoteDiscussionSubmission,
} from "server/internal/discussion-management";
import {
	tryCheckInProgressSubmission,
	tryGetNextAttemptNumber,
	tryStartQuizAttempt,
	trySubmitQuiz,
} from "server/internal/quiz-submission-management";
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "server/internal/utils/handle-transaction-id";
import { createLocalReq } from "server/internal/utils/internal-function-utils";
import {
	canParticipateInDiscussion,
	canSubmitAssignment,
} from "server/utils/permissions";
import z from "zod";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { handleUploadError } from "~/utils/handle-upload-errors";
import {
	AssignmentActions,
	DiscussionActions,
	QuizActions,
} from "~/utils/module-actions";
import {
	badRequest,
	ForbiddenResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
import type { Route } from "./+types/route";
import { loadSearchParams } from "./utils";
import {
	PagePreview,
	WhiteboardPreview,
	AssignmentPreview,
} from "app/components/activity-module-forms";
import { ModuleDatesInfo } from "./components/module-dates-info";
import { FilePreview } from "app/components/activity-modules-preview/file-preview";
import { DiscussionThreadView } from "./components/discussion-thread-view";
import { SubmissionHistory } from "app/components/submission-history";
import {
	useSubmitAssignment,
	useStartQuizAttempt,
	useSubmitQuiz,
} from "./hooks";
import { QuizPreview } from "app/components/activity-modules-preview/quiz-preview";
import { QuizInstructionsView } from "app/components/activity-modules-preview/quiz-instructions-view";
import { transformQuizAnswersToSubmissionFormat } from "./utils";
import { parseAsString, useQueryState } from "nuqs";
import type { QuizAnswers } from "server/json/raw-quiz-config/types.v2";

export const loader = async ({
	context,
	params,
	request,
}: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
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

	// Get current user
	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	// Check if user is a student
	const isStudent = enrolmentContext?.enrolment?.role === "student";

	return {
		...courseModuleContext,
		action,
		threadId,
		moduleLinkId,
		isStudent,
	};
};

// Individual action functions
const createThreadAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & {
	searchParams: { action: string; replyTo: string | null };
}) => {
	const { payload } = context.get(globalContextKey);
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

	const createResult = await tryCreateDiscussionSubmission({
		payload,
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
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}) + `?threadId=${createResult.value.id}`,
	);
};

const upvoteThreadAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: string } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized({ error: "Unauthorized" });
	}

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

	const upvoteResult = await tryUpvoteDiscussionSubmission({
		payload,
		submissionId,
		userId: currentUser.id,
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
	});

	if (!upvoteResult.ok) {
		return badRequest({ error: upvoteResult.error.message });
	}

	return ok({ success: true, message: "Thread upvote added successfully" });
};

const removeUpvoteThreadAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: string } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized({ error: "Unauthorized" });
	}

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

	const removeUpvoteResult = await tryRemoveUpvoteDiscussionSubmission({
		payload,
		submissionId,
		userId: currentUser.id,
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
	});

	if (!removeUpvoteResult.ok) {
		return badRequest({ error: removeUpvoteResult.error.message });
	}

	return ok({ success: true, message: "Thread upvote removed successfully" });
};

const upvoteReplyAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: string } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized({ error: "Unauthorized" });
	}

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

	const upvoteResult = await tryUpvoteDiscussionSubmission({
		payload,
		submissionId,
		userId: currentUser.id,
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
	});

	if (!upvoteResult.ok) {
		return badRequest({ error: upvoteResult.error.message });
	}

	return ok({ success: true, message: "Reply upvote added successfully" });
};

const removeUpvoteReplyAction = async ({
	request,
	context,
}: Route.ActionArgs & { searchParams: { action: string } }) => {
	const { payload } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized({ error: "Unauthorized" });
	}

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

	const removeUpvoteResult = await tryRemoveUpvoteDiscussionSubmission({
		payload,
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
		submissionId,
		userId: currentUser.id,
	});

	if (!removeUpvoteResult.ok) {
		return badRequest({ error: removeUpvoteResult.error.message });
	}

	return ok({ success: true, message: "Reply upvote removed successfully" });
};

const createReplyAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & {
	searchParams: { action: string; replyTo: string | null };
}) => {
	const { payload } = context.get(globalContextKey);
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

	const { replyTo: replyToParam } = loadSearchParams(request);

	if (!replyToParam || replyToParam === "") {
		return badRequest({ error: "Reply target is required" });
	}

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

	const createResult = await tryCreateDiscussionSubmission({
		payload,
		courseModuleLinkId: Number(moduleLinkId),
		studentId: currentUser.id,
		enrollmentId: enrolmentContext.enrolment.id,
		postType,
		content: content.trim(),
		parentThread: actualParentThread,
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
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
			}) + `?threadId=${parentThreadId}`,
	});
};

const submitQuizAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: string } }) => {
	const { payload } = context.get(globalContextKey);
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

	// Only students can submit assignments or start quizzes
	if (!canSubmitAssignment(enrolmentContext.enrolment).allowed) {
		throw new ForbiddenResponse("Only students can submit assignments");
	}

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
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
		overrideAccess: false,
	});

	if (!submitResult.ok) {
		return badRequest({ error: submitResult.error.message });
	}

	// Redirect to remove showQuiz parameter and show instructions view
	return redirect(
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}),
	);
};

const startQuizAttemptAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: string } }) => {
	const { payload } = context.get(globalContextKey);
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

	// Only students can submit assignments or start quizzes
	if (!canSubmitAssignment(enrolmentContext.enrolment).allowed) {
		throw new ForbiddenResponse("Only students can submit assignments");
	}

	// Check if there's already an in_progress submission
	const checkResult = await tryCheckInProgressSubmission({
		payload,
		courseModuleLinkId: Number(moduleLinkId),
		studentId: currentUser.id,
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
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
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
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
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
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
};

const submitAssignmentAction = async ({
	request,
	context,
	params,
}: Route.ActionArgs & { searchParams: { action: string } }) => {
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
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized({ error: "Unauthorized" });
	}

	// Only students can submit assignments or start quizzes
	if (!canSubmitAssignment(enrolmentContext.enrolment).allowed) {
		throw new ForbiddenResponse("Only students can submit assignments");
	}

	// Handle assignment submission (existing logic)
	if (courseModuleContext.type !== "assignment") {
		return badRequest({ error: "Invalid module type for this action" });
	}

	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(payload);

	// Parse form data with media upload handler
	const parseResult = await tryParseFormDataWithMediaUpload({
		payload,
		request,
		userId: currentUser.id,
		req: transactionInfo.reqWithTransaction,
		maxFileSize,
		fields: [
			{
				fieldName: "files",
				alt: (_fieldName, filename) =>
					`Assignment submission file - ${filename}`,
			},
		],
	});

	if (!parseResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return handleUploadError(
			parseResult.error,
			maxFileSize,
			"Failed to parse form data",
		);
	}

	const { formData, uploadedMedia } = parseResult.value;

	const parsed = z
		.object({
			textContent: z.string().nullish(),
		})
		.safeParse({
			textContent: formData.get("textContent"),
		});

	if (!parsed.success) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			error: parsed.error.message,
		});
	}

	const textContent = parsed.data.textContent;

	// Build attachments array from uploaded files
	const attachments = uploadedMedia.map((media) => ({
		file: media.mediaId,
	}));

	// Find existing draft submission
	// Type guard: ensure we're working with assignment submissions
	if (courseModuleContext.type !== "assignment") {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({
			error: "This action is only available for assignment modules",
		});
	}

	const existingDraftSubmission = courseModuleContext.submissions.find(
		(sub) => sub.student.id === currentUser.id && sub.status === "draft",
	);

	// Calculate next attempt number
	const userSubmissions = courseModuleContext.submissions.filter(
		(sub): sub is typeof sub & { attemptNumber: unknown } =>
			sub.student.id === currentUser.id && "attemptNumber" in sub,
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
			content: textContent ?? "",
			attachments: attachments.length > 0 ? attachments : undefined,
			status: "draft",
			req: transactionInfo.reqWithTransaction,
			overrideAccess: false,
		});

		if (!updateResult.ok) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
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
			content: textContent ?? "",
			attachments: attachments.length > 0 ? attachments : undefined,
			attemptNumber: nextAttemptNumber,
			req: transactionInfo.reqWithTransaction,
			overrideAccess: false,
		});

		if (!createResult.ok) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			return badRequest({ error: createResult.error.message });
		}

		submissionId = createResult.value.id;
	}

	// Submit the assignment (change status to submitted)
	const submitResult = await trySubmitAssignment({
		payload,
		submissionId,
		req: transactionInfo.reqWithTransaction,
		overrideAccess: false,
	});

	if (!submitResult.ok) {
		await rollbackTransactionIfCreated(payload, transactionInfo);
		return badRequest({ error: submitResult.error.message });
	}

	await commitTransactionIfCreated(payload, transactionInfo);

	return redirect(
		href("/course/module/:moduleLinkId", {
			moduleLinkId: String(moduleLinkId),
		}),
	);
};

export const action = async (args: Route.ActionArgs) => {
	assertRequestMethod(args.request.method, "POST");

	const { action: actionParam, replyTo: replyToParam } = loadSearchParams(
		args.request,
	);

	if (!actionParam) {
		return badRequest({ error: "Action is required" });
	}

	// Handle reply creation (determined by replyTo parameter)
	if (actionParam === DiscussionActions.REPLY && replyToParam !== "") {
		return createReplyAction({
			...args,
			searchParams: {
				action: actionParam,
				replyTo: replyToParam,
			},
		});
	}

	// Route to appropriate action based on action parameter
	if (actionParam === DiscussionActions.CREATE_THREAD) {
		return createThreadAction({
			...args,
			searchParams: {
				action: actionParam,
				replyTo: replyToParam,
			},
		});
	}

	if (actionParam === DiscussionActions.UPVOTE_THREAD) {
		return upvoteThreadAction({
			...args,
			searchParams: {
				action: actionParam,
			},
		});
	}

	if (actionParam === DiscussionActions.REMOVE_UPVOTE_THREAD) {
		return removeUpvoteThreadAction({
			...args,
			searchParams: {
				action: actionParam,
			},
		});
	}

	if (actionParam === DiscussionActions.UPVOTE_REPLY) {
		return upvoteReplyAction({
			...args,
			searchParams: {
				action: actionParam,
			},
		});
	}

	if (actionParam === DiscussionActions.REMOVE_UPVOTE_REPLY) {
		return removeUpvoteReplyAction({
			...args,
			searchParams: {
				action: actionParam,
			},
		});
	}

	if (actionParam === QuizActions.SUBMIT_QUIZ) {
		return submitQuizAction({
			...args,
			searchParams: {
				action: actionParam,
			},
		});
	}

	if (actionParam === QuizActions.START_ATTEMPT) {
		return startQuizAttemptAction({
			...args,
			searchParams: {
				action: actionParam,
			},
		});
	}

	if (actionParam === AssignmentActions.SUBMIT_ASSIGNMENT) {
		return submitAssignmentAction({
			...args,
			searchParams: {
				action: actionParam,
			},
		});
	}

	return badRequest({ error: "Invalid action" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized
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
			message: actionData.message || "Operation completed successfully",
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
	const { submitAssignment, isSubmitting } = useSubmitAssignment(loaderData.id);

	return (
		<>
			<ModuleDatesInfo moduleSettings={loaderData.formattedModuleSettings} />
			<AssignmentPreview
				assignment={loaderData.assignment || null}
				submission={loaderData.assignmentSubmission}
				allSubmissions={loaderData.allSubmissionsForDisplay}
				onSubmit={({ textContent, files }) => {
					submitAssignment(textContent, files);
				}}
				isSubmitting={isSubmitting}
				canSubmit={loaderData.canSubmit}
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
};

function QuizModuleView({ loaderData }: QuizModuleViewProps) {
	const { startQuizAttempt } = useStartQuizAttempt(loaderData.id);
	const { submitQuiz } = useSubmitQuiz(loaderData.id);
	const [showQuiz] = useQueryState("showQuiz", parseAsString.withDefault(""));

	const quizConfig = loaderData.quiz?.rawQuizConfig || null;
	if (!quizConfig) {
		return <Text c="red">No quiz configuration available</Text>;
	}

	// Use server-calculated values
	const allQuizSubmissionsForDisplay =
		loaderData.allQuizSubmissionsForDisplay ?? [];

	// Show QuizPreview only if showQuiz parameter is true AND there's an active attempt
	if (showQuiz === "true" && loaderData.hasActiveQuizAttempt) {
		// Use userSubmission which is already the active in_progress submission
		const activeSubmission =
			loaderData.userSubmission &&
			"status" in loaderData.userSubmission &&
			loaderData.userSubmission.status === "in_progress"
				? loaderData.userSubmission
				: null;

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
				<ModuleDatesInfo moduleSettings={loaderData.formattedModuleSettings} />
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
			<ModuleDatesInfo moduleSettings={loaderData.formattedModuleSettings} />
			<QuizInstructionsView
				quiz={loaderData.quiz}
				allSubmissions={allQuizSubmissionsForDisplay}
				onStartQuiz={startQuizAttempt}
				canSubmit={loaderData.canSubmit}
				quizRemainingTime={loaderData.quizRemainingTime}
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
			<ModuleDatesInfo moduleSettings={loaderData.formattedModuleSettings} />
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
			<ModuleDatesInfo moduleSettings={loaderData.formattedModuleSettings} />
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
			<ModuleDatesInfo moduleSettings={loaderData.formattedModuleSettings} />
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
			<ModuleDatesInfo moduleSettings={loaderData.formattedModuleSettings} />
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
		threadId,
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
					<QuizModuleView loaderData={loaderData} />
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
