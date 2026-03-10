import { os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateSection,
	tryUpdateSection,
	tryFindSectionById,
	tryDeleteSection,
	tryFindSectionsByCourse,
	tryFindRootSections,
	tryFindChildSections,
	tryGetSectionTree,
	tryGetSectionAncestors,
	tryGetSectionDepth,
} from "../../internal/course-section-management";
import type { OrpcContext } from "../context";
import { run } from "../utils/handler";

const outputSchema = z.any();

const createSchema = z.object({
	data: z.object({
		course: z.coerce.number().int().min(1),
		title: z.string().min(1),
		description: z.string(),
		parentSection: z.coerce.number().int().min(1).optional(),
		contentOrder: z.coerce.number().int().min(0).optional(),
	}),
});

const updateSchema = z.object({
	sectionId: z.coerce.number().int().min(1),
	data: z.object({
		title: z.string().optional(),
		description: z.string().optional(),
		parentSection: z.coerce.number().int().min(1).optional(),
		contentOrder: z.coerce.number().int().min(0).optional(),
	}),
});

const sectionIdSchema = z.object({
	sectionId: z.coerce.number().int().min(1),
});

const courseIdSchema = z.object({
	courseId: z.coerce.number().int().min(1),
});

const parentSectionIdSchema = z.object({
	parentSectionId: z.coerce.number().int().min(1),
});

export const createSection = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/course-sections" })
	.input(createSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryCreateSection, { payload: context.payload, ...input }));

export const updateSection = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/course-sections/{sectionId}" })
	.input(updateSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryUpdateSection, { payload: context.payload, ...input }));

export const findSectionById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-sections/{sectionId}" })
	.input(sectionIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryFindSectionById, { payload: context.payload, ...input }));

export const deleteSection = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/course-sections/{sectionId}" })
	.input(sectionIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryDeleteSection, { payload: context.payload, ...input }));

export const findSectionsByCourse = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-sections/by-course/{courseId}" })
	.input(courseIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryFindSectionsByCourse, { payload: context.payload, ...input }));

export const findRootSections = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-sections/roots/{courseId}" })
	.input(courseIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryFindRootSections, { payload: context.payload, ...input }));

export const findChildSections = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-sections/{parentSectionId}/children" })
	.input(parentSectionIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindChildSections, { payload: context.payload, ...input }),
	);

export const getSectionTree = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-sections/tree/{courseId}" })
	.input(courseIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetSectionTree, { payload: context.payload, ...input }));

export const getSectionAncestors = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-sections/{sectionId}/ancestors" })
	.input(sectionIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetSectionAncestors, { payload: context.payload, ...input }));

export const getSectionDepth = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-sections/{sectionId}/depth" })
	.input(sectionIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetSectionDepth, { payload: context.payload, ...input }));
