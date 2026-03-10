import { os } from "@orpc/server";
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
} from "../../internal/enrollment-management";
import type { OrpcContext } from "../context";
import { run } from "../utils/handler";

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
	.handler(async ({ input, context }) =>
		run(tryCreateEnrollment, {
			payload: context.payload,
			...input,
		}),
	);

export const updateEnrollment = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/enrollments/{enrollmentId}" })
	.input(updateEnrollmentSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryUpdateEnrollment, {
			payload: context.payload,
			...input,
		}),
	);

export const findEnrollmentById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/{enrollmentId}" })
	.input(enrollmentIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindEnrollmentById, {
			payload: context.payload,
			...input,
		}),
	);

export const searchEnrollments = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/search" })
	.input(searchSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(trySearchEnrollments, {
			payload: context.payload,
			...input,
		}),
	);

export const deleteEnrollment = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/enrollments/{enrollmentId}" })
	.input(enrollmentIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryDeleteEnrollment, {
			payload: context.payload,
			...input,
		}),
	);

export const findEnrollmentsByUser = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/by-user/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindEnrollmentsByUser, {
			payload: context.payload,
			...input,
		}),
	);

export const findEnrollmentsByCourse = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/by-course/{courseId}" })
	.input(courseIdSchema.extend({ limit: z.coerce.number().int().min(1).max(100).optional() }))
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindEnrollmentsByCourse, {
			payload: context.payload,
			...input,
		}),
	);

export const findUserEnrollmentInCourse = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/user/{userId}/course/{courseId}" })
	.input(userCourseSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindUserEnrollmentInCourse, {
			payload: context.payload,
			...input,
		}),
	);

export const findActiveEnrollments = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/active" })
	.input(limitPageSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindActiveEnrollments, {
			payload: context.payload,
			...input,
		}),
	);

export const updateEnrollmentStatus = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/enrollments/{enrollmentId}/status" })
	.input(updateStatusSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryUpdateEnrollmentStatus, {
			payload: context.payload,
			...input,
		}),
	);

export const addGroupsToEnrollment = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/enrollments/{enrollmentId}/groups" })
	.input(addGroupsSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryAddGroupsToEnrollment, {
			payload: context.payload,
			...input,
		}),
	);

export const removeGroupsFromEnrollment = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/enrollments/{enrollmentId}/groups" })
	.input(removeGroupsSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryRemoveGroupsFromEnrollment, {
			payload: context.payload,
			...input,
		}),
	);

export const findEnrollmentsByGroup = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/enrollments/by-group/{groupId}" })
	.input(groupIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindEnrollmentsByGroup, {
			payload: context.payload,
			...input,
		}),
	);
