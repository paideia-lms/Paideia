/**
 * course context:
 *
 * this context is available when user is in a course
 */

import { createContext } from "react-router";
import { tryFindLinksByCourse } from "server/internal/course-activity-module-link-management";
import { tryFindCourseById } from "server/internal/course-management";
import { tryGetCourseStructure } from "server/internal/course-section-management";
import {
	type GradebookSetupItemWithCalculations,
	tryGetGradebookAllRepresentations,
	tryGetGradebookByCourseWithDetails,
} from "server/internal/gradebook-management";
import { canAccessCourse, permissions } from "server/utils/permissions";
import { Result } from "typescript-result";
import {
	CourseAccessDeniedError,
	DevelopmentError,
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import {
	generateCourseStructureTree,
	generateSimpleCourseStructureTree,
} from "../utils/course-structure-tree";
import type { BaseInternalFunctionArgs } from "server/internal/utils/internal-function-utils";
export { courseContextKey } from "./utils/context-keys";

// interface Group {
// 	id: number;
// 	name: string;
// 	path: string;
// 	description?: string | null;
// 	color?: string | null;
// 	parent?: number | null;
// }

// /**
//  * all the user enrollments, the name, id, email, role, status, enrolledAt, completedAt
//  */
// export interface Enrollment {
// 	name: string;
// 	id: number;
// 	userId: number;
// 	email: string;
// 	role: "student" | "teacher" | "ta" | "manager";
// 	status: "active" | "inactive" | "completed" | "dropped";
// 	avatar:
// 		| number
// 		| {
// 				id: number;
// 				filename?: string | null;
// 		  }
// 		| null;
// 	enrolledAt?: string | null;
// 	completedAt?: string | null;
// 	groups: Group[];
// }

// interface Category {
// 	id: number;
// 	name: string;
// 	parent?: {
// 		id: number;
// 		name: string;
// 	} | null;
// }

// interface ActivityModule {
// 	id: number;
// 	title: string;
// 	description: string;
// 	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
// 	status: "draft" | "published" | "archived";
// 	createdBy: {
// 		id: number;
// 		email: string;
// 		firstName?: string | null;
// 		lastName?: string | null;
// 		avatar:
// 			| number
// 			| {
// 					id: number;
// 					filename?: string | null;
// 			  }
// 			| null;
// 	};
// 	updatedAt: string;
// 	createdAt: string;
// }

// interface CourseActivityModuleLink {
// 	id: number;
// 	activityModule: ActivityModule;
// 	settings?: {
// 		version: "v1";
// 		settings: {
// 			type: string;
// 			name?: string;
// 			[key: string]: unknown;
// 		};
// 	} | null;
// 	createdAt: string;
// 	updatedAt: string;
// }

// export interface GradebookData extends Omit<Gradebook, "categories" | "items"> {
// 	categories: GradebookCategory[];
// 	items: GradebookItem[];
// }

// export interface Course {
// 	id: number;
// 	title: string;
// 	slug: string;
// 	description: string;
// 	status: "draft" | "published" | "archived";
// 	createdBy: {
// 		id: number;
// 		email: string;
// 		firstName?: string | null;
// 		lastName?: string | null;
// 		avatar: {
// 			id: number;
// 			filename?: string | null;
// 		} | null;
// 	};
// 	category?: Category | null;
// 	thumbnail?:
// 		| number
// 		| {
// 				id: number;
// 				filename?: string | null;
// 		  }
// 		| null;
// 	updatedAt: string;
// 	createdAt: string;
// 	enrollments: Enrollment[];
// 	groups: Group[];
// 	moduleLinks: CourseActivityModuleLink[];
// }

export interface FlattenedCategory {
	id: number;
	name: string;
	parentId: number | null;
	depth: number;
	path: string; // Full path like "Parent > Child > Grandchild"
}

// export interface CourseContext {
// 	course: Course;
// 	courseId: number;
// 	courseStructure: CourseStructure;
// 	courseStructureTree: string;
// 	courseStructureTreeSimple: string;
// 	gradebook: GradebookData | null;
// 	gradebookJson: GradebookJsonRepresentation | null;
// 	gradebookYaml: string | null;
// 	gradebookMarkdown: string | null;
// 	gradebookSetupForUI: GradebookSetupForUI;
// 	flattenedCategories: FlattenedCategory[];
// }

export type CourseContext = NonNullable<
	Awaited<ReturnType<typeof tryGetCourseContext>>["value"]
>;
export const courseContext = createContext<CourseContext | null>(null);

export interface TryGetCourseContextArgs extends BaseInternalFunctionArgs {
	courseId: number;
}

// export const courseContextKey =
// 	"courseContext" as unknown as typeof courseContext;

export const tryGetCourseContext = Result.wrap(
	async ({ payload, req, courseId }: TryGetCourseContextArgs) => {
		const user = req?.user;
		if (Number.isNaN(courseId)) {
			throw new InvalidArgumentError("Course ID is required");
		}
		// Get course
		const course = await tryFindCourseById({
			payload,
			courseId,
			req,
		}).getOrThrow();

		// Check if user exists
		if (!user) {
			throw new CourseAccessDeniedError(
				"User must be authenticated to access course",
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
			throw new CourseAccessDeniedError(
				`User ${user.id} does not have access to course ${courseId}`,
			);
		}

		// Fetch existing course-activity-module links and populate moduleLinks
		const linksResult = await tryFindLinksByCourse({
			payload,
			courseId,
			req,
		});
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
					settings: link.settings,
					createdAt: link.createdAt,
					updatedAt: link.updatedAt,
				}))
			: [];

		// Update course with moduleLinks
		const courseWithModuleLinks = {
			...course,
			moduleLinks,
		};

		// Fetch course structure
		const [courseStructure, gradebook, allReps] = await Promise.all([
			tryGetCourseStructure({
				payload,
				courseId: course.id,
				req,
				overrideAccess: false,
			}).then((r) => r.getOrThrow()),
			tryGetGradebookByCourseWithDetails({
				payload,
				courseId,
				req,
			}).then((r) => r.getOrThrow()),
			tryGetGradebookAllRepresentations({
				payload,
				courseId,
				req,
				overrideAccess: false,
			}).then((r) => r.getOrThrow()),
		]);
		const courseStructureTree = generateCourseStructureTree(
			courseStructure,
			course.title,
		);
		const courseStructureTreeSimple = generateSimpleCourseStructureTree(
			courseStructure,
			course.title,
		);

		// Flatten categories from gradebook setup
		const flattenedCategoriesData = flattenGradebookCategories(
			allReps.ui.gradebook_setup.items,
		);

		const enrolment = courseWithModuleLinks.enrollments.find(
			(enrolment) => enrolment.user.id === user.id,
		);

		return {
			enrolment,
			course: courseWithModuleLinks,
			courseId: course.id,
			courseStructure,
			courseStructureTree,
			courseStructureTreeSimple,
			gradebook,
			gradebookJson: allReps.json,
			gradebookYaml: allReps.yaml,
			gradebookMarkdown: allReps.markdown,
			gradebookSetupForUI: allReps.ui,
			flattenedCategories: flattenedCategoriesData,
			permissions: {
				canSeeSettings: permissions.course.canSeeSettings(user, enrolment),
				canEdit: permissions.course.canEdit(
					user,
					courseWithModuleLinks.enrollments.map((e) => ({
						userId: e.user.id,
						role: e.role,
					})),
				),
			},
		};
	},
	(error) => {
		return (
			transformError(error) ??
			new UnknownError("Failed to get course context", {
				cause: error,
			})
		);
	},
);

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
