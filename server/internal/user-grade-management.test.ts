import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/types";
import sanitizedConfig from "../payload.config";
import {
	tryCreateAssignmentModule,
	tryCreateDiscussionModule,
} from "./activity-module-management";
import {
	tryCreateAssignmentSubmission,
	tryGradeAssignmentSubmission,
} from "./assignment-submission-management";
import { tryCreateCourseActivityModuleLink } from "./course-activity-module-link-management";
import { tryCreateCourse } from "./course-management";
import { tryCreateSection } from "./course-section-management";
import {
	type CreateDiscussionSubmissionArgs,
	type GradeDiscussionSubmissionArgs,
	tryCreateDiscussionSubmission,
	tryGradeDiscussionSubmission,
} from "./discussion-management";
import { tryCreateEnrollment } from "./enrollment-management";
import { tryCreateGradebookCategory } from "./gradebook-category-management";
import { tryCreateGradebookItem } from "./gradebook-item-management";
import { tryGetGradebookByCourseWithDetails } from "./gradebook-management";
import {
	tryAddAdjustment,
	tryCalculateUserFinalGrade,
	tryCreateUserGrade,
	tryDeleteUserGrade,
	tryFindUserGradeByEnrollmentAndItem,
	tryFindUserGradeById,
	tryGetAdjustedSingleUserGrades,
	tryGetGradesForItem,
	tryGetSingleUserGradesJsonRepresentation,
	tryGetUserGradesForGradebook,
	tryGetUserGradesJsonRepresentation,
	tryReleaseAssignmentGrade,
	tryReleaseDiscussionGrade,
	tryRemoveAdjustment,
	tryToggleAdjustment,
	tryUpdateUserGrade,
} from "./user-grade-management";
import { tryCreateUser } from "./user-management";

/**
 * in the before all, we create 3 users: admin, instructor, and student
 * then we create a course
 * then we create an enrollment for the student in the course
 * then we create a gradebook for the course
 * then we create a auto weighted category for the gradebook
 * then we create a auto weighted manual item for the gradebook in this category
 * then we create a manual item that weight 40% of the total grade at the root
 *
 * test 1: create a auto weighted grade for the enrollment and item at the root
 */
