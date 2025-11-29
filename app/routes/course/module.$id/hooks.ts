import { stringify } from "qs";
import { useEffect } from "react";
import { href, useFetcher, useRevalidator } from "react-router";
import { ContentType } from "~/utils/get-content-type";
import {
	AssignmentActions,
	DiscussionActions,
	QuizActions,
} from "~/utils/module-actions";
import type { clientAction } from "./route";

export const getActionUrl = (
	action: string,
	moduleLinkId: string,
	additionalParams?: Record<string, string | null>,
) => {
	const baseUrl = href("/course/module/:moduleLinkId", {
		moduleLinkId: String(moduleLinkId),
	});
	const params: Record<string, string> = {};
	if (action) {
		params.action = action;
	}
	if (additionalParams) {
		for (const [key, value] of Object.entries(additionalParams)) {
			if (value !== null && value !== undefined) {
				params[key] = value;
			}
		}
	}
	return baseUrl + "?" + stringify(params);
};

export const useSubmitAssignment = (moduleLinkId: number) => {
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
			action: getActionUrl(
				AssignmentActions.SUBMIT_ASSIGNMENT,
				String(moduleLinkId),
			),
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
			action: getActionUrl(QuizActions.START_ATTEMPT, String(moduleLinkId)),
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
			action: getActionUrl(QuizActions.SUBMIT_QUIZ, String(moduleLinkId)),
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
			action: getActionUrl(
				DiscussionActions.CREATE_THREAD,
				String(moduleLinkId),
			),
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
			action: getActionUrl(
				DiscussionActions.UPVOTE_THREAD,
				String(moduleLinkId),
			),
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
			action: getActionUrl(
				DiscussionActions.REMOVE_UPVOTE_THREAD,
				String(moduleLinkId),
			),
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
			action: getActionUrl(
				DiscussionActions.UPVOTE_REPLY,
				String(moduleLinkId),
			),
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
		const formData = new FormData();
		formData.append("submissionId", submissionId.toString());
		formData.append("threadId", threadId);

		fetcher.submit(formData, {
			method: "POST",
			action: getActionUrl(
				DiscussionActions.REMOVE_UPVOTE_REPLY,
				String(moduleLinkId),
			),
		});
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

		// Use replyTo URL parameter instead of action=REPLY
		// replyTo=thread for thread-level replies, replyTo=<commentId> for nested comments
		const replyToParam = commentId ?? "thread";

		fetcher.submit(formData, {
			method: "POST",
			action: getActionUrl("", String(moduleLinkId), { replyTo: replyToParam }),
		});
	};

	return {
		createReply,
		isSubmitting: fetcher.state !== "idle",
		state: fetcher.state,
		data: fetcher.data,
	};
};
