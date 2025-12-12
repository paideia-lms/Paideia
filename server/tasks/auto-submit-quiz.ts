import type { TaskConfig } from "payload";
import { trySubmitQuiz } from "../internal/quiz-submission-management";

/**
 * Payload task that auto-submits a quiz when the time limit expires
 * This task is scheduled when a student starts a quiz attempt
 */
export const autoSubmitQuiz: TaskConfig<"autoSubmitQuiz"> = {
	slug: "autoSubmitQuiz" as const,
	inputSchema: [
		{
			name: "submissionId",
			type: "number",
			required: true,
		},
	],
	outputSchema: [
		{
			name: "message",
			type: "text",
			required: true,
		},
		{
			name: "submissionId",
			type: "number",
			required: true,
		},
	],
	handler: async ({ req, input }) => {
		const submissionId = input?.submissionId;

		if (!submissionId) {
			return {
				state: "failed",
				errorMessage: "Submission ID is required",
			};
		}

		// Get the current submission to check if it's still in progress
		const currentSubmission = await req.payload.findByID({
			collection: "quiz-submissions",
			id: submissionId,
			overrideAccess: true,
		});

		if (!currentSubmission) {
			return {
				state: "failed",
				errorMessage: `Quiz submission with id '${submissionId}' not found`,
			};
		}

		// Only auto-submit if still in progress
		if (currentSubmission.status !== "in_progress") {
			return {
				state: "succeeded",
				output: {
					message: `Quiz submission ${submissionId} was already ${currentSubmission.status}, skipping auto-submit`,
					submissionId,
				},
			};
		}

		// Auto-submit the quiz (bypass time limit check since timer has expired)
		const submitResult = await trySubmitQuiz({
			payload: req.payload,
			submissionId,
			// ! we can override access because this is a system request
			overrideAccess: true,
			// ! we can bypass the time limit check because the timer has expired and this is a system request
			bypassTimeLimit: true,
		});

		if (!submitResult.ok) {
			return {
				state: "failed",
				errorMessage: `Failed to auto-submit quiz: ${submitResult.error.message}`,
			};
		}

		return {
			state: "succeeded",
			output: {
				message: `Quiz submission ${submissionId} auto-submitted successfully`,
				submissionId,
			},
		};
	},
};
