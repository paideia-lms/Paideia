/**
 * user context:
 * this context is available when user is logged in
 */
import {
	type Payload,
	type TypedUser as PayloadUser,
	parseCookies,
} from "payload";
import { createContext, href } from "react-router";
import { tryHandleImpersonation } from "server/internal/user-management";

export function getAvatarUrl(user: PayloadUser) {
	if (user.avatar && typeof user.avatar === "object" && user.avatar.filename) {
		return href(`/api/media/file/:filenameOrId`, {
			filenameOrId: user.avatar.filename,
		});
	}
	return null;
}

export interface User {
	id: number;
	firstName?: string | null;
	lastName?: string | null;
	role?:
	| (
		| "student"
		| "instructor"
		| "admin"
		| "content-manager"
		| "analytics-viewer"
	)
	| null;
	bio?: string | null;
	/**
	 * the id or file name of the avatar
	 */
	avatar: {
		id: number;
		filename?: string | null;
	} | null;
	theme: "light" | "dark";
	email: string;
	updatedAt: string;
	createdAt: string;
}

export interface UserSession {
	authenticatedUser: User; // The actual logged-in user (admin)
	effectiveUser?: User | null; // The user being impersonated, or null when not impersonating
	authenticatedUserPermissions: string[]; // Permissions for authenticatedUser (admin's real permissions)
	effectiveUserPermissions?: string[] | null; // Permissions for effectiveUser, or null when not impersonating
	isImpersonating: boolean; // true when admin is viewing as another user
	isAuthenticated: boolean;
}

export const userContext = createContext<UserSession | null>(null);

export const userContextKey = "userContext" as unknown as typeof userContext;

export const tryGetUserContext = async (
	payload: Payload,
	request: Request,
): Promise<UserSession | null> => {
	// Get the authenticated user
	const { user: authenticatedUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!authenticatedUser) {
		// No authenticated user, don't set context - let it use default null value
		return null;
	}

	// Check for impersonation cookie
	const cookies = parseCookies(request.headers);
	const impersonateUserId = cookies.get(
		`${payload.config.cookiePrefix}-impersonate`,
	);

	let effectiveUser: User | null = null;
	let effectiveUserPermissions: string[] | null = null;
	let isImpersonating = false;

	// If impersonation cookie exists and user is admin
	if (impersonateUserId && authenticatedUser.role === "admin") {
		const impersonationResult = await tryHandleImpersonation({
			payload,
			impersonateUserId,
			authenticatedUser,
		});

		if (impersonationResult.ok && impersonationResult.value) {
			effectiveUser = {
				...impersonationResult.value.targetUser,
				avatar:
					typeof impersonationResult.value.targetUser.avatar === "object"
						? impersonationResult.value.targetUser.avatar
						: null,
			};
			effectiveUserPermissions = impersonationResult.value.permissions;
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
		},
		effectiveUser: effectiveUser,
		authenticatedUserPermissions: effectiveUserPermissions ?? [],
		effectiveUserPermissions: effectiveUserPermissions,
		isImpersonating: isImpersonating,
		isAuthenticated: true,
	};
};
