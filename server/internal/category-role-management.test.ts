import { beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	tryAssignCategoryRole,
	tryCheckUserCategoryRole,
	tryCheckUserCourseAccessViaCategory,
	tryFindCategoryRoleAssignment,
	tryGetCategoryRoleAssignments,
	tryGetEffectiveCategoryRole,
	tryGetUserCategoryRoles,
	tryGetUserCoursesFromCategories,
	tryRevokeCategoryRole,
	tryUpdateCategoryRole,
} from "./category-role-management";
import { tryCreateCategory } from "./course-category-management";
import { tryCreateCourse } from "./course-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Category Role Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let adminUser: { id: number };
	let user1: { id: number };
	let user2: { id: number };
	let user3: { id: number };

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		mockRequest = new Request("http://localhost:3000/test");

		// Create test users
		const adminArgs: CreateUserArgs = {
			payload,
			data: {
				email: "admin@example.com",
				password: "testpassword123",
				firstName: "Admin",
				lastName: "User",
				role: "admin",
			},
			overrideAccess: true,
		};

		const user1Args: CreateUserArgs = {
			payload,
			data: {
				email: "user1@example.com",
				password: "testpassword123",
				firstName: "User",
				lastName: "One",
				role: "student",
			},
			overrideAccess: true,
		};

		const user2Args: CreateUserArgs = {
			payload,
			data: {
				email: "user2@example.com",
				password: "testpassword123",
				firstName: "User",
				lastName: "Two",
				role: "student",
			},
			overrideAccess: true,
		};

		const user3Args: CreateUserArgs = {
			payload,
			data: {
				email: "user3@example.com",
				password: "testpassword123",
				firstName: "User",
				lastName: "Three",
				role: "student",
			},
			overrideAccess: true,
		};

		const adminResult = await tryCreateUser(adminArgs);
		const user1Result = await tryCreateUser(user1Args);
		const user2Result = await tryCreateUser(user2Args);
		const user3Result = await tryCreateUser(user3Args);

		if (
			!adminResult.ok ||
			!user1Result.ok ||
			!user2Result.ok ||
			!user3Result.ok
		) {
			throw new Error("Failed to create test users");
		}

		adminUser = adminResult.value;
		user1 = user1Result.value;
		user2 = user2Result.value;
		user3 = user3Result.value;
	});

	test("should assign category role to user", async () => {
		const categoryResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Science",
			overrideAccess: true,
		});

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) return;

		const assignResult = await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		expect(assignResult.ok).toBe(true);
		if (assignResult.ok) {
			expect(assignResult.value.role).toBe("category-admin");
		}
	});

	test("should revoke category role from user", async () => {
		const categoryResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Mathematics",
			overrideAccess: true,
		});

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) return;

		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		const revokeResult = await tryRevokeCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: categoryResult.value.id,
			overrideAccess: true,
		});

		expect(revokeResult.ok).toBe(true);
	});

	test("should update existing role assignment", async () => {
		const categoryResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Arts",
			overrideAccess: true,
		});

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) return;

		const assignResult = await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-reviewer",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		expect(assignResult.ok).toBe(true);
		if (!assignResult.ok) return;

		const updateResult = await tryUpdateCategoryRole({
			payload,
			req: mockRequest,
			assignmentId: assignResult.value.id,
			newRole: "category-admin",
			overrideAccess: true,
		});

		expect(updateResult.ok).toBe(true);
		if (updateResult.ok) {
			expect(updateResult.value.role).toBe("category-admin");
		}
	});

	test("should prevent duplicate assignments (one role per user per category)", async () => {
		const categoryResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "History",
			overrideAccess: true,
		});

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) return;

		// First assignment
		const assign1Result = await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		expect(assign1Result.ok).toBe(true);

		// Second assignment should update, not create duplicate
		const assign2Result = await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		expect(assign2Result.ok).toBe(true);
		if (assign2Result.ok) {
			expect(assign2Result.value.role).toBe("category-admin");
		}

		// Verify only one assignment exists
		const assignments = await tryGetCategoryRoleAssignments({
			payload,
			categoryId: categoryResult.value.id,
		});
		expect(assignments.ok).toBe(true);
		if (assignments.ok) {
			const userAssignments = assignments.value.filter((a) => {
				const userId = typeof a.user === "number" ? a.user : a.user.id;
				return userId === user1.id;
			});
			expect(userAssignments.length).toBe(1);
		}
	});

	test("should get all role assignments for a user", async () => {
		const cat1 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Category 1",
			overrideAccess: true,
		});
		const cat2 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Category 2",
			overrideAccess: true,
		});

		if (!cat1.ok || !cat2.ok) return;

		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user2.id,
			categoryId: cat1.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user2.id,
			categoryId: cat2.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		const userRoles = await tryGetUserCategoryRoles({
			payload,
			userId: user2.id,
		});

		expect(userRoles.ok).toBe(true);
		if (userRoles.ok) {
			expect(userRoles.value.length).toBeGreaterThanOrEqual(2);
		}
	});

	test("should get all role assignments for a category", async () => {
		const categoryResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Popular Category",
			overrideAccess: true,
		});

		if (!categoryResult.ok) return;

		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user2.id,
			categoryId: categoryResult.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		const assignments = await tryGetCategoryRoleAssignments({
			payload,
			categoryId: categoryResult.value.id,
		});

		expect(assignments.ok).toBe(true);
		if (assignments.ok) {
			expect(assignments.value.length).toBe(2);
		}
	});

	test("should find specific role assignment", async () => {
		const categoryResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Find Test Category",
			overrideAccess: true,
		});

		if (!categoryResult.ok) return;

		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-reviewer",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		const found = await tryFindCategoryRoleAssignment({
			payload,
			userId: user1.id,
			categoryId: categoryResult.value.id,
		});

		expect(found.ok).toBe(true);
		if (found.ok && found.value) {
			expect(found.value.role).toBe("category-reviewer");
		}
	});

	test("should check if user has role on category", async () => {
		const categoryResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Check Role Category",
			overrideAccess: true,
		});

		if (!categoryResult.ok) return;

		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		const checkResult = await tryCheckUserCategoryRole({
			payload,
			userId: user1.id,
			categoryId: categoryResult.value.id,
		});

		expect(checkResult.ok).toBe(true);
		if (checkResult.ok) {
			expect(checkResult.value).toBe("category-admin");
		}
	});

	test("should get effective role with inheritance from parent category", async () => {
		const parentCat = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Parent Category",
			overrideAccess: true,
		});

		if (!parentCat.ok) return;

		const childCat = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Child Category",
			parent: parentCat.value.id,
			overrideAccess: true,
		});

		if (!childCat.ok) return;

		// Assign role on parent
		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: parentCat.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		// Check effective role on child (should inherit from parent)
		const effectiveRole = await tryGetEffectiveCategoryRole({
			payload,
			userId: user1.id,
			categoryId: childCat.value.id,
		});

		expect(effectiveRole.ok).toBe(true);
		if (effectiveRole.ok) {
			expect(effectiveRole.value).toBe("category-admin");
		}
	});

	test("should respect role priority (admin > coordinator > reviewer)", async () => {
		const grandparent = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Grandparent",
			overrideAccess: true,
		});

		if (!grandparent.ok) return;

		const parent = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Parent",
			parent: grandparent.value.id,
			overrideAccess: true,
		});

		if (!parent.ok) return;

		const child = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Child",
			parent: parent.value.id,
			overrideAccess: true,
		});

		if (!child.ok) return;

		// Assign reviewer on grandparent
		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: grandparent.value.id,
			role: "category-reviewer",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		// Assign admin on parent (higher priority)
		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: parent.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		// Check effective role on child (should be admin, not reviewer)
		const effectiveRole = await tryGetEffectiveCategoryRole({
			payload,
			userId: user1.id,
			categoryId: child.value.id,
		});

		expect(effectiveRole.ok).toBe(true);
		if (effectiveRole.ok) {
			expect(effectiveRole.value).toBe("category-admin");
		}
	});

	test("should get all courses user can access via category roles", async () => {
		const category = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Course Access Category",
			overrideAccess: true,
		});

		if (!category.ok) return;

		const subcategory = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Subcategory",
			parent: category.value.id,
			overrideAccess: true,
		});

		if (!subcategory.ok) return;

		// Create courses in both categories
		await tryCreateCourse({
			payload,
			data: {
				title: "Course 1",
				description: "Description 1",
				slug: "course-1-access",
				createdBy: adminUser.id,
				category: category.value.id,
			},
			overrideAccess: true,
		});

		await tryCreateCourse({
			payload,
			data: {
				title: "Course 2",
				description: "Description 2",
				slug: "course-2-access",
				createdBy: adminUser.id,
				category: subcategory.value.id,
			},
			overrideAccess: true,
		});

		// Assign role on parent category
		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: category.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		const userCourses = await tryGetUserCoursesFromCategories({
			payload,
			userId: user1.id,
		});

		expect(userCourses.ok).toBe(true);
		if (userCourses.ok) {
			expect(userCourses.value.length).toBeGreaterThanOrEqual(2);
		}
	});

	test("should check course access via direct category", async () => {
		const category = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Direct Access Category",
			overrideAccess: true,
		});

		if (!category.ok) return;

		const course = await tryCreateCourse({
			payload,
			data: {
				title: "Direct Course",
				description: "Direct Description",
				slug: "direct-course-access",
				createdBy: adminUser.id,
				category: category.value.id,
			},
			overrideAccess: true,
		});

		if (!course.ok) return;

		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: category.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		const access = await tryCheckUserCourseAccessViaCategory({
			payload,
			userId: user1.id,
			courseId: course.value.id,
		});

		expect(access.ok).toBe(true);
		if (access.ok) {
			expect(access.value).toBe("category-admin");
		}
	});

	test("should check course access via ancestor category", async () => {
		const parentCat = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Ancestor Category",
			overrideAccess: true,
		});

		if (!parentCat.ok) return;

		const childCat = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Descendant Category",
			parent: parentCat.value.id,
			overrideAccess: true,
		});

		if (!childCat.ok) return;

		const course = await tryCreateCourse({
			payload,
			data: {
				title: "Nested Course",
				description: "Nested Description",
				slug: "nested-course-access",
				createdBy: adminUser.id,
				category: childCat.value.id,
			},
			overrideAccess: true,
		});

		if (!course.ok) return;

		// Assign role on parent
		await tryAssignCategoryRole({
			payload,
			req: mockRequest,
			userId: user1.id,
			categoryId: parentCat.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
			overrideAccess: true,
		});

		const access = await tryCheckUserCourseAccessViaCategory({
			payload,
			userId: user1.id,
			courseId: course.value.id,
		});

		expect(access.ok).toBe(true);
		if (access.ok) {
			expect(access.value).toBe("category-coordinator");
		}
	});
});
