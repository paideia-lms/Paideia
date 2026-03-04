/**
 * Frontend types - backend-agnostic shapes for UI data.
 * Per workspace rules: "react router context should not import types from payload types.
 * It should create types for itself to provide type stability for the frontend."
 */

export interface Media {
	id: number;
	url?: string | null;
	filename?: string | null;
	alt?: string | null;
	caption?: string | null;
	thumbnailURL?: string | null;
	mimeType?: string | null;
	filesize?: number | null;
	width?: number | null;
	height?: number | null;
}

export type UserRole =
	| "admin"
	| "content-manager"
	| "analytics-viewer"
	| "instructor"
	| "student";

export interface User {
	id: number;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
	role?: UserRole | null;
	bio?: string | null;
	theme?: "light" | "dark";
	direction?: "ltr" | "rtl";
	avatar?: number | Media | null;
	updatedAt?: string;
	createdAt?: string;
}

export type CourseStatus = "draft" | "published" | "archived";

export interface Course {
	id: number;
	title: string;
	slug: string;
	description: string;
	status: CourseStatus;
	thumbnail?: number | Media | null;
	updatedAt?: string;
	createdAt?: string;
}

export type EnrollmentRole = "student" | "teacher" | "ta" | "manager";
export type EnrollmentStatus = "active" | "inactive" | "completed" | "dropped";

export interface Enrollment {
	id: number;
	user: number | User;
	course: number | Course;
	role: EnrollmentRole;
	status: EnrollmentStatus;
	enrolledAt?: string | null;
	completedAt?: string | null;
	updatedAt?: string;
	createdAt?: string;
}

export type ActivityModuleType =
	| "page"
	| "whiteboard"
	| "file"
	| "assignment"
	| "quiz"
	| "discussion";

export interface ActivityModule {
	id: number;
	title: string;
	description?: string | null;
	type: ActivityModuleType;
	owner: number | User;
	createdBy: number | User;
	updatedAt: string;
	createdAt: string;
}
