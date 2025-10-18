/**
 * course context:
 *
 * this context is available when user is in a course
 */

import type { Payload } from "payload";
import { createContext } from "react-router";
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import { tryFindLinksByCourse } from "server/internal/course-activity-module-link-management";
import { tryFindCourseById } from "server/internal/course-management";
import type { CourseStructure } from "server/internal/course-section-management";
import { tryGetCourseStructure } from "server/internal/course-section-management";
import { Result } from "typescript-result";
import {
	CourseAccessDeniedError,
	CourseStructureNotFoundError,
} from "~/utils/error";
import {
	generateCourseStructureTree,
	generateSimpleCourseStructureTree,
} from "../utils/course-structure-tree";
import type { User } from "./user-context";

type Group = {
	id: number;
	name: string;
	path: string;
	description?: string | null;
	color?: string | null;
	parent?: number | null;
};

/**
 * all the user enrollments, the name, id, email, role, status, enrolledAt, completedAt
 */
export type Enrollment = {
	name: string;
	id: number;
	userId: number;
	email: string;
	role: "student" | "teacher" | "ta" | "manager";
	status: "active" | "inactive" | "completed" | "dropped";
	avatar:
		| number
		| {
				id: number;
				filename?: string | null;
		  }
		| null;
	enrolledAt?: string | null;
	completedAt?: string | null;
	groups: Group[];
};

type Category = {
	id: number;
	name: string;
	parent?: {
		id: number;
		name: string;
	} | null;
};

type ActivityModule = {
	id: number;
	title: string;
	description: string;
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status: "draft" | "published" | "archived";
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
	updatedAt: string;
	createdAt: string;
};

type CourseActivityModuleLink = {
	id: number;
	activityModule: ActivityModule;
	createdAt: string;
	updatedAt: string;
};

export interface Course {
	id: number;
	title: string;
	slug: string;
	description: string;
	status: "draft" | "published" | "archived";
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
	category?: Category | null;
	updatedAt: string;
	createdAt: string;
	enrollments: Enrollment[];
	groups: Group[];
	moduleLinks: CourseActivityModuleLink[];
}

export interface CourseContext {
	course: Course;
	courseId: number;
	currentUser: {
		id: number;
		role:
			| "admin"
			| "content-manager"
			| "instructor"
			| "student"
			| "analytics-viewer";
	};
	availableModules: Array<{
		id: number;
		title: string;
		type: string;
		status: string;
		description: string;
	}>;
	courseStructure: CourseStructure;
	courseStructureTree: string;
	courseStructureTreeSimple: string;
}

export const courseContext = createContext<CourseContext | null>(null);

export const courseContextKey =
	"courseContext" as unknown as typeof courseContext;

