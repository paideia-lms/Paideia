import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import type { Course, User } from "../payload-types";
import { tryCreateCourse } from "./course-management";
import {
	type CreateEnrollmentArgs,
	tryCreateEnrollment,
	tryDeleteEnrollment,
	tryFindActiveEnrollments,
	tryFindEnrollmentById,
	tryFindEnrollmentsByCourse,
	tryFindEnrollmentsByUser,
	tryFindUserEnrollmentInCourse,
	trySearchEnrollments,
	tryUpdateEnrollment,
	tryUpdateEnrollmentStatus,
	type UpdateEnrollmentArgs,
} from "./enrollment-management";
import { tryCreateUser } from "./user-management";

describe("Enrollment Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUser: User;
	let testInstructor: User;
	let testCourse: Course;

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

		// Create test users
		const userResult = await tryCreateUser(payload, mockRequest, {
			email: "student@example.com",
			password: "password123",
			firstName: "Test",
			lastName: "Student",
			role: "student",
		});

		if (!userResult.ok) {
			throw new Error(
				`Failed to create test user: ${userResult.error.message}`,
			);
		}
		testUser = userResult.value;

		const instructorResult = await tryCreateUser(payload, mockRequest, {
			email: "instructor@example.com",
			password: "password123",
			firstName: "Test",
			lastName: "Instructor",
			role: "instructor",
		});

		if (!instructorResult.ok) {
			throw new Error(
				`Failed to create test instructor: ${instructorResult.error.message}`,
			);
		}
		testInstructor = instructorResult.value;

		// Create test course
		const courseResult = await tryCreateCourse(payload, mockRequest, {
			title: "Test Course",
			description: "A test course for enrollment testing",
			instructor: testInstructor.id,
		});

		if (!courseResult.ok) {
			throw new Error(
				`Failed to create test course: ${courseResult.error.message}`,
			);
		}
		testCourse = courseResult.value;
	});

	afterAll(async () => {
		// Clean up test data
		try {
			await payload.delete({
				collection: "enrollments",
				where: {},
			});
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

	describe("tryCreateEnrollment", () => {
		test("should create a new enrollment successfully", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				user: testUser.id,
				course: testCourse.id,
				role: "student",
				status: "active",
			};

			const result = await tryCreateEnrollment(
				payload,
				mockRequest,
				enrollmentArgs,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// User can be either ID or populated user object
				if (typeof result.value.user === "object") {
					expect(result.value.user.id).toBe(testUser.id);
				} else {
					expect(result.value.user).toBe(testUser.id);
				}
				// Course can be either ID or populated course object
				if (typeof result.value.course === "object") {
					expect(result.value.course.id).toBe(testCourse.id);
				} else {
					expect(result.value.course).toBe(testCourse.id);
				}
				expect(result.value.role).toBe("student");
				expect(result.value.status).toBe("active");
				expect(result.value.enrolledAt).toBeDefined();
			}
		});

		test("should fail when user does not exist", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				user: 99999, // Non-existent user ID
				course: testCourse.id,
				role: "student",
			};

			const result = await tryCreateEnrollment(
				payload,
				mockRequest,
				enrollmentArgs,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain(
					"Referenced user or course not found",
				);
			}
		});

		test("should fail when course does not exist", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				user: testUser.id,
				course: 99999, // Non-existent course ID
				role: "student",
			};

			const result = await tryCreateEnrollment(
				payload,
				mockRequest,
				enrollmentArgs,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain(
					"Referenced user or course not found",
				);
			}
		});

		test("should fail when enrollment already exists", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				user: testUser.id,
				course: testCourse.id,
				role: "teacher",
			};

			// Try to create duplicate enrollment
			const result = await tryCreateEnrollment(
				payload,
				mockRequest,
				enrollmentArgs,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Enrollment already exists");
			}
		});

		test("should create enrollment with different roles", async () => {
			// Create a second user
			const userResult = await tryCreateUser(payload, mockRequest, {
				email: "ta@example.com",
				password: "password123",
				firstName: "Test",
				lastName: "TA",
				role: "instructor",
			});

			if (!userResult.ok) {
				throw new Error("Failed to create TA user");
			}

			const enrollmentArgs: CreateEnrollmentArgs = {
				user: userResult.value.id,
				course: testCourse.id,
				role: "ta",
				status: "active",
			};

			const result = await tryCreateEnrollment(
				payload,
				mockRequest,
				enrollmentArgs,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.role).toBe("ta");
			}
		});
	});

	describe("tryFindEnrollmentById", () => {
		test("should find existing enrollment", async () => {
			// Get the enrollment we created earlier
			const searchResult = await trySearchEnrollments(payload, {
				user: testUser.id,
				course: testCourse.id,
			});

			if (!searchResult.ok || searchResult.value.docs.length === 0) {
				throw new Error("No enrollment found for test");
			}

			const enrollmentId = searchResult.value.docs[0].id;
			const result = await tryFindEnrollmentById(payload, enrollmentId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(enrollmentId);
				// User can be either ID or populated user object
				if (typeof result.value.user === "object") {
					expect(result.value.user.id).toBe(testUser.id);
				} else {
					expect(result.value.user).toBe(testUser.id);
				}
				// Course can be either ID or populated course object
				if (typeof result.value.course === "object") {
					expect(result.value.course.id).toBe(testCourse.id);
				} else {
					expect(result.value.course).toBe(testCourse.id);
				}
			}
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryFindEnrollmentById(payload, 99999);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Enrollment not found");
			}
		});
	});

	describe("tryUpdateEnrollment", () => {
		test("should update enrollment successfully", async () => {
			// Get the enrollment we created earlier
			const searchResult = await trySearchEnrollments(payload, {
				user: testUser.id,
				course: testCourse.id,
			});

			if (!searchResult.ok || searchResult.value.docs.length === 0) {
				throw new Error("No enrollment found for test");
			}

			const enrollmentId = searchResult.value.docs[0].id;
			const updateArgs: UpdateEnrollmentArgs = {
				status: "inactive",
				role: "manager",
			};

			const result = await tryUpdateEnrollment(
				payload,
				mockRequest,
				enrollmentId,
				updateArgs,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.status).toBe("inactive");
				expect(result.value.role).toBe("manager");
			}
		});

		test("should fail when enrollment does not exist", async () => {
			const updateArgs: UpdateEnrollmentArgs = {
				status: "completed",
			};

			const result = await tryUpdateEnrollment(
				payload,
				mockRequest,
				99999,
				updateArgs,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Enrollment not found");
			}
		});
	});

	describe("trySearchEnrollments", () => {
		test("should search enrollments by user", async () => {
			const result = await trySearchEnrollments(payload, {
				user: testUser.id,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				// User can be either ID or populated user object
				if (typeof result.value.docs[0].user === "object") {
					expect(result.value.docs[0].user.id).toBe(testUser.id);
				} else {
					expect(result.value.docs[0].user).toBe(testUser.id);
				}
			}
		});

		test("should search enrollments by course", async () => {
			const result = await trySearchEnrollments(payload, {
				course: testCourse.id,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				// Course can be either ID or populated course object
				if (typeof result.value.docs[0].course === "object") {
					expect(result.value.docs[0].course.id).toBe(testCourse.id);
				} else {
					expect(result.value.docs[0].course).toBe(testCourse.id);
				}
			}
		});

		test("should search enrollments by role", async () => {
			const result = await trySearchEnrollments(payload, {
				role: "ta",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				expect(result.value.docs[0].role).toBe("ta");
			}
		});

		test("should return empty results for non-existent criteria", async () => {
			const result = await trySearchEnrollments(payload, {
				user: 99999,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBe(0);
			}
		});
	});

	describe("tryFindEnrollmentsByUser", () => {
		test("should find enrollments for existing user", async () => {
			const result = await tryFindEnrollmentsByUser(payload, testUser.id);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThan(0);
				// User can be either ID or populated user object
				if (typeof result.value[0].user === "object") {
					expect(result.value[0].user.id).toBe(testUser.id);
				} else {
					expect(result.value[0].user).toBe(testUser.id);
				}
			}
		});

		test("should return empty array for user with no enrollments", async () => {
			const newUserResult = await tryCreateUser(payload, mockRequest, {
				email: "noenroll@example.com",
				password: "password123",
				firstName: "No",
				lastName: "Enrollment",
			});

			if (!newUserResult.ok) {
				throw new Error("Failed to create user for test");
			}

			const result = await tryFindEnrollmentsByUser(
				payload,
				newUserResult.value.id,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBe(0);
			}
		});
	});

	describe("tryFindEnrollmentsByCourse", () => {
		test("should find enrollments for existing course", async () => {
			const result = await tryFindEnrollmentsByCourse(payload, testCourse.id);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThan(0);
				// Course can be either ID or populated course object
				if (typeof result.value[0].course === "object") {
					expect(result.value[0].course.id).toBe(testCourse.id);
				} else {
					expect(result.value[0].course).toBe(testCourse.id);
				}
			}
		});
	});

	describe("tryFindUserEnrollmentInCourse", () => {
		test("should find specific user enrollment in course", async () => {
			const result = await tryFindUserEnrollmentInCourse(
				payload,
				testUser.id,
				testCourse.id,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).not.toBeNull();
				if (result.value) {
					// User can be either ID or populated user object
					if (typeof result.value.user === "object") {
						expect(result.value.user.id).toBe(testUser.id);
					} else {
						expect(result.value.user).toBe(testUser.id);
					}
					// Course can be either ID or populated course object
					if (typeof result.value.course === "object") {
						expect(result.value.course.id).toBe(testCourse.id);
					} else {
						expect(result.value.course).toBe(testCourse.id);
					}
				}
			}
		});

		test("should return null when enrollment does not exist", async () => {
			const newUserResult = await tryCreateUser(payload, mockRequest, {
				email: "notinroll@example.com",
				password: "password123",
				firstName: "Not",
				lastName: "Enrolled",
			});

			if (!newUserResult.ok) {
				throw new Error("Failed to create user for test");
			}

			const result = await tryFindUserEnrollmentInCourse(
				payload,
				newUserResult.value.id,
				testCourse.id,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe("tryUpdateEnrollmentStatus", () => {
		test("should update enrollment status to completed with completion date", async () => {
			// Get the enrollment we created earlier
			const searchResult = await trySearchEnrollments(payload, {
				user: testUser.id,
				course: testCourse.id,
			});

			if (!searchResult.ok || searchResult.value.docs.length === 0) {
				throw new Error("No enrollment found for test");
			}

			const enrollmentId = searchResult.value.docs[0].id;
			const completionDate = new Date().toISOString();

			const result = await tryUpdateEnrollmentStatus(
				payload,
				mockRequest,
				enrollmentId,
				"completed",
				completionDate,
			);

			expect(result.ok).toBe(true);
			if (result.ok && result.value.ok) {
				expect(result.value.value.status).toBe("completed");
				expect(result.value.value.completedAt).toBe(completionDate);
			}
		});

		test("should auto-set completion date when marking as completed without date", async () => {
			// Create another enrollment for this test
			const userResult = await tryCreateUser(payload, mockRequest, {
				email: "autocomplete@example.com",
				password: "password123",
				firstName: "Auto",
				lastName: "Complete",
			});

			if (!userResult.ok) {
				throw new Error("Failed to create user for test");
			}

			const enrollResult = await tryCreateEnrollment(payload, mockRequest, {
				user: userResult.value.id,
				course: testCourse.id,
				role: "student",
			});

			if (!enrollResult.ok) {
				throw new Error("Failed to create enrollment for test");
			}

			const result = await tryUpdateEnrollmentStatus(
				payload,
				mockRequest,
				enrollResult.value.id,
				"completed",
			);

			expect(result.ok).toBe(true);
			if (result.ok && result.value.ok) {
				expect(result.value.value.status).toBe("completed");
				expect(result.value.value.completedAt).toBeDefined();
			}
		});
	});

	describe("tryFindActiveEnrollments", () => {
		test("should find active enrollments only", async () => {
			const result = await tryFindActiveEnrollments(payload);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// All returned enrollments should have status "active"
				result.value.docs.forEach((enrollment) => {
					expect(enrollment.status).toBe("active");
				});
			}
		});
	});

	describe("tryDeleteEnrollment", () => {
		test("should delete enrollment successfully", async () => {
			// Create a new enrollment to delete
			const userResult = await tryCreateUser(payload, mockRequest, {
				email: "deleteme@example.com",
				password: "password123",
				firstName: "Delete",
				lastName: "Me",
			});

			if (!userResult.ok) {
				throw new Error("Failed to create user for delete test");
			}

			const enrollResult = await tryCreateEnrollment(payload, mockRequest, {
				user: userResult.value.id,
				course: testCourse.id,
				role: "student",
			});

			if (!enrollResult.ok) {
				throw new Error("Failed to create enrollment for delete test");
			}

			const deleteResult = await tryDeleteEnrollment(
				payload,
				mockRequest,
				enrollResult.value.id,
			);

			expect(deleteResult.ok).toBe(true);

			// Verify enrollment is deleted
			const findResult = await tryFindEnrollmentById(
				payload,
				enrollResult.value.id,
			);
			expect(findResult.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryDeleteEnrollment(payload, mockRequest, 99999);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to delete enrollment");
			}
		});
	});
});
