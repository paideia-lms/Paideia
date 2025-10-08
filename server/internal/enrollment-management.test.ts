import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import {
	DuplicateEnrollmentError,
	EnrollmentNotFoundError,
	InvalidArgumentError,
} from "~/utils/error";
import sanitizedConfig from "../payload.config";
import { tryFindCourseById } from "./course-management";
import {
	type CreateEnrollmentArgs,
	tryAddGroupsToEnrollment,
	tryCreateEnrollment,
	tryDeleteEnrollment,
	tryFindEnrollmentById,
	tryFindEnrollmentsByGroup,
	tryGetAllGroupPaths,
	tryRemoveGroupsFromEnrollment,
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
				createdBy: testUserId,
				slug: "test-course",
				structure: {
					sections: [
						{
							title: "Test Section",
							description: "A test section for enrollment testing",
							items: [
								{
									id: 1,
								},
							],
						},
					],
				},
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
				expect((result.value as any).role).toBe("teacher");
				expect((result.value as any).status).toBe("completed");
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

	describe("Group Management Functions", () => {
		let enrollmentId: number;

		beforeAll(async () => {
			// Create a separate enrollment for group tests
			const testUser5 = await payload.create({
				collection: "users",
				data: {
					email: "test5@example.com",
					password: "testpassword123",
					firstName: "Test5",
					lastName: "User5",
				},
			});

			const enrollmentArgs: CreateEnrollmentArgs = {
				user: testUser5.id,
				course: testCourseId,
				role: "student",
				status: "active",
				groups: ["art", "econ"],
			};

			const result = await tryCreateEnrollment(payload, enrollmentArgs);
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		describe("tryCreateEnrollment with groups", () => {
			test("should create enrollment with groups and expand parent groups", async () => {
				const testUser6 = await payload.create({
					collection: "users",
					data: {
						email: "test6@example.com",
						password: "testpassword123",
						firstName: "Test6",
						lastName: "User6",
					},
				});

				const enrollmentArgs: CreateEnrollmentArgs = {
					user: testUser6.id,
					course: testCourseId,
					role: "student",
					status: "active",
					groups: ["art/group-1", "econ/group-2/subgroup-a"],
				};

				const result = await tryCreateEnrollment(payload, enrollmentArgs);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.groups).toBeDefined();
					const groupPaths =
						result.value.groups?.map((g: any) => g.groupPath) || [];

					// Should include the specified groups and their parents
					expect(groupPaths).toContain("art");
					expect(groupPaths).toContain("art/group-1");
					expect(groupPaths).toContain("econ");
					expect(groupPaths).toContain("econ/group-2");
					expect(groupPaths).toContain("econ/group-2/subgroup-a");
				}
			});
		});

		describe("tryAddGroupsToEnrollment", () => {
			test("should add groups to existing enrollment", async () => {
				const result = await tryAddGroupsToEnrollment(payload, enrollmentId, [
					"math",
					"science/group-1",
				]);

				expect(result.ok).toBe(true);
				if (result.ok) {
					const groupPaths =
						result.value.groups?.map((g: any) => g.groupPath) || [];

					// Should include original groups
					expect(groupPaths).toContain("art");
					expect(groupPaths).toContain("econ");

					// Should include new groups and their parents
					expect(groupPaths).toContain("math");
					expect(groupPaths).toContain("science");
					expect(groupPaths).toContain("science/group-1");
				}
			});

			test("should fail when enrollment ID is missing", async () => {
				const result = await tryAddGroupsToEnrollment(payload, 0, ["math"]);

				expect(result.ok).toBe(false);
			});

			test("should fail when groups array is empty", async () => {
				const result = await tryAddGroupsToEnrollment(
					payload,
					enrollmentId,
					[],
				);

				expect(result.ok).toBe(false);
			});
		});

		describe("try get course with groups", () => {
			test("should get course with groups", async () => {
				const result = await tryFindCourseById(payload, testCourseId);

				expect(result.ok).toBe(true);
				if (result.ok) {
					console.log(result.value);
					const groups = result.value.groups.map((g) => g.groupPath);
					expect(result.value.groups).toBeDefined();
					expect(groups).toContain("art");
					expect(groups).toContain("econ");
				}
			});
		});

		describe("tryRemoveGroupsFromEnrollment", () => {
			test("should remove groups from enrollment", async () => {
				const result = await tryRemoveGroupsFromEnrollment(
					payload,
					enrollmentId,
					["art", "science"],
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					const groupPaths =
						result.value.groups?.map((g: any) => g.groupPath) || [];

					// Should not contain removed groups
					expect(groupPaths).not.toContain("art");
					expect(groupPaths).not.toContain("science");
					expect(groupPaths).not.toContain("science/group-1");

					// Should still contain other groups
					expect(groupPaths).toContain("econ");
					expect(groupPaths).toContain("math");
				}
			});

			test("should fail when enrollment ID is missing", async () => {
				const result = await tryRemoveGroupsFromEnrollment(payload, 0, [
					"math",
				]);

				expect(result.ok).toBe(false);
			});
		});

		describe("tryFindEnrollmentsByGroup", () => {
			test("should find enrollments by group path", async () => {
				const result = await tryFindEnrollmentsByGroup(payload, "econ");

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBeGreaterThan(0);
					// All returned enrollments should be in the econ group
					for (const enrollment of result.value) {
						const groupPaths =
							enrollment.groups?.map((g: any) => g.groupPath) || [];
						expect(groupPaths).toContain("econ");
					}
				}
			});

			test("should fail when group path is missing", async () => {
				const result = await tryFindEnrollmentsByGroup(payload, "");

				expect(result.ok).toBe(false);
			});
		});

		describe("tryGetAllGroupPaths", () => {
			test("should get all unique group paths", async () => {
				const result = await tryGetAllGroupPaths(payload);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(Array.isArray(result.value)).toBe(true);
					expect(result.value.length).toBeGreaterThan(0);

					// Should contain some of the groups we created
					expect(result.value).toContain("art");
					expect(result.value).toContain("econ");
					expect(result.value).toContain("math");
				}
			});
		});
	});
});
