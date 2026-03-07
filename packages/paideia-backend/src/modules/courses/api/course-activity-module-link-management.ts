import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateCourseActivityModuleLink,
	tryFindLinksByCourse,
	tryFindLinksByActivityModule,
	trySearchCourseActivityModuleLinks,
	tryDeleteCourseActivityModuleLink,
	tryFindCourseActivityModuleLinkById,
	tryGetCourseModuleSettings,
	tryCheckCourseActivityModuleLinkExists,
} from "../services/course-activity-module-link-management";
import type { OrpcContext } from "../../../orpc/context";

const outputSchema = z.any();

const createSchema = z.object({
	course: z.coerce.number().int().min(1),
	activityModule: z.coerce.number().int().min(1),
	section: z.coerce.number().int().min(1),
	order: z.coerce.number().int().min(0).optional(),
	contentOrder: z.coerce.number().int().min(0).optional(),
	settings: z.record(z.string(), z.any()).optional(),
});

const linkIdSchema = z.object({
	linkId: z.coerce.number().int().min(1),
});

const courseIdSchema = z.object({
	courseId: z.coerce.number().int().min(1),
});

const activityModuleIdSchema = z.object({
	activityModuleId: z.coerce.number().int().min(1),
});

const searchSchema = z.object({
	course: z.coerce.number().int().min(1).optional(),
	activityModule: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const settingsSchema = z.object({
	linkId: z.coerce.number().int().min(1),
});

const existsSchema = z.object({
	courseId: z.coerce.number().int().min(1),
	activityModuleId: z.coerce.number().int().min(1),
});

export const createCourseActivityModuleLink = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/course-activity-module-links" })
	.input(createSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryCreateCourseActivityModuleLink({
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

export const findLinksByCourse = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-activity-module-links/by-course/{courseId}" })
	.input(courseIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindLinksByCourse({
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

export const findLinksByActivityModule = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-activity-module-links/by-activity-module/{activityModuleId}" })
	.input(activityModuleIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindLinksByActivityModule({
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

export const searchCourseActivityModuleLinks = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-activity-module-links/search" })
	.input(searchSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await trySearchCourseActivityModuleLinks({
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

export const deleteCourseActivityModuleLink = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/course-activity-module-links/{linkId}" })
	.input(linkIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryDeleteCourseActivityModuleLink({
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

export const findCourseActivityModuleLinkById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-activity-module-links/{linkId}" })
	.input(linkIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindCourseActivityModuleLinkById({
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

export const getCourseModuleSettings = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-activity-module-links/{linkId}/settings" })
	.input(settingsSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryGetCourseModuleSettings({
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

export const checkCourseActivityModuleLinkExists = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-activity-module-links/exists" })
	.input(existsSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryCheckCourseActivityModuleLinkExists({
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
