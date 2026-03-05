import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
	tryFindUserById,
	tryFindAllUsers,
	tryFindUserByEmail,
} from "../services/user-management";
import type { OrpcContext } from "../../../orpc/context";

const userIdSchema = z.object({
	userId: z.coerce.number().int().min(1),
});

const emailSchema = z.object({
	email: z.email(),
});

const findAllSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
	page: z.coerce.number().int().min(1).optional(),
	sort: z.string().optional(),
	query: z.string().optional(),
});

const outputSchema = z.any();

export const findUserById = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/users/{userId}" })
	.input(userIdSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindUserById({
			payload: context.payload,
			userId: input.userId,
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

export const findUserByEmail = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/users/by-email" })
	.input(emailSchema)
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindUserByEmail({
			payload: context.payload,
			email: input.email,
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

export const findAllUsers = os
	.$context<OrpcContext>()
	.route({ method: "GET", path: "/users" })
	.input(findAllSchema.optional())
	.output(outputSchema)
	.handler(async ({ input, context }) => {
		const result = await tryFindAllUsers({
			payload: context.payload,
			limit: input?.limit,
			page: input?.page,
			sort: input?.sort,
			query: input?.query,
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
