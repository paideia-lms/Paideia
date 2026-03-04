import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateCategory,
	tryUpdateCategory,
	tryDeleteCategory,
	tryFindCategoryById,
	tryGetCategoryTree,
	tryGetCategoryAncestors,
	tryGetCategoryDepth,
	tryGetTotalNestedCoursesCount,
	tryFindRootCategories,
	tryFindSubcategories,
	tryFindAllCategories,
} from "../../internal/course-category-management";
import type { OrpcContext } from "../context";
import { handleResult } from "../utils/handler";

const outputSchema = z.any();

const createSchema = z.object({
	name: z.string().min(1),
	parent: z.coerce.number().int().min(1).optional(),
});

const updateSchema = z.object({
	categoryId: z.coerce.number().int().min(1),
	name: z.string().optional(),
	parent: z.coerce.number().int().min(1).nullable().optional(),
});

const categoryIdSchema = z.object({
	categoryId: z.coerce.number().int().min(1),
});

const parentIdSchema = z.object({
	parentId: z.coerce.number().int().min(1),
});

const searchSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

const run = <T>(fn: (args: object) => Promise<{ ok: boolean; value?: T; error?: { message: string } }>, args: object) =>
	handleResult(() => fn({ ...args, req: undefined, overrideAccess: true }));

export const createCategory = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/course-categories" })
	.input(createSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryCreateCategory, { payload: context.payload, ...input }));

export const updateCategory = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/course-categories/{categoryId}" })
	.input(updateSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryUpdateCategory, { payload: context.payload, ...input }));

export const deleteCategory = os
	.$context<OrpcContext>()
	.route({ method: "DELETE", path: "/course-categories/{categoryId}" })
	.input(categoryIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryDeleteCategory, { payload: context.payload, ...input }));

export const findCategoryById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-categories/{categoryId}" })
	.input(categoryIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryFindCategoryById, { payload: context.payload, ...input }));

export const getCategoryTree = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-categories/tree" })
	.input(z.object({}))
	.output(outputSchema)
	.handler(async ({ context }) => run(tryGetCategoryTree, { payload: context.payload }));

export const getCategoryAncestors = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-categories/{categoryId}/ancestors" })
	.input(categoryIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetCategoryAncestors, { payload: context.payload, ...input }));

export const getCategoryDepth = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-categories/{categoryId}/depth" })
	.input(categoryIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryGetCategoryDepth, { payload: context.payload, ...input }));

export const getTotalNestedCoursesCount = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-categories/{categoryId}/nested-courses-count" })
	.input(categoryIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetTotalNestedCoursesCount, { payload: context.payload, ...input }),
	);

export const findRootCategories = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-categories/roots" })
	.input(searchSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryFindRootCategories, { payload: context.payload, ...input }));

export const findSubcategories = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-categories/{parentId}/subcategories" })
	.input(parentIdSchema.extend({ limit: z.coerce.number().int().min(1).max(100).optional() }))
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryFindSubcategories, { payload: context.payload, parentId: input.parentId, limit: input.limit }),
	);

export const findAllCategories = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/course-categories" })
	.input(searchSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryFindAllCategories, { payload: context.payload, ...input }));
