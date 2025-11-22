import { Button, Container, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
} from "@remix-run/form-data-parser";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { parseAsString, useQueryState } from "nuqs";
import prettyBytes from "pretty-bytes";
import { useEffect } from "react";
import { href, Link, redirect, useFetcher, useRevalidator } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import {
	courseModuleContextKey,
	type DiscussionThread,
	tryGetDiscussionThreadWithReplies,
} from "server/contexts/course-module-context";
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
	tryListDiscussionSubmissions,
	tryRemoveUpvoteDiscussionSubmission,
	tryUpvoteDiscussionSubmission,
} from "server/internal/discussion-management";
import { parseFormDataWithMediaUpload } from "~/utils/upload-handler";
import {
	tryCheckInProgressSubmission,
	tryGetNextAttemptNumber,
	tryListQuizSubmissions,
	tryStartQuizAttempt,
	trySubmitQuiz,
} from "server/internal/quiz-submission-management";
import type { QuizAnswers } from "server/json/raw-quiz-config.types.v2";
import { flattenCourseStructureWithModuleInfo } from "server/utils/course-structure-utils";
import {
	canParticipateInDiscussion,
	canSubmitAssignment,
} from "server/utils/permissions";
import z from "zod";
import { AssignmentPreview } from "~/components/activity-modules-preview/assignment-preview";
import type { DiscussionReply } from "~/components/activity-modules-preview/discussion-preview";
import { FilePreview } from "~/components/activity-modules-preview/file-preview";
import { PagePreview } from "~/components/activity-modules-preview/page-preview";
import { QuizInstructionsView } from "~/components/activity-modules-preview/quiz-instructions-view";
import { QuizPreview } from "~/components/activity-modules-preview/quiz-preview";
import { WhiteboardPreview } from "~/components/activity-modules-preview/whiteboard-preview";
import { SubmissionHistory } from "~/components/submission-history";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { ContentType } from "~/utils/get-content-type";
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
import type { Route } from "./+types/route";
import { DiscussionThreadView } from "./components/discussion-thread-view";
import { ModuleDatesInfo } from "./components/module-dates-info";
import {
	loadSearchParams,
	transformQuizAnswersToSubmissionFormat,
} from "./utils";

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

	// Get current user
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check permissions
	if (
		!courseModuleContext.canSubmit &&
		action === AssignmentActions.EDIT_SUBMISSION
	) {
		throw new ForbiddenResponse("You cannot edit submissions");
	}

	// Extract module-specific data from discriminated union
	const { moduleSpecificData } = courseModuleContext;

	// If this is an assignment module and user cannot submit, they can't see submissions
	if (
		courseModuleContext.module.type === "assignment" &&
		!courseModuleContext.canSubmit
	) {
		return {
			module: courseModuleContext.module,
			moduleSettings: courseModuleContext.moduleLinkSettings,
			formattedModuleSettings: courseModuleContext.formattedModuleSettings,
			course: courseContext.course,
			previousModule: courseModuleContext.previousModule,
			nextModule: courseModuleContext.nextModule,
			userSubmission: null,
			userSubmissions: [],
			moduleLinkId: courseModuleContext.moduleLinkId,
			canSubmit: false,
			discussionThreads:
				moduleSpecificData.type === "discussion"
					? moduleSpecificData.threads
					: [],
			discussionThread: null,
			discussionReplies: [],
			quizRemainingTime:
				moduleSpecificData.type === "quiz"
					? moduleSpecificData.quizRemainingTime
					: undefined,
		};
	}

	// Fetch discussion replies if threadId is provided (threadId-dependent, so stays in loader)
	let discussionThread: DiscussionThread | null = null;
	let discussionReplies: DiscussionReply[] = [];

	if (moduleSpecificData.type === "discussion" && threadId) {
		const payload = context.get(globalContextKey)?.payload;
		if (!payload) {
			throw new ForbiddenResponse("Payload not available");
		}

		const threadIdNum = Number.parseInt(threadId, 10);
		if (!Number.isNaN(threadIdNum)) {
			// Find the thread from context
			const foundThread = moduleSpecificData.threads.find(
				(t) => t.id === threadId,
			);
			if (foundThread) {
				discussionThread = foundThread;

				// Get the thread with all nested replies using the course module context function
				const threadResult = await tryGetDiscussionThreadWithReplies(
					payload,
					threadIdNum,
					Number(moduleLinkId),
					currentUser
						? {
							...currentUser,
							avatar:
								currentUser.avatar && typeof currentUser.avatar === "object"
									? currentUser.avatar.id
									: currentUser.avatar,
						}
						: null,
				);

				if (threadResult.ok) {
					discussionReplies = threadResult.value.replies;
				}
			}
		}
	}

	// Extract values from discriminated union based on module type
	const userSubmission =
		moduleSpecificData.type === "assignment" ||
			moduleSpecificData.type === "quiz"
			? moduleSpecificData.userSubmission
			: null;
	const userSubmissions =
		moduleSpecificData.type === "assignment" ||
			moduleSpecificData.type === "quiz" ||
			moduleSpecificData.type === "discussion"
			? moduleSpecificData.userSubmissions
			: [];
	const discussionThreads =
		moduleSpecificData.type === "discussion" ? moduleSpecificData.threads : [];

	// Extract module-specific data based on module type
	const quizRemainingTime =
		courseModuleContext.moduleSpecificData.type === "quiz"
			? courseModuleContext.moduleSpecificData.quizRemainingTime
			: undefined;
	const quizSubmissionsForDisplay =
		courseModuleContext.moduleSpecificData.type === "quiz"
			? courseModuleContext.moduleSpecificData.quizSubmissionsForDisplay
			: undefined;
	const hasActiveQuizAttempt =
		courseModuleContext.moduleSpecificData.type === "quiz"
			? courseModuleContext.moduleSpecificData.hasActiveQuizAttempt
			: undefined;

	return {
		module: courseModuleContext.module,
		moduleSettings: courseModuleContext.moduleLinkSettings,
		formattedModuleSettings: courseModuleContext.formattedModuleSettings,
		course: courseContext.course,
		previousModule: courseModuleContext.previousModule,
		nextModule: courseModuleContext.nextModule,
		userSubmission,
		userSubmissions,
		moduleLinkId: courseModuleContext.moduleLinkId,
		canSubmit: courseModuleContext.canSubmit,
		discussionThreads,
		discussionThread,
		discussionReplies,
		quizRemainingTime,
		quizSubmissionsForDisplay,
		hasActiveQuizAttempt,
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
	const { action: actionParam, replyTo: replyToParam } =
		loadSearchParams(request);
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
		courseModuleContext.module.type === "discussion" && replyToParam !== "";

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
		const canParticipate = canParticipateInDiscussion(
			enrolmentContext.enrolment,
		);
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
			href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}) + `?threadId=${createResult.value.id}`,
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

		const removeUpvoteResult = await tryRemoveUpvoteDiscussionSubmission(
			payload,
			{
				submissionId,
				userId: currentUser.id,
			},
		);

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

		const removeUpvoteResult = await tryRemoveUpvoteDiscussionSubmission(
			payload,
			{
				submissionId,
				userId: currentUser.id,
			},
		);

		if (!removeUpvoteResult.ok) {
			return badRequest({ error: removeUpvoteResult.error.message });
		}

		// Redirect to refresh the page and show updated upvote count
		const threadIdParam = formData.get("threadId");
		if (!threadIdParam || typeof threadIdParam !== "string") {
			return badRequest({
				error: "Thread ID is required for reply upvote removal",
			});
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
		const canParticipate = canParticipateInDiscussion(
			enrolmentContext.enrolment,
		);
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
		return ok({
			success: true,
			message: "Reply created successfully",
			redirectTo:
				href("/course/module/:moduleLinkId", {
					moduleLinkId: String(moduleLinkId),
				}) + `?threadId=${parentThreadId}`,
		});
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
			user: currentUser,
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
	}

	// Handle quiz start attempt
	if (isQuizStart) {
		// Check if there's already an in_progress submission
		const checkResult = await tryCheckInProgressSubmission({
			payload,
			courseModuleLinkId: Number(moduleLinkId),
			studentId: currentUser.id,
			user: currentUser,
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
			user: currentUser,
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
			user: currentUser,
			req: request,
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
		// Parse form data with media upload handler
		const { formData, uploadedMedia } = await parseFormDataWithMediaUpload({
			payload,
			request,
			userId: currentUser.id,
			user: currentUser,
			req: { transactionID },
			maxFileSize,
			fields: [
				{
					fieldName: "files",
					alt: (_fieldName, filename) =>
						`Assignment submission file - ${filename}`,
				},
			],
		});

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
		const attachments = uploadedMedia.map((media) => ({
			file: media.mediaId,
		}));

		// Find existing draft submission
		// Type guard: ensure we're working with assignment submissions
		if (courseModuleContext.moduleSpecificData.type !== "assignment") {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({
				error: "This action is only available for assignment modules",
			});
		}

		const existingDraftSubmission =
			courseModuleContext.moduleSpecificData.submissions.find(
				(sub) => sub.student.id === currentUser.id && sub.status === "draft",
			);

		// Calculate next attempt number
		const userSubmissions =
			courseModuleContext.moduleSpecificData.submissions.filter(
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
				content: textContent,
				attachments: attachments.length > 0 ? attachments : undefined,
				status: "draft",
				user: currentUser,
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
				user: currentUser,
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
			user: currentUser,
			req: { transactionID },
			overrideAccess: false,
		});

		if (!submitResult.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: submitResult.error.message });
		}

		await payload.db.commitTransaction(transactionID);

		return redirect(
			href("/course/module/:moduleLinkId", {
				moduleLinkId: String(moduleLinkId),
			}),
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

export const useSubmitAssignment = () => {
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

export const useStartQuizAttempt = (moduleLinkId: number) => {
	const fetcher = useFetcher<typeof clientAction>();

	const startQuizAttempt = () => {
		const formData = new FormData();
		fetcher.submit(formData, {
			method: "POST",
			action:
				href("/course/module/:moduleLinkId", {
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

export const useSubmitQuiz = (moduleLinkId: number) => {
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
			action:
				href("/course/module/:moduleLinkId", {
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
			action:
				href("/course/module/:moduleLinkId", {
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
			action:
				href("/course/module/:moduleLinkId", {
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
			action:
				href("/course/module/:moduleLinkId", {
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
			action:
				href("/course/module/:moduleLinkId", {
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

	const removeUpvoteReply = (submissionId: number, threadId: string) => {
		fetcher.submit(
			{
				submissionId,
				threadId,
				intent: DiscussionActions.REMOVE_UPVOTE_REPLY,
				moduleLinkId: moduleLinkId,
			},
			{
				method: "POST",
				action:
					href("/course/module/:moduleLinkId", {
						moduleLinkId: String(moduleLinkId),
					}) + `?action=${DiscussionActions.REMOVE_UPVOTE_REPLY}`,
				encType: ContentType.JSON,
			},
		);
	};

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
		commentId?: string | null,
	) => {
		const formData = new FormData();
		formData.append("content", content);
		formData.append("parentThread", parentThreadId.toString());

		console.log("parentThreadId", parentThreadId);
		console.log("replyToId", commentId);

		// Use replyTo URL parameter instead of action=REPLY
		// replyTo=thread for thread-level replies, replyTo=<commentId> for nested comments
		const replyToParam = commentId || "thread";

		fetcher.submit(formData, {
			method: "POST",
			action:
				href("/course/module/:moduleLinkId", {
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

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

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
		quizRemainingTime,
		quizSubmissionsForDisplay,
		hasActiveQuizAttempt,
	} = loaderData;
	const { submitAssignment, isSubmitting } = useSubmitAssignment();
	const { startQuizAttempt } = useStartQuizAttempt(loaderData.moduleLinkId);
	const { submitQuiz } = useSubmitQuiz(loaderData.moduleLinkId);
	const [showQuiz] = useQueryState("showQuiz", parseAsString.withDefault(""));

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

				// Use server-calculated values
				const allQuizSubmissionsForDisplay = quizSubmissionsForDisplay ?? [];

				// Show QuizPreview only if showQuiz parameter is true AND there's an active attempt
				if (showQuiz === "true" && hasActiveQuizAttempt) {
					// Use userSubmission which is already the active in_progress submission
					const activeSubmission =
						userSubmission &&
							"status" in userSubmission &&
							userSubmission.status === "in_progress"
							? userSubmission
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
							<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
							<QuizPreview
								quizConfig={quizConfig}
								submissionId={activeSubmission?.id}
								onSubmit={handleQuizSubmit}
								remainingTime={quizRemainingTime}
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
							quizRemainingTime={quizRemainingTime}
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
			case "file": {
				const fileData = module.file;
				return (
					<>
						<ModuleDatesInfo moduleSettings={formattedModuleSettings} />
						<FilePreview files={fileData?.media || []} />
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
