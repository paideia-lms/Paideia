/**
 * user context:
 * this context is available when user is logged in
 */

import {
	executeAuthStrategies,
	type Payload,
	type TypedUser as PayloadUser,
	parseCookies,
	RequestContext,
} from "payload";
import { createContext } from "react-router";
import { tryHandleImpersonation } from "server/internal/user-management";
import {
	type BaseInternalFunctionArgs,
	createLocalReq,
} from "server/internal/utils/internal-function-utils";

export type User = PayloadUser;

export interface UserSession {
	authenticatedUser: User; // The actual logged-in user (admin)
	effectiveUser?: User | null; // The user being impersonated, or null when not impersonating
	// authenticatedUserPermissions: string[]; // Permissions for authenticatedUser (admin's real permissions)
	// effectiveUserPermissions?: string[] | null; // Permissions for effectiveUser, or null when not impersonating
	isImpersonating: boolean; // true when admin is viewing as another user
	isAuthenticated: boolean;
}

export const userContext = createContext<UserSession | null>(null);

export { userContextKey } from "./utils/context-keys";

export const tryGetUserContext = async (
	args: Pick<BaseInternalFunctionArgs, "payload" | "req">,
): Promise<UserSession | null> => {
	const { payload, req } = args;
	const headers = req?.headers ?? new Headers();
	// Get the authenticated user
	const { user: authenticatedUser } = await executeAuthStrategies({
		headers,
		canSetHeaders: true,
		payload,
	});

	if (!authenticatedUser) {
		// No authenticated user, don't set context - let it use default null value
		return null;
	}

	// Check for impersonation cookie
	const cookies = parseCookies(headers);
	const impersonateUserId = cookies.get(
		`${payload.config.cookiePrefix}-impersonate`,
	);

	let effectiveUser: User | null = null;
	let isImpersonating = false;

	// If impersonation cookie exists and user is admin
	if (impersonateUserId && authenticatedUser.role === "admin") {
		const impersonationResult = await tryHandleImpersonation({
			payload,
			impersonateUserId,
			req,
		});

		if (impersonationResult.ok && impersonationResult.value) {
			effectiveUser = {
				...impersonationResult.value.targetUser,
				collection: "users",
			};
			isImpersonating = true;
		}
	}

	return {
		authenticatedUser: {
			...authenticatedUser,
			avatar:
				typeof authenticatedUser.avatar === "object"
					? authenticatedUser.avatar
					: null,
			direction: authenticatedUser.direction ?? "ltr",
		},
		effectiveUser: effectiveUser,
		// authenticatedUserPermissions: effectiveUserPermissions ?? [],
		// effectiveUserPermissions: effectiveUserPermissions,
		isImpersonating: isImpersonating,
		isAuthenticated: true,
	};
};
