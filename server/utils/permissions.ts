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
	if (enrolment) return true;
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


export function canAccessCourse(user?: {
	id: number;
	role?: User["role"];
},
	enrolments?: {
		id: number;
		userId: number;
		role?: Enrollment["role"];
	}[]
) {
	return (
		user?.role === "admin" ||
		user?.role === "content-manager" ||
		enrolments?.some((enrolment) => enrolment.userId === user?.id)
	)
}