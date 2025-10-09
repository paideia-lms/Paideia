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
            email: "testuser@example.com",
            password: "testpassword123",
            firstName: "Test",
            lastName: "User",
            role: "admin",
        };

        const userResult = await tryCreateUser(payload, mockRequest, userArgs);
        if (!userResult.ok) {
            throw new Error("Failed to create test user");
        }

        testUser = userResult.value;
    });

    test("should create a root category", async () => {
        const result = await tryCreateCategory(payload, mockRequest, {
            name: "Mathematics",
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.name).toBe("Mathematics");
            expect(result.value.parent).toBeNull();
        }
    });

    test("should create a nested category with valid parent", async () => {
        const parentResult = await tryCreateCategory(payload, mockRequest, {
            name: "Science",
        });

        expect(parentResult.ok).toBe(true);
        if (!parentResult.ok) return;

        const childResult = await tryCreateCategory(payload, mockRequest, {
            name: "Physics",
            parent: parentResult.value.id,
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
        const result = await tryCreateCategory(payload, mockRequest, {
            name: "Self Reference Test",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Try to update the category to be its own parent
        const updateResult = await tryUpdateCategory(
            payload,
            mockRequest,
            result.value.id,
            {
                parent: result.value.id,
            },
        );

        expect(updateResult.ok).toBe(false);
        if (!updateResult.ok) {
            expect(updateResult.error.message).toMatch(
                /own parent|Failed to update category/,
            );
        }
    });

    test("should prevent circular reference when updating parent", async () => {
        const grandparentResult = await tryCreateCategory(payload, mockRequest, {
            name: "Grandparent",
        });
        expect(grandparentResult.ok).toBe(true);
        if (!grandparentResult.ok) return;

        const parentResult = await tryCreateCategory(payload, mockRequest, {
            name: "Parent",
            parent: grandparentResult.value.id,
        });
        expect(parentResult.ok).toBe(true);
        if (!parentResult.ok) return;

        const childResult = await tryCreateCategory(payload, mockRequest, {
            name: "Child",
            parent: parentResult.value.id,
        });
        expect(childResult.ok).toBe(true);
        if (!childResult.ok) return;

        // Try to make grandparent a child of child (circular)
        const updateResult = await tryUpdateCategory(
            payload,
            mockRequest,
            grandparentResult.value.id,
            {
                parent: childResult.value.id,
            },
        );

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

        const level1Result = await tryCreateCategory(payload, mockRequest, {
            name: "Level 1",
        });
        expect(level1Result.ok).toBe(true);
        if (!level1Result.ok) return;

        const level2Result = await tryCreateCategory(payload, mockRequest, {
            name: "Level 2",
            parent: level1Result.value.id,
        });
        expect(level2Result.ok).toBe(true);
        if (!level2Result.ok) return;

        // This should fail because it would be level 3
        const level3Result = await tryCreateCategory(payload, mockRequest, {
            name: "Level 3",
            parent: level2Result.value.id,
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
        const createResult = await tryCreateCategory(payload, mockRequest, {
            name: "Old Name",
        });

        expect(createResult.ok).toBe(true);
        if (!createResult.ok) return;

        const updateResult = await tryUpdateCategory(
            payload,
            mockRequest,
            createResult.value.id,
            {
                name: "New Name",
            },
        );

        expect(updateResult.ok).toBe(true);
        if (updateResult.ok) {
            expect(updateResult.value.name).toBe("New Name");
        }
    });

    test("should change category parent", async () => {
        const parent1Result = await tryCreateCategory(payload, mockRequest, {
            name: "Parent 1",
        });
        const parent2Result = await tryCreateCategory(payload, mockRequest, {
            name: "Parent 2",
        });
        const childResult = await tryCreateCategory(payload, mockRequest, {
            name: "Movable Child",
            parent: parent1Result.ok ? parent1Result.value.id : undefined,
        });

        expect(parent1Result.ok && parent2Result.ok && childResult.ok).toBe(true);
        if (!parent1Result.ok || !parent2Result.ok || !childResult.ok) return;

        const updateResult = await tryUpdateCategory(
            payload,
            mockRequest,
            childResult.value.id,
            {
                parent: parent2Result.value.id,
            },
        );

        expect(updateResult.ok).toBe(true);
        if (updateResult.ok) {
            expect(
                typeof updateResult.value.parent === "number"
                    ? updateResult.value.parent
                    : updateResult.value.parent?.id,
            ).toBe(parent2Result.value.id);
        }
    });

    test("should delete empty category", async () => {
        const createResult = await tryCreateCategory(payload, mockRequest, {
            name: "To Delete",
        });

        expect(createResult.ok).toBe(true);
        if (!createResult.ok) return;

        const deleteResult = await tryDeleteCategory(
            payload,
            mockRequest,
            createResult.value.id,
        );

        expect(deleteResult.ok).toBe(true);
    });

    test("should fail to delete category with subcategories", async () => {
        const parentResult = await tryCreateCategory(payload, mockRequest, {
            name: "Parent with Children",
        });
        expect(parentResult.ok).toBe(true);
        if (!parentResult.ok) return;

        const childResult = await tryCreateCategory(payload, mockRequest, {
            name: "Child Category",
            parent: parentResult.value.id,
        });
        expect(childResult.ok).toBe(true);

        const deleteResult = await tryDeleteCategory(
            payload,
            mockRequest,
            parentResult.value.id,
        );

        expect(deleteResult.ok).toBe(false);
        if (!deleteResult.ok) {
            expect(deleteResult.error.message).toContain("subcategories");
        }
    });

    test("should fail to delete category with courses", async () => {
        const categoryResult = await tryCreateCategory(payload, mockRequest, {
            name: "Category with Courses",
        });
        expect(categoryResult.ok).toBe(true);
        if (!categoryResult.ok) return;

        const courseResult = await tryCreateCourse(payload, mockRequest, {
            title: "Test Course",
            description: "Test Description",
            slug: "test-course-cat",
            createdBy: testUser.id,
            category: categoryResult.value.id,
        });
        expect(courseResult.ok).toBe(true);

        const deleteResult = await tryDeleteCategory(
            payload,
            mockRequest,
            categoryResult.value.id,
        );

        expect(deleteResult.ok).toBe(false);
        if (!deleteResult.ok) {
            expect(deleteResult.error.message).toMatch(
                /courses|Cannot delete category/,
            );
        }
    });

    test("should find category by ID", async () => {
        const createResult = await tryCreateCategory(payload, mockRequest, {
            name: "Find Me",
        });

        expect(createResult.ok).toBe(true);
        if (!createResult.ok) return;

        const findResult = await tryFindCategoryById(
            payload,
            createResult.value.id,
        );

        expect(findResult.ok).toBe(true);
        if (findResult.ok) {
            expect(findResult.value.name).toBe("Find Me");
        }
    });

    test("should get category tree structure", async () => {
        // Create a tree structure
        const root1 = await tryCreateCategory(payload, mockRequest, {
            name: "Root 1",
        });
        const root2 = await tryCreateCategory(payload, mockRequest, {
            name: "Root 2",
        });

        if (!root1.ok || !root2.ok) return;

        const child1 = await tryCreateCategory(payload, mockRequest, {
            name: "Child 1",
            parent: root1.value.id,
        });
        const child2 = await tryCreateCategory(payload, mockRequest, {
            name: "Child 2",
            parent: root1.value.id,
        });

        expect(child1.ok && child2.ok).toBe(true);

        const treeResult = await tryGetCategoryTree(payload);

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
        const level1 = await tryCreateCategory(payload, mockRequest, {
            name: "Ancestor Level 1",
        });
        if (!level1.ok) return;

        const level2 = await tryCreateCategory(payload, mockRequest, {
            name: "Ancestor Level 2",
            parent: level1.value.id,
        });
        if (!level2.ok) return;

        const level3 = await tryCreateCategory(payload, mockRequest, {
            name: "Ancestor Level 3",
            parent: level2.value.id,
        });
        if (!level3.ok) return;

        const ancestorsResult = await tryGetCategoryAncestors(
            payload,
            level3.value.id,
        );

        expect(ancestorsResult.ok).toBe(true);
        if (ancestorsResult.ok) {
            expect(ancestorsResult.value.length).toBe(3);
            expect(ancestorsResult.value[0].name).toBe("Ancestor Level 1");
            expect(ancestorsResult.value[1].name).toBe("Ancestor Level 2");
            expect(ancestorsResult.value[2].name).toBe("Ancestor Level 3");
        }
    });

    test("should calculate category depth correctly", async () => {
        const root = await tryCreateCategory(payload, mockRequest, {
            name: "Depth Root",
        });
        if (!root.ok) return;

        const child = await tryCreateCategory(payload, mockRequest, {
            name: "Depth Child",
            parent: root.value.id,
        });
        if (!child.ok) return;

        const grandchild = await tryCreateCategory(payload, mockRequest, {
            name: "Depth Grandchild",
            parent: child.value.id,
        });
        if (!grandchild.ok) return;

        const rootDepth = await tryGetCategoryDepth(payload, root.value.id);
        expect(rootDepth.ok).toBe(true);
        if (rootDepth.ok) {
            expect(rootDepth.value).toBe(0);
        }

        const childDepth = await tryGetCategoryDepth(payload, child.value.id);
        expect(childDepth.ok).toBe(true);
        if (childDepth.ok) {
            expect(childDepth.value).toBe(1);
        }

        const grandchildDepth = await tryGetCategoryDepth(
            payload,
            grandchild.value.id,
        );
        expect(grandchildDepth.ok).toBe(true);
        if (grandchildDepth.ok) {
            expect(grandchildDepth.value).toBe(2);
        }
    });

    test("should count total nested courses correctly", async () => {
        const parent = await tryCreateCategory(payload, mockRequest, {
            name: "Count Parent",
        });
        if (!parent.ok) return;

        const child1 = await tryCreateCategory(payload, mockRequest, {
            name: "Count Child 1",
            parent: parent.value.id,
        });
        const child2 = await tryCreateCategory(payload, mockRequest, {
            name: "Count Child 2",
            parent: parent.value.id,
        });

        if (!child1.ok || !child2.ok) return;

        // Create courses in different categories
        await tryCreateCourse(payload, mockRequest, {
            title: "Parent Course",
            description: "Course in parent",
            slug: "parent-course-count",
            createdBy: testUser.id,
            category: parent.value.id,
        });

        await tryCreateCourse(payload, mockRequest, {
            title: "Child 1 Course",
            description: "Course in child 1",
            slug: "child1-course-count",
            createdBy: testUser.id,
            category: child1.value.id,
        });

        await tryCreateCourse(payload, mockRequest, {
            title: "Child 2 Course",
            description: "Course in child 2",
            slug: "child2-course-count",
            createdBy: testUser.id,
            category: child2.value.id,
        });

        const countResult = await tryGetTotalNestedCoursesCount(
            payload,
            parent.value.id,
        );

        expect(countResult.ok).toBe(true);
        if (countResult.ok) {
            expect(countResult.value).toBe(3); // 1 in parent + 1 in child1 + 1 in child2
        }
    });

    test("should find root categories", async () => {
        await tryCreateCategory(payload, mockRequest, {
            name: "Another Root",
        });

        const rootsResult = await tryFindRootCategories(payload);

        expect(rootsResult.ok).toBe(true);
        if (rootsResult.ok) {
            expect(rootsResult.value.length).toBeGreaterThan(0);
            for (const cat of rootsResult.value) {
                expect(cat.parent).toBeNull();
            }
        }
    });

    test("should find subcategories", async () => {
        const parent = await tryCreateCategory(payload, mockRequest, {
            name: "Parent for Subs",
        });
        if (!parent.ok) return;

        await tryCreateCategory(payload, mockRequest, {
            name: "Sub 1",
            parent: parent.value.id,
        });
        await tryCreateCategory(payload, mockRequest, {
            name: "Sub 2",
            parent: parent.value.id,
        });

        const subsResult = await tryFindSubcategories(payload, parent.value.id);

        expect(subsResult.ok).toBe(true);
        if (subsResult.ok) {
            expect(subsResult.value.length).toBeGreaterThanOrEqual(2);
        }
    });

    test("should assign course to category", async () => {
        const category = await tryCreateCategory(payload, mockRequest, {
            name: "Course Category",
        });
        if (!category.ok) return;

        const course = await tryCreateCourse(payload, mockRequest, {
            title: "Categorized Course",
            description: "A course with a category",
            slug: "categorized-course",
            createdBy: testUser.id,
            category: category.value.id,
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
        const cat1 = await tryCreateCategory(payload, mockRequest, {
            name: "Category 1",
        });
        const cat2 = await tryCreateCategory(payload, mockRequest, {
            name: "Category 2",
        });

        if (!cat1.ok || !cat2.ok) return;

        const course = await tryCreateCourse(payload, mockRequest, {
            title: "Movable Course",
            description: "A course that moves",
            slug: "movable-course",
            createdBy: testUser.id,
            category: cat1.value.id,
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
