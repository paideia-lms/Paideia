import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateCourse,
	tryUpdateCourse,
	tryFindCourseById,
	trySearchCourses,
	tryFindPublishedCourses,
	tryDeleteCourse,
	tryFindCoursesByInstructor,
	tryFindAllCourses,
} from "../services/course-management";
import type { OrpcContext } from "../../../orpc/context";

const courseIdSchema = z.object({
	courseId: z.coerce.number().int().min(1),
});

const createCourseSchema = z.object({
	data: z.object({
		title: z.string().min(1),
		description: z.string(),
		slug: z.string().min(1),
		createdBy: z.coerce.number().int().min(1),
		status: z.enum(["draft", "published", "archived"]).optional(),
		thumbnail: z.coerce.number().int().min(1).optional(),
		tags: z.array(z.object({ tag: z.string().optional() })).optional(),
		category: z.coerce.number().int().min(1).optional(),
	}),
});

const updateCourseSchema = z.object({
	courseId: z.coerce.number().int().min(1),
	data: z.object({
		title: z.string().optional(),
		description: z.string().optional(),
		slug: z.string().optional(),
		status: z.enum(["draft", "published", "archived"]).optional(),
		thumbnail: z.coerce.number().int().min(1).optional(),
		tags: z.array(z.object({ tag: z.string().optional() })).optional(),
		category: z.coerce.number().int().min(1).optional(),
	}),
});

const searchFiltersSchema = z.object({
	title: z.string().optional(),
	createdBy: z.number().int().optional(),
	status: z.enum(["draft", "published", "archived"]).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const publishedFiltersSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const instructorIdSchema = z.object({
	instructorId: z.coerce.number().int().min(1),
	limit: z.coerce.number().int().min(1).max(100).optional(),
});

const findAllSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
	sort: z.string().optional(),
	query: z.string().optional(),
});

const outputSchema = z.any();

export const createCourse = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/courses" })
	.input(createCourseSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryCreateCourse({
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

export const updateCourse = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/courses/{courseId}" })
	.input(updateCourseSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryUpdateCourse({
			payload: context.payload,
			...input,
			req: context.req,
			overrideAccess: false,
		} as any);
		if (!result.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error.message,
				cause: result.error,
			});
		}
		return result.value;
	});

export const findCourseById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/courses/{courseId}" })
	.input(courseIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindCourseById({
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

export const searchCourses = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/courses/search" })
	.input(searchFiltersSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await trySearchCourses({
			payload: context.payload,
			filters: input,
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

export const findPublishedCourses = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/courses/published" })
	.input(publishedFiltersSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindPublishedCourses({
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

export const deleteCourse = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/courses/{courseId}" })
	.input(courseIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryDeleteCourse({
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

export const findCoursesByInstructor = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/courses/by-instructor/{instructorId}" })
	.input(instructorIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindCoursesByInstructor({
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

export const findAllCourses = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/courses/all" })
	.input(findAllSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindAllCourses({
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
