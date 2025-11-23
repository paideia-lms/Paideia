/**
 * course context:
 *
 * this context is available when user is in a course
 */

import type { Payload, PayloadRequest, TypedUser } from "payload";
import { createContext } from "react-router";
import { tryFindLinksByCourse } from "server/internal/course-activity-module-link-management";
import { tryFindCourseById } from "server/internal/course-management";
import type { CourseStructure } from "server/internal/course-section-management";
import { tryGetCourseStructure } from "server/internal/course-section-management";
import {
	type GradebookJsonRepresentation,
	type GradebookSetupForUI,
	type GradebookSetupItemWithCalculations,
	tryGetGradebookAllRepresentations,
	tryGetGradebookByCourseWithDetails,
} from "server/internal/gradebook-management";
import { canAccessCourse } from "server/utils/permissions";
import { Result } from "typescript-result";
import {
	CourseAccessDeniedError,
	CourseStructureNotFoundError,
	UnknownError,
} from "~/utils/error";
import type {
	Gradebook,
	GradebookCategory,
	GradebookItem,
} from "../payload-types";
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
		avatar:
		| number
		| {
			id: number;
			filename?: string | null;
		}
		| null;
	};
	updatedAt: string;
	createdAt: string;
};

type CourseActivityModuleLink = {
	id: number;
	activityModule: ActivityModule;
	settings?: {
		version: "v1";
		settings: {
			type: string;
			name?: string;
			[key: string]: unknown;
		};
	} | null;
	createdAt: string;
	updatedAt: string;
};

export type GradebookData = Gradebook & {
	categories: GradebookCategory[];
	items: GradebookItem[];
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
	thumbnail?:
	| number
	| {
		id: number;
		filename?: string | null;
	}
	| null;
	updatedAt: string;
	createdAt: string;
	enrollments: Enrollment[];
	groups: Group[];
	moduleLinks: CourseActivityModuleLink[];
}

export type FlattenedCategory = {
	id: number;
	name: string;
	parentId: number | null;
	depth: number;
	path: string; // Full path like "Parent > Child > Grandchild"
};

export interface CourseContext {
	course: Course;
	courseId: number;
	courseStructure: CourseStructure;
	courseStructureTree: string;
	courseStructureTreeSimple: string;
	gradebook: GradebookData | null;
	gradebookJson: GradebookJsonRepresentation | null;
	gradebookYaml: string | null;
	gradebookMarkdown: string | null;
	gradebookSetupForUI: GradebookSetupForUI;
	flattenedCategories: FlattenedCategory[];
}

export const courseContext = createContext<CourseContext | null>(null);

export const courseContextKey =
	"courseContext" as unknown as typeof courseContext;

export const tryGetCourseContext = async (
	payload: Payload,
	courseId: number,
	user?: TypedUser | null,
	req?: Partial<PayloadRequest>,
) => {
	// Get course
	const courseResult = await tryFindCourseById({
		payload,
		courseId: courseId,
		user: user,
		req,
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
	const hasAccess = canAccessCourse(
		{
			id: user.id,
			role: user.role ?? "student",
		},
		course.enrollments.map((enrollment) => ({
			id: enrollment.id,
			userId: enrollment.user.id,
			role: enrollment.role,
		})),
	).allowed;

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
		thumbnail: course.thumbnail
			? typeof course.thumbnail === "object"
				? {
					id: course.thumbnail.id,
					filename: course.thumbnail.filename,
				}
				: course.thumbnail
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
	const linksResult = await tryFindLinksByCourse({ payload, courseId });
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
					avatar: link.activityModule.createdBy.avatar ?? null,
				},
				updatedAt: link.activityModule.updatedAt,
				createdAt: link.activityModule.createdAt,
			},
			settings: link.settings as CourseActivityModuleLink["settings"],
			createdAt: link.createdAt,
			updatedAt: link.updatedAt,
		}))
		: [];

	// Update course with moduleLinks
	const courseWithModuleLinks = {
		...courseData,
		moduleLinks,
	};

	// Fetch course structure
	const courseStructureResult = await tryGetCourseStructure({
		payload,
		courseId: course.id,
		user: user,
		req,
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

	// Fetch gradebook data
	const gradebookResult = await tryGetGradebookByCourseWithDetails({
		payload,
		courseId,
		user: user,
		req,
		overrideAccess: false,
	});

	let gradebookData: GradebookData | null = null;
	let gradebookJsonData: GradebookJsonRepresentation | null = null;
	let gradebookYamlData: string | null = null;
	let gradebookMarkdownData: string | null = null;
	let gradebookSetupForUIData: GradebookSetupForUI | null = null;
	let flattenedCategoriesData: FlattenedCategory[] = [];

	if (gradebookResult.ok) {
		const gradebook = gradebookResult.value;
		gradebookData = gradebook as GradebookData;

		// Fetch all gradebook representations in a single call (more efficient)
		const allRepresentationsResult = await tryGetGradebookAllRepresentations({
			payload,
			courseId,
			user: user,
			req,
			overrideAccess: false,
		});

		if (allRepresentationsResult.ok) {
			const allReps = allRepresentationsResult.value;
			gradebookJsonData = allReps.json;
			gradebookYamlData = allReps.yaml;
			gradebookMarkdownData = allReps.markdown;
			gradebookSetupForUIData = allReps.ui;

			// Flatten categories from gradebook setup
			flattenedCategoriesData = flattenGradebookCategories(
				gradebookSetupForUIData.gradebook_setup.items,
			);
		}
	}

	if (!gradebookSetupForUIData) {
		return Result.error(
			new UnknownError("Failed to get gradebook setup for UI"),
		);
	}

	return Result.ok({
		course: courseWithModuleLinks,
		courseId: course.id,
		courseStructure,
		courseStructureTree,
		courseStructureTreeSimple,
		gradebook: gradebookData,
		gradebookJson: gradebookJsonData,
		gradebookYaml: gradebookYamlData,
		gradebookMarkdown: gradebookMarkdownData,
		gradebookSetupForUI: gradebookSetupForUIData,
		flattenedCategories: flattenedCategoriesData,
	});
};

/**
 * Flattens the gradebook category structure recursively to get all categories
 * including nested ones, with their hierarchy information
 */
function flattenGradebookCategories(
	items: GradebookSetupItemWithCalculations[],
	parentId: number | null = null,
	depth: number = 0,
	parentPath: string = "",
): FlattenedCategory[] {
	const result: FlattenedCategory[] = [];

	for (const item of items) {
		if (item.type === "category") {
			const currentPath = parentPath
				? `${parentPath} > ${item.name}`
				: item.name;

			result.push({
				id: item.id,
				name: item.name,
				parentId,
				depth,
				path: currentPath,
			});

			// Recursively process nested categories
			if (item.grade_items) {
				const nestedCategories = flattenGradebookCategories(
					item.grade_items,
					item.id,
					depth + 1,
					currentPath,
				);
				result.push(...nestedCategories);
			}
		}
	}

	return result;
}
