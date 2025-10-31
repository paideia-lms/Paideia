import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import type { TryResultValue } from "server/utils/type-narrowing";
import { DuplicateGradebookError } from "~/utils/error";
import sanitizedConfig from "../payload.config";
import { tryCreateCourse } from "./course-management";
import { tryCreateGradebookCategory } from "./gradebook-category-management";
import { tryCreateGradebookItem } from "./gradebook-item-management";
import {
	calculateAdjustedWeights,
	calculateOverallWeights,
	type GradebookSetupItem,
	type GradebookSetupItemWithCalculations,
	tryCreateGradebook,
	tryFindGradebookByCourseId,
	tryFindGradebookById,
	tryGetGradebookByCourseWithDetails,
	tryGetGradebookJsonRepresentation,
	tryGetGradebookWithDetails,
	tryUpdateGradebook,
} from "./gradebook-management";
import type { CreateUserArgs } from "./user-management";
import { tryCreateUser } from "./user-management";

describe("Gradebook Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let instructor: TryResultValue<typeof tryCreateUser>;
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
		};

		const instructorResult = await tryCreateUser(instructorArgs);

		expect(instructorResult.ok).toBe(true);
		if (!instructorResult.ok) {
			throw new Error("Failed to create test instructor");
		}

		instructor = instructorResult.value;

		// create a test course
		const courseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Test Course",
				description: "Test Course Description",
				slug: "test-course",
				createdBy: instructor.id,
			},
			overrideAccess: true,
		});

		expect(courseResult.ok).toBe(true);
		if (!courseResult.ok) {
			throw new Error("Failed to create test course");
		}

		testCourse = courseResult.value;

		// The course creation already creates a gradebook, so let's get it
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

		// Create test items
		const itemResult = await tryCreateGradebookItem(payload, {} as Request, {
			gradebookId: testGradebook.id,
			categoryId: testCategory.id,
			name: "Test Assignment",
			description: "Test Assignment Description",
			maxGrade: 100,
			minGrade: 0,
			weight: 25,
			extraCredit: false,
			sortOrder: 0,
		});

		expect(itemResult.ok).toBe(true);
		if (!itemResult.ok) {
			throw new Error("Failed to create test item");
		}
		testItem = itemResult.value;

		const item2Result = await tryCreateGradebookItem(payload, {} as Request, {
			gradebookId: testGradebook.id,
			categoryId: null,
			name: "Test Manual Item",
			description: "Test Manual Item Description",
			maxGrade: 50,
			minGrade: 0,
			weight: 15,
			extraCredit: false,
			sortOrder: 1,
		});

		expect(item2Result.ok).toBe(true);
		if (!item2Result.ok) {
			throw new Error("Failed to create test item 2");
		}
		testItem2 = item2Result.value;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	it("should find existing gradebook for a course", async () => {
		const result = await tryFindGradebookByCourseId(payload, testCourse.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.course).toBeDefined();
			expect(result.value.enabled).toBe(true);
			testGradebook = result.value;
		}
	});

	it("should not create duplicate gradebook for the same course", async () => {
		const result = await tryCreateGradebook(payload, {} as Request, {
			courseId: testCourse.id,
			enabled: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeInstanceOf(DuplicateGradebookError);
		}
	});

	it("should find gradebook by ID", async () => {
		const result = await tryFindGradebookById(payload, testGradebook.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGradebook.id);
			expect(result.value.course).toBeDefined();
		}
	});

	it("should find gradebook by course ID", async () => {
		const result = await tryFindGradebookByCourseId(payload, testCourse.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGradebook.id);
		}
	});

	it("should update gradebook", async () => {
		const result = await tryUpdateGradebook(
			payload,
			{} as Request,
			testGradebook.id,
			{
				enabled: false,
			},
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.enabled).toBe(false);
		}
	});

	it("should get gradebook with details", async () => {
		const result = await tryGetGradebookWithDetails(payload, testGradebook.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGradebook.id);
			expect(result.value.categories).toBeDefined();
			expect(result.value.items).toBeDefined();
		}
	});

	it("should get gradebook by course with details", async () => {
		const result = await tryGetGradebookByCourseWithDetails(
			payload,
			testCourse.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGradebook.id);
		}

		console.log(result.value);
	});

	it("should get gradebook JSON representation", async () => {
		const result = await tryGetGradebookJsonRepresentation(
			payload,
			testGradebook.id,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Failed to get gradebook JSON representation");
		}
		const json = result.value;

		console.log(JSON.stringify(json, null, 2));

		// Check basic structure
		expect(json.gradebook_id).toBe(testGradebook.id);
		expect(json.course_id).toBe(testCourse.id);
		expect(json.gradebook_setup).toBeDefined();
		expect(json.gradebook_setup.exclude_empty_grades).toBe(true);
		expect(Array.isArray(json.gradebook_setup.items)).toBe(true);

		// Check that we have both manual items and categories
		const manualItems = json.gradebook_setup.items.filter(
			(item) => item.type === "manual_item",
		);
		const categories = json.gradebook_setup.items.filter(
			(item) => item.type === "category",
		);

		expect(manualItems.length).toBeGreaterThanOrEqual(1);
		expect(categories.length).toBeGreaterThanOrEqual(1);

		// Check manual item structure
		const manualItem = manualItems.find(
			(item) => item.name === "Test Manual Item",
		);
		expect(manualItem).toBeDefined();
		if (manualItem) {
			expect(manualItem.id).toBe(testItem2.id);
			expect(manualItem.type).toBe("manual_item");
			expect(manualItem.weight).toBe(15);
			expect(manualItem.max_grade).toBe(50);
		}

		// Check category structure
		const category = categories.find((item) => item.name === "Test Category");
		expect(category).toBeDefined();
		if (category) {
			expect(category.id).toBe(testCategory.id);
			expect(category.type).toBe("category");
			expect(category.weight).toBe(50);
			expect(category.max_grade).toBeNull();
			expect(Array.isArray(category.grade_items)).toBe(true);
			if (category.grade_items) {
				expect(category.grade_items.length).toBeGreaterThanOrEqual(1);

				// Check grade item within category
				const gradeItem = category.grade_items.find(
					(item) => item.name === "Test Assignment",
				);
				expect(gradeItem).toBeDefined();
				if (gradeItem) {
					expect(gradeItem.id).toBe(testItem.id);
					expect(gradeItem.type).toBe("manual_item"); // Default type when no activity module
					expect(gradeItem.weight).toBe(25);
					expect(gradeItem.max_grade).toBe(100);
				}
			}
		}
	});

	it("should calculate adjusted weights for items with specified weights", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 40,
				max_grade: 100,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: 60,
				max_grade: 100,
			},
		];

		const result = calculateAdjustedWeights(items);

		expect(result.length).toBe(2);
		expect((result[0] as GradebookSetupItemWithCalculations).adjusted_weight).toBe(40);
		expect((result[1] as GradebookSetupItemWithCalculations).adjusted_weight).toBe(60);
	});

	it("should calculate adjusted weights for items without weights", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: null,
				max_grade: 100,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: null,
				max_grade: 100,
			},
		];

		const result = calculateAdjustedWeights(items);

		expect(result.length).toBe(2);
		// Each item should get 50% (100% / 2)
		expect((result[0] as GradebookSetupItemWithCalculations).adjusted_weight).toBe(50);
		expect((result[1] as GradebookSetupItemWithCalculations).adjusted_weight).toBe(50);
	});

	it("should calculate adjusted weights for mixed items", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 40,
				max_grade: 100,
			},
			{
				id: 2,
				type: "manual_item",
				name: "Item 2",
				weight: null,
				max_grade: 100,
			},
			{
				id: 3,
				type: "manual_item",
				name: "Item 3",
				weight: null,
				max_grade: 100,
			},
		];

		const result = calculateAdjustedWeights(items);

		expect(result.length).toBe(3);
		expect((result[0] as GradebookSetupItemWithCalculations).adjusted_weight).toBe(40);
		// Remaining 60% divided by 2 = 30% each
		expect((result[1] as GradebookSetupItemWithCalculations).adjusted_weight).toBe(30);
		expect((result[2] as GradebookSetupItemWithCalculations).adjusted_weight).toBe(30);
	});

	it("should calculate adjusted weights for nested categories", () => {
		const items: GradebookSetupItem[] = [
			{
				id: 1,
				type: "category",
				name: "Category 1",
				weight: 50,
				max_grade: null,
				grade_items: [
					{
						id: 2,
						type: "manual_item",
						name: "Item 1",
						weight: 60,
						max_grade: 100,
					},
					{
						id: 3,
						type: "manual_item",
						name: "Item 2",
						weight: null,
						max_grade: 100,
					},
				],
			},
		];

		const result = calculateAdjustedWeights(items);

		expect(result.length).toBe(1);
		expect((result[0] as GradebookSetupItemWithCalculations).adjusted_weight).toBe(50);
		expect(result[0].grade_items).toBeDefined();
		if (result[0].grade_items) {
			expect(
				(result[0].grade_items[0] as GradebookSetupItemWithCalculations)
					.adjusted_weight,
			).toBe(60);
			// Remaining 40% goes to Item 2
			expect(
				(result[0].grade_items[1] as GradebookSetupItemWithCalculations)
					.adjusted_weight,
			).toBe(40);
		}
	});

	it("should calculate overall weights for root-level items", () => {
		const items: GradebookSetupItemWithCalculations[] = [
			{
				id: 1,
				type: "manual_item",
				name: "Item 1",
				weight: 40,
				adjusted_weight: 40,
				overall_weight: null,
				weight_explanation: null,
				max_grade: 100,
			},
		];

		calculateOverallWeights(items);

		// Root-level item's overall weight equals its adjusted weight
		expect(items[0].overall_weight).toBe(40);
		// Root-level item should have explanation showing just the item
		expect(items[0].weight_explanation).toBe("Item 1 (40.00%) = 40.00%");
	});

	it("should calculate overall weights for items in categories", () => {
		// The function processes recursively, so we need to understand the context
		// When processing items within a category, it searches in the parent scope
		const items: GradebookSetupItemWithCalculations[] = [
			{
				id: 1,
				type: "category",
				name: "Category 1",
				weight: 50,
				adjusted_weight: 50,
				overall_weight: null,
				weight_explanation: null,
				max_grade: null,
				grade_items: [
					{
						id: 2,
						type: "manual_item",
						name: "Item 1",
						weight: 40,
						adjusted_weight: 40,
						overall_weight: null,
						weight_explanation: null,
						max_grade: 100,
					},
					{
						id: 3,
						type: "manual_item",
						name: "Item 2",
						weight: 60,
						adjusted_weight: 60,
						overall_weight: null,
						weight_explanation: null,
						max_grade: 100,
					},
				] as GradebookSetupItemWithCalculations[],
			},
		];

		calculateOverallWeights(items);

		// Note: The function is processing recursively, so when it processes items
		// within category 1, it searches for the parent in the root `items` array.
		// Since item 2 is inside category 1 (which is in the root array), it should find it.

		// Category should not have overall weight (categories don't get overall weight)
		// However, categories might get overall_weight set if they're processed as leaf items
		// The function checks `if (item.type === "category")` but continues processing
		// Let's check what actually happens
		if (items[0].grade_items) {
			// Items inside the category should have their overall weight calculated
			const item1 = items[0].grade_items[0] as GradebookSetupItemWithCalculations;
			const item2 = items[0].grade_items[1] as GradebookSetupItemWithCalculations;

			// Since these items are processed within the recursive call,
			// and the function searches in the parent scope (items),
			// it should find category 1 as the parent
			// Item 1: 50% (category) * 40% (item) = 20%
			expect(item1.overall_weight).toBe(20);
			expect(item1.weight_explanation).toBe(
				"Category 1 (50.00%) × Item 1 (40.00%) = 20.00%",
			);
			// Item 2: 50% (category) * 60% (item) = 30%
			expect(item2.overall_weight).toBe(30);
			expect(item2.weight_explanation).toBe(
				"Category 1 (50.00%) × Item 2 (60.00%) = 30.00%",
			);
		}
	});

	it("should calculate overall weights for nested categories", () => {
		const items: GradebookSetupItemWithCalculations[] = [
			{
				id: 1,
				type: "category",
				name: "Category 1",
				weight: 35,
				adjusted_weight: 35,
				overall_weight: null,
				weight_explanation: null,
				max_grade: null,
				grade_items: [
					{
						id: 2,
						type: "category",
						name: "Category 2",
						weight: 50,
						adjusted_weight: 50,
						overall_weight: null,
						weight_explanation: null,
						max_grade: null,
						grade_items: [
							{
								id: 3,
								type: "manual_item",
								name: "Item 1",
								weight: 10,
								adjusted_weight: 10,
								overall_weight: null,
								weight_explanation: null,
								max_grade: 100,
							},
						] as GradebookSetupItemWithCalculations[],
					} as GradebookSetupItemWithCalculations,
				] as GradebookSetupItemWithCalculations[],
			},
		];

		calculateOverallWeights(items);

		// Item 1: 35% (parent category) * 50% (nested category) * 10% (item) = 1.75%
		const item = items[0].grade_items?.[0]
			.grade_items?.[0] as GradebookSetupItemWithCalculations | undefined;
		if (item) {
			expect(item.overall_weight).toBeCloseTo(1.75, 2);
			expect(item.weight_explanation).toBe(
				"Category 1 (35.00%) × Category 2 (50.00%) × Item 1 (10.00%) = 1.75%",
			);
		}
	});

	it("should set overall weight to null for items without adjusted weight", () => {
		const items = [
			{
				id: 1,
				type: "category",
				name: "Category 1",
				weight: 50,
				adjusted_weight: 50,
				overall_weight: null,
				weight_explanation: null,
				max_grade: null,
				grade_items: [
					{
						id: 2,
						type: "manual_item",
						name: "Item 1",
						weight: null,
						adjusted_weight: null,
						overall_weight: null,
						weight_explanation: null,
						max_grade: 100,
					},
				],
			},
		];

		calculateOverallWeights(items as GradebookSetupItemWithCalculations[]);

		// Item without adjusted weight should have null overall weight
		if (items[0].grade_items) {
			const item = items[0].grade_items[0] as GradebookSetupItemWithCalculations;
			expect(item.overall_weight).toBeNull();
			expect(item.weight_explanation).toBeNull();
		}
	});

	it("should not calculate overall weight for categories", () => {
		const items: GradebookSetupItemWithCalculations[] = [
			{
				id: 1,
				type: "category",
				name: "Category 1",
				weight: 50,
				adjusted_weight: 50,
				overall_weight: null,
				weight_explanation: null,
				max_grade: null,
			},
		];

		calculateOverallWeights(items);

		// Categories should not have overall weight or explanation
		expect(items[0].overall_weight).toBeNull();
		expect(items[0].weight_explanation).toBeNull();
	});
});
