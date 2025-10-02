import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import {
	DuplicateEnrollmentError,
	EnrollmentNotFoundError,
	InvalidArgumentError,
} from "~/utils/error";
import sanitizedConfig from "../payload.config";
import {
	type CreateEnrollmentArgs,
	tryCreateEnrollment,
	tryDeleteEnrollment,
	tryFindEnrollmentById,
	tryUpdateEnrollment,
	type UpdateEnrollmentArgs,
} from "./enrollment-management";

describe("Enrollment Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let testUserId: number;
	let testCourseId: number;

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

		// Create test user
		const testUser = await payload.create({
			collection: "users",
			data: {
				email: "test@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
			},
		});
		testUserId = testUser.id;

		// Create test course
		const testCourse = await payload.create({
			collection: "courses",
			data: {
				title: "Test Course",
				description: "A test course for enrollment testing",
				instructor: testUserId,
				status: "published",
			},
		});
		testCourseId = testCourse.id;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateEnrollment", () => {
		test("should create a new enrollment successfully", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				user: testUserId,
				course: testCourseId,
				role: "student",
				status: "active",
			};

			const result = await tryCreateEnrollment(payload, enrollmentArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeDefined();
				// Handle both cases: user can be ID or populated object
				const userId =
					typeof result.value.user === "object"
						? result.value.user.id
						: result.value.user;
				expect(userId).toBe(testUserId);
				const courseId =
					typeof result.value.course === "object"
						? result.value.course.id
						: result.value.course;
				expect(courseId).toBe(testCourseId);
				expect(result.value.role).toBe("student");
				expect(result.value.status).toBe("active");
				expect(result.value.enrolledAt).toBeDefined();
			}
		});

		test("should fail when trying to create duplicate enrollment", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				user: testUserId,
				course: testCourseId,
				role: "teacher",
				status: "active",
			};

			const result = await tryCreateEnrollment(payload, enrollmentArgs);

			expect(result.ok).toBe(false);
		});

		test("should fail when user ID is missing", async () => {
			const enrollmentArgs = {
				course: testCourseId,
				role: "student",
				status: "active",
			} as CreateEnrollmentArgs;

			const result = await tryCreateEnrollment(payload, enrollmentArgs);

			expect(result.ok).toBe(false);
		});

		test("should fail when course ID is missing", async () => {
			const enrollmentArgs = {
				user: testUserId,
				role: "student",
				status: "active",
			} as CreateEnrollmentArgs;

			const result = await tryCreateEnrollment(payload, enrollmentArgs);

			expect(result.ok).toBe(false);
		});

		test("should fail when role is missing", async () => {
			const enrollmentArgs = {
				user: testUserId,
				course: testCourseId,
				status: "active",
			} as CreateEnrollmentArgs;

			const result = await tryCreateEnrollment(payload, enrollmentArgs);

			expect(result.ok).toBe(false);
		});
	});

	describe("tryUpdateEnrollment", () => {
		let enrollmentId: number;

		beforeAll(async () => {
			// Create a separate enrollment for update tests
			const testUser2 = await payload.create({
				collection: "users",
				data: {
					email: "test2@example.com",
					password: "testpassword123",
					firstName: "Test2",
					lastName: "User2",
				},
			});

			const enrollmentArgs: CreateEnrollmentArgs = {
				user: testUser2.id,
				course: testCourseId,
				role: "student",
				status: "active",
			};

			const result = await tryCreateEnrollment(payload, enrollmentArgs);
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		test("should update enrollment successfully", async () => {
			const updateArgs: UpdateEnrollmentArgs = {
				role: "teacher",
				status: "completed",
			};

			const result = await tryUpdateEnrollment(
				payload,
				enrollmentId,
				updateArgs,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.role).toBe("teacher");
				expect(result.value.status).toBe("completed");
			}
		});

		test("should fail when enrollment ID is missing", async () => {
			const updateArgs: UpdateEnrollmentArgs = {
				role: "student",
			};

			const result = await tryUpdateEnrollment(payload, 0, updateArgs);

			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const updateArgs: UpdateEnrollmentArgs = {
				role: "student",
			};

			const result = await tryUpdateEnrollment(payload, 99999, updateArgs);

			expect(result.ok).toBe(false);
		});
	});

	describe("tryDeleteEnrollment", () => {
		let enrollmentId: number;

		beforeAll(async () => {
			// Create a separate enrollment for delete tests
			const testUser3 = await payload.create({
				collection: "users",
				data: {
					email: "test3@example.com",
					password: "testpassword123",
					firstName: "Test3",
					lastName: "User3",
				},
			});

			const enrollmentArgs: CreateEnrollmentArgs = {
				user: testUser3.id,
				course: testCourseId,
				role: "student",
				status: "active",
			};

			const result = await tryCreateEnrollment(payload, enrollmentArgs);
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		test("should delete enrollment successfully", async () => {
			const result = await tryDeleteEnrollment(payload, enrollmentId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(enrollmentId);
			}
		});

		test("should fail when enrollment ID is missing", async () => {
			const result = await tryDeleteEnrollment(payload, 0);

			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryDeleteEnrollment(payload, 99999);

			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindEnrollmentById", () => {
		let enrollmentId: number;

		beforeAll(async () => {
			// Create a separate enrollment for find tests
			const testUser4 = await payload.create({
				collection: "users",
				data: {
					email: "test4@example.com",
					password: "testpassword123",
					firstName: "Test4",
					lastName: "User4",
				},
			});

			const enrollmentArgs: CreateEnrollmentArgs = {
				user: testUser4.id,
				course: testCourseId,
				role: "student",
				status: "active",
			};

			const result = await tryCreateEnrollment(payload, enrollmentArgs);
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		test("should find enrollment by ID successfully", async () => {
			const result = await tryFindEnrollmentById(payload, enrollmentId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(enrollmentId);
				expect(result.value.role).toBe("student");
				expect(result.value.status).toBe("active");
			}
		});

		test("should fail when enrollment ID is missing", async () => {
			const result = await tryFindEnrollmentById(payload, 0);

			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryFindEnrollmentById(payload, 99999);

			expect(result.ok).toBe(false);
		});
	});
});
