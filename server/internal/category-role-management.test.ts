import { beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import { checkUserCourseAccess } from "../utils/check-course-access";
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
				role: "user",
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
				role: "user",
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
				role: "user",
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
		const categoryResult = await tryCreateCategory(payload, mockRequest, {
			name: "Science",
		});

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) return;

		const assignResult = await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
		});

		expect(assignResult.ok).toBe(true);
		if (assignResult.ok) {
			expect(assignResult.value.role).toBe("category-admin");
		}
	});

	test("should revoke category role from user", async () => {
		const categoryResult = await tryCreateCategory(payload, mockRequest, {
			name: "Mathematics",
		});

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) return;

		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
		});

		const revokeResult = await tryRevokeCategoryRole(
			payload,
			mockRequest,
			user1.id,
			categoryResult.value.id,
		);

		expect(revokeResult.ok).toBe(true);
	});

	test("should update existing role assignment", async () => {
		const categoryResult = await tryCreateCategory(payload, mockRequest, {
			name: "Arts",
		});

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) return;

		const assignResult = await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-reviewer",
			assignedBy: adminUser.id,
		});

		expect(assignResult.ok).toBe(true);
		if (!assignResult.ok) return;

		const updateResult = await tryUpdateCategoryRole(
			payload,
			mockRequest,
			assignResult.value.id,
			"category-admin",
		);

		expect(updateResult.ok).toBe(true);
		if (updateResult.ok) {
			expect(updateResult.value.role).toBe("category-admin");
		}
	});

	test("should prevent duplicate assignments (one role per user per category)", async () => {
		const categoryResult = await tryCreateCategory(payload, mockRequest, {
			name: "History",
		});

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) return;

		// First assignment
		const assign1Result = await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
		});

		expect(assign1Result.ok).toBe(true);

		// Second assignment should update, not create duplicate
		const assign2Result = await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
		});

		expect(assign2Result.ok).toBe(true);
		if (assign2Result.ok) {
			expect(assign2Result.value.role).toBe("category-admin");
		}

		// Verify only one assignment exists
		const assignments = await tryGetCategoryRoleAssignments(
			payload,
			categoryResult.value.id,
		);
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
		const cat1 = await tryCreateCategory(payload, mockRequest, {
			name: "Category 1",
		});
		const cat2 = await tryCreateCategory(payload, mockRequest, {
			name: "Category 2",
		});

		if (!cat1.ok || !cat2.ok) return;

		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user2.id,
			categoryId: cat1.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
		});

		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user2.id,
			categoryId: cat2.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
		});

		const userRoles = await tryGetUserCategoryRoles(payload, user2.id);

		expect(userRoles.ok).toBe(true);
		if (userRoles.ok) {
			expect(userRoles.value.length).toBeGreaterThanOrEqual(2);
		}
	});

	test("should get all role assignments for a category", async () => {
		const categoryResult = await tryCreateCategory(payload, mockRequest, {
			name: "Popular Category",
		});

		if (!categoryResult.ok) return;

		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
		});

		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user2.id,
			categoryId: categoryResult.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
		});

		const assignments = await tryGetCategoryRoleAssignments(
			payload,
			categoryResult.value.id,
		);

		expect(assignments.ok).toBe(true);
		if (assignments.ok) {
			expect(assignments.value.length).toBe(2);
		}
	});

	test("should find specific role assignment", async () => {
		const categoryResult = await tryCreateCategory(payload, mockRequest, {
			name: "Find Test Category",
		});

		if (!categoryResult.ok) return;

		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-reviewer",
			assignedBy: adminUser.id,
		});

		const found = await tryFindCategoryRoleAssignment(
			payload,
			user1.id,
			categoryResult.value.id,
		);

		expect(found.ok).toBe(true);
		if (found.ok && found.value) {
			expect(found.value.role).toBe("category-reviewer");
		}
	});

	test("should check if user has role on category", async () => {
		const categoryResult = await tryCreateCategory(payload, mockRequest, {
			name: "Check Role Category",
		});

		if (!categoryResult.ok) return;

		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: categoryResult.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
		});

		const checkResult = await tryCheckUserCategoryRole(
			payload,
			user1.id,
			categoryResult.value.id,
		);

		expect(checkResult.ok).toBe(true);
		if (checkResult.ok) {
			expect(checkResult.value).toBe("category-admin");
		}
	});

	test("should get effective role with inheritance from parent category", async () => {
		const parentCat = await tryCreateCategory(payload, mockRequest, {
			name: "Parent Category",
		});

		if (!parentCat.ok) return;

		const childCat = await tryCreateCategory(payload, mockRequest, {
			name: "Child Category",
			parent: parentCat.value.id,
		});

		if (!childCat.ok) return;

		// Assign role on parent
		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: parentCat.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
		});

		// Check effective role on child (should inherit from parent)
		const effectiveRole = await tryGetEffectiveCategoryRole(
			payload,
			user1.id,
			childCat.value.id,
		);

		expect(effectiveRole.ok).toBe(true);
		if (effectiveRole.ok) {
			expect(effectiveRole.value).toBe("category-admin");
		}
	});

	test("should respect role priority (admin > coordinator > reviewer)", async () => {
		const grandparent = await tryCreateCategory(payload, mockRequest, {
			name: "Grandparent",
		});

		if (!grandparent.ok) return;

		const parent = await tryCreateCategory(payload, mockRequest, {
			name: "Parent",
			parent: grandparent.value.id,
		});

		if (!parent.ok) return;

		const child = await tryCreateCategory(payload, mockRequest, {
			name: "Child",
			parent: parent.value.id,
		});

		if (!child.ok) return;

		// Assign reviewer on grandparent
		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: grandparent.value.id,
			role: "category-reviewer",
			assignedBy: adminUser.id,
		});

		// Assign admin on parent (higher priority)
		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: parent.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
		});

		// Check effective role on child (should be admin, not reviewer)
		const effectiveRole = await tryGetEffectiveCategoryRole(
			payload,
			user1.id,
			child.value.id,
		);

		expect(effectiveRole.ok).toBe(true);
		if (effectiveRole.ok) {
			expect(effectiveRole.value).toBe("category-admin");
		}
	});

	test("should get all courses user can access via category roles", async () => {
		const category = await tryCreateCategory(payload, mockRequest, {
			name: "Course Access Category",
		});

		if (!category.ok) return;

		const subcategory = await tryCreateCategory(payload, mockRequest, {
			name: "Subcategory",
			parent: category.value.id,
		});

		if (!subcategory.ok) return;

		// Create courses in both categories
		await tryCreateCourse(payload, mockRequest, {
			title: "Course 1",
			description: "Description 1",
			slug: "course-1-access",
			createdBy: adminUser.id,
			category: category.value.id,
		});

		await tryCreateCourse(payload, mockRequest, {
			title: "Course 2",
			description: "Description 2",
			slug: "course-2-access",
			createdBy: adminUser.id,
			category: subcategory.value.id,
		});

		// Assign role on parent category
		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: category.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
		});

		const userCourses = await tryGetUserCoursesFromCategories(
			payload,
			user1.id,
		);

		expect(userCourses.ok).toBe(true);
		if (userCourses.ok) {
			expect(userCourses.value.length).toBeGreaterThanOrEqual(2);
		}
	});

	test("should check course access via direct category", async () => {
		const category = await tryCreateCategory(payload, mockRequest, {
			name: "Direct Access Category",
		});

		if (!category.ok) return;

		const course = await tryCreateCourse(payload, mockRequest, {
			title: "Direct Course",
			description: "Direct Description",
			slug: "direct-course-access",
			createdBy: adminUser.id,
			category: category.value.id,
		});

		if (!course.ok) return;

		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: category.value.id,
			role: "category-admin",
			assignedBy: adminUser.id,
		});

		const access = await tryCheckUserCourseAccessViaCategory(
			payload,
			user1.id,
			course.value.id,
		);

		expect(access.ok).toBe(true);
		if (access.ok) {
			expect(access.value).toBe("category-admin");
		}
	});

	test("should check course access via ancestor category", async () => {
		const parentCat = await tryCreateCategory(payload, mockRequest, {
			name: "Ancestor Category",
		});

		if (!parentCat.ok) return;

		const childCat = await tryCreateCategory(payload, mockRequest, {
			name: "Descendant Category",
			parent: parentCat.value.id,
		});

		if (!childCat.ok) return;

		const course = await tryCreateCourse(payload, mockRequest, {
			title: "Nested Course",
			description: "Nested Description",
			slug: "nested-course-access",
			createdBy: adminUser.id,
			category: childCat.value.id,
		});

		if (!course.ok) return;

		// Assign role on parent
		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user1.id,
			categoryId: parentCat.value.id,
			role: "category-coordinator",
			assignedBy: adminUser.id,
		});

		const access = await tryCheckUserCourseAccessViaCategory(
			payload,
			user1.id,
			course.value.id,
		);

		expect(access.ok).toBe(true);
		if (access.ok) {
			expect(access.value).toBe("category-coordinator");
		}
	});

	test("should check global admin has access regardless of assignments", async () => {
		const category = await tryCreateCategory(payload, mockRequest, {
			name: "Admin Test Category",
		});

		if (!category.ok) return;

		const course = await tryCreateCourse(payload, mockRequest, {
			title: "Admin Test Course",
			description: "Admin Test Description",
			slug: "admin-test-course",
			createdBy: adminUser.id,
			category: category.value.id,
		});

		if (!course.ok) return;

		const access = await checkUserCourseAccess(
			payload,
			adminUser.id,
			course.value.id,
		);

		expect(access.hasAccess).toBe(true);
		expect(access.source).toBe("global-admin");
	});

	test("should check access via category when no enrollment exists", async () => {
		const category = await tryCreateCategory(payload, mockRequest, {
			name: "No Enrollment Category",
		});

		if (!category.ok) return;

		const course = await tryCreateCourse(payload, mockRequest, {
			title: "No Enrollment Course",
			description: "No Enrollment Description",
			slug: "no-enrollment-course",
			createdBy: adminUser.id,
			category: category.value.id,
		});

		if (!course.ok) return;

		await tryAssignCategoryRole(payload, mockRequest, {
			userId: user3.id,
			categoryId: category.value.id,
			role: "category-reviewer",
			assignedBy: adminUser.id,
		});

		const access = await checkUserCourseAccess(
			payload,
			user3.id,
			course.value.id,
		);

		expect(access.hasAccess).toBe(true);
		expect(access.source).toBe("category");
		expect(access.role).toBe("category-reviewer");
	});
});
