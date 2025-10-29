/**
 * Type-safe constants for module actions
 * These actions are used in query parameters to control UI state
 */

export const AssignmentActions = {
    EDIT_SUBMISSION: "editsubmission",
} as const;

export const DiscussionActions = {
    CREATE_THREAD: "createthread",
    REPLY: "reply",
} as const;

export type AssignmentAction =
    (typeof AssignmentActions)[keyof typeof AssignmentActions];
export type DiscussionAction =
    (typeof DiscussionActions)[keyof typeof DiscussionActions];
export type ModuleAction = AssignmentAction | DiscussionAction;

