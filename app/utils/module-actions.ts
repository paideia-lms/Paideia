/**
 * Type-safe constants for module actions
 * These actions are used in query parameters to control UI state
 */

export const AssignmentActions = {
	EDIT_SUBMISSION: "editsubmission",
	GRADE_SUBMISSION: "gradesubmission",
} as const;

export const DiscussionActions = {
	CREATE_THREAD: "createthread",
	REPLY: "reply",
	UPVOTE_THREAD: "upvotethread",
	REMOVE_UPVOTE_THREAD: "removeupvotethread",
	UPVOTE_REPLY: "upvotereply",
	REMOVE_UPVOTE_REPLY: "removeupvotereply",
} as const;

export const QuizActions = {
	START_ATTEMPT: "startattempt",
	SUBMIT_QUIZ: "submitquiz",
} as const;

export type AssignmentAction =
	(typeof AssignmentActions)[keyof typeof AssignmentActions];
export type DiscussionAction =
	(typeof DiscussionActions)[keyof typeof DiscussionActions];
export type QuizAction = (typeof QuizActions)[keyof typeof QuizActions];
export type ModuleAction = AssignmentAction | DiscussionAction | QuizAction;
