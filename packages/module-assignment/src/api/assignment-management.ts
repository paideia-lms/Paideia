import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateAssignment,
	tryUpdateAssignment,
	tryFindAssignmentById,
	tryListAssignmentsByCourse,
	tryDeleteAssignment,
	trySubmitAssignment,
	tryGradeSubmission,
	tryListSubmissions,
	tryFindSubmissionById,
	tryDeleteSubmission,
} from "../services/assignment-management";
import type { OrpcContext } from "../orpc/context";

const outputSchema = z.any();

const createAssignmentSchema = z.object({
	data: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
		instructions: z.string().optional(),
		courseId: z.coerce.number().int().min(1),
		sectionId: z.coerce.number().int().min(1),
		dueDate: z.string().optional(),
		maxAttempts: z.coerce.number().int().min(1).optional(),
		maxGrade: z.coerce.number().min(0).optional(),
		requireTextSubmission: z.boolean().optional(),
		requireFileSubmission: z.boolean().optional(),
		maxFileSize: z.coerce.number().min(0).optional(),
		maxFiles: z.coerce.number().int().min(1).optional(),
		createdBy: z.coerce.number().int().min(1),
	}),
});

const updateAssignmentSchema = z.object({
	assignmentId: z.coerce.number().int().min(1),
	data: z.object({
		title: z.string().optional(),
		description: z.string().optional(),
		instructions: z.string().optional(),
		dueDate: z.string().optional(),
		maxAttempts: z.coerce.number().int().min(1).optional(),
		maxGrade: z.coerce.number().min(0).optional(),
		requireTextSubmission: z.boolean().optional(),
		requireFileSubmission: z.boolean().optional(),
		maxFileSize: z.coerce.number().min(0).optional(),
		maxFiles: z.coerce.number().int().min(1).optional(),
	}),
});

const assignmentIdSchema = z.object({
	assignmentId: z.coerce.number().int().min(1),
});

const listByCourseSchema = z.object({
	courseId: z.coerce.number().int().min(1),
	sectionId: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const submitSchema = z.object({
	assignmentId: z.coerce.number().int().min(1),
	studentId: z.coerce.number().int().min(1),
	content: z.string().optional(),
	attemptNumber: z.coerce.number().int().min(1).optional(),
});

const gradeSchema = z.object({
	submissionId: z.coerce.number().int().min(1),
	grade: z.coerce.number().min(0),
	feedback: z.string().optional(),
	gradedBy: z.coerce.number().int().min(1),
});

const listSubmissionsSchema = z.object({
	assignmentId: z.coerce.number().int().min(1).optional(),
	studentId: z.coerce.number().int().min(1).optional(),
	status: z.enum(["draft", "submitted", "graded", "returned"]).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const submissionIdSchema = z.object({
	submissionId: z.coerce.number().int().min(1),
});

export const createAssignment = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/assignments" })
	.input(createAssignmentSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryCreateAssignment({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const updateAssignment = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/assignments/{assignmentId}" })
	.input(updateAssignmentSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryUpdateAssignment({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const findAssignmentById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/assignments/{assignmentId}" })
	.input(assignmentIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindAssignmentById({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const listAssignmentsByCourse = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/assignments/by-course/{courseId}" })
	.input(listByCourseSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryListAssignmentsByCourse({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const deleteAssignment = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/assignments/{assignmentId}" })
	.input(assignmentIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryDeleteAssignment({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const submitAssignment = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/assignment-submissions" })
	.input(submitSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await trySubmitAssignment({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const gradeSubmission = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/assignment-submissions/{submissionId}/grade" })
	.input(gradeSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGradeSubmission({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const listSubmissions = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/assignment-submissions" })
	.input(listSubmissionsSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryListSubmissions({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const findSubmissionById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/assignment-submissions/{submissionId}" })
	.input(submissionIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindSubmissionById({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const deleteSubmission = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/assignment-submissions/{submissionId}" })
	.input(submissionIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryDeleteSubmission({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		});
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});
