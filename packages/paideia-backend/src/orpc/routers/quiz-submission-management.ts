import { os } from "@orpc/server";
import { z } from "zod";
import {
	tryGetQuizById,
	tryGetQuizSubmissionById,
	tryListQuizSubmissions,
	tryStartQuizAttempt,
	tryStartPreviewQuizAttempt,
	tryGetQuizGradesReport,
	tryGetQuizStatisticsReport,
	tryGetNextAttemptNumber,
	tryCheckInProgressSubmission,
} from "../../internal/quiz-submission-management";
import type { OrpcContext } from "../context";
import { run } from "../utils/handler";

const outputSchema = z.any();

const idSchema = z.object({ id: z.union([z.coerce.number(), z.string()]) });

const startAttemptSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1),
	enrollmentId: z.coerce.number().int().min(1),
});

const courseModuleLinkIdSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1),
});

const previewAttemptSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1),
	userId: z.coerce.number().int().min(1),
	enrollmentId: z.coerce.number().int().min(1),
});

const nextAttemptSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1),
	studentId: z.coerce.number().int().min(1),
});

const listSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1).optional(),
	studentId: z.coerce.number().int().min(1).optional(),
	enrollmentId: z.coerce.number().int().min(1).optional(),
	status: z.enum(["in_progress", "completed", "graded", "returned"]).optional(),
	includePreview: z.boolean().optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const inProgressSchema = z.object({
	courseModuleLinkId: z.coerce.number().int().min(1),
	studentId: z.coerce.number().int().min(1),
});

export const getQuizById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/quiz-submissions/quiz/{id}" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetQuizById, { payload: context.payload, ...input }));

export const getQuizSubmissionById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/quiz-submissions/{id}" })
	.input(idSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetQuizSubmissionById, { payload: context.payload, ...input }),
	);

export const listQuizSubmissions = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/quiz-submissions" })
	.input(listSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryListQuizSubmissions, { payload: context.payload, ...input }),
	);

export const startQuizAttempt = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/quiz-submissions/start" })
	.input(startAttemptSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryStartQuizAttempt, { payload: context.payload, ...input }),
	);

export const startPreviewQuizAttempt = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/quiz-submissions/start-preview" })
	.input(previewAttemptSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryStartPreviewQuizAttempt, { payload: context.payload, ...input }),
	);

export const getQuizGradesReport = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/quiz-submissions/grades-report/{courseModuleLinkId}" })
	.input(courseModuleLinkIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetQuizGradesReport, { payload: context.payload, ...input }),
	);

export const getQuizStatisticsReport = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/quiz-submissions/statistics-report/{courseModuleLinkId}" })
	.input(courseModuleLinkIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetQuizStatisticsReport, { payload: context.payload, ...input }),
	);

export const getNextAttemptNumber = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/quiz-submissions/next-attempt" })
	.input(nextAttemptSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetNextAttemptNumber, { payload: context.payload, ...input }),
	);

export const checkInProgressSubmission = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/quiz-submissions/in-progress" })
	.input(inProgressSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryCheckInProgressSubmission, { payload: context.payload, ...input }),
	);
