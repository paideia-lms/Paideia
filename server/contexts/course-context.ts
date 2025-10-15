/**
 * course context:
 *
 * this context is available when user is in a course
 */

import type { Payload } from "payload";
import { createContext } from "react-router";
import { tryFindCourseById } from "server/internal/course-management";
import type { CourseStructure } from "server/utils/schema";
import type { User } from "./user-context";

/**
 * all the user enrollments, the name, id, email, role, status, enrolledAt, completedAt
 */
export type Enrollment = {
	name: string;
	id: number;
	email: string;
	role: "student" | "teacher" | "ta" | "manager";
	status: "active" | "inactive" | "completed" | "dropped";
	avatar: {
		id: number;
		filename?: string | null;
	} | null;
	enrolledAt?: string | null;
	completedAt?: string | null;
};

export interface Course {
	id: number;
	title: string;
	slug: string;
	description: string;
	status: "draft" | "published" | "archived";
	structure: CourseStructure;
	createdBy: {
		id: number;
		email: string;
		firstName?: string | null;
		lastName?: string | null;
		avatar: {
			id: number;
			filename?: string | null;
		} | null;
	};
	category?: number | null;
	updatedAt: string;
	createdAt: string;
	enrollments: Enrollment[];
}

export interface CourseContext {
	course: Course;
	courseId: number;
}

export const courseContext = createContext<CourseContext | null>(null);

export const courseContextKey =
	"courseContext" as unknown as typeof courseContext;

export const tryGetCourseContext = async (
	payload: Payload,
	courseId: number,
	user: User | null,
): Promise<CourseContext | null> => {
	const courseResult = await tryFindCourseById({
		payload,
		courseId: courseId,
		user: user
			? {
					...user,
					avatar: user.avatar?.id,
				}
			: null,
		// ! we cannot use overrideAccess true here
	});

	if (!courseResult.ok) {
		return null;
	}

	const course = courseResult.value;

	// Transform course data to match the Course interface
	const courseData: Course = {
		id: course.id,
		title: course.title,
		slug: course.slug,
		description: course.description,
		status: course.status,
		structure: course.structure,
		createdBy: {
			id: course.createdBy.id,
			email: course.createdBy.email,
			firstName: course.createdBy.firstName,
			lastName: course.createdBy.lastName,
			avatar:
				typeof course.createdBy.avatar === "object"
					? course.createdBy.avatar
					: null,
		},
		category:
			typeof course.category === "number"
				? course.category
				: course.category?.id || null,
		updatedAt: course.updatedAt,
		createdAt: course.createdAt,
		enrollments: course.enrollments.map(
			(e) =>
				({
					name: `${e.user.firstName} ${e.user.lastName}`.trim(),
					id: e.user.id,
					email: e.user.email,
					role: e.role,
					status: e.status,
					avatar: e.user.avatar ?? null,
					enrolledAt: e.enrolledAt,
					completedAt: e.completedAt,
				}) satisfies Enrollment,
		),
	};

	return {
		course: courseData,
		courseId: course.id,
	};
};
