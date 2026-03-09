import { os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateDiscussionSubmission,
	tryUpdateDiscussionSubmission,
	tryGetDiscussionSubmissionById,
	tryGetDiscussionThreadsWithAllReplies,
	tryUpvoteDiscussionSubmission,
	tryRemoveUpvoteDiscussionSubmission,
	tryListDiscussionSubmissions,
	tryGradeDiscussionSubmission,
	tryDeleteDiscussionSubmission,
	tryGetDiscussionThreadWithReplies,
} from "../../internal/discussion-management";
import type { OrpcContext } from "../context";
import { handleResult } from "../utils/handler";

const outputSchema = z.any();

const run = <T>(fn: (args: object) => Promise<{ ok: boolean; value?: T; error?: { message: string } }>, args: object) =>
	handleResult(() => fn({ ...args, req: undefined, overrideAccess: true }));

const createSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1),
	studentId: z.coerce.number().int().min(1),
	enrollmentId: z.coerce.number().int().min(1),
	postType: z.enum(["thread", "reply", "comment"]),
	title: z.string().optional(),
	content: z.string().min(1),
	parentThread: z.coerce.number().int().min(1).optional(),
});

const updateSchema = z.object({
	id: z.coerce.number().int().min(1),
	title: z.string().optional(),
	content: z.string().optional(),
	isPinned: z.boolean().optional(),
	isLocked: z.boolean().optional(),
});

const idSchema = z.object({ id: z.union([z.coerce.number(), z.string()]) });

const threadsSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1),
});

const upvoteSchema = z.object({
	submissionId: z.coerce.number().int().min(1),
	userId: z.coerce.number().int().min(1),
});

const gradeSchema = z.object({
	id: z.coerce.number().int().min(1),
	grade: z.number(),
	feedback: z.string().optional(),
	gradedBy: z.coerce.number().int().min(1),
});

const listSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1).optional(),
	studentId: z.coerce.number().int().min(1).optional(),
	enrollmentId: z.coerce.number().int().min(1).optional(),
	postType: z.enum(["thread", "reply", "comment"]).optional(),
	parentThread: z.coerce.number().int().min(1).optional(),
	status: z.enum(["draft", "published", "archived"]).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
	sortBy: z.enum(["recent", "upvoted", "active", "alphabetical"]).optional(),
});

const threadWithRepliesSchema = z.object({
	threadId: z.coerce.number().int().min(1),
	courseModuleLinkId: z.coerce.number().int().min(1),
});

export const createDiscussionSubmission = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/discussions" })
	.input(createSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryCreateDiscussionSubmission, { payload: context.payload, ...input }),
	);

export const updateDiscussionSubmission = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/discussions/{id}" })
	.input(updateSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryUpdateDiscussionSubmission, { payload: context.payload, ...input }),
	);

export const getDiscussionSubmissionById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/discussions/{id}" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetDiscussionSubmissionById, { payload: context.payload, ...input }),
	);

export const getDiscussionThreadsWithAllReplies = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/discussions/threads/{courseModuleLinkId}" })
	.input(threadsSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetDiscussionThreadsWithAllReplies, { payload: context.payload, ...input }),
	);

export const getDiscussionThreadWithReplies = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/discussions/thread" })
	.input(threadWithRepliesSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetDiscussionThreadWithReplies, { payload: context.payload, ...input }),
	);

export const upvoteDiscussionSubmission = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/discussions/upvote" })
	.input(upvoteSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryUpvoteDiscussionSubmission, { payload: context.payload, ...input }),
	);

export const removeUpvoteDiscussionSubmission = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/discussions/remove-upvote" })
	.input(upvoteSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryRemoveUpvoteDiscussionSubmission, { payload: context.payload, ...input }),
	);

export const listDiscussionSubmissions = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/discussions" })
	.input(listSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryListDiscussionSubmissions, { payload: context.payload, ...input }),
	);

export const gradeDiscussionSubmission = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/discussions/grade" })
	.input(gradeSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGradeDiscussionSubmission, { payload: context.payload, ...input }),
	);

export const deleteDiscussionSubmission = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/discussions/{id}" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryDeleteDiscussionSubmission, { payload: context.payload, ...input }),
	);
