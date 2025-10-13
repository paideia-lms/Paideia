import type { User } from "server/payload-types";

/**
 * Check if user can create/edit activity modules
 */
export function canManageActivityModules(user: User): boolean {
	return (
		user.role === "admin" ||
		user.role === "instructor" ||
		user.role === "content-manager"
	);
}
