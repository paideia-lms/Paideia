/**
 * public permissions checks
 * we can use this functions in client side and server side
 *
 * all functions in this file will only return true or false and a reason
 */

import type { Enrollment } from "server/contexts/course-context";
import type { User } from "server/payload-types";

/**
 * Result type for permission checks
 * Contains both the permission result and a human-readable reason
 */
export interface PermissionResult {
	allowed: boolean;
	reason: string;
}

export function canSeeCourseSettings(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		id: number;
		role?: Enrollment["role"];
	},
) {
	return (
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		user?.role === "admin" ||
		user?.role === "content-manager"
	);
}

export function canSeeCourseParticipants(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		role?: Enrollment["role"];
	},
) {
	return (
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		user?.role === "admin" ||
		user?.role === "content-manager"
	);
}

export function canSeeCourseGrades(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		id: number;
		userId: number;
		role?: Enrollment["role"];
	},
) {
	if (enrolment)
		return (
			enrolment.role === "teacher" ||
			enrolment.role === "manager" ||
			enrolment.role === "ta"
		);
	return user?.role === "admin" || user?.role === "content-manager";
}

export function canSeeCourseModules(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		id: number;
		userId: number;
		role?: Enrollment["role"];
	},
) {
	return (
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		user?.role === "admin" ||
		user?.role === "content-manager"
	);
}

export function canSeeCourseBin(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		role?: Enrollment["role"];
	},
) {
	return (
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		user?.role === "admin" ||
		user?.role === "content-manager"
	);
}

export function canSeeCourseBackup(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		role?: Enrollment["role"];
	},
) {
	return (
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		user?.role === "admin" ||
		user?.role === "content-manager"
	);
}

export function canUpdateCourseStructure(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		role?: Enrollment["role"];
	},
) {
	return (
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		user?.role === "admin" ||
		user?.role === "content-manager"
	);
}

export function canManageCourseGroups(
	user?: {
		id: number;
		role?: User["role"];
	},
	courseCreatorId?: number,
	enrolment?: {
		role?: Enrollment["role"];
	},
) {
	return (
		user?.role === "admin" ||
		user?.role === "content-manager" ||
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		(courseCreatorId !== undefined && user?.id === courseCreatorId)
	);
}

export function canAccessCourse(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolments?: {
		id: number;
		userId: number;
		role?: Enrollment["role"];
	}[],
) {
	return (
		user?.role === "admin" ||
		user?.role === "content-manager" ||
		enrolments?.some((enrolment) => enrolment.userId === user?.id)
	);
}

export function canSeeCourseSectionSettings(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		role?: Enrollment["role"];
	},
) {
	return (
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		user?.role === "admin" ||
		user?.role === "content-manager"
	);
}

export function canSeeCourseModuleSettings(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		role?: Enrollment["role"];
	},
) {
	return (
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		user?.role === "admin" ||
		user?.role === "content-manager"
	);
}

export function canEditUserModule(
	user?: {
		id: number;
		role?: User["role"];
	},
	moduleAccessType?: "owned" | "granted" | "readonly",
) {
	// Admin can always edit
	if (user?.role === "admin") return true;

	// Only owned or granted modules can be edited (not readonly)
	return moduleAccessType === "owned" || moduleAccessType === "granted";
}

export function canSeeModuleSubmissions(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		role?: Enrollment["role"];
	},
) {
	return (
		enrolment?.role === "teacher" ||
		enrolment?.role === "manager" ||
		enrolment?.role === "ta" ||
		user?.role === "admin" ||
		user?.role === "content-manager"
	);
}

export function canSubmitAssignment(enrolment?: { role?: Enrollment["role"] }) {
	return enrolment?.role === "student";
}

export function canDeleteSubmissions(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolment?: {
		role?: Enrollment["role"];
	},
) {
	return (
		user?.role === "admin" ||
		enrolment?.role === "manager" ||
		enrolment?.role === "teacher"
	);
}

export function canImpersonateUser(
	authenticatedUser?: {
		id: number;
		role?: User["role"];
	},
	targetUser?: {
		id: number;
		role?: User["role"];
	},
	isImpersonating?: boolean,
) {
	if (!authenticatedUser || !targetUser) return false;

	return (
		authenticatedUser.role === "admin" &&
		targetUser.id !== authenticatedUser.id &&
		targetUser.role !== "admin" &&
		!isImpersonating
	);
}

