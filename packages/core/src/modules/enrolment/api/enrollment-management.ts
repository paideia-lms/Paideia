import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateEnrollment,
	tryUpdateEnrollment,
	tryFindEnrollmentById,
	trySearchEnrollments,
	tryDeleteEnrollment,
	tryFindEnrollmentsByUser,
	tryFindEnrollmentsByCourse,
	tryFindUserEnrollmentInCourse,
	tryFindActiveEnrollments,
	tryUpdateEnrollmentStatus,
	tryAddGroupsToEnrollment,
	tryRemoveGroupsFromEnrollment,
	tryFindEnrollmentsByGroup,
} from "../services/enrollment-management";
import type { OrpcContext } from "server/orpc/context";

const outputSchema = z.any();
const roleSchema = z.enum(["student", "teacher", "ta", "manager"]);
const statusSchema = z.enum(["active", "inactive", "completed", "dropped"]);

const createEnrollmentSchema = z.object({
	userId: z.coerce.number().int().min(1),
	course: z.coerce.number().int().min(1),
	role: roleSchema,
	status: statusSchema.optional(),
	enrolledAt: z.string().optional(),
	completedAt: z.string().optional(),
	groups: z.array(z.coerce.number().int().min(1)).optional(),
});

const updateEnrollmentSchema = z.object({
	enrollmentId: z.coerce.number().int().min(1),
	role: roleSchema.optional(),
	status: statusSchema.optional(),
	enrolledAt: z.string().optional(),
	completedAt: z.string().optional(),
	groups: z.array(z.coerce.number().int().min(1)).optional(),
});

const enrollmentIdSchema = z.object({
	enrollmentId: z.coerce.number().int().min(1),
});

const searchSchema = z.object({
	userId: z.coerce.number().int().min(1).optional(),
	course: z.coerce.number().int().min(1).optional(),
	role: roleSchema.optional(),
	status: statusSchema.optional(),
	groupId: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const userIdSchema = z.object({
	userId: z.coerce.number().int().min(1),
});

const courseIdSchema = z.object({
	courseId: z.coerce.number().int().min(1),
});

const userCourseSchema = z.object({
	userId: z.coerce.number().int().min(1),
	courseId: z.coerce.number().int().min(1),
});

const updateStatusSchema = z.object({
	enrollmentId: z.coerce.number().int().min(1),
	status: statusSchema,
	completedAt: z.string().optional(),
});

const addGroupsSchema = z.object({
	enrollmentId: z.coerce.number().int().min(1),
	groupIds: z.array(z.coerce.number().int().min(1)),
});

const removeGroupsSchema = z.object({
	enrollmentId: z.coerce.number().int().min(1),
	groupIds: z.array(z.coerce.number().int().min(1)),
});

const groupIdSchema = z.object({
	groupId: z.coerce.number().int().min(1),
	limit: z.coerce.number().int().min(1).max(100).optional(),
});

const limitPageSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

export const createEnrollment = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/enrollments" })
	.input(createEnrollmentSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryCreateEnrollment({
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

export const updateEnrollment = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/enrollments/{enrollmentId}" })
	.input(updateEnrollmentSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryUpdateEnrollment({
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

export const findEnrollmentById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/{enrollmentId}" })
	.input(enrollmentIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindEnrollmentById({
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

export const searchEnrollments = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/search" })
	.input(searchSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await trySearchEnrollments({
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

export const deleteEnrollment = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/enrollments/{enrollmentId}" })
	.input(enrollmentIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryDeleteEnrollment({
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

export const findEnrollmentsByUser = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/by-user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindEnrollmentsByUser({
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

export const findEnrollmentsByCourse = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/by-course/{courseId}" })
	.input(courseIdSchema.extend({ limit: z.coerce.number().int().min(1).max(100).optional() }))
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindEnrollmentsByCourse({
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

export const findUserEnrollmentInCourse = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/user/{userId}/course/{courseId}" })
	.input(userCourseSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindUserEnrollmentInCourse({
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

export const findActiveEnrollments = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/active" })
	.input(limitPageSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindActiveEnrollments({
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

export const updateEnrollmentStatus = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/enrollments/{enrollmentId}/status" })
	.input(updateStatusSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryUpdateEnrollmentStatus({
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

export const addGroupsToEnrollment = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/enrollments/{enrollmentId}/groups" })
	.input(addGroupsSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryAddGroupsToEnrollment({
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

export const removeGroupsFromEnrollment = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/enrollments/{enrollmentId}/groups" })
	.input(removeGroupsSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryRemoveGroupsFromEnrollment({
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

export const findEnrollmentsByGroup = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/by-group/{groupId}" })
	.input(groupIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindEnrollmentsByGroup({
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
