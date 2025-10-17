/** 
 * public permissions checks
 * we can use this functions in client side and server side
 */

import { Enrollment } from "server/contexts/course-context";
import type { User } from "server/payload-types";


/**
 * Check if user can create/edit activity modules
 */
export function canManageActivityModules(user?: {
	id: number;
	role: User['role'];
}): boolean {
	return (
		user?.role === "admin" ||
		user?.role === "instructor" ||
		user?.role === "content-manager"
	);
}


export function canSeeCourseSettings(user?: {
	id: number;
	role: User['role'];
}, enrolment?: {
	role: Enrollment['role'];
}) {
	return enrolment?.role === "teacher" || enrolment?.role === "manager" || user?.role === "admin" || user?.role === "content-manager";
}

export function canSeeCourseParticipants(user?: {
	id: number;
	role: User['role'];
}, enrolment?: {
	role: Enrollment['role']
}) {
	return enrolment?.role === "teacher" || enrolment?.role === "manager" || user?.role === "admin" || user?.role === "content-manager";
}

export function canSeeCourseGrades(user?: {
	id: number;
	role: User['role']
}, enrolment?: {
	role: Enrollment['role']
}) {
	if (enrolment) return true;
	return user?.role === "admin" || user?.role === "content-manager";
}

export function canSeeCourseModules(user?: {
	id: number;
	role: User['role'];
}, enrolment?: {
	role: Enrollment['role']
}) {
	return enrolment?.role === "teacher" || enrolment?.role === "manager" || user?.role === "admin" || user?.role === "content-manager";
}

export function canSeeCourseBin(user?: {
	id: number;
	role: User['role'];
}, enrolment?: {
	role: Enrollment['role'];
}) {
	return enrolment?.role === "teacher" || enrolment?.role === "manager" || user?.role === "admin" || user?.role === "content-manager";
}

export function canSeeCourseBackup(user?: {
	id: number;
	role: User['role'];
}, enrolment?: {
	role: Enrollment['role'];
}) {
	return enrolment?.role === "teacher" || enrolment?.role === "manager" || user?.role === "admin" || user?.role === "content-manager";
}

export function canUpdateCourseStructure(user?: {
	id: number;
	role?: User['role'];
}, enrolment?: {
	role: Enrollment['role'];
}) {
	return enrolment?.role === "teacher" || enrolment?.role === "manager" || user?.role === "admin" || user?.role === "content-manager";
}