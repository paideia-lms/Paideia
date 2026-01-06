/**
 * user context:
 * this context is available when user is logged in
 */

import { executeAuthStrategies, parseCookies } from "payload";
import { createContext } from "react-router";
import { tryHandleImpersonation } from "server/internal/user-management";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "server/internal/utils/internal-function-utils";
import { permissions } from "server/utils/permissions";

export type UserSession = NonNullable<
	Awaited<ReturnType<typeof tryGetUserContext>>
>;

export const userContext = createContext<UserSession | null>(null);

export { userContextKey } from "./utils/context-keys";

export const tryGetUserContext = async (
	args: Pick<BaseInternalFunctionArgs, "payload" | "req">,
) => {
	const { payload, req } = args;
	const headers = req?.headers ?? new Headers();
	// Get the authenticated user
	const { user: authenticatedUser } = await executeAuthStrategies({
		headers,
		canSetHeaders: true,
		payload,
	}).then(stripDepth<1, "find">());

	if (!authenticatedUser) {
		// No authenticated user, don't set context - let it use default null value
		return null;
	}

	// Check for impersonation cookie
	const cookies = parseCookies(headers);
	const impersonateUserId = cookies.get(
		`${payload.config.cookiePrefix}-impersonate`,
	);

	const impersonationResult =
		impersonateUserId && authenticatedUser.role === "admin"
			? await tryHandleImpersonation({
					payload,
					impersonateUserId,
					req,
				})
			: null;

	const { effectiveUser, isImpersonating } =
		impersonationResult?.ok && impersonationResult.value
			? {
					effectiveUser: {
						...impersonationResult.value.targetUser,
						collection: "users" as const,
					},
					isImpersonating: true,
				}
			: {
					effectiveUser: null,
					isImpersonating: false,
				};

	const currentUser = effectiveUser || authenticatedUser;

	return {
		authenticatedUser: {
			...authenticatedUser,
			avatar: authenticatedUser.avatar?.id ?? null,
			direction: authenticatedUser.direction ?? "ltr",
		},
		effectiveUser: effectiveUser,
		// authenticatedUserPermissions: effectiveUserPermissions ?? [],
		// effectiveUserPermissions: effectiveUserPermissions,
		isImpersonating: isImpersonating,
		isAuthenticated: true,
		permissions: {
			canSeeUserModules: permissions.user.canSeeModules(currentUser).allowed,
		},
	};
};
