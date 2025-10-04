import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import type { TryResultValue } from "server/utils/type-narrowing";
import sanitizedConfig from "../payload.config";
import { tryCreateCourse } from "./course-management";
import { tryCreateGradebookCategory } from "./gradebook-category-management";
import {
	tryCreateGradebookItem,
	tryDeleteGradebookItem,
	tryFindGradebookItemById,
	tryGetCategoryItems,
	tryGetGradebookItemsInOrder,
	tryGetItemsWithUserGrades,
	tryGetNextItemSortOrder,
	tryReorderItems,
	tryUpdateGradebookItem,
} from "./gradebook-item-management";
import { tryFindGradebookByCourseId } from "./gradebook-management";
import type { CreateUserArgs } from "./user-management";
import { tryCreateUser } from "./user-management";

describe("Gradebook Item Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let instructor: TryResultValue<typeof tryCreateUser>;
	let student: TryResultValue<typeof tryCreateUser>;
	let testCourse: TryResultValue<typeof tryCreateCourse>;
	let testGradebook: TryResultValue<typeof tryFindGradebookByCourseId>;
	let testCategory: TryResultValue<typeof tryCreateGradebookCategory>;
	let testItem: TryResultValue<typeof tryCreateGradebookItem>;
	let testItem2: TryResultValue<typeof tryCreateGradebookItem>;

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
			email: "instructor@test.com",
			password: "password123",
			firstName: "John",
			lastName: "Instructor",
			role: "instructor",
		};

		const studentArgs: CreateUserArgs = {
			email: "student@test.com",
			password: "password123",
			firstName: "Jane",
			lastName: "Student",
			role: "student",
		};

		const instructorResult = await tryCreateUser(
			payload,
			mockRequest,
			instructorArgs,
		);
		const studentResult = await tryCreateUser(
			payload,
			mockRequest,
			studentArgs,
		);

		expect(instructorResult.ok).toBe(true);
		expect(studentResult.ok).toBe(true);
		if (!instructorResult.ok || !studentResult.ok) {
			throw new Error("Failed to create test users");
		}

		instructor = instructorResult.value;
		student = studentResult.value;

		// Create a test course
		const courseResult = await tryCreateCourse(payload, {} as Request, {
			title: "Test Course Items",
			description: "Test Course Description",
			slug: "test-course-items",
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

		// Create a test category
		const categoryResult = await tryCreateGradebookCategory(
			payload,
			{} as Request,
			{
				gradebookId: testGradebook.id,
				name: "Test Category",
				description: "Test Category Description",
				weight: 50,
				sortOrder: 0,
			},
		);

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) {
			throw new Error("Failed to create test category");
		}
		testCategory = categoryResult.value;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	it("should create a gradebook item", async () => {
		const result = await tryCreateGradebookItem(payload, {} as Request, {
			gradebookId: testGradebook.id,
			categoryId: testCategory.id,
			name: "Test Item",
			description: "Test Item Description",
			maxGrade: 100,
			minGrade: 0,
			weight: 25,
			extraCredit: false,
			sortOrder: 0,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Test Item");
			expect(result.value.maxGrade).toBe(100);
			expect(result.value.weight).toBe(25);
			testItem = result.value;
		}
	});

	it("should not create item with invalid grade values", async () => {
		const result = await tryCreateGradebookItem(payload, {} as Request, {
			gradebookId: testGradebook.id,
			categoryId: testCategory.id,
			name: "Invalid Item",
			maxGrade: 50,
			minGrade: 100, // Invalid: min > max
			weight: 25,
			sortOrder: 1,
		});

		expect(result.ok).toBe(false);
	});

	it("should not create item with invalid weight", async () => {
		const result = await tryCreateGradebookItem(payload, {} as Request, {
			gradebookId: testGradebook.id,
			categoryId: testCategory.id,
			name: "Invalid Weight Item",
			weight: 150, // Invalid: > 100
			sortOrder: 1,
		});

		expect(result.ok).toBe(false);
	});

	it("should not create item with invalid sort order", async () => {
		const result = await tryCreateGradebookItem(payload, {} as Request, {
			gradebookId: testGradebook.id,
			categoryId: testCategory.id,
			name: "Invalid Sort Item",
			sortOrder: -1, // Invalid: negative
		});

		expect(result.ok).toBe(false);
	});

	it("should find gradebook item by ID", async () => {
		const result = await tryFindGradebookItemById(payload, testItem.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testItem.id);
			expect(result.value.name).toBe("Test Item");
		}
	});

	it("should update gradebook item", async () => {
		const result = await tryUpdateGradebookItem(
			payload,
			{} as Request,
			testItem.id,
			{
				name: "Updated Test Item",
				weight: 30,
			},
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Updated Test Item");
			expect(result.value.weight).toBe(30);
		}
	});

	it("should get gradebook items in order", async () => {
		// Create another item
		const item2Result = await tryCreateGradebookItem(payload, {} as Request, {
			gradebookId: testGradebook.id,
			categoryId: testCategory.id,
			name: "Test Item 2",
			sortOrder: 1,
		});

		expect(item2Result.ok).toBe(true);
		if (!item2Result.ok) {
			throw new Error("Failed to create second test item");
		}
		testItem2 = item2Result.value;

		const result = await tryGetGradebookItemsInOrder(payload, testGradebook.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.length).toBeGreaterThanOrEqual(2);
			expect(result.value[0].sortOrder).toBeLessThanOrEqual(
				result.value[1].sortOrder,
			);
		}
	});

	it("should get category items", async () => {
		const result = await tryGetCategoryItems(payload, testCategory.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("should get next item sort order", async () => {
		const result = await tryGetNextItemSortOrder(
			payload,
			testGradebook.id,
			testCategory.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBeGreaterThanOrEqual(2);
		}
	});

	it("should reorder items", async () => {
		const result = await tryReorderItems(payload, {} as Request, [
			testItem2.id,
			testItem.id,
		]);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
		}
	});

	it("should get items with user grades", async () => {
		const result = await tryGetItemsWithUserGrades(
			payload,
			testGradebook.id,
			student.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value)).toBe(true);
		}
	});

	it("should delete gradebook item", async () => {
		const result = await tryDeleteGradebookItem(
			payload,
			{} as Request,
			testItem2.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testItem2.id);
		}
	});

	it("should not find deleted item", async () => {
		const result = await tryFindGradebookItemById(payload, testItem2.id);

		expect(result.ok).toBe(false);
	});
});
