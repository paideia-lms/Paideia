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

		if (instructorResult.ok && studentResult.ok) {
			instructorId = instructorResult.value.id;
			studentId = studentResult.value.id;
		}
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await payload.delete({
				collection: "courses",
				where: {},
			});
			await payload.delete({
				collection: "users",
				where: {},
			});
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateCourse", () => {
		test("should create a new course successfully", async () => {
			const courseArgs: CreateCourseArgs = {
				title: "Introduction to JavaScript",
				description: "Learn the basics of JavaScript programming",
				instructor: instructorId,
				difficulty: "beginner",
				duration: 120,
				status: "draft",
				tags: [{ tag: "javascript" }, { tag: "programming" }],
			};

			const result = await tryCreateCourse(payload, mockRequest, courseArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.title).toBe(courseArgs.title);
				expect(result.value.description).toBe(courseArgs.description);
				// Instructor can be either ID or populated user object
				if (typeof result.value.instructor === "object") {
					expect(result.value.instructor.id).toBe(courseArgs.instructor);
				} else {
					expect(result.value.instructor).toBe(courseArgs.instructor);
				}
				expect(result.value.difficulty).toBe(courseArgs.difficulty);
				expect(result.value.duration).toBe(courseArgs.duration);
				expect(result.value.status).toBe(courseArgs.status);
			}
		});

		test("should create course with default values", async () => {
			const courseArgs: CreateCourseArgs = {
				title: "Basic HTML",
				description: "Learn HTML fundamentals",
				instructor: instructorId,
			};

			const result = await tryCreateCourse(payload, mockRequest, courseArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.difficulty).toBe("beginner");
				expect(result.value.status).toBe("draft");
			}
		});

		test("should fail when instructor does not exist", async () => {
			const courseArgs: CreateCourseArgs = {
				title: "Non-existent Instructor Course",
				description: "This should fail",
				instructor: 99999,
			};

			const result = await tryCreateCourse(payload, mockRequest, courseArgs);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Not Found");
			}
		});
	});

	describe("tryUpdateCourse", () => {
		test("should update course successfully", async () => {
			// First create a course
			const createArgs: CreateCourseArgs = {
				title: "Original Title",
				description: "Original description",
				instructor: instructorId,
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
					difficulty: "intermediate",
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
					expect(updateResult.value.difficulty).toBe("intermediate");
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
				instructor: instructorId,
			};

			const createResult = await tryCreateCourse(
				payload,
				mockRequest,
				createArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const updateArgs: UpdateCourseArgs = {
					instructor: 99999,
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
		test("should find existing course by ID", async () => {
			const courseArgs: CreateCourseArgs = {
				title: "Find By ID Test",
				description: "Test course for finding by ID",
				instructor: instructorId,
			};

			const createResult = await tryCreateCourse(
				payload,
				mockRequest,
				courseArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const findResult = await tryFindCourseById(
					payload,
					createResult.value.id,
				);

				expect(findResult.ok).toBe(true);
				if (findResult.ok) {
					expect(findResult.value.id).toBe(createResult.value.id);
					expect(findResult.value.title).toBe("Find By ID Test");
				}
			}
		});

		test("should fail when finding non-existent course by ID", async () => {
			const result = await tryFindCourseById(payload, 99999);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Not Found");
			}
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
				instructor: instructorId,
			});

			await tryCreateCourse(payload, mockRequest, {
				title: "Vue.js Basics",
				description: "Learn Vue",
				instructor: instructorId,
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

		test("should search courses by instructor", async () => {
			const result = await trySearchCourses(payload, {
				instructor: instructorId,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// All courses should be by our instructor
				result.value.docs.forEach((course) => {
					if (typeof course.instructor === "object") {
						expect(course.instructor.id).toBe(instructorId);
					} else {
						expect(course.instructor).toBe(instructorId);
					}
				});
			}
		});

		test("should search courses by difficulty", async () => {
			// Create course with specific difficulty
			await tryCreateCourse(payload, mockRequest, {
				title: "Advanced TypeScript",
				description: "Advanced TypeScript concepts",
				instructor: instructorId,
				difficulty: "advanced",
			});

			const result = await trySearchCourses(payload, {
				difficulty: "advanced",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				result.value.docs.forEach((course) => {
					expect(course.difficulty).toBe("advanced");
				});
			}
		});
	});

	describe("tryDeleteCourse", () => {
		test("should delete course successfully", async () => {
			const courseArgs: CreateCourseArgs = {
				title: "Course to Delete",
				description: "This course will be deleted",
				instructor: instructorId,
			};

			const createResult = await tryCreateCourse(
				payload,
				mockRequest,
				courseArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteCourse(
					payload,
					mockRequest,
					createResult.value.id,
				);

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
				}

				// Verify course is actually deleted
				const findResult = await tryFindCourseById(
					payload,
					createResult.value.id,
				);
				expect(findResult.ok).toBe(false);
			}
		});
	});

	describe("tryFindCoursesByInstructor", () => {
		test("should find courses by instructor", async () => {
			const result = await tryFindCoursesByInstructor(payload, instructorId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeInstanceOf(Array);
				result.value.forEach((course) => {
					if (typeof course.instructor === "object") {
						expect(course.instructor.id).toBe(instructorId);
					} else {
						expect(course.instructor).toBe(instructorId);
					}
				});
			}
		});
	});

	describe("tryFindPublishedCourses", () => {
		test("should find only published courses", async () => {
			// Create published course
			await tryCreateCourse(payload, mockRequest, {
				title: "Published Course",
				description: "This course is published",
				instructor: instructorId,
				status: "published",
			});

			// Create draft course
			await tryCreateCourse(payload, mockRequest, {
				title: "Draft Course",
				description: "This course is draft",
				instructor: instructorId,
				status: "draft",
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
				instructor: instructorId,
				difficulty: "beginner",
				status: "draft",
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
					difficulty: "intermediate",
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
