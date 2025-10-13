import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateCourseArgs,
	tryCreateCourse,
	tryDeleteCourse,
	tryFindCourseById,
	tryGetUserAccessibleCourses,
	trySearchCourses,
	tryUpdateCourse,
	type UpdateCourseArgs,
} from "./course-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";
import { tryCreateEnrollment } from "./enrollment-management";
import { tryCreateCategory, tryAssignCategoryRole } from "./category-role-management";

describe("Course Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let instructorId: number;

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
				role: "student",
			},
			overrideAccess: true,
		};

		const instructorResult = await tryCreateUser(instructorArgs);

		expect(instructorResult.ok).toBe(true);

		if (instructorResult.ok) {
			instructorId = instructorResult.value.id;
		}
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateCourse", () => {
		test("should create a new course successfully", async () => {
			const courseArgs = {
				title: "Introduction to JavaScript",
				description: "Learn the basics of JavaScript programming",
				createdBy: instructorId,
				slug: "introduction-to-javascript",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Learn the basics of JavaScript programming",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
				status: "draft",
				tags: [{ tag: "javascript" }, { tag: "programming" }],
			} satisfies CreateCourseArgs;

			const result = await tryCreateCourse(payload, mockRequest, courseArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.title).toBe(courseArgs.title);
				expect(result.value.description).toBe(courseArgs.description);
				expect(result.value.status).toBe(courseArgs.status);
			}
		});

		test("should create course with default values", async () => {
			const courseArgs: CreateCourseArgs = {
				title: "Basic HTML",
				description: "Learn HTML fundamentals",
				createdBy: instructorId,
				slug: "basic-html",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Learn the basics of HTML programming",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			};

			const result = await tryCreateCourse(payload, mockRequest, courseArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.status).toBe("draft");
			}
		});

		test("should fail when instructor does not exist", async () => {
			const courseArgs: CreateCourseArgs = {
				title: "Non-existent Instructor Course",
				description: "This should fail",
				createdBy: 99999,
				slug: "non-existent-instructor-course",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Test section",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			};

			const result = await tryCreateCourse(payload, mockRequest, courseArgs);

			expect(result.ok).toBe(false);
		});
	});

	describe("tryUpdateCourse", () => {
		test("should update course successfully", async () => {
			// First create a course
			const createArgs: CreateCourseArgs = {
				title: "Original Title",
				description: "Original description",
				createdBy: instructorId,
				slug: "original-title",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Original section",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			};

			const createResult = await tryCreateCourse(
				payload,
				mockRequest,
				createArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const updateArgs: UpdateCourseArgs = {
					title: "Updated Title",
					description: "Updated description",
					status: "published",
				};

				const updateResult = await tryUpdateCourse(
					payload,
					mockRequest,
					createResult.value.id,
					updateArgs,
				);

				expect(updateResult.ok).toBe(true);
				if (updateResult.ok) {
					expect(updateResult.value.title).toBe("Updated Title");
					expect(updateResult.value.description).toBe("Updated description");
					expect(updateResult.value.status).toBe("published");
				}
			}
		});

		test("should fail when updating non-existent course", async () => {
			const updateArgs: UpdateCourseArgs = {
				title: "Non-existent Course",
			};

			const result = await tryUpdateCourse(
				payload,
				mockRequest,
				99999,
				updateArgs,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Not Found");
			}
		});

		test("should fail when updating with non-existent instructor", async () => {
			// First create a course
			const createArgs: CreateCourseArgs = {
				title: "Test Course",
				description: "Test description",
				createdBy: instructorId,
				slug: "test-course",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Test section",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			};

			const createResult = await tryCreateCourse(
				payload,
				mockRequest,
				createArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const updateArgs: UpdateCourseArgs = {
					createdBy: 99999,
				};

				const updateResult = await tryUpdateCourse(
					payload,
					mockRequest,
					createResult.value.id,
					updateArgs,
				);

				expect(updateResult.ok).toBe(false);
				if (!updateResult.ok) {
					expect(updateResult.error.message).toContain("Not Found");
				}
			}
		});
	});

	describe("tryFindCourseById", () => {
		test.only("should find existing course by ID", async () => {
			const courseArgs = {
				title: "Find By ID Test",
				description: "Test course for finding by ID",
				createdBy: instructorId,
				slug: "find-by-id-test",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Test section",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			} satisfies CreateCourseArgs;

			const createResult = await tryCreateCourse(
				payload,
				mockRequest,
				courseArgs,
			);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) {
				throw new Error("Failed to create course");
			}
			const findResult = await tryFindCourseById(
				payload,
				createResult.value.id,
			);

			expect(findResult.ok).toBe(true);
			if (!findResult.ok) {
				throw new Error("Failed to find course");
			}
			expect(findResult.value.id).toBe(createResult.value.id);
			expect(findResult.value.title).toBe("Find By ID Test");
		});

		test("should fail when finding non-existent course by ID", async () => {
			const result = await tryFindCourseById(payload, 99999);

			expect(result.ok).toBe(false);
		});
	});

	describe("trySearchCourses", () => {
		test("should search courses with no filters", async () => {
			const result = await trySearchCourses(payload, {});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs).toBeInstanceOf(Array);
				expect(typeof result.value.totalDocs).toBe("number");
				expect(typeof result.value.page).toBe("number");
				expect(typeof result.value.limit).toBe("number");
			}
		});

		test("should search courses by title", async () => {
			// Create test courses
			await tryCreateCourse(payload, mockRequest, {
				title: "React Fundamentals",
				description: "Learn React",
				createdBy: instructorId,
				slug: "react-fundamentals",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "React section",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			});

			await tryCreateCourse(payload, mockRequest, {
				title: "Vue.js Basics",
				description: "Learn Vue",
				createdBy: instructorId,
				slug: "vue-js-basics",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Vue section",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			});

			const result = await trySearchCourses(payload, { title: "React" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				// Should contain React course
				const reactCourse = result.value.docs.find((course) =>
					course.title.includes("React"),
				);
				expect(reactCourse).toBeDefined();
			}
		});
	});

	describe("tryDeleteCourse", () => {
		test("should delete course successfully", async () => {
			const courseArgs = {
				title: "Course to Delete",
				description: "This course will be deleted",
				createdBy: instructorId,
				slug: "course-to-delete",
			} satisfies CreateCourseArgs;

			const createResult = await tryCreateCourse(
				payload,
				mockRequest,
				courseArgs,
			);
			expect(createResult.ok).toBe(true);

			if (!createResult.ok) {
				throw new Error("Test Error: Failed to create course");
			}
			const deleteResult = await tryDeleteCourse(
				payload,
				mockRequest,
				createResult.value.id,
			);

			expect(deleteResult.ok).toBe(true);
			if (!deleteResult.ok) {
				throw new Error("Test Error: Failed to delete course");
			}
			expect(deleteResult.value.id).toBe(createResult.value.id);

			// Verify course is actually deleted
			const findResult = await tryFindCourseById(
				payload,
				createResult.value.id,
			);
			expect(findResult.ok).toBe(false);
		});
	});

	describe("tryFindCoursesByInstructor", () => {
		test("should find courses by instructor", async () => {
			const result = await tryFindCoursesByInstructor(payload, instructorId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeInstanceOf(Array);
			}
		});
	});

	describe("tryFindPublishedCourses", () => {
		test("should find only published courses", async () => {
			// Create published course
			await tryCreateCourse(payload, mockRequest, {
				title: "Published Course",
				description: "This course is published",
				createdBy: instructorId,
				slug: "published-course",
				status: "published",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Published section",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			});

			// Create draft course
			await tryCreateCourse(payload, mockRequest, {
				title: "Draft Course",
				description: "This course is draft",
				createdBy: instructorId,
				slug: "draft-course",
				status: "draft",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Draft section",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			});

			const result = await tryFindPublishedCourses(payload);

			expect(result.ok).toBe(true);
			if (result.ok) {
				result.value.docs.forEach((course) => {
					expect(course.status).toBe("published");
				});
			}
		});
	});

	describe("Integration Tests", () => {
		test("should handle complete course lifecycle", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				title: "Lifecycle Test Course",
				description: "Testing complete lifecycle",
				createdBy: instructorId,
				slug: "lifecycle-test-course",
				status: "draft",
				structure: {
					sections: [
						{
							title: "Introduction",
							description: "Lifecycle test section",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
			};

			const createResult = await tryCreateCourse(
				payload,
				mockRequest,
				createArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const courseId = createResult.value.id;

				// Find by ID
				const findResult = await tryFindCourseById(payload, courseId);
				expect(findResult.ok).toBe(true);

				// Update course
				const updateArgs: UpdateCourseArgs = {
					status: "published",
				};
				const updateResult = await tryUpdateCourse(
					payload,
					mockRequest,
					courseId,
					updateArgs,
				);
				expect(updateResult.ok).toBe(true);

				// Search for updated course
				const searchResult = await trySearchCourses(payload, {
					status: "published",
				});
				expect(searchResult.ok).toBe(true);

				// Delete course
				const deleteResult = await tryDeleteCourse(
					payload,
					mockRequest,
					courseId,
				);
				expect(deleteResult.ok).toBe(true);

				// Verify deletion
				const findAfterDeleteResult = await tryFindCourseById(
					payload,
					courseId,
				);
				expect(findAfterDeleteResult.ok).toBe(false);
			}
		});
	});

	describe("tryGetUserAccessibleCourses", () => {
		let adminUserId: number;
		let contentManagerUserId: number;
		let regularUserId: number;
		let course1Id: number;
		let course2Id: number;
		let course3Id: number;
		let categoryId: number;

		beforeAll(async () => {
			// Create additional test users
			const adminArgs: CreateUserArgs = {
				payload,
				data: {
					email: "admin@test.com",
					password: "password123",
					firstName: "Admin",
					lastName: "User",
					role: "admin",
				},
				overrideAccess: true,
			};

			const contentManagerArgs: CreateUserArgs = {
				payload,
				data: {
					email: "contentmanager@test.com",
					password: "password123",
					firstName: "Content",
					lastName: "Manager",
					role: "content-manager",
				},
				overrideAccess: true,
			};

			const regularUserArgs: CreateUserArgs = {
				payload,
				data: {
					email: "regular@test.com",
					password: "password123",
					firstName: "Regular",
					lastName: "User",
					role: "student",
				},
				overrideAccess: true,
			};

			const adminResult = await tryCreateUser(adminArgs);
			const contentManagerResult = await tryCreateUser(contentManagerArgs);
			const regularUserResult = await tryCreateUser(regularUserArgs);

			expect(adminResult.ok).toBe(true);
			expect(contentManagerResult.ok).toBe(true);
			expect(regularUserResult.ok).toBe(true);

			if (adminResult.ok && contentManagerResult.ok && regularUserResult.ok) {
				adminUserId = adminResult.value.id;
				contentManagerUserId = contentManagerResult.value.id;
				regularUserId = regularUserResult.value.id;
			}

			// Create test courses
			const course1Args: CreateCourseArgs = {
				title: "Course 1 - Admin Access",
				description: "Test course for admin access",
				createdBy: instructorId,
				slug: "course-1-admin-access",
				status: "published",
			};

			const course2Args: CreateCourseArgs = {
				title: "Course 2 - Enrollment Access",
				description: "Test course for enrollment access",
				createdBy: instructorId,
				slug: "course-2-enrollment-access",
				status: "published",
			};

			const course3Args: CreateCourseArgs = {
				title: "Course 3 - Category Access",
				description: "Test course for category access",
				createdBy: instructorId,
				slug: "course-3-category-access",
				status: "published",
			};

			const course1Result = await tryCreateCourse(payload, mockRequest, course1Args);
			const course2Result = await tryCreateCourse(payload, mockRequest, course2Args);
			const course3Result = await tryCreateCourse(payload, mockRequest, course3Args);

			expect(course1Result.ok).toBe(true);
			expect(course2Result.ok).toBe(true);
			expect(course3Result.ok).toBe(true);

			if (course1Result.ok && course2Result.ok && course3Result.ok) {
				course1Id = course1Result.value.id;
				course2Id = course2Result.value.id;
				course3Id = course3Result.value.id;
			}

			// Create a category and assign role
			const categoryResult = await tryCreateCategory(payload, mockRequest, {
				name: "Test Category",
			});

			expect(categoryResult.ok).toBe(true);
			if (categoryResult.ok) {
				categoryId = categoryResult.value.id;

				// Update course3 to belong to this category
				await tryUpdateCourse(payload, mockRequest, course3Id, {
					category: categoryId,
				});

				// Assign category role to regular user
				const roleAssignmentResult = await tryAssignCategoryRole(payload, mockRequest, {
					userId: regularUserId,
					categoryId: categoryId,
					role: "category-coordinator",
					assignedBy: adminUserId,
				});

				expect(roleAssignmentResult.ok).toBe(true);
			}

			// Create enrollment for regular user in course2
			const enrollmentResult = await tryCreateEnrollment(payload, {
				user: regularUserId,
				course: course2Id,
				role: "student",
				status: "active",
			});

			expect(enrollmentResult.ok).toBe(true);
		});

		test("should return all courses for admin user", async () => {
			const result = await tryGetUserAccessibleCourses(payload, adminUserId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThanOrEqual(3);

				// Check that admin sees all courses
				const courseIds = result.value.map(course => course.id);
				expect(courseIds).toContain(course1Id);
				expect(courseIds).toContain(course2Id);
				expect(courseIds).toContain(course3Id);

				// Check admin role assignment
				const adminCourse = result.value.find(course => course.id === course1Id);
				expect(adminCourse?.role).toBe("manager");
				expect(adminCourse?.source).toBe("global-admin");
			}
		});

		test("should return all courses for content manager user", async () => {
			const result = await tryGetUserAccessibleCourses(payload, contentManagerUserId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThanOrEqual(3);

				// Check that content manager sees all courses
				const courseIds = result.value.map(course => course.id);
				expect(courseIds).toContain(course1Id);
				expect(courseIds).toContain(course2Id);
				expect(courseIds).toContain(course3Id);

				// Check content manager role assignment
				const contentManagerCourse = result.value.find(course => course.id === course1Id);
				expect(contentManagerCourse?.role).toBe("category-coordinator");
				expect(contentManagerCourse?.source).toBe("global-admin");
			}
		});

		test("should return courses from enrollments for regular user", async () => {
			const result = await tryGetUserAccessibleCourses(payload, regularUserId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should have at least course2 (enrollment) and course3 (category access)
				expect(result.value.length).toBeGreaterThanOrEqual(2);

				// Check enrollment access
				const enrollmentCourse = result.value.find(course => course.id === course2Id);
				expect(enrollmentCourse).toBeDefined();
				expect(enrollmentCourse?.role).toBe("student");
				expect(enrollmentCourse?.source).toBe("enrollment");
				expect(enrollmentCourse?.enrollmentStatus).toBe("active");
			}
		});

		test("should return courses from category roles for regular user", async () => {
			const result = await tryGetUserAccessibleCourses(payload, regularUserId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Check category access
				const categoryCourse = result.value.find(course => course.id === course3Id);
				expect(categoryCourse).toBeDefined();
				expect(categoryCourse?.role).toBe("category-coordinator");
				expect(categoryCourse?.source).toBe("category");
				expect(categoryCourse?.enrollmentStatus).toBeNull();
			}
		});

		test("should not return courses user has no access to", async () => {
			const result = await tryGetUserAccessibleCourses(payload, regularUserId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Regular user should not see course1 (no enrollment or category access)
				const courseIds = result.value.map(course => course.id);
				expect(courseIds).not.toContain(course1Id);
			}
		});

		test("should handle completed enrollment status", async () => {
			// Update enrollment to completed
			const enrollments = await payload.find({
				collection: "enrollments",
				where: {
					and: [
						{ user: { equals: regularUserId } },
						{ course: { equals: course2Id } },
					],
				},
			});

			if (enrollments.docs.length > 0) {
				await payload.update({
					collection: "enrollments",
					id: enrollments.docs[0].id,
					data: { status: "completed" },
				});

				const result = await tryGetUserAccessibleCourses(payload, regularUserId);

				expect(result.ok).toBe(true);
				if (result.ok) {
					const enrollmentCourse = result.value.find(course => course.id === course2Id);
					expect(enrollmentCourse?.enrollmentStatus).toBe("completed");
					expect(enrollmentCourse?.completionPercentage).toBe(100);
				}
			}
		});

		test("should fail with invalid user ID", async () => {
			const result = await tryGetUserAccessibleCourses(payload, 99999);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("User ID is required");
			}
		});

		test("should handle user with no course access", async () => {
			// Create a user with no enrollments or category roles
			const noAccessUserArgs: CreateUserArgs = {
				payload,
				data: {
					email: "noaccess@test.com",
					password: "password123",
					firstName: "No",
					lastName: "Access",
					role: "student",
				},
				overrideAccess: true,
			};

			const noAccessUserResult = await tryCreateUser(noAccessUserArgs);
			expect(noAccessUserResult.ok).toBe(true);

			if (noAccessUserResult.ok) {
				const result = await tryGetUserAccessibleCourses(payload, noAccessUserResult.value.id);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBe(0);
				}
			}
		});
	});
});