export function canEditCourse(
	user?: {
		id: number;
		role?: User["role"];
	},
	enrolments?: {
		userId: number;
		role?: Enrollment["role"];
	}[],
) {
	if (!user) return false;

	return (
		user.role === "admin" ||
		user.role === "content-manager" ||
		enrolments?.some(
			(enrollment) =>
				enrollment.userId === user.id &&
				(enrollment.role === "teacher" ||
					enrollment.role === "manager" ||
					enrollment.role === "ta"),
		)
	);
}

/**
 * Checks if the current user is editing another admin user's profile.
 * This is a helper function used by field-specific permission checks.
 *
 * Permission Rules:
 * - In sandbox mode: users can edit their own profile even if they're an admin
 * - Outside sandbox mode: admins cannot edit other admin users
 *
 * @param currentUser - The user attempting to edit (current logged-in user)
 * @param targetUser - The user whose profile is being edited
 * @param isSandboxMode - Whether sandbox mode is enabled
 * @returns Permission result with allowed boolean and reason string
 */
export function canEditOtherAdmin(
	currentUser?: {
		id: number;
		role?: User["role"];
	},
	targetUser?: {
		id: number;
		role?: User["role"];
	},
	isSandboxMode?: boolean,
): PermissionResult {
	if (!currentUser || !targetUser) {
		return {
			allowed: false,
			reason: "User information is missing",
		};
	}

	const isOwnData = currentUser.id === targetUser.id;
	const isAdmin = currentUser.role === "admin";
	const isTargetUserAdmin = targetUser.role === "admin";

	// In sandbox mode, allow editing own profile even if admin
	if (isSandboxMode && isOwnData) {
		return {
			allowed: false,
			reason: "In sandbox mode, you can edit your own profile",
		};
	}

	const isEditingOtherAdmin = isAdmin && !isOwnData && isTargetUserAdmin;
	return {
		allowed: isEditingOtherAdmin,
		reason: isEditingOtherAdmin
			? "Admins cannot edit other admin users"
			: "You can edit this profile",
	};
}

/**
 * Checks if the current user can edit another user's profile.
 * This is the base permission check for profile editing.
 *
 * Permission Rules:
 * - In sandbox mode: users can only edit their own profile
 * - Outside sandbox mode:
 *   - Users can always edit their own profile
 *   - Admins can edit other users, except other admins
 *
 * @param currentUser - The user attempting to edit (current logged-in user)
 * @param targetUser - The user whose profile is being edited
 * @param isSandboxMode - Whether sandbox mode is enabled
 * @returns Permission result with allowed boolean and reason string
 */
export function canEditUserProfile(
	currentUser?: {
		id: number;
		role?: User["role"];
	},
	targetUser?: {
		id: number;
		role?: User["role"];
	},
	isSandboxMode?: boolean,
): PermissionResult {
	if (!currentUser || !targetUser) {
		return {
			allowed: false,
			reason: "User information is missing",
		};
	}

	const isOwnData = currentUser.id === targetUser.id;

	// In sandbox mode, users can only edit their own profile
	if (isSandboxMode) {
		return {
			allowed: isOwnData,
			reason: isOwnData
				? "In sandbox mode, you can only edit your own profile"
				: "In sandbox mode, you can only edit your own profile",
		};
	}

	// Users can always edit their own profile
	if (isOwnData) {
		return {
			allowed: true,
			reason: "You can edit your own profile",
		};
	}

	// Admins can edit other users, except other admins
	if (currentUser.role === "admin" && targetUser.role !== "admin") {
		return {
			allowed: true,
			reason: "Admins can edit other users",
		};
	}

	return {
		allowed: false,
		reason: "You can only edit your own profile",
	};
}

/**
 * Checks if the current user can edit the email field of a target user.
 *
 * Permission Rules:
 * - Only admins can edit email addresses
 * - Admins cannot edit other admin users' emails
 * - In sandbox mode: users can edit their own email (treated as any profile field)
 *
 * @param currentUser - The user attempting to edit (current logged-in user)
 * @param targetUser - The user whose email is being edited
 * @param isSandboxMode - Whether sandbox mode is enabled
 * @returns Permission result with allowed boolean and reason string
 */
export function canEditProfileEmail(): PermissionResult {
	return {
		allowed: false,
		reason: "Email cannot be changed by users",
	};
}

