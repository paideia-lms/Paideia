import {
	CategoryRoleAssignments,
	CourseCategories,
	Courses,
} from "server/payload.config";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { CategoryRoleAssignment } from "../payload-types";
import {
	commitTransactionIfCreated,
	handleTransactionId,
	rollbackTransactionIfCreated,
} from "./utils/handle-transaction-id";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export type CategoryRole =
	| "category-admin"
	| "category-coordinator"
	| "category-reviewer";

export type AssignCategoryRoleArgs = BaseInternalFunctionArgs & {
	userId: number;
	categoryId: number;
	role: CategoryRole;
	assignedBy: number;
	notes?: string;
};

export type RevokeCategoryRoleArgs = BaseInternalFunctionArgs & {
	userId: number;
	categoryId: number;
};

export type UpdateCategoryRoleArgs = BaseInternalFunctionArgs & {
	assignmentId: number;
	newRole: CategoryRole;
};

export type GetUserCategoryRolesArgs = BaseInternalFunctionArgs & {
	userId: number;
};

export type GetCategoryRoleAssignmentsArgs = BaseInternalFunctionArgs & {
	categoryId: number;
};

export type FindCategoryRoleAssignmentArgs = BaseInternalFunctionArgs & {
	userId: number;
	categoryId: number;
};

export type CheckUserCategoryRoleArgs = BaseInternalFunctionArgs & {
	userId: number;
	categoryId: number;
	requiredRole?: CategoryRole;
};

export type GetEffectiveCategoryRoleArgs = BaseInternalFunctionArgs & {
	userId: number;
	categoryId: number;
};

export type GetUserCoursesFromCategoriesArgs = BaseInternalFunctionArgs & {
	userId: number;
};

export type CheckUserCourseAccessViaCategoryArgs = BaseInternalFunctionArgs & {
	userId: number;
	courseId: number;
};

export interface CategoryRoleInfo {
	id: number;
	userId: number;
	categoryId: number;
	role: CategoryRole;
	assignedBy: number;
	assignedAt: string;
	notes?: string;
}

export interface CourseAccessInfo {
	courseId: number;
	categoryRole: CategoryRole;
	categoryId: number;
}

/**
 * Assigns a category role to a user
 */
