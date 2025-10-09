import type { Payload } from "payload";
import type { CategoryRole } from "server/internal/category-role-management";
import { tryCheckUserCourseAccessViaCategory } from "server/internal/category-role-management";

export type CourseRole = "student" | "teacher" | "ta" | "manager";
export type AccessSource = "enrollment" | "category" | "global-admin" | null;

export interface CourseAccessResult {
	hasAccess: boolean;
	role: CourseRole | CategoryRole | null;
	source: AccessSource;
}

/**
 * Checks if a user has access to a course and returns their effective role
 *
 * Access resolution order:
 * 1. Check if user is global admin → grant manager-level access
 * 2. Check direct course enrollment → use enrollment role
 * 3. Check category role on course's category → use category role
 * 4. Check category role on ancestor categories → use highest priority role
 * 5. No access found → deny access
 */
export async function checkUserCourseAccess(
	payload: Payload,
	userId: number,
	courseId: number,
): Promise<CourseAccessResult> {
	// 1. Check if user is global admin
	try {
		const user = await payload.findByID({
			collection: "users",
			id: userId,
			depth: 0,
		});

		if (user.role === "admin") {
			return {
				hasAccess: true,
				role: "manager",
				source: "global-admin",
			};
		}
	} catch {
		// User not found, continue to other checks
	}

	// 2. Check direct enrollment
	const enrollment = await payload.find({
		collection: "enrollments",
		where: {
			and: [
				{ user: { equals: userId } },
				{ course: { equals: courseId } },
				{ status: { equals: "active" } },
			],
		},
		depth: 0,
	});

	if (enrollment.docs.length > 0) {
		return {
			hasAccess: true,
			role: enrollment.docs[0].role as CourseRole,
			source: "enrollment",
		};
	}

	// 3. Check category-based access
	const categoryAccessResult = await tryCheckUserCourseAccessViaCategory(
		payload,
		userId,
		courseId,
	);

	if (categoryAccessResult.ok && categoryAccessResult.value) {
		return {
			hasAccess: true,
			role: categoryAccessResult.value,
			source: "category",
		};
	}

	return {
		hasAccess: false,
		role: null,
		source: null,
	};
}

/**
 * Check if user has at least a specific role level on a course
 *
 * Role hierarchy:
 * - category-admin / manager > category-coordinator / teacher > category-reviewer / ta > student
 */
export function hasMinimumRole(
	userRole: CourseRole | CategoryRole,
	requiredRole: CourseRole | CategoryRole,
): boolean {
	const rolePriority: Record<CourseRole | CategoryRole, number> = {
		"category-admin": 6,
		manager: 6,
		"category-coordinator": 5,
		teacher: 5,
		"category-reviewer": 4,
		ta: 3,
		student: 1,
	};

	const userPriority = rolePriority[userRole] || 0;
	const requiredPriority = rolePriority[requiredRole] || 0;

	return userPriority >= requiredPriority;
}