describe("User Grade Management", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let admin: TryResultValue<typeof tryCreateUser>;
	let instructor: TryResultValue<typeof tryCreateUser>;
	let student: TryResultValue<typeof tryCreateUser>;
	let testCourse: TryResultValue<typeof tryCreateCourse>;
	let testEnrollment: TryResultValue<typeof tryCreateEnrollment>;
	let testGradebook: TryResultValue<typeof tryGetGradebookByCourseWithDetails>;
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

		const [adminResult, instructorResult, studentResult] = await Promise.all([
			tryCreateUser({
				payload,
				data: {
					email: "admin@test.com",
					password: "password123",
					firstName: "Admin",
					lastName: "User",
					role: "admin",
				},
				overrideAccess: true,
				req: undefined,
			}).getOrThrow(),
			tryCreateUser({
				payload,
				data: {
					email: "instructor@test.com",
					password: "password123",
					firstName: "John",
					lastName: "Instructor",
					role: "instructor",
				},
				overrideAccess: true,
				req: undefined,
			}).getOrThrow(),
			tryCreateUser({
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
			}).getOrThrow(),
		]);

		admin = adminResult;
		instructor = instructorResult;
		student = studentResult;

		// Create a test course
		testCourse = await tryCreateCourse({
			payload,
			data: {
				title: "Test Course Grades",
				description: "Test Course Description",
				slug: "test-course-grades",
				createdBy: instructor.id,
			},
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		// Create enrollment for student in the course
		testEnrollment = await tryCreateEnrollment({
			payload,
			userId: student.id,
			course: testCourse.id,
			role: "student",
			status: "active",
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		// Get the gradebook created by the course
		testGradebook = await tryGetGradebookByCourseWithDetails({
			payload,
			courseId: testCourse.id,
			req: undefined,
			overrideAccess: true,
		}).getOrThrow();

		// Create a test category
		testCategory = await tryCreateGradebookCategory({
			payload,
			gradebookId: testGradebook.id,
			parentId: null,
			name: "Test Category",
			description: "Test Category Description",
			sortOrder: 0,
			req: undefined,
			overrideAccess: true,
		}).getOrThrow();

		// Create test items
		testItem = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: testCategory.id,
			name: "Test Assignment",
			description: "Test Assignment Description",
			maxGrade: 100,
			minGrade: 0,
			weight: null,
			extraCredit: false,
			sortOrder: 0,
			req: undefined,
			overrideAccess: true,
		}).getOrThrow();

		testItem2 = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: null,
			name: "Test Quiz",
			description: "Test Quiz Description",
			maxGrade: 50,
			minGrade: 0,
			weight: 40, // 40% of total
			extraCredit: false,
			sortOrder: 1,
			req: undefined,
			overrideAccess: true,
		}).getOrThrow();
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
		const result = await tryCreateUserGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
			baseGrade: 85,
			feedback: "Good work!",
			gradedBy: instructor.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.baseGrade).toBe(85);
			expect(result.value.feedback).toBe("Good work!");
			testGrade = result.value;
		}
	});

	it("should not create duplicate grade for same enrollment and item", async () => {
		const result = await tryCreateUserGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
			baseGrade: 90,
		});

		expect(result.ok).toBe(false);
	});

	it("should not create grade with invalid value", async () => {
		const result = await tryCreateUserGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem2.id,
			baseGrade: 150, // Invalid: > maxGrade (50)
		});

		expect(result.ok).toBe(false);
	});

	it("should find grade by ID", async () => {
		const result = await tryFindUserGradeById({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			gradeId: testGrade.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGrade.id);
			expect(result.value.baseGrade).toBe(85);
		}
	});

	it("should find grade by enrollment and item", async () => {
		const result = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGrade.id);
		}
	});

	it("should update grade", async () => {
		const result = await tryUpdateUserGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			gradeId: testGrade.id,
			baseGrade: 90,
			feedback: "Excellent work!",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.baseGrade).toBe(90);
			expect(result.value.feedback).toBe("Excellent work!");
		}
	});

	it("should get user grades for gradebook", async () => {
		const result = await tryGetUserGradesForGradebook({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookId: testGradebook.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			console.log(result.value);
			expect(result.value).toHaveLength(1);
			expect(result.value[0]!.id).toBe(testGrade.id);
		}
	});

	it("should get grades for item", async () => {
		const result = await tryGetGradesForItem({
			payload,
			req: {
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			gradebookItemId: testItem.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toHaveLength(1);
			expect(result.value[0]!.id).toBe(testGrade.id);
		}
	});

	it("should calculate user final grade", async () => {
		const result = await tryCalculateUserFinalGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: true,
			enrollmentId: testEnrollment.id,
			gradebookId: testGradebook.id,
		});

		expect(result.ok).toBe(true);
	});

	it("should delete grade", async () => {
		const result = await tryDeleteUserGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			gradeId: testGrade.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(testGrade.id);
		}
	});

	it("should not find deleted grade", async () => {
		const result = await tryFindUserGradeById({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			gradeId: testGrade.id,
		});

		expect(result.ok).toBe(false);
	});

	it("should get user grades JSON representation", async () => {
		const result = await tryGetUserGradesJsonRepresentation({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			courseId: testCourse.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			console.log(JSON.stringify(result.value, null, 2));
			expect(result.value.course_id).toBe(testCourse.id);
			expect(result.value.enrollments).toHaveLength(1);

			const enrollment = result.value.enrollments[0]!;
			expect(enrollment.enrollment_id).toBe(testEnrollment.id);
			expect(enrollment.user_id).toBe(student.id);
			expect(enrollment.items).toHaveLength(2);
		}
	});

	it("should get single user grades JSON representation", async () => {
		const result = await tryGetSingleUserGradesJsonRepresentation({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			courseId: testCourse.id,
			enrollmentId: testEnrollment.id,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			console.log("Single user grades:", JSON.stringify(result.value, null, 2));
			expect(result.value.course_id).toBe(testCourse.id);
			expect(result.value.gradebook_id).toBe(testGradebook.id);
			expect(result.value.enrollment.enrollment_id).toBe(testEnrollment.id);
			expect(result.value.enrollment.user_id).toBe(student.id);
			expect(result.value.enrollment.items).toHaveLength(2);
		}
	});

	it("should fail to get single user grades for non-existent enrollment", async () => {
		const result = await tryGetSingleUserGradesJsonRepresentation({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			courseId: testCourse.id,
			enrollmentId: 99999, // Non-existent enrollment ID
		});

		expect(result.ok).toBe(false);
	});

	it("should fail to get single user grades for wrong course", async () => {
		// Create another course (only admin can create courses)
		const anotherCourseResult = await tryCreateCourse({
			payload,
			data: {
				title: "Another Test Course",
				description: "Another Test Course Description",
				slug: "another-test-course",
				createdBy: admin.id,
			},
			req: { user: admin as typeof admin & { collection: "users" } },
			overrideAccess: false,
		});

		expect(anotherCourseResult.ok).toBe(true);
		if (anotherCourseResult.ok) {
			const result = await tryGetSingleUserGradesJsonRepresentation({
				payload,
				req: {
					...mockRequest,
					user: instructor as typeof instructor & { collection: "users" },
				},
				overrideAccess: false,
				courseId: anotherCourseResult.value.id,
				enrollmentId: testEnrollment.id, // This enrollment belongs to testCourse, not anotherCourse
			});

			expect(result.ok).toBe(false);
		}
	});

	it("should get adjusted single user grades with JSON, YAML, and Markdown", async () => {
		const result = await tryGetAdjustedSingleUserGrades({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			courseId: testCourse.id,
			enrollmentId: testEnrollment.id,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Failed to get adjusted single user grades");
		}

		const { json, yaml, markdown } = result.value;

		// Verify JSON structure
		expect(json.course_id).toBe(testCourse.id);
		expect(json.gradebook_id).toBe(testGradebook.id);
		expect(json.enrollment.enrollment_id).toBe(testEnrollment.id);
		expect(json.enrollment.user_id).toBe(student.id);
		expect(json.enrollment.items).toHaveLength(2);

		// Verify YAML is valid and contains expected data
		expect(yaml).toBeTruthy();
		expect(typeof yaml).toBe("string");
		expect(yaml.length).toBeGreaterThan(0);
		// Verify YAML can be parsed back to JSON
		const parsedYaml = Bun.YAML?.parse(yaml) as {
			course_id?: number;
			gradebook_id?: number;
			enrollment?: { enrollment_id?: number };
		} | null;
		expect(parsedYaml).toBeTruthy();
		if (parsedYaml) {
			expect(parsedYaml.course_id).toBe(testCourse.id);
			expect(parsedYaml.gradebook_id).toBe(testGradebook.id);
			expect(parsedYaml.enrollment?.enrollment_id).toBe(testEnrollment.id);
		}

		// Verify Markdown contains expected content
		expect(markdown).toBeTruthy();
		expect(typeof markdown).toBe("string");
		expect(markdown.length).toBeGreaterThan(0);
		expect(markdown).toContain("# Single User Grade Report");
		expect(markdown).toContain(`**Course:** ${testCourse.title}`);
		expect(markdown).toContain(
			`**Student:** ${student.firstName} ${student.lastName}`,
		);
		expect(markdown).toContain(`**Enrollment ID:** ${testEnrollment.id}`);
		expect(markdown).toContain("## Grade Summary");
		expect(markdown).toContain("## Totals");
		// Verify grade items are in the markdown
		expect(markdown).toContain(testItem.name);
		expect(markdown).toContain(testItem2.name);
		// Verify totals section
		expect(markdown).toContain("Total Grade");
		expect(markdown).toContain("Total Max Grade");
		expect(markdown).toContain("Final Grade");
		expect(markdown).toContain("Total Weight");
		expect(markdown).toContain("Graded Items");
	});

	it("should add bonus adjustment to user grade", async () => {
		// First create a grade
		const gradeResult = await tryCreateUserGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
			baseGrade: 85,
			feedback: "Good work!",
			gradedBy: instructor.id,
		});

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) {
			throw new Error("Failed to create grade for adjustment test");
		}

		const grade = gradeResult.value;

		// Add bonus adjustment
		const adjustmentResult = await tryAddAdjustment({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			gradeId: grade.id,
			type: "bonus",
			points: 5,
			reason: "Extra effort bonus",
			appliedBy: instructor.id,
		});

		expect(adjustmentResult.ok).toBe(true);
	});

	it("should add penalty adjustment to user grade", async () => {
		// Get the grade from previous test
		const gradeResult = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
		});

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) {
			throw new Error("Failed to find grade for penalty test");
		}

		const grade = gradeResult.value;

		// Add penalty adjustment
		const adjustmentResult = await tryAddAdjustment({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			gradeId: grade.id,
			type: "penalty",
			points: -2,
			reason: "Late submission",
			appliedBy: instructor.id,
		});

		expect(adjustmentResult.ok).toBe(true);
		if (adjustmentResult.ok) {
			expect(adjustmentResult.value.adjustments).toHaveLength(2);
			const adjustment = adjustmentResult.value.adjustments?.[1];
			expect(adjustment?.type).toBe("penalty");
			expect(adjustment?.points).toBe(-2);
		}
	});

	it("should toggle adjustment active status", async () => {
		// Get the grade from previous test
		const gradeResult = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
		});

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) {
			throw new Error("Failed to find grade for toggle test");
		}

		const grade = gradeResult.value;
		const adjustmentId = grade.adjustments?.[0]?.id;

		if (!adjustmentId) {
			throw new Error("No adjustment found to toggle");
		}

		// Toggle adjustment
		const toggleResult = await tryToggleAdjustment({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			gradeId: grade.id,
			adjustmentId,
		});

		expect(toggleResult.ok).toBe(true);
		if (toggleResult.ok) {
			expect(toggleResult.value.adjustments?.[0]?.isActive).toBe(false);
		}
	});

	it("should remove adjustment from user grade", async () => {
		// Get the grade from previous test
		const gradeResult = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
		});

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) {
			throw new Error("Failed to find grade for removal test");
		}

		const grade = gradeResult.value;
		const adjustmentId = grade.adjustments?.[1]?.id; // Remove the penalty

		if (!adjustmentId) {
			throw new Error("No second adjustment found to remove");
		}

		// Remove adjustment
		const removeResult = await tryRemoveAdjustment({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			gradeId: grade.id,
			adjustmentId,
		});

		expect(removeResult.ok).toBe(true);
		if (removeResult.ok) {
			expect(removeResult.value.adjustments).toHaveLength(1);
			expect(removeResult.value.adjustments?.[0]?.type).toBe("bonus");
		}
	});

	it("should calculate final grade with adjustments", async () => {
		// Get the grade with adjustments
		const gradeResult = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
		});

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) {
			throw new Error("Failed to find grade for calculation test");
		}

		// Calculate final grade
		const finalGradeResult = await tryCalculateUserFinalGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookId: testGradebook.id,
		});

		expect(finalGradeResult.ok).toBe(true);
	});

	it("should handle extra credit items in grade calculation", async () => {
		// Create an extra credit gradebook item
		const extraCreditItem = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: null,
			name: "Extra Credit Project",
			description: "Optional bonus project",
			maxGrade: 25,
			minGrade: 0,
			weight: 15, // This will make total weight exceed 100%
			extraCredit: true,
			sortOrder: 2,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
		});

		expect(extraCreditItem.ok).toBe(true);
		if (!extraCreditItem.ok) {
			throw new Error("Failed to create extra credit item");
		}

		// Create a grade for the extra credit item
		const extraCreditGrade = await tryCreateUserGrade({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: extraCreditItem.value.id,
			baseGrade: 20,
			feedback: "Excellent extra credit work!",
			gradedBy: instructor.id,
		});

		expect(extraCreditGrade.ok).toBe(true);
		if (!extraCreditGrade.ok) {
			throw new Error("Failed to create extra credit grade");
		}

		// Calculate final grade with extra credit
		const finalGradeResult = await tryCalculateUserFinalGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookId: testGradebook.id,
		});

		expect(finalGradeResult.ok).toBe(true);
	});

	it("should handle zero weight extra credit items", async () => {
		// Create a zero weight extra credit item
		const zeroWeightExtraCredit = await tryCreateGradebookItem({
			payload,
			courseId: testCourse.id,
			categoryId: null,
			name: "Participation Bonus",
			description: "Class participation extra credit",
			maxGrade: 10,
			minGrade: 0,
			weight: 0, // Zero weight
			extraCredit: true,
			sortOrder: 3,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			overrideAccess: false,
		});

		expect(zeroWeightExtraCredit.ok).toBe(true);
		if (!zeroWeightExtraCredit.ok) {
			throw new Error("Failed to create zero weight extra credit item");
		}

		// Create a grade for the zero weight extra credit
		const zeroWeightGrade = await tryCreateUserGrade({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: zeroWeightExtraCredit.value.id,
			baseGrade: 8,
			feedback: "Great participation!",
			gradedBy: instructor.id,
		});

		expect(zeroWeightGrade.ok).toBe(true);
		if (!zeroWeightGrade.ok) {
			throw new Error("Failed to create zero weight extra credit grade");
		}

		// Calculate final grade - should not affect total weight
		const finalGradeResult = await tryCalculateUserFinalGrade({
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookId: testGradebook.id,
		});

		expect(finalGradeResult.ok).toBe(true);
	});

	it("should calculate final grade with adjustments and extra credit", async () => {
		// Get the grade with adjustments from previous tests
		const gradeResult = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: testItem.id,
		});

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) {
			throw new Error("Failed to find grade for comprehensive test");
		}

		// Add another bonus adjustment
		const additionalBonus = await tryAddAdjustment({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			gradeId: gradeResult.value.id,
			type: "curve",
			points: 3,
			reason: "Class curve adjustment",
			appliedBy: instructor.id,
		});

		expect(additionalBonus.ok).toBe(true);

		// Calculate final grade with all factors
		const finalGradeResult = await tryCalculateUserFinalGrade({
			payload,
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookId: testGradebook.id,
		});

		expect(finalGradeResult.ok).toBe(true);
		if (finalGradeResult.ok) {
			console.log(
				"Final grade with adjustments and extra credit:",
				finalGradeResult.value,
			);

			// Should have a final grade that includes all adjustments and extra credit
			expect(finalGradeResult.value.finalGrade).toBeDefined();
			expect(finalGradeResult.value.finalGrade).toBeGreaterThan(0);
		}
	});

	it("should release grade from submission to user-grade", async () => {
		// This test verifies that tryReleaseAssignmentGrade correctly releases grades from submissions to user-grades
		// Note: Full integration test requires creating assignment submission and grading it first
		// which is tested in assignment-submission-management.test.ts

		// Test with non-existent enrollment - should fail
		const invalidResult = await tryReleaseAssignmentGrade({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			courseActivityModuleLinkId: 99999,
			enrollmentId: 99999,
		});

		// Should fail because enrollment doesn't exist
		expect(invalidResult.ok).toBe(false);
	});

	it("should show grade in JSON representation after grading assignment submission", async () => {
		// Create an assignment activity module
		const activityModuleResult = await tryCreateAssignmentModule({
			payload,
			title: "Programming Exercise: Calculator",
			description: "Build a calculator application",
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			instructions: "Create a calculator that can perform basic operations",
			requireTextSubmission: true,
			requireFileSubmission: false,
		});
		expect(activityModuleResult.ok).toBe(true);
		if (!activityModuleResult.ok) {
			throw new Error("Failed to create activity module");
		}
		const activityModule = activityModuleResult.value;

		// Create a section for the course
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Assignments Section",
				description: "Section for assignments",
			},
			req: { user: instructor as typeof instructor & { collection: "users" } },
			overrideAccess: false,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) {
			throw new Error("Failed to create section");
		}
		const section = sectionResult.value;

		const courseActivityModuleLinkResult =
			await tryCreateCourseActivityModuleLink({
				payload,
				course: testCourse.id,
				activityModule: activityModule.id,
				section: section.id,
				contentOrder: 0,
				req: {
					...mockRequest,
					user: admin as typeof admin & { collection: "users" },
				},
				overrideAccess: false,
			});

		expect(courseActivityModuleLinkResult.ok).toBe(true);
		if (!courseActivityModuleLinkResult.ok) {
			throw new Error("Failed to create course-activity-module-link");
		}
		const courseModuleLink = courseActivityModuleLinkResult.value;

		// Verify gradebook item was created automatically
		const gradebookItems = await payload.find({
			collection: "gradebook-items",
			where: {
				activityModule: {
					equals: courseModuleLink.id,
				},
			},
		});

		expect(gradebookItems.docs.length).toBeGreaterThan(0);
		const gradebookItem = gradebookItems.docs[0]!;

		// Create an assignment submission
		const submissionResult = await tryCreateAssignmentSubmission({
			payload,
			courseModuleLinkId: courseModuleLink.id,
			studentId: student.id,
			enrollmentId: testEnrollment.id,
			attemptNumber: 1,
			content: "Here is my calculator implementation",
			timeSpent: 3600, // 1 hour
			req: { user: student as typeof student & { collection: "users" } },
			overrideAccess: false,
		});

		expect(submissionResult.ok).toBe(true);
		if (!submissionResult.ok) {
			throw new Error("Failed to create assignment submission");
		}
		const submission = submissionResult.value;

		// Grade the assignment submission (only updates submission, doesn't create user-grade)
		const gradeResult = await tryGradeAssignmentSubmission({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			id: submission.id,
			grade: 85,
			feedback: "Great work! Your calculator implementation is excellent.",
			gradedBy: instructor.id,
			overrideAccess: false,
		});

		expect(gradeResult.ok).toBe(true);
		if (!gradeResult.ok) {
			throw new Error(`Failed to grade assignment: ${gradeResult.error}`);
		}

		// Verify submission was graded but user-grade was NOT created yet
		const gradedSubmission = gradeResult.value;
		expect(gradedSubmission.status).toBe("graded");
		const submissionWithGrade = gradedSubmission as typeof gradedSubmission & {
			grade?: number | null;
			feedback?: string | null;
		};
		expect(submissionWithGrade.grade).toBe(85);
		expect(submissionWithGrade.feedback).toBe(
			"Great work! Your calculator implementation is excellent.",
		);

		// Verify no user-grade exists yet
		const gradeBeforeRelease = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: gradebookItem.id,
		});
		expect(gradeBeforeRelease.ok).toBe(false);

		// Now release the grade - this should create the user-grade
		const releaseResult = await tryReleaseAssignmentGrade({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			courseActivityModuleLinkId: courseModuleLink.id,
			enrollmentId: testEnrollment.id,
		});

		expect(releaseResult.ok).toBe(true);
		if (!releaseResult.ok) {
			throw new Error(`Failed to release grade: ${releaseResult.error}`);
		}

		// Verify user-grade was created after release
		const gradeAfterRelease = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: gradebookItem.id,
		});

		expect(gradeAfterRelease.ok).toBe(true);
		if (!gradeAfterRelease.ok) {
			throw new Error("User grade should exist after release");
		}

		const userGrade = gradeAfterRelease.value;
		expect(userGrade.baseGrade).toBe(85);
		expect(userGrade.feedback).toBe(
			"Great work! Your calculator implementation is excellent.",
		);
		const submissionValue =
			typeof userGrade.submission === "number"
				? userGrade.submission
				: typeof userGrade.submission === "object" &&
						userGrade.submission !== null &&
						"value" in userGrade.submission
					? typeof userGrade.submission.value === "number"
						? userGrade.submission.value
						: userGrade.submission.value?.id
					: null;
		expect(submissionValue).toBe(submission.id);
		expect(userGrade.submissionType).toBe("assignment");

		// Get single user grades JSON representation
		const jsonResult = await tryGetSingleUserGradesJsonRepresentation({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			courseId: testCourse.id,
			enrollmentId: testEnrollment.id,
		});

		expect(jsonResult.ok).toBe(true);
		if (!jsonResult.ok) {
			throw new Error("Failed to get user grades JSON representation");
		}

		const jsonData = jsonResult.value;

		// Verify the grade appears in the JSON representation
		expect(jsonData.course_id).toBe(testCourse.id);
		expect(jsonData.gradebook_id).toBe(testGradebook.id);
		expect(jsonData.enrollment.enrollment_id).toBe(testEnrollment.id);
		expect(jsonData.enrollment.user_id).toBe(student.id);

		// Find the gradebook item in the items array
		const gradedItem = jsonData.enrollment.items.find(
			(item) => item.item_id === gradebookItem.id,
		);

		expect(gradedItem).toBeDefined();
		if (gradedItem) {
			expect(gradedItem.base_grade).toBe(85);
			expect(gradedItem.feedback).toBe(
				"Great work! Your calculator implementation is excellent.",
			);
			expect(gradedItem.status).toBe("graded");
			expect(gradedItem.graded_at).toBeDefined();
			expect(gradedItem.item_name).toBe("Programming Exercise: Calculator");
		}

		// Verify graded_items count is updated
		expect(jsonData.enrollment.graded_items).toBeGreaterThan(0);
	});

	it("should release discussion grade from submissions to user-grade", async () => {
		// Create a discussion activity module
		const activityModuleResult = await tryCreateDiscussionModule({
			payload,
			title: "Class Discussion: Design Patterns",
			description: "Discuss various design patterns",
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			instructions:
				"Participate in this discussion by creating threads and replies",
			dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			requireThread: true,
			requireReplies: true,
			minReplies: 2,
			minWordsPerPost: 10,
			allowAttachments: true,
			allowUpvotes: true,
			allowEditing: true,
			allowDeletion: false,
			moderationRequired: false,
			anonymousPosting: false,
			groupDiscussion: false,
			threadSorting: "recent" as const,
		});

		expect(activityModuleResult.ok).toBe(true);
		if (!activityModuleResult.ok) {
			throw new Error("Failed to create assignment module");
		}
		const activityModule = activityModuleResult.value;

		// Create a section for the course
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Discussions Section",
				description: "Section for discussions",
			},
			req: createLocalReq({
				request: mockRequest,
				user: instructor as TypedUser,
			}),
			overrideAccess: true,
		});

		expect(sectionResult.ok).toBe(true);
		if (!sectionResult.ok) {
			throw new Error("Failed to create section");
		}
		const section = sectionResult.value;

		const courseActivityModuleLinkResult =
			await tryCreateCourseActivityModuleLink({
				payload,
				req: createLocalReq({
					request: mockRequest,
					user: instructor as TypedUser,
				}),
				overrideAccess: false,
				course: testCourse.id,
				activityModule: activityModule.id,
				section: section.id,
				contentOrder: 0,
			});

		expect(courseActivityModuleLinkResult.ok).toBe(true);
		if (!courseActivityModuleLinkResult.ok) {
			throw new Error("Failed to create course-activity-module-link");
		}
		const courseModuleLink = courseActivityModuleLinkResult.value;

		// Verify gradebook item was created automatically
		const gradebookItems = await payload.find({
			collection: "gradebook-items",
			where: {
				activityModule: {
					equals: courseModuleLink.id,
				},
			},
		});

		expect(gradebookItems.docs.length).toBeGreaterThan(0);
		const gradebookItem = gradebookItems.docs[0]!;

		// Create discussion submissions (thread, reply, comment)
		const threadArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			courseModuleLinkId: courseModuleLink.id,
			studentId: student.id,
			enrollmentId: testEnrollment.id,
			postType: "thread",
			title: "Design Patterns Discussion",
			content:
				"I think the singleton pattern is very useful for managing global state.",
		};

		const threadResult = await tryCreateDiscussionSubmission(threadArgs);
		expect(threadResult.ok).toBe(true);
		if (!threadResult.ok) {
			throw new Error("Failed to create thread");
		}
		const thread = threadResult.value;

		const replyArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			courseModuleLinkId: courseModuleLink.id,
			studentId: student.id,
			enrollmentId: testEnrollment.id,
			postType: "reply",
			content: "I agree, but we should also consider the factory pattern.",
			parentThread: thread.id,
		};

		const replyResult = await tryCreateDiscussionSubmission(replyArgs);
		expect(replyResult.ok).toBe(true);
		if (!replyResult.ok) {
			throw new Error("Failed to create reply");
		}
		const reply = replyResult.value;

		const commentArgs: CreateDiscussionSubmissionArgs = {
			payload,
			req: createLocalReq({
				request: mockRequest,
				user: student as TypedUser,
			}),
			courseModuleLinkId: courseModuleLink.id,
			studentId: student.id,
			enrollmentId: testEnrollment.id,
			postType: "comment",
			content: "Great point!",
			parentThread: thread.id,
		};

		const commentResult = await tryCreateDiscussionSubmission(commentArgs);
		expect(commentResult.ok).toBe(true);
		if (!commentResult.ok) {
			throw new Error("Failed to create comment");
		}

		// Grade the thread (90 points)
		const threadGradeArgs: GradeDiscussionSubmissionArgs = {
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			id: thread.id,
			gradedBy: instructor.id,
			grade: 90,
			feedback: "Excellent thread! Very insightful.",
			overrideAccess: false,
		};

		const threadGradeResult =
			await tryGradeDiscussionSubmission(threadGradeArgs);
		expect(threadGradeResult.ok).toBe(true);
		if (!threadGradeResult.ok) {
			throw new Error("Failed to grade thread");
		}

		// Grade the reply (80 points)
		const replyGradeArgs: GradeDiscussionSubmissionArgs = {
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			id: reply.id,
			gradedBy: instructor.id,
			grade: 80,
			feedback: "Good reply with additional insights.",
			overrideAccess: false,
		};

		const replyGradeResult = await tryGradeDiscussionSubmission(replyGradeArgs);
		expect(replyGradeResult.ok).toBe(true);
		if (!replyGradeResult.ok) {
			throw new Error("Failed to grade reply");
		}

		// Don't grade the comment - it should be ignored in average calculation

		// Verify no user-grade exists yet
		const gradeBeforeRelease = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: gradebookItem.id,
		});
		expect(gradeBeforeRelease.ok).toBe(false);

		// Now release the grade - this should create the user-grade with average (90 + 80) / 2 = 85
		const releaseResult = await tryReleaseDiscussionGrade({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			courseActivityModuleLinkId: courseModuleLink.id,
			enrollmentId: testEnrollment.id,
		});

		expect(releaseResult.ok).toBe(true);
		if (!releaseResult.ok) {
			throw new Error(
				`Failed to release discussion grade: ${releaseResult.error}`,
			);
		}

		const releaseData = releaseResult.value;
		expect(releaseData.averageGrade).toBe(85); // (90 + 80) / 2
		expect(releaseData.gradedPostsCount).toBe(2); // Only thread and reply are graded
		expect(releaseData.totalPostsCount).toBe(3); // thread, reply, and comment

		// Verify user-grade was created after release
		const gradeAfterRelease = await tryFindUserGradeByEnrollmentAndItem({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			enrollmentId: testEnrollment.id,
			gradebookItemId: gradebookItem.id,
		});

		expect(gradeAfterRelease.ok).toBe(true);
		if (!gradeAfterRelease.ok) {
			throw new Error("User grade should exist after release");
		}

		const userGrade = gradeAfterRelease.value;
		expect(userGrade.baseGrade).toBe(85); // Average of graded posts
		expect(userGrade.submissionType).toBe("discussion");
		expect(userGrade.feedback).toContain("Excellent thread");
		expect(userGrade.feedback).toContain("Good reply");

		// Get single user grades JSON representation
		const jsonResult = await tryGetSingleUserGradesJsonRepresentation({
			payload,
			req: {
				...mockRequest,
				user: instructor as typeof instructor & { collection: "users" },
			},
			overrideAccess: false,
			courseId: testCourse.id,
			enrollmentId: testEnrollment.id,
		});

		expect(jsonResult.ok).toBe(true);
		if (!jsonResult.ok) {
			throw new Error("Failed to get user grades JSON representation");
		}

		const jsonData = jsonResult.value;

		// Find the gradebook item in the items array
		const gradedItem = jsonData.enrollment.items.find(
			(item) => item.item_id === gradebookItem.id,
		);

		expect(gradedItem).toBeDefined();
		if (gradedItem) {
			expect(gradedItem.base_grade).toBe(85);
			expect(gradedItem.status).toBe("graded");
			expect(gradedItem.graded_at).toBeDefined();
			expect(gradedItem.item_name).toBe("Class Discussion: Design Patterns");
		}
	});
});
