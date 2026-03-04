import { os } from "@orpc/server";
import { z } from "zod";
import {
	tryCreateGradebook,
	tryUpdateGradebook,
	tryGetGradebookByCourseWithDetails,
	tryGetGradebookAllRepresentations,
} from "../../internal/gradebook-management";
import type { OrpcContext } from "../context";
import { handleResult } from "../utils/handler";

const outputSchema = z.any();

const run = <T>(fn: (args: object) => Promise<{ ok: boolean; value?: T; error?: { message: string } }>, args: object) =>
	handleResult(() => fn({ ...args, req: undefined, overrideAccess: true }));

const createSchema = z.object({
	courseId: z.coerce.number().int().min(1),
	enabled: z.boolean().optional(),
});

const updateSchema = z.object({
	gradebookId: z.coerce.number().int().min(1),
	enabled: z.boolean().optional(),
});

const courseIdSchema = z.object({
	courseId: z.coerce.number().int().min(1),
});

export const createGradebook = os
	.$context<OrpcContext>()
	.route({ method: "POST", path: "/gradebooks" })
	.input(createSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryCreateGradebook, { payload: context.payload, ...input }));

export const updateGradebook = os
	.$context<OrpcContext>()
	.route({ method: "PATCH", path: "/gradebooks/{gradebookId}" })
	.input(updateSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => run(tryUpdateGradebook, { payload: context.payload, ...input }));

export const getGradebookByCourseWithDetails = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/gradebooks/by-course/{courseId}" })
	.input(courseIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetGradebookByCourseWithDetails, { payload: context.payload, ...input }),
	);

export const getGradebookAllRepresentations = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/gradebooks/by-course/{courseId}/all-representations" })
	.input(courseIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		run(tryGetGradebookAllRepresentations, { payload: context.payload, ...input }),
	);
