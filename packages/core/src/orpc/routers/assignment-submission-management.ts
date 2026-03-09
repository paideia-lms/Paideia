import { os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateAssignmentSubmission,
	tryGetAssignmentSubmissionById,
	tryGradeAssignmentSubmission,
	tryRemoveAssignmentSubmissionGrade,
	tryListAssignmentSubmissions,
	tryDeleteAssignmentSubmission,
} from "../../internal/assignment-submission-management";
import type { OrpcContext } from "../context";
import { handleResult } from "../utils/handler";

const outputSchema = z.any();

const run = <T>(fn: (args: object) => Promise<{ ok: boolean; value?: T; error?: { message: string } }>, args: object) =>
	handleResult(() => fn({ ...args, req: undefined, overrideAccess: true }));

const createSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1),
	studentId: z.coerce.number().int().min(1),
	enrollmentId: z.coerce.number().int().min(1),
	attemptNumber: z.coerce.number().int().min(1).optional(),
	content: z.string().optional(),
	timeSpent: z.coerce.number().int().min(0).optional(),
});

const idSchema = z.object({ id: z.union([z.coerce.number(), z.string()]) });

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
	status: z.enum(["draft", "submitted", "graded", "returned"]).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

export const createAssignmentSubmission = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/assignment-submissions" })
	.input(createSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryCreateAssignmentSubmission, { payload: context.payload, ...input }),
	);

export const getAssignmentSubmissionById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/assignment-submissions/{id}" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetAssignmentSubmissionById, { payload: context.payload, ...input }),
	);

export const gradeAssignmentSubmission = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/assignment-submissions/grade" })
	.input(gradeSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGradeAssignmentSubmission, { payload: context.payload, ...input }),
	);

export const removeAssignmentSubmissionGrade = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/assignment-submissions/remove-grade" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryRemoveAssignmentSubmissionGrade, { payload: context.payload, ...input }),
	);

export const listAssignmentSubmissions = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/assignment-submissions" })
	.input(listSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryListAssignmentSubmissions, { payload: context.payload, ...input }),
	);

export const deleteAssignmentSubmission = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/assignment-submissions/{id}" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryDeleteAssignmentSubmission, { payload: context.payload, ...input }),
	);
