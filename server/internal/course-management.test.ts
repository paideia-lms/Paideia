import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateCourseArgs,
	SearchCoursesArgs,
	tryCreateCourse,
	tryDeleteCourse,
	tryFindCourseById,
	tryFindCoursesByInstructor,
	tryFindPublishedCourses,
	trySearchCourses,
	tryUpdateCourse,
	type UpdateCourseArgs,
} from "./course-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Course Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let instructorId: number;
	let studentId: number;

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
		};

		const instructorResult = await tryCreateUser(instructorArgs);
		const studentResult = await tryCreateUser(studentArgs);

		expect(instructorResult.ok).toBe(true);
		expect(studentResult.ok).toBe(true);

		if (instructorResult.ok && studentResult.ok) {
			instructorId = instructorResult.value.id;
			studentId = studentResult.value.id;
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
});
