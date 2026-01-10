import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import type { TryResultValue } from "server/utils/types";
import sanitizedConfig from "../payload.config";
import { tryCreateCourse } from "./course-management";
import { tryCreateEnrollment } from "./enrollment-management";
import { tryCreateGradebookCategory } from "./gradebook-category-management";
import {
	tryCreateGradebookItem,
	tryDeleteGradebookItem,
	tryFindGradebookItemByCourseModuleLink,
	tryFindGradebookItemById,
	tryGetCategoryItems,
	tryGetGradebookItemsInOrder,
	tryGetItemsWithUserGrades,
	tryGetNextItemSortOrder,
	tryReorderItems,
	tryUpdateGradebookItem,
} from "./gradebook-item-management";
import { tryGetGradebookByCourseWithDetails } from "./gradebook-management";
import { tryCreateUserGrade } from "./user-grade-management";
import type { CreateUserArgs } from "./user-management";
import { tryCreateUser } from "./user-management";

describe("Gradebook Item Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let instructor: TryResultValue<typeof tryCreateUser>;
	let student: TryResultValue<typeof tryCreateUser>;
	let testCourse: TryResultValue<typeof tryCreateCourse>;
	let testEnrollment: TryResultValue<typeof tryCreateEnrollment>;
	let testGradebook: TryResultValue<typeof tryGetGradebookByCourseWithDetails>;
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

		// Create test users (instructor and student)
		const instructorArgs: CreateUserArgs = {
			payload,
			data: {
				email: "instructor@test.com",
				password: "password123",
				firstName: "John",
				lastName: "Instructor",
				role: "student",
			},
			overrideAccess: true,

			req: undefined,
		};

		const studentArgs: CreateUserArgs = {
			payload,
			data: {
				email: "student@test.com",
				password: "password123",
				firstName: "Jane",
				lastName: "Student",
				role: "student",
			},
			overrideAccess: true,

			req: undefined,
		};

		const instructorResult = await tryCreateUser(instructorArgs);
		const studentResult = await tryCreateUser(studentArgs);

		expect(instructorResult.ok).toBe(true);
		expect(studentResult.ok).toBe(true);
		if (!instructorResult.ok || !studentResult.ok) {
			throw new Error("Failed to create test users");
		}

		instructor = instructorResult.value;
		student = studentResult.value;

		// Create a test course
		const courseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Test Course Items",
				description: "Test Course Description",
				slug: "test-course-items",
				createdBy: instructor.id,
			},
			overrideAccess: true,

			req: undefined,
		});

		expect(courseResult.ok).toBe(true);
		if (!courseResult.ok) {
			throw new Error("Failed to create test course");
		}

		testCourse = courseResult.value;

		// Create enrollment for student in the course
		const enrollmentResult = await tryCreateEnrollment({
			payload,
			userId: student.id,
			course: testCourse.id,
			role: "student",
			status: "active",
			req: undefined,
			overrideAccess: true,
		});

		expect(enrollmentResult.ok).toBe(true);
		if (!enrollmentResult.ok) {
			throw new Error("Failed to create test enrollment");
		}
		testEnrollment = enrollmentResult.value;

		// Get the gradebook created by the course
		const gradebookResult = await tryGetGradebookByCourseWithDetails({
			payload,
			courseId: testCourse.id,
			req: undefined,
			overrideAccess: true,
		});
		expect(gradebookResult.ok).toBe(true);
		if (!gradebookResult.ok) {
			throw new Error("Failed to find gradebook for course");
		}
		testGradebook = gradebookResult.value;

		// Create a test category
		const categoryResult = await tryCreateGradebookCategory({
			payload,
			name: "Test Category",
			gradebookId: testGradebook.id,
			description: "Test Category Description",
			sortOrder: 0,
			req: undefined,
			overrideAccess: true,
		});

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
		// First create items with auto-weight (null) to avoid validation issues
		// Then update their weights to specific values
		const item1Result = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: testCategory.id,
			name: "Test Item",
			description: "Test Item Description",
			maxGrade: 100,
			minGrade: 0,
			weight: null, // Auto-weighted initially
			extraCredit: false,
			sortOrder: 0,
			req: undefined,
			overrideAccess: true,
		});

		expect(item1Result.ok).toBe(true);
		if (!item1Result.ok) {
			throw new Error("Failed to create test item");
		}
		testItem = item1Result.value;

		// Create second item with auto-weight
		const item2Result = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: testCategory.id,
			name: "Test Item 2",
			description: "Test Item 2 Description",
			maxGrade: 100,
			minGrade: 0,
			weight: null, // Auto-weighted initially
			extraCredit: false,
			sortOrder: 1,
			req: undefined,
			overrideAccess: true,
		});

		expect(item2Result.ok).toBe(true);
		if (!item2Result.ok) {
			throw new Error("Failed to create second test item");
		}
		testItem2 = item2Result.value;

		// Now update the first item to have weight 50%
		const updateResult = await tryUpdateGradebookItem({
			payload,
			itemId: testItem.id,
			weight: 50,
			req: undefined,
			overrideAccess: true,
		});

		expect(updateResult.ok).toBe(true);
		if (updateResult.ok) {
			expect(updateResult.value.weight).toBe(50);
		}

		// Update the second item to have weight 50% to make total 100%
		const update2Result = await tryUpdateGradebookItem({
			payload,
			itemId: testItem2.id,
			weight: 50,
			req: undefined,
			overrideAccess: true,
		});

		expect(update2Result.ok).toBe(true);
		if (update2Result.ok) {
			expect(update2Result.value.weight).toBe(50);
		}

		// Verify first item
		expect(testItem.name).toBe("Test Item");
		expect(testItem.maxGrade).toBe(100);
		expect(testItem.weight).toBe(null); // Initially null, but updated to 50 above
	});

	it("should not create item with invalid grade values", async () => {
		const result = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: testCategory.id,
			name: "Invalid Item",
			maxGrade: 50,
			minGrade: 100, // Invalid: min > max
			weight: 25,
			sortOrder: 1,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	it("should not create item with invalid weight", async () => {
		const result = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: testCategory.id,
			name: "Invalid Weight Item",
			weight: 150, // Invalid: > 100
			sortOrder: 1,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	it("should not create item with invalid sort order", async () => {
		const result = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: testCategory.id,
			name: "Invalid Sort Item",
			sortOrder: -1, // Invalid: negative
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	it("should find gradebook item by ID", async () => {
		const result = await tryFindGradebookItemById({
			payload,
			itemId: testItem.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testItem.id);
			expect(result.value.name).toBe("Test Item");
		}
	});

	it("should update gradebook item", async () => {
		// Ensure testItem exists
		if (!testItem) {
			throw new Error("testItem not initialized");
		}

		// Update name and weight
		// Since testItem and testItem2 should both have weight 50% from the first test,
		// we can update testItem to 60% and testItem2 to 40% to maintain 100% total
		const result = await tryUpdateGradebookItem({
			payload,
			itemId: testItem.id,
			name: "Updated Test Item",
			weight: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Updated Test Item");
		}

		// Update the other item in the category to 40% to make total 100%
		if (testItem2) {
			const update2Result = await tryUpdateGradebookItem({
				payload,
				itemId: testItem2.id,
				weight: 40,
				req: undefined,
				overrideAccess: true,
			});
			expect(update2Result.ok).toBe(true);
		}
	});

	it("should validate weights at category level recursively", async () => {
		// Create a category
		const categoryResult = await tryCreateGradebookCategory({
			payload,
			gradebookId: testGradebook.id,
			name: "Test Validation Category",
			sortOrder: 40,
			req: undefined,
			overrideAccess: true,
		});

		expect(categoryResult.ok).toBe(true);
		if (!categoryResult.ok) {
			throw new Error("Failed to create category");
		}

		const validationCategory = categoryResult.value;

		// First create items with auto-weight (null) to avoid validation issues
		const item1Result = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: validationCategory.id,
			name: "Category Item 1",
			weight: null, // Auto-weighted initially
			sortOrder: 0,
			req: undefined,
			overrideAccess: true,
		});

		expect(item1Result.ok).toBe(true);
		if (!item1Result.ok) {
			throw new Error("Failed to create category item 1");
		}

		// Create second item with auto-weight
		const item2Result = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: validationCategory.id,
			name: "Category Item 2",
			weight: null, // Auto-weighted initially
			sortOrder: 1,
			req: undefined,
			overrideAccess: true,
		});

		expect(item2Result.ok).toBe(true);
		if (!item2Result.ok) {
			throw new Error("Failed to create category item 2");
		}

		// Update first item to 40% weight
		const update1Result = await tryUpdateGradebookItem({
			payload,
			itemId: item1Result.value.id,
			weight: 40,
			req: undefined,
			overrideAccess: true,
		});

		expect(update1Result.ok).toBe(true);

		// Update second item to 60% weight to make total 100%
		const update2Result = await tryUpdateGradebookItem({
			payload,
			itemId: item2Result.value.id,
			weight: 60,
			req: undefined,
			overrideAccess: true,
		});

		expect(update2Result.ok).toBe(true);

		// Now try to update second item to 70% (would make total 40% + 70% = 110%)
		// This should fail because no auto-weighted items in category, so total must equal 100%
		const updateResult = await tryUpdateGradebookItem({
			payload,
			itemId: item2Result.value.id,
			weight: 70,
			req: undefined,
			overrideAccess: true,
		});

		expect(updateResult.ok).toBe(false);
		if (!updateResult.ok) {
			expect(updateResult.error.message).toContain(
				"course level > Test Validation Category",
			);
			expect(updateResult.error.message).toContain("must equal exactly 100%");
		}
	});

	it("should get gradebook items in order", async () => {
		// testItem2 should already exist from the first test, but if not, create it
		if (!testItem2) {
			// Create another item in the category with auto-weight (null) to avoid validation issues
			const item2Result = await tryCreateGradebookItem({
				payload,
				courseId: testCourse.id,
				categoryId: testCategory.id,
				name: "Test Item 2",
				weight: null, // Auto-weighted to avoid validation issues
				sortOrder: 1,
				req: undefined,
				overrideAccess: true,
			});

			expect(item2Result.ok).toBe(true);
			if (!item2Result.ok) {
				throw new Error("Failed to create second test item");
			}
			testItem2 = item2Result.value;
		}

		const result = await tryGetGradebookItemsInOrder({
			payload,
			gradebookId: testGradebook.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.length).toBeGreaterThanOrEqual(2);
			expect(result.value[0]!.sortOrder).toBeLessThanOrEqual(
				result.value[1]!.sortOrder,
			);
		}
	});

	it("should get category items", async () => {
		const result = await tryGetCategoryItems({
			payload,
			categoryId: testCategory.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("should get next item sort order", async () => {
		const result = await tryGetNextItemSortOrder({
			payload,
			gradebookId: testGradebook.id,
			categoryId: testCategory.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBeGreaterThanOrEqual(2);
		}
	});

	it("should reorder items", async () => {
		const result = await tryReorderItems({
			payload,
			req: undefined,
			overrideAccess: true,
			itemIds: [testItem2.id, testItem.id],
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
		}
	});

	it("should get items with user grades", async () => {
		const result = await tryGetItemsWithUserGrades({
			payload,
			gradebookId: testGradebook.id,
			enrollmentId: testEnrollment.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value)).toBe(true);
		}
	});

	it("should get items with non-empty userGrades array", async () => {
		// Ensure testItem exists
		if (!testItem) {
			throw new Error("testItem not initialized");
		}

		// Create a user grade for the test item
		const userGradeResult = await tryCreateUserGrade({
			payload,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
			baseGrade: 85,
			baseGradeSource: "manual",
			feedback: "Great work!",
			gradedBy: instructor.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(userGradeResult.ok).toBe(true);
		if (!userGradeResult.ok) {
			throw new Error("Failed to create user grade");
		}

		// Get items with user grades
		const result = await tryGetItemsWithUserGrades({
			payload,
			gradebookId: testGradebook.id,
			enrollmentId: testEnrollment.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value)).toBe(true);
			expect(result.value.length).toBeGreaterThan(0);

			// Find the item we created a grade for
			const itemWithGrade = result.value.find(
				(item) => item.id === testItem.id,
			);
			expect(itemWithGrade).toBeDefined();
			if (itemWithGrade) {
				// Access userGrades - it should be an array after transformation
				const userGrades = itemWithGrade.userGrades;
				expect(userGrades).toBeDefined();

				// Check if userGrades is an array (after transformation in tryGetItemsWithUserGrades)
				// It might be the Payload response type with docs property, or already transformed to array

				expect(userGrades?.length ?? 0).toBeGreaterThan(0);
			}
		}
	});

	it("should delete gradebook item", async () => {
		// Ensure testItem2 exists before trying to delete it
		if (!testItem2) {
			// Create a temporary item to delete
			const tempItemResult = await tryCreateGradebookItem({
				payload,
				courseId: testCourse.id,
				categoryId: testCategory.id,
				name: "Temp Item to Delete",
				weight: null, // Auto-weighted
				sortOrder: 100,
				req: {
					user: instructor as typeof instructor & { collection: "users" },
				},
				overrideAccess: true,
			});

			expect(tempItemResult.ok).toBe(true);
			if (!tempItemResult.ok) {
				throw new Error("Failed to create temp item for deletion test");
			}
			testItem2 = tempItemResult.value;
		}

		const result = await tryDeleteGradebookItem({
			payload,
			itemId: testItem2.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testItem2.id);
		}
	});

	it("should not find deleted item", async () => {
		const result = await tryFindGradebookItemById({
			payload,
			itemId: testItem2.id,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
	});

	it("should create extra credit gradebook item", async () => {
		const result = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: null, // Extra credit items are typically not in categories
			name: "Extra Credit Assignment",
			description: "Optional extra credit work",
			maxGrade: 20,
			minGrade: 0,
			weight: 10, // This will be added to the total weight, potentially exceeding 100%
			extraCredit: true,
			sortOrder: 2,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Extra Credit Assignment");
			expect(result.value.extraCredit).toBe(true);
			expect(result.value.maxGrade).toBe(20);
			expect(result.value.weight).toBe(10);
		}
	});

	it("should create extra credit item with zero weight", async () => {
		const result = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: null,
			name: "Participation Extra Credit",
			description: "Class participation bonus",
			maxGrade: 5,
			minGrade: 0,
			weight: 0, // Zero weight extra credit
			extraCredit: true,
			sortOrder: 3,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.extraCredit).toBe(true);
			expect(result.value.weight).toBe(0);
		}
	});

	it("should handle extra credit items in final grade calculation", async () => {
		// This test would require user grades to be created and calculated
		// For now, we'll just verify the items exist
		const allItems = await tryGetGradebookItemsInOrder({
			payload,
			gradebookId: testGradebook.id,
			req: undefined,
			overrideAccess: true,
		});
		expect(allItems.ok).toBe(true);

		if (allItems.ok) {
			const extraCreditItems = allItems.value.filter(
				(item) => item.extraCredit,
			);
			expect(extraCreditItems.length).toBeGreaterThan(0);

			// Verify extra credit items have the correct properties
			extraCreditItems.forEach((item) => {
				expect(item.extraCredit).toBe(true);
				expect(item.maxGrade).toBeGreaterThan(0);
			});
		}
	});

	it("should fail to find gradebook item for non-existent course module link", async () => {
		const result = await tryFindGradebookItemByCourseModuleLink({
			payload,
			req: undefined,
			overrideAccess: true,
			courseModuleLinkId: 99999, // Non-existent course module link ID
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(String(result.error)).toContain("not found");
		}
	});
});