/**
 * Checks if the current user can edit basic profile fields (firstName, lastName, bio, avatar).
 *
 * Permission Rules:
 * - In sandbox mode: users can only edit their own profile fields
 * - Outside sandbox mode:
 *   - Users can always edit their own profile fields
 *   - Admins can edit other users' profile fields, except other admins
 *
 * @param currentUser - The user attempting to edit (current logged-in user)
 * @param targetUser - The user whose profile fields are being edited
 * @param isSandboxMode - Whether sandbox mode is enabled
 * @returns Permission result with allowed boolean and reason string
 */
export function canEditProfileFields(
	currentUser?: {
		id: number;
		role?: User["role"];
	},
	targetUser?: {
		id: number;
		role?: User["role"];
	},
	isSandboxMode?: boolean,
): PermissionResult {
	// Reuse the base profile editing permission for basic fields
	return canEditUserProfile(currentUser, targetUser, isSandboxMode);
}

/**
 * Checks if the current user can edit the firstName field of a target user.
 * This is an alias for canEditProfileFields for consistency.
 */
export function canEditProfileFirstName(
	currentUser?: {
		id: number;
		role?: User["role"];
	},
	targetUser?: {
		id: number;
		role?: User["role"];
	},
	isSandboxMode?: boolean,
): PermissionResult {
	return canEditProfileFields(currentUser, targetUser, isSandboxMode);
}

/**
 * Checks if the current user can edit the lastName field of a target user.
 * This is an alias for canEditProfileFields for consistency.
 */
export function canEditProfileLastName(
	currentUser?: {
		id: number;
		role?: User["role"];
	},
	targetUser?: {
		id: number;
		role?: User["role"];
	},
	isSandboxMode?: boolean,
): PermissionResult {
	return canEditProfileFields(currentUser, targetUser, isSandboxMode);
}

/**
 * Checks if the current user can edit the bio field of a target user.
 * This is an alias for canEditProfileFields for consistency.
 */
export function canEditProfileBio(
	currentUser?: {
		id: number;
		role?: User["role"];
	},
	targetUser?: {
		id: number;
		role?: User["role"];
	},
	isSandboxMode?: boolean,
): PermissionResult {
	return canEditProfileFields(currentUser, targetUser, isSandboxMode);
}

/**
 * Checks if the current user can edit the avatar field of a target user.
 * This is an alias for canEditProfileFields for consistency.
 */
export function canEditProfileAvatar(
	currentUser?: {
		id: number;
		role?: User["role"];
	},
	targetUser?: {
		id: number;
		role?: User["role"];
	},
	isSandboxMode?: boolean,
): PermissionResult {
	return canEditProfileFields(currentUser, targetUser, isSandboxMode);
}

/**
 * Checks if the current user can edit the role field of a target user.
 *
 * Permission Rules:
 * - First user cannot change their admin role (immutable)
 * - In sandbox mode: users can edit their own role but not others
 * - Outside sandbox mode:
 *   - Only admins can edit roles
 *   - Admins cannot edit other admin users' roles
 *
 * @param currentUser - The user attempting to edit (current logged-in user)
 * @param targetUser - The user whose role is being edited
 * @param isSandboxMode - Whether sandbox mode is enabled
 * @returns Permission result with allowed boolean and reason string
 */
export function canEditProfileRole(
	currentUser?: {
		id: number;
		role?: User["role"];
	},
	targetUser?: {
		id: number;
		role?: User["role"];
	},
	isSandboxMode?: boolean,
): PermissionResult {
	if (!currentUser || !targetUser) {
		return {
			allowed: false,
			reason: "User information is missing",
		};
	}

	const isOwnData = currentUser.id === targetUser.id;

	// First user cannot change their admin role (immutable)
	if (targetUser.id === 1) {
		return {
			allowed: false,
			reason: "The first user cannot change their admin role",
		};
	}

	// In sandbox mode, users can edit their own role but not others
	if (isSandboxMode) {
		return {
			allowed: isOwnData,
			reason: isOwnData
				? "In sandbox mode, you can freely change your role"
				: "In sandbox mode, you can only edit your own profile",
		};
	}

	// Only admins can edit roles outside sandbox mode
	if (currentUser.role !== "admin") {
		return {
			allowed: false,
			reason: "System-wide role that determines user permissions",
		};
	}

	// Admins cannot edit other admin users' roles
	if (!isOwnData && targetUser.role === "admin") {
		return {
			allowed: false,
			reason: "Admins cannot edit other admin users",
		};
	}

	return {
		allowed: true,
		reason: "System-wide role that determines user permissions",
	};
}
