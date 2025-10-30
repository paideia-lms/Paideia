/**
 * public permissions checks
 * we can use this functions in client side and server side
 */

import type { Enrollment } from "server/contexts/course-context";
import type { User } from "server/payload-types";

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