export const tryAssignCategoryRole = Result.wrap(
	async (args: AssignCategoryRoleArgs) => {
		const { payload, userId, categoryId, role, assignedBy, notes, req } = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		if (!role) {
			throw new InvalidArgumentError("Role is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Verify user exists
			await payload.findByID({
				collection: "users",
				id: userId,
				req: transactionInfo.reqWithTransaction,
			});

			// Verify category exists
			await payload.findByID({
				collection: CourseCategories.slug,
				id: categoryId,
				req: transactionInfo.reqWithTransaction,
			});

			// Check if assignment already exists
			const existing = await payload.find({
				collection: CategoryRoleAssignments.slug,
				where: {
					and: [
						{ user: { equals: userId } },
						{ category: { equals: categoryId } },
					],
				},
				req: transactionInfo.reqWithTransaction,
			});

			let assignment: CategoryRoleAssignment;

			if (existing.docs.length > 0) {
				// Update existing assignment
				assignment = (await payload.update({
					collection: CategoryRoleAssignments.slug,
					id: existing.docs[0]!.id,
					data: {
						role,
						assignedBy,
						assignedAt: new Date().toISOString(),
						notes,
					},
					req: transactionInfo.reqWithTransaction,
				})) as CategoryRoleAssignment;
			} else {
				// Create new assignment
				assignment = (await payload.create({
					collection: CategoryRoleAssignments.slug,
					data: {
						user: userId,
						category: categoryId,
						role,
						assignedBy,
						assignedAt: new Date().toISOString(),
						notes,
					},
					req: transactionInfo.reqWithTransaction,
				})) as CategoryRoleAssignment;
			}

			await commitTransactionIfCreated(payload, transactionInfo);

			return assignment;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to assign category role", { cause: error }),
);

/**
 * Revokes a category role from a user
 */
export const tryRevokeCategoryRole = Result.wrap(
	async (args: RevokeCategoryRoleArgs) => {
		const { payload, userId, categoryId, req } = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			// Find the assignment
			const assignments = await payload.find({
				collection: CategoryRoleAssignments.slug,
				where: {
					and: [
						{ user: { equals: userId } },
						{ category: { equals: categoryId } },
					],
				},
				req: transactionInfo.reqWithTransaction,
			});

			if (assignments.docs.length === 0) {
				throw new InvalidArgumentError(
					"No role assignment found for this user and category",
				);
			}

			const deleted = await payload.delete({
				collection: CategoryRoleAssignments.slug,
				id: assignments.docs[0]!.id,
				req: transactionInfo.reqWithTransaction,
			});

			await commitTransactionIfCreated(payload, transactionInfo);

			return deleted;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to revoke category role", { cause: error }),
);

/**
 * Updates an existing category role assignment
 */
export const tryUpdateCategoryRole = Result.wrap(
	async (args: UpdateCategoryRoleArgs) => {
		const { payload, assignmentId, newRole, req } = args;

		if (!assignmentId) {
			throw new InvalidArgumentError("Assignment ID is required");
		}

		if (!newRole) {
			throw new InvalidArgumentError("New role is required");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		try {
			const updated = (await payload.update({
				collection: CategoryRoleAssignments.slug,
				id: assignmentId,
				data: {
					role: newRole,
				},
				req: transactionInfo.reqWithTransaction,
			})) as CategoryRoleAssignment;

			await commitTransactionIfCreated(payload, transactionInfo);

			return updated;
		} catch (error) {
			await rollbackTransactionIfCreated(payload, transactionInfo);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update category role", { cause: error }),
);

/**
 * Gets all category role assignments for a user
 */
export const tryGetUserCategoryRoles = Result.wrap(
	async (args: GetUserCategoryRolesArgs) => {
		const { payload, userId, user, req, overrideAccess = false } = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		const assignments = await payload.find({
			collection: CategoryRoleAssignments.slug,
			where: {
				user: { equals: userId },
			},
			depth: 1,
			pagination: false,
			req,
			overrideAccess,
		});

		return assignments.docs as CategoryRoleAssignment[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user category roles", { cause: error }),
);

/**
 * Gets all role assignments for a category
 */
export const tryGetCategoryRoleAssignments = Result.wrap(
	async (args: GetCategoryRoleAssignmentsArgs) => {
		const { payload, categoryId, user, req, overrideAccess = false } = args;

		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const assignments = await payload.find({
			collection: CategoryRoleAssignments.slug,
			where: {
				category: { equals: categoryId },
			},
			depth: 1,
			pagination: false,
			req,
			overrideAccess,
		});

		return assignments.docs as CategoryRoleAssignment[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get category role assignments", {
			cause: error,
		}),
);

/**
 * Finds a specific category role assignment
 */
export const tryFindCategoryRoleAssignment = Result.wrap(
	async (args: FindCategoryRoleAssignmentArgs) => {
		const { payload, userId, categoryId, req, overrideAccess = false } = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const assignments = await payload.find({
			collection: CategoryRoleAssignments.slug,
			where: {
				and: [
					{ user: { equals: userId } },
					{ category: { equals: categoryId } },
				],
			},
			depth: 1,
			req,
			overrideAccess,
		});

		return assignments.docs.length > 0
			? (assignments.docs[0] as CategoryRoleAssignment)
			: null;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find category role assignment", {
			cause: error,
		}),
);

/**
 * Checks if user has a specific role on a category
 */
export const tryCheckUserCategoryRole = Result.wrap(
	async (args: CheckUserCategoryRoleArgs) => {
		const {
			payload,
			userId,
			categoryId,
			requiredRole,
			req,
			overrideAccess = false,
		} = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const assignment = await tryFindCategoryRoleAssignment({
			payload,
			userId,
			categoryId,
			req,
			overrideAccess,
		});

		if (!assignment.ok || !assignment.value) {
			return null;
		}

		const role = assignment.value.role as CategoryRole;

		if (requiredRole && role !== requiredRole) {
			return null;
		}

		return role;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to check user category role", { cause: error }),
);

/**
 * Gets effective role by checking category and all ancestors
 * Returns the highest priority role found
 */
export const tryGetEffectiveCategoryRole = Result.wrap(
	async (args: GetEffectiveCategoryRoleArgs) => {
		const { payload, userId, categoryId, req, overrideAccess = false } = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!categoryId) {
			throw new InvalidArgumentError("Category ID is required");
		}

		const rolePriority: Record<CategoryRole, number> = {
			"category-admin": 3,
			"category-coordinator": 2,
			"category-reviewer": 1,
		};

		let currentCategoryId: number | null = categoryId;
		let highestRole: CategoryRole | null = null;
		let highestPriority = 0;

		// Traverse up the category hierarchy
		while (currentCategoryId !== null) {
			// Check for role assignment at current level
			const assignments = await payload.find({
				collection: CategoryRoleAssignments.slug,
				where: {
					and: [
						{ user: { equals: userId } },
						{ category: { equals: currentCategoryId } },
					],
				},
				user,
				req,
				overrideAccess,
			});

			if (assignments.docs.length > 0) {
				const role = assignments.docs[0]!.role as CategoryRole;
				const priority = rolePriority[role] || 0;

				if (priority > highestPriority) {
					highestRole = role;
					highestPriority = priority;
				}
			}

			// Move to parent category
			const category: any = await payload.findByID({
				collection: CourseCategories.slug,
				id: currentCategoryId,
				depth: 0,
				user,
				req,
				overrideAccess,
			});

			currentCategoryId =
				typeof category.parent === "number"
					? category.parent
					: (category.parent?.id ?? null);
		}

		return highestRole;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get effective category role", { cause: error }),
);

/**
 * Gets all courses a user has access to via category roles
 */
export const tryGetUserCoursesFromCategories = Result.wrap(
	async (args: GetUserCoursesFromCategoriesArgs) => {
		const { payload, userId, user, req, overrideAccess = false } = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Get all categories where user has roles
		const userRoles = await payload.find({
			collection: CategoryRoleAssignments.slug,
			where: {
				user: { equals: userId },
			},
			pagination: false,
			req,
			overrideAccess,
		});

		const coursesMap = new Map<number, CourseAccessInfo>();

		// For each category role, get all descendant courses
		for (const roleAssignment of userRoles.docs) {
			const categoryId =
				typeof roleAssignment.category === "number"
					? roleAssignment.category
					: roleAssignment.category.id;

			const courseIds = await getAllDescendantCourses({
				payload,
				categoryId,
				user,
				req,
				overrideAccess,
			});

			for (const courseId of courseIds) {
				if (!coursesMap.has(courseId)) {
					coursesMap.set(courseId, {
						courseId,
						categoryRole: roleAssignment.role as CategoryRole,
						categoryId,
					});
				}
			}
		}

		return Array.from(coursesMap.values());
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user courses from categories", {
			cause: error,
		}),
);

/**
 * Checks if user has access to a course via category role
 */
export const tryCheckUserCourseAccessViaCategory = Result.wrap(
	async (args: CheckUserCourseAccessViaCategoryArgs) => {
		const { payload, userId, courseId, req, overrideAccess = false } = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!courseId) {
			throw new InvalidArgumentError("Course ID is required");
		}

		// Get the course's category
		const course = await payload.findByID({
			collection: Courses.slug,
			id: courseId,
			depth: 0,
			req,
			overrideAccess,
		});

		if (!course.category) {
			return null;
		}

		const courseCategoryId =
			typeof course.category === "number"
				? course.category
				: course.category.id;

		// Check if user has role on this category or any ancestor
		const effectiveRole = await tryGetEffectiveCategoryRole({
			payload,
			userId,
			categoryId: courseCategoryId,
			req,
			overrideAccess,
		});

		if (!effectiveRole.ok) {
			return null;
		}

		return effectiveRole.value;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to check user course access via category", {
			cause: error,
		}),
);

type GetAllDescendantCoursesArgs = BaseInternalFunctionArgs & {
	categoryId: number;
};

/**
 * Helper: Get all descendant courses of a category (recursive)
 */
async function getAllDescendantCourses(
	args: GetAllDescendantCoursesArgs,
): Promise<number[]> {
	const { payload, categoryId, user, req, overrideAccess = false } = args;
	const courseIds: number[] = [];

	// Get direct courses
	const directCourses = await payload.find({
		collection: Courses.slug,
		where: { category: { equals: categoryId } },
		pagination: false,
		depth: 0,
		user,
		req,
		overrideAccess,
	});
	courseIds.push(...directCourses.docs.map((c) => c.id));

	// Get subcategories and recurse
	const subcategories = await payload.find({
		collection: CourseCategories.slug,
		where: { parent: { equals: categoryId } },
		pagination: false,
		depth: 0,
		user,
		req,
		overrideAccess,
	});

	for (const subcat of subcategories.docs) {
		const nestedCourses = await getAllDescendantCourses({
			payload,
			categoryId: subcat.id,
			req,
			overrideAccess,
		});
		courseIds.push(...nestedCourses);
	}

	return courseIds;
}
