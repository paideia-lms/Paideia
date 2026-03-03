import { beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	tryCreateCategory,
	tryDeleteCategory,
	tryFindCategoryById,
	tryFindRootCategories,
	tryFindSubcategories,
	tryGetCategoryAncestors,
	tryGetCategoryDepth,
	tryGetCategoryTree,
	tryGetTotalNestedCoursesCount,
	tryUpdateCategory,
} from "./course-category-management";
import { tryCreateCourse } from "./course-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Course Category Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUser: { id: number };

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

		// Create test user
		const userArgs: CreateUserArgs = {
			payload,
			data: {
				email: "testuser@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
				role: "admin",
			},
			overrideAccess: true,
			req: undefined,
		};

		const userResult = await tryCreateUser(userArgs);
		if (!userResult.ok) {
			throw new Error("Failed to create test user");
		}

		testUser = userResult.value;
	});

	test("should create a root category", async () => {
		const result = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Mathematics",
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Mathematics");
			expect(result.value.parent).toBeNull();
		}
	});

	test("should create a nested category with valid parent", async () => {
		const parentResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Science",
			overrideAccess: true,
		});

		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const childResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Physics",
			parent: parentResult.value.id,
			overrideAccess: true,
		});

		expect(childResult.ok).toBe(true);
		if (childResult.ok) {
			expect(childResult.value.name).toBe("Physics");
			expect(
				typeof childResult.value.parent === "number"
					? childResult.value.parent
					: childResult.value.parent?.id,
			).toBe(parentResult.value.id);
		}
	});

	test("should prevent circular reference when creating category", async () => {
		const result = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Self Reference Test",
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Try to update the category to be its own parent
		const updateResult = await tryUpdateCategory({
			payload,
			req: mockRequest,
			categoryId: result.value.id,
			parent: result.value.id,
			overrideAccess: true,
		});

		expect(updateResult.ok).toBe(false);
		if (!updateResult.ok) {
			expect(updateResult.error.message).toMatch(
				/own parent|Failed to update category/,
			);
		}
	});

	test("should prevent circular reference when updating parent", async () => {
		const grandparentResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Grandparent",
			overrideAccess: true,
		});
		expect(grandparentResult.ok).toBe(true);
		if (!grandparentResult.ok) return;

		const parentResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Parent",
			parent: grandparentResult.value.id,
			overrideAccess: true,
		});
		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const childResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Child",
			parent: parentResult.value.id,
			overrideAccess: true,
		});
		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		// Try to make grandparent a child of child (circular)
		const updateResult = await tryUpdateCategory({
			payload,
			req: mockRequest,
			categoryId: grandparentResult.value.id,
			parent: childResult.value.id,
			overrideAccess: true,
		});

		expect(updateResult.ok).toBe(false);
		if (!updateResult.ok) {
			expect(updateResult.error.message).toMatch(
				/circular reference|Failed to update category/,
			);
		}
	});

	test("should enforce max category depth when configured", async () => {
		// Set max depth to 2
		await payload.updateGlobal({
			slug: "system-grade-table",
			data: {
				maxCategoryDepth: 2,
			},
		});

		const level1Result = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Level 1",
			overrideAccess: true,
		});
		expect(level1Result.ok).toBe(true);
		if (!level1Result.ok) return;

		const level2Result = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Level 2",
			parent: level1Result.value.id,
			overrideAccess: true,
		});
		expect(level2Result.ok).toBe(true);
		if (!level2Result.ok) return;

		// This should fail because it would be level 3
		const level3Result = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Level 3",
			parent: level2Result.value.id,
			overrideAccess: true,
		});

		expect(level3Result.ok).toBe(false);
		if (!level3Result.ok) {
			expect(level3Result.error.message).toMatch(
				/depth limit exceeded|Failed to create category/,
			);
		}

		// Reset max depth
		await payload.updateGlobal({
			slug: "system-grade-table",
			data: {
				maxCategoryDepth: null,
			},
		});
	});

	test("should update category name", async () => {
		const createResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Old Name",
			overrideAccess: true,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const updateResult = await tryUpdateCategory({
			payload,
			req: mockRequest,
			categoryId: createResult.value.id,
			name: "New Name",
			overrideAccess: true,
		});

		expect(updateResult.ok).toBe(true);
		if (updateResult.ok) {
			expect(updateResult.value.name).toBe("New Name");
		}
	});

	test("should change category parent", async () => {
		const parent1Result = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Parent 1",
			overrideAccess: true,
		});
		const parent2Result = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Parent 2",
			overrideAccess: true,
		});
		const childResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Movable Child",
			parent: parent1Result.ok ? parent1Result.value.id : undefined,
			overrideAccess: true,
		});

		expect(parent1Result.ok && parent2Result.ok && childResult.ok).toBe(true);
		if (!parent1Result.ok || !parent2Result.ok || !childResult.ok) return;

		const updateResult = await tryUpdateCategory({
			payload,
			req: mockRequest,
			categoryId: childResult.value.id,
			parent: parent2Result.value.id,
			overrideAccess: true,
		});

		expect(updateResult.ok).toBe(true);
		if (updateResult.ok) {
			expect(updateResult.value.parent).toBe(parent2Result.value.id);
		}
	});

	test("should delete empty category", async () => {
		const createResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "To Delete",
			overrideAccess: true,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const deleteResult = await tryDeleteCategory({
			payload,
			req: mockRequest,
			categoryId: createResult.value.id,
			overrideAccess: true,
		});

		expect(deleteResult.ok).toBe(true);
	});

	test("should fail to delete category with subcategories", async () => {
		const parentResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Parent with Children",
			overrideAccess: true,
		});
		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const childResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Child Category",
			parent: parentResult.value.id,
			overrideAccess: true,
		});
		expect(childResult.ok).toBe(true);

		const deleteResult = await tryDeleteCategory({
			payload,
			req: mockRequest,
			categoryId: parentResult.value.id,
			overrideAccess: true,
		});

		expect(deleteResult.ok).toBe(false);
		if (!deleteResult.ok) {
			expect(deleteResult.error.message).toContain("subcategories");
		}
	});

	test("should fail to delete category with courses", async () => {
		const categoryResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Category with Courses",
			overrideAccess: true,
		});
		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) return;

		const courseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Test Course",
				description: "Test Description",
				slug: "test-course-cat",
				createdBy: testUser.id,
				category: categoryResult.value.id,
			},
			overrideAccess: true,

			req: undefined,
		});
		expect(courseResult.ok).toBe(true);

		const deleteResult = await tryDeleteCategory({
			payload,
			req: mockRequest,
			categoryId: categoryResult.value.id,
			overrideAccess: true,
		});

		expect(deleteResult.ok).toBe(false);
		if (!deleteResult.ok) {
			expect(deleteResult.error.message).toMatch(
				/courses|Cannot delete category/,
			);
		}
	});

	test("should find category by ID", async () => {
		const createResult = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Find Me",
			overrideAccess: true,
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const findResult = await tryFindCategoryById({
			payload,
			categoryId: createResult.value.id,
			overrideAccess: true,

			req: undefined,
		});

		expect(findResult.ok).toBe(true);
		if (findResult.ok) {
			expect(findResult.value.name).toBe("Find Me");
		}
	});

	test("should get category tree structure", async () => {
		// Create a tree structure
		const root1 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Root 1",
			overrideAccess: true,
		});
		const root2 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Root 2",
			overrideAccess: true,
		});

		if (!root1.ok || !root2.ok) return;

		const child1 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Child 1",
			parent: root1.value.id,
			overrideAccess: true,
		});
		const child2 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Child 2",
			parent: root1.value.id,
			overrideAccess: true,
		});

		expect(child1.ok && child2.ok).toBe(true);

		const treeResult = await tryGetCategoryTree({
			payload,
			overrideAccess: true,

			req: undefined,
		});

		expect(treeResult.ok).toBe(true);
		if (treeResult.ok) {
			const tree = treeResult.value;
			expect(tree.length).toBeGreaterThan(0);

			const root1Node = tree.find((n) => n.id === root1.value.id);
			expect(root1Node).toBeDefined();
			if (root1Node) {
				expect(root1Node.subcategories.length).toBeGreaterThanOrEqual(2);
			}
		}
	});

	test("should get category ancestors", async () => {
		const level1 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Ancestor Level 1",
			overrideAccess: true,
		});
		if (!level1.ok) return;

		const level2 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Ancestor Level 2",
			parent: level1.value.id,
			overrideAccess: true,
		});
		if (!level2.ok) return;

		const level3 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Ancestor Level 3",
			parent: level2.value.id,
			overrideAccess: true,
		});
		if (!level3.ok) return;

		const ancestorsResult = await tryGetCategoryAncestors({
			payload,
			categoryId: level3.value.id,
			overrideAccess: true,

			req: undefined,
		});

		expect(ancestorsResult.ok).toBe(true);
		if (ancestorsResult.ok) {
			expect(ancestorsResult.value.length).toBe(3);
			expect(ancestorsResult.value[0]!.name).toBe("Ancestor Level 1");
			expect(ancestorsResult.value[1]!.name).toBe("Ancestor Level 2");
			expect(ancestorsResult.value[2]!.name).toBe("Ancestor Level 3");
		}
	});

	test("should calculate category depth correctly", async () => {
		const root = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Depth Root",
			overrideAccess: true,
		});
		if (!root.ok) return;

		const child = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Depth Child",
			parent: root.value.id,
			overrideAccess: true,
		});
		if (!child.ok) return;

		const grandchild = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Depth Grandchild",
			parent: child.value.id,
			overrideAccess: true,
		});
		if (!grandchild.ok) return;

		const rootDepth = await tryGetCategoryDepth({
			payload,
			categoryId: root.value.id,
			overrideAccess: true,

			req: undefined,
		});
		expect(rootDepth.ok).toBe(true);
		if (rootDepth.ok) {
			expect(rootDepth.value).toBe(0);
		}

		const childDepth = await tryGetCategoryDepth({
			payload,
			categoryId: child.value.id,
			overrideAccess: true,

			req: undefined,
		});
		expect(childDepth.ok).toBe(true);
		if (childDepth.ok) {
			expect(childDepth.value).toBe(1);
		}

		const grandchildDepth = await tryGetCategoryDepth({
			payload,
			categoryId: grandchild.value.id,
			overrideAccess: true,

			req: undefined,
		});
		expect(grandchildDepth.ok).toBe(true);
		if (grandchildDepth.ok) {
			expect(grandchildDepth.value).toBe(2);
		}
	});

	test("should count total nested courses correctly", async () => {
		const parent = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Count Parent",
			overrideAccess: true,
		});
		if (!parent.ok) return;

		const child1 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Count Child 1",
			parent: parent.value.id,
			overrideAccess: true,
		});
		const child2 = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Count Child 2",
			parent: parent.value.id,
			overrideAccess: true,
		});

		if (!child1.ok || !child2.ok) return;

		// Create courses in different categories
		await tryCreateCourse({
			payload,
			data: {
				title: "Parent Course",
				description: "Course in parent",
				slug: "parent-course-count",
				createdBy: testUser.id,
				category: parent.value.id,
			},
			overrideAccess: true,

			req: undefined,
		});

		await tryCreateCourse({
			payload,
			data: {
				title: "Child 1 Course",
				description: "Course in child 1",
				slug: "child1-course-count",
				createdBy: testUser.id,
				category: child1.value.id,
			},
			overrideAccess: true,

			req: undefined,
		});

		await tryCreateCourse({
			payload,
			data: {
				title: "Child 2 Course",
				description: "Course in child 2",
				slug: "child2-course-count",
				createdBy: testUser.id,
				category: child2.value.id,
			},
			overrideAccess: true,

			req: undefined,
		});

		const countResult = await tryGetTotalNestedCoursesCount({
			payload,
			categoryId: parent.value.id,
			overrideAccess: true,

			req: undefined,
		});

		expect(countResult.ok).toBe(true);
		if (countResult.ok) {
			expect(countResult.value).toBe(3); // 1 in parent + 1 in child1 + 1 in child2
		}
	});

	test("should find root categories", async () => {
		await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Another Root",
			overrideAccess: true,
		});

		const rootsResult = await tryFindRootCategories({
			payload,
			overrideAccess: true,

			req: undefined,
		});

		expect(rootsResult.ok).toBe(true);
		if (rootsResult.ok) {
			expect(rootsResult.value.length).toBeGreaterThan(0);
			for (const cat of rootsResult.value) {
				expect(cat.parent).toBeNull();
			}
		}
	});

	test("should find subcategories", async () => {
		const parent = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Parent for Subs",
			overrideAccess: true,
		});
		if (!parent.ok) return;

		await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Sub 1",
			parent: parent.value.id,
			overrideAccess: true,
		});
		await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Sub 2",
			parent: parent.value.id,
			overrideAccess: true,
		});

		const subsResult = await tryFindSubcategories({
			payload,
			parentId: parent.value.id,
			overrideAccess: true,

			req: undefined,
		});

		expect(subsResult.ok).toBe(true);
		if (subsResult.ok) {
			expect(subsResult.value.length).toBeGreaterThanOrEqual(2);
		}
	});

	test("should assign course to category", async () => {
		const category = await tryCreateCategory({
			payload,
			req: mockRequest,
			name: "Course Category",
			overrideAccess: true,
		});
		if (!category.ok) return;

		const course = await tryCreateCourse({
			payload,
			data: {
				title: "Categorized Course",
				description: "A course with a category",
				slug: "categorized-course",
				createdBy: testUser.id,
				category: category.value.id,
			},
			overrideAccess: true,

			req: undefined,
		});

		expect(course.ok).toBe(true);
		if (course.ok) {
			expect(
				typeof course.value.category === "number"
					? course.value.category
					: course.value.category?.id,
			).toBe(category.value.id);
		}
	});

	test("should move course between categories", async () => {
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

		const course = await tryCreateCourse({
			payload,
			data: {
				title: "Movable Course",
				description: "A course that moves",
				slug: "movable-course",
				createdBy: testUser.id,
				category: cat1.value.id,
			},
			overrideAccess: true,

			req: undefined,
		});

		if (!course.ok) return;

		// Move course to category 2
		const updated = await payload.update({
			collection: "courses",
			id: course.value.id,
			data: {
				category: cat2.value.id,
			},
		});

		expect(
			typeof updated.category === "number"
				? updated.category
				: updated.category?.id,
		).toBe(cat2.value.id);
	});
});
