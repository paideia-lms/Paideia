import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import type { TryResultValue } from "server/utils/type-narrowing";
import { InvalidSortOrderError, WeightExceedsLimitError } from "~/utils/error";
import sanitizedConfig from "../payload.config";
import { tryCreateCourse } from "./course-management";
import {
	tryCreateGradebookCategory,
	tryDeleteGradebookCategory,
	tryFindGradebookCategoryById,
	tryGetGradebookCategoriesHierarchy,
	tryGetNextSortOrder,
	tryReorderCategories,
	tryUpdateGradebookCategory,
} from "./gradebook-category-management";
import { tryFindGradebookByCourseId } from "./gradebook-management";
import type { CreateUserArgs } from "./user-management";
import { tryCreateUser } from "./user-management";

describe("Gradebook Category Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let instructor: TryResultValue<typeof tryCreateUser>;
	let testCourse: TryResultValue<typeof tryCreateCourse>;
	let testGradebook: TryResultValue<typeof tryFindGradebookByCourseId>;
	let testCategory: TryResultValue<typeof tryCreateGradebookCategory>;
	let testSubCategory: TryResultValue<typeof tryCreateGradebookCategory>;

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

		// Create mock request object
		mockRequest = new Request("http://localhost:3000/test");

		// Create test users (instructor and student)
		const instructorArgs: CreateUserArgs = {
			payload,
			data: {
				email: "instructor@test.com",
				password: "password123",
				firstName: "John",
				lastName: "Instructor",
				role: "user",
			},
			overrideAccess: true,
		};

		const instructorResult = await tryCreateUser(instructorArgs);

		expect(instructorResult.ok).toBe(true);
		if (!instructorResult.ok) {
			throw new Error("Failed to create test instructor");
		}

		instructor = instructorResult.value;

		// Create a test course
		const courseResult = await tryCreateCourse(payload, {} as Request, {
			title: "Test Course Categories",
			description: "Test Course Description",
			slug: "test-course-categories",
			createdBy: instructor.id,
		});

		expect(courseResult.ok).toBe(true);
		if (!courseResult.ok) {
			throw new Error("Failed to create test course");
		}

		testCourse = courseResult.value;

		// Get the gradebook created by the course
		const gradebookResult = await tryFindGradebookByCourseId(
			payload,
			testCourse.id,
		);
		expect(gradebookResult.ok).toBe(true);
		if (!gradebookResult.ok) {
			throw new Error("Failed to find gradebook for course");
		}
		testGradebook = gradebookResult.value;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	it("should create a gradebook category", async () => {
		const result = await tryCreateGradebookCategory(payload, {} as Request, {
			gradebookId: testGradebook.id,
			name: "Test Category",
			description: "Test Category Description",
			weight: 50,
			sortOrder: 0,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Test Category");
			expect(result.value.weight).toBe(50);
			expect(result.value.sortOrder).toBe(0);
			testCategory = result.value;
		}
	});

	it("should not create category with invalid weight", async () => {
		const result = await tryCreateGradebookCategory(payload, {} as Request, {
			gradebookId: testGradebook.id,
			name: "Invalid Weight Category",
			weight: 150, // Invalid: > 100
			sortOrder: 1,
		});

		expect(result.ok).toBe(false);
	});

	it("should not create category with invalid sort order", async () => {
		const result = await tryCreateGradebookCategory(payload, {} as Request, {
			gradebookId: testGradebook.id,
			name: "Invalid Sort Category",
			sortOrder: -1, // Invalid: negative
		});

		expect(result.ok).toBe(false);
	});

	it("should create a subcategory", async () => {
		const result = await tryCreateGradebookCategory(payload, {} as Request, {
			gradebookId: testGradebook.id,
			parentId: testCategory.id,
			name: "Test Subcategory",
			description: "Test Subcategory Description",
			weight: 25,
			sortOrder: 0,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Test Subcategory");
			expect(result.value.parent).toBeDefined();
			testSubCategory = result.value;
		}
	});

	it("should find gradebook category by ID", async () => {
		const result = await tryFindGradebookCategoryById(payload, testCategory.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testCategory.id);
			expect(result.value.name).toBe("Test Category");
		}
	});

	it("should update gradebook category", async () => {
		const result = await tryUpdateGradebookCategory(
			payload,
			{} as Request,
			testCategory.id,
			{
				name: "Updated Test Category",
				weight: 60,
			},
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Updated Test Category");
			expect(result.value.weight).toBe(60);
		}
	});

	it("should get gradebook categories hierarchy", async () => {
		const result = await tryGetGradebookCategoriesHierarchy(
			payload,
			testGradebook.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.length).toBeGreaterThanOrEqual(1);
			// Check if we have the main category
			const mainCategory = result.value.find(
				(cat) => cat.id === testCategory.id,
			);
			expect(mainCategory).toBeDefined();
			if (mainCategory) {
				expect(mainCategory.children.length).toBeGreaterThanOrEqual(1);
			}
		}
	});

	it("should get next sort order", async () => {
		const result = await tryGetNextSortOrder(payload, testGradebook.id, null);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBeGreaterThanOrEqual(1);
		}
	});

	it("should reorder categories", async () => {
		const result = await tryReorderCategories(payload, {} as Request, [
			testCategory.id,
		]);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
		}
	});

	it("should delete gradebook category", async () => {
		const result = await tryDeleteGradebookCategory(
			payload,
			{} as Request,
			testSubCategory.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testSubCategory.id);
		}
	});

	it("should not find deleted category", async () => {
		const result = await tryFindGradebookCategoryById(
			payload,
			testSubCategory.id,
		);

		expect(result.ok).toBe(false);
	});
});
