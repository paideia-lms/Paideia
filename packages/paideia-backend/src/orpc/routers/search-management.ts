import { os } from "@orpc/server";
import { z } from "zod";
import { tryGlobalSearch } from "../../internal/search-management";
import type { OrpcContext } from "../context";
import { handleResult } from "../utils/handler";

const outputSchema = z.any();

const searchSchema = z.object({
	query: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
});

export const globalSearch = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/search" })
	.input(searchSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) =>
		handleResult(() =>
			tryGlobalSearch({
				payload: context.payload,
				...input,
				req: undefined,
				overrideAccess: true,
			}),
		),
	);
