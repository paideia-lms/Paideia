import { ORPCError, os } from "@orpc/server";
import type { OrpcContext } from "../context";
import type { User } from "../../payload-types";

/**
 * Middleware that requires an authenticated user.
 * Throws UNAUTHORIZED if context.user is null or undefined.
 */
export const requireAuth = os
	.$context<OrpcContext>()
	.middleware(async ({ context, next }) => {
		if (!context.user) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "Authentication required",
			});
		}
		return next({
			context: {
				req: { user: context.user },
			},
		});
	});

/**
 * Creates middleware that requires the user to have one of the specified roles.
 * Must be used after requireAuth (user is guaranteed to exist).
 */
export function requireRoles(allowedRoles: NonNullable<User["role"]>[]) {
	return os.$context<OrpcContext>().middleware(async ({ context, next }) => {
		if (!context.user) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "Authentication required",
			});
		}
		const userRole = context.user.role;
		if (!userRole || !allowedRoles.includes(userRole)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Insufficient permissions",
			});
		}
		return next();
	});
}

/** Shorthand for admin-only procedures */
export const requireAdmin = requireRoles(["admin"]);
