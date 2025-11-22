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
	tryCreateGradebook,
	tryGetGradebookAllRepresentations,
	tryGetGradebookByCourseWithDetails,
	tryUpdateGradebook,
} from "./gradebook-management";
import type { CreateUserArgs } from "./user-management";
import { tryCreateUser } from "./user-management";

describe("Gradebook Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let instructor: TryResultValue<typeof tryCreateUser>;
	let testCourse: TryResultValue<typeof tryCreateCourse>;
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
		const gradebookResult = await tryGetGradebookByCourseWithDetails({
			payload,
			courseId: testCourse.id,
			user: null,
			req: undefined,
			overrideAccess: true,
		});
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
			courseId: testCourse.id,
			categoryId: testCategory.id,
			name: "Test Assignment",
			description: "Test Assignment Description",
			maxGrade: 100,
			minGrade: 0,
			extraCredit: false,
			sortOrder: 0,
		});

		expect(itemResult.ok).toBe(true);
		if (!itemResult.ok) {
			throw new Error("Failed to create test item");
		}
		testItem = itemResult.value;

		const item2Result = await tryCreateGradebookItem(payload, {} as Request, {
			courseId: testCourse.id,
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
		const result = await tryGetGradebookByCourseWithDetails({
			payload,
			courseId: testCourse.id,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.course).toBeDefined();
			expect(result.value.enabled).toBe(true);
			testGradebook = result.value;
		}
	});

	it("should not create duplicate gradebook for the same course", async () => {
		const result = await tryCreateGradebook({
			payload,
			courseId: testCourse.id,
			enabled: true,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeInstanceOf(DuplicateGradebookError);
		}
	});

	it("should find gradebook by course ID", async () => {
		const result = await tryGetGradebookByCourseWithDetails({
			payload,
			courseId: testCourse.id,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGradebook.id);
		}
	});

	it("should update gradebook", async () => {
		const result = await tryUpdateGradebook({
			payload,
			gradebookId: testGradebook.id,
			enabled: false,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.enabled).toBe(false);
		}
	});

	it("should get gradebook by course with details", async () => {
		const result = await tryGetGradebookByCourseWithDetails({
			payload,
			courseId: testCourse.id,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGradebook.id);
		}

		console.log(result.value);
	});

	it("should get gradebook JSON representation", async () => {
		const result = await tryGetGradebookAllRepresentations({
			payload,
			courseId: testCourse.id,
			user: null,
			req: undefined,
			overrideAccess: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Failed to get gradebook all representations");
		}
		const json = result.value.json;

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
			expect(manualItem.weight).toBe(15); // auto-weighted
			expect(manualItem.max_grade).toBe(50);
		}

		// Check category structure
		const category = categories.find((item) => item.name === "Test Category");
		expect(category).toBeDefined();
		if (category) {
			expect(category.id).toBe(testCategory.id);
			expect(category.type).toBe("category");
			expect(category.weight).toBe(null);
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
					expect(gradeItem.weight).toBe(null); // auto-weighted
					expect(gradeItem.max_grade).toBe(100);
				}
			}
		}
	});
});