export const tryGetCourseContext = async (
	payload: Payload,
	courseId: number,
	user: User | null,
) => {
	// Get course
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
		return Result.error(courseResult.error);
	}

	const course = courseResult.value;

	// Check if user exists
	if (!user) {
		return Result.error(
			new CourseAccessDeniedError(
				"User must be authenticated to access course",
			),
		);
	}

	// Check access
	const hasAccess =
		user.role === "admin" ||
		user.role === "content-manager" ||
		course.enrollments.some((enrollment) => enrollment.user.id === user.id);

	if (!hasAccess) {
		return Result.error(
			new CourseAccessDeniedError(
				`User ${user.id} does not have access to course ${courseId}`,
			),
		);
	}

	// Transform course data to match the Course interface
	const courseData: Course = {
		id: course.id,
		title: course.title,
		slug: course.slug,
		description: course.description,
		status: course.status,
		createdBy: {
			id: course.createdBy.id,
			email: course.createdBy.email,
			firstName: course.createdBy.firstName,
			lastName: course.createdBy.lastName,
			avatar: course.createdBy.avatar
				? {
						id: course.createdBy.avatar.id,
						filename: course.createdBy.avatar.filename,
					}
				: null,
		},
		category: course.category
			? {
					id: course.category.id,
					name: course.category.name,
					parent: course.category.parent
						? {
								id: course.category.parent.id,
								name: course.category.parent.name,
							}
						: null,
				}
			: null,
		updatedAt: course.updatedAt,
		createdAt: course.createdAt,
		groups: course.groups.map((g) => ({
			id: g.id,
			name: g.name,
			path: g.path,
			description: g.description,
			color: g.color,
			parent: g.parent?.id,
		})),
		enrollments: course.enrollments.map(
			(e) =>
				({
					name: `${e.user.firstName} ${e.user.lastName}`.trim(),
					id: e.id,
					userId: e.user.id,
					email: e.user.email,
					role: e.role,
					status: e.status,
					avatar: e.user.avatar ?? null,
					enrolledAt: e.enrolledAt,
					completedAt: e.completedAt,
					groups: e.groups.map((g) => ({
						id: g.id,
						name: g.name,
						path: g.path,
						description: g.description,
						color: g.color,
						parent: g.parent,
					})),
				}) satisfies Enrollment,
		),
		moduleLinks: [],
	};

	// console.log("courseData", courseData);

	// Fetch existing course-activity-module links and populate moduleLinks
	const linksResult = await tryFindLinksByCourse(payload, courseId);
	const moduleLinks = linksResult.ok
		? linksResult.value.map((link) => ({
				id: link.id,
				activityModule: {
					id: link.activityModule.id,
					title: link.activityModule.title || "",
					description: link.activityModule.description || "",
					type: link.activityModule.type as
						| "page"
						| "whiteboard"
						| "assignment"
						| "quiz"
						| "discussion",
					status: link.activityModule.status as
						| "draft"
						| "published"
						| "archived",
					createdBy: {
						id: link.activityModule.createdBy.id,
						email: link.activityModule.createdBy.email,
						firstName: link.activityModule.createdBy.firstName,
						lastName: link.activityModule.createdBy.lastName,
						avatar: link.activityModule.createdBy.avatar
							? {
									id: link.activityModule.createdBy.avatar.id,
									filename: link.activityModule.createdBy.avatar.filename,
								}
							: null,
					},
					updatedAt: link.activityModule.updatedAt,
					createdAt: link.activityModule.createdAt,
				},
				createdAt: link.createdAt,
				updatedAt: link.updatedAt,
			}))
		: [];

	// Update course with moduleLinks
	const courseWithModuleLinks = {
		...courseData,
		moduleLinks,
	};

	// Fetch available activity modules the user can access
	const modulesResult = await tryGetUserActivityModules(payload, {
		userId: user.id,
	});
	const availableModules = modulesResult.ok
		? modulesResult.value.modulesOwnedOrGranted
		: [];

	// Fetch course structure
	const courseStructureResult = await tryGetCourseStructure({
		payload,
		courseId: course.id,
		user: {
			...user,
			avatar: user.avatar?.id,
		},
		overrideAccess: false,
	});

	if (!courseStructureResult.ok) {
		return Result.error(
			new CourseStructureNotFoundError(
				`Failed to get course structure for course ${courseId}: ${courseStructureResult.error.message}`,
				{ cause: courseStructureResult.error },
			),
		);
	}

	const courseStructure = courseStructureResult.value;

	// Generate tree representations
	const courseStructureTree = generateCourseStructureTree(
		courseStructure,
		course.title,
	);
	const courseStructureTreeSimple = generateSimpleCourseStructureTree(
		courseStructure,
		course.title,
	);

	return Result.ok({
		course: courseWithModuleLinks,
		courseId: course.id,
		currentUser: {
			id: user.id,
			role: user.role ?? "student",
		},
		availableModules: availableModules.map((module) => ({
			id: module.id,
			title: module.title,
			type: module.type,
			status: module.status,
			description: module.description || "",
		})),
		courseStructure,
		courseStructureTree,
		courseStructureTreeSimple,
	});
};
