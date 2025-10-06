import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import type { TryResultValue } from "server/utils/type-narrowing";
import sanitizedConfig from "../payload.config";
import { tryCreateCourse } from "./course-management";
import { tryCreateEnrollment } from "./enrollment-management";
import { tryCreateGradebookCategory } from "./gradebook-category-management";
import { tryCreateGradebookItem } from "./gradebook-item-management";
import { tryFindGradebookByCourseId } from "./gradebook-management";
import {
	tryBulkUpdateUserGrades,
	tryCalculateUserFinalGrade,
	tryCreateUserGrade,
	tryDeleteUserGrade,
	tryFindUserGradeByEnrollmentAndItem,
	tryFindUserGradeById,
	tryGetGradesForItem,
	tryGetUserGradesForGradebook,
	tryUpdateUserGrade,
} from "./user-grade-management";
import type { CreateUserArgs } from "./user-management";
import { tryCreateUser } from "./user-management";

describe("User Grade Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let instructor: TryResultValue<typeof tryCreateUser>;
	let student: TryResultValue<typeof tryCreateUser>;
	let testCourse: TryResultValue<typeof tryCreateCourse>;
	let testEnrollment: TryResultValue<typeof tryCreateEnrollment>;
	let testGradebook: TryResultValue<typeof tryFindGradebookByCourseId>;
	let testCategory: TryResultValue<typeof tryCreateGradebookCategory>;
	let testItem: TryResultValue<typeof tryCreateGradebookItem>;
	let testItem2: TryResultValue<typeof tryCreateGradebookItem>;
	let testGrade: TryResultValue<typeof tryCreateUserGrade>;

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
			title: "Test Course Grades",
			description: "Test Course Description",
			slug: "test-course-grades",
			createdBy: instructor.id,
		});

		expect(courseResult.ok).toBe(true);
		if (!courseResult.ok) {
			throw new Error("Failed to create test course");
		}

		testCourse = courseResult.value;

		// Create enrollment for student in the course
		const enrollmentResult = await tryCreateEnrollment(payload, {
			user: student.id,
			course: testCourse.id,
			role: "student",
			status: "active",
		});

		expect(enrollmentResult.ok).toBe(true);
		if (!enrollmentResult.ok) {
			throw new Error("Failed to create test enrollment");
		}
		testEnrollment = enrollmentResult.value;

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
				parentId: null,
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
			name: "Test Quiz",
			description: "Test Quiz Description",
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

	it("should create a user grade", async () => {
		const result = await tryCreateUserGrade(payload, {} as Request, {
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
			grade: 85,
			feedback: "Good work!",
			gradedBy: instructor.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.grade).toBe(85);
			expect(result.value.feedback).toBe("Good work!");
			testGrade = result.value;
		}
	});

	it("should not create duplicate grade for same enrollment and item", async () => {
		const result = await tryCreateUserGrade(payload, {} as Request, {
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
			grade: 90,
		});

		expect(result.ok).toBe(false);
	});

	it("should not create grade with invalid value", async () => {
		const result = await tryCreateUserGrade(payload, {} as Request, {
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem2.id,
			grade: 150, // Invalid: > maxGrade (50)
		});

		expect(result.ok).toBe(false);
	});

	it("should find grade by ID", async () => {
		const result = await tryFindUserGradeById(payload, testGrade.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGrade.id);
			expect(result.value.grade).toBe(85);
		}
	});

	it("should find grade by enrollment and item", async () => {
		const result = await tryFindUserGradeByEnrollmentAndItem(
			payload,
			testEnrollment.id,
			testItem.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGrade.id);
		}
	});

	it("should update grade", async () => {
		const result = await tryUpdateUserGrade(
			payload,
			{} as Request,
			testGrade.id,
			{
				grade: 90,
				feedback: "Excellent work!",
			},
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.grade).toBe(90);
			expect(result.value.feedback).toBe("Excellent work!");
		}
	});

	it("should get user grades for gradebook", async () => {
		const result = await tryGetUserGradesForGradebook(
			payload,
			testEnrollment.id,
			testGradebook.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toHaveLength(1);
			expect(result.value[0].id).toBe(testGrade.id);
		}
	});

	it("should get grades for item", async () => {
		const result = await tryGetGradesForItem(payload, testItem.id);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toHaveLength(1);
			expect(result.value[0].id).toBe(testGrade.id);
		}
	});

	it("should bulk update user grades", async () => {
		const result = await tryBulkUpdateUserGrades(payload, {} as Request, {
			enrollmentId: testEnrollment.id,
			grades: [
				{
					gradebookItemId: testItem2.id,
					grade: 45,
					feedback: "Good quiz performance",
				},
			],
			gradedBy: instructor.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toHaveLength(1);
			expect(result.value[0].grade).toBe(45);
		}
	});

	it("should calculate user final grade", async () => {
		const result = await tryCalculateUserFinalGrade(
			payload,
			testEnrollment.id,
			testGradebook.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.finalGrade).toBeDefined();
			expect(result.value.totalWeight).toBeGreaterThan(0);
			expect(result.value.gradedItems).toBeGreaterThan(0);
		}
	});

	it("should delete grade", async () => {
		const result = await tryDeleteUserGrade(
			payload,
			{} as Request,
			testGrade.id,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGrade.id);
		}
	});

	it("should not find deleted grade", async () => {
		const result = await tryFindUserGradeById(payload, testGrade.id);

		expect(result.ok).toBe(false);
	});
});
