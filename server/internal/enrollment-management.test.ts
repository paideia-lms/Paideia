import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	tryCreateGroup,
	tryFindCourseById,
	tryFindGroupsByCourse,
} from "./course-management";
import {
	type CreateEnrollmentArgs,
	type SearchEnrollmentsArgs,
	tryAddGroupsToEnrollment,
	tryCreateEnrollment,
	tryDeleteEnrollment,
	tryFindEnrollmentById,
	tryFindEnrollmentsByGroup,
	tryRemoveGroupsFromEnrollment,
	trySearchEnrollments,
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
				payload,
				user: testUserId,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: true,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);

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
				payload,
				user: testUserId,
				course: testCourseId,
				role: "teacher",
				status: "active",
				overrideAccess: true,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);

			expect(result.ok).toBe(false);
		});

		test("should fail when user ID is missing", async () => {
			const enrollmentArgs = {
				payload,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: true,
			} as CreateEnrollmentArgs;

			const result = await tryCreateEnrollment(enrollmentArgs);

			expect(result.ok).toBe(false);
		});

		test("should fail when course ID is missing", async () => {
			const enrollmentArgs = {
				payload,
				user: testUserId,
				role: "student",
				status: "active",
				overrideAccess: true,
			} as CreateEnrollmentArgs;

			const result = await tryCreateEnrollment(enrollmentArgs);

			expect(result.ok).toBe(false);
		});

		test("should fail when role is missing", async () => {
			const enrollmentArgs = {
				payload,
				user: testUserId,
				course: testCourseId,
				status: "active",
				overrideAccess: true,
			} as CreateEnrollmentArgs;

			const result = await tryCreateEnrollment(enrollmentArgs);

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
				payload,
				user: testUser2.id,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: true,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		test("should update enrollment successfully", async () => {
			const updateArgs: UpdateEnrollmentArgs = {
				payload,
				enrollmentId,
				role: "teacher",
				status: "completed",
				overrideAccess: true,
			};

			const result = await tryUpdateEnrollment(updateArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as any).role).toBe("teacher");
				expect((result.value as any).status).toBe("completed");
			}
		});

		test("should fail when enrollment ID is missing", async () => {
			const updateArgs: UpdateEnrollmentArgs = {
				payload,
				enrollmentId: 0,
				role: "student",
				overrideAccess: true,
			};

			const result = await tryUpdateEnrollment(updateArgs);

			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const updateArgs: UpdateEnrollmentArgs = {
				payload,
				enrollmentId: 99999,
				role: "student",
				overrideAccess: true,
			};

			const result = await tryUpdateEnrollment(updateArgs);

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
				payload,
				user: testUser3.id,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: true,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		test("should delete enrollment successfully", async () => {
			const result = await tryDeleteEnrollment(
				payload,
				enrollmentId,
				null,
				undefined,
				true,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(enrollmentId);
			}
		});

		test("should fail when enrollment ID is missing", async () => {
			const result = await tryDeleteEnrollment(
				payload,
				0,
				null,
				undefined,
				true,
			);

			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryDeleteEnrollment(
				payload,
				99999,
				null,
				undefined,
				true,
			);

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
				payload,
				user: testUser4.id,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: true,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		test("should find enrollment by ID successfully", async () => {
			const result = await tryFindEnrollmentById(
				payload,
				enrollmentId,
				null,
				undefined,
				true,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(enrollmentId);
				expect(result.value.role).toBe("student");
				expect(result.value.status).toBe("active");
			}
		});

		test("should fail when enrollment ID is missing", async () => {
			const result = await tryFindEnrollmentById(
				payload,
				0,
				null,
				undefined,
				true,
			);

			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryFindEnrollmentById(
				payload,
				99999,
				null,
				undefined,
				true,
			);

			expect(result.ok).toBe(false);
		});
	});

	describe("Group Management Functions", () => {
		let enrollmentId: number;
		let artGroupId: number;
		let econGroupId: number;
		let mathGroupId: number;
		let scienceGroupId: number;
		let mockRequest: Request;

		beforeAll(async () => {
			mockRequest = new Request("http://localhost:3000/test");

			// Create groups first
			const artGroupResult = await tryCreateGroup(payload, mockRequest, {
				name: "art",
				course: testCourseId,
			});
			expect(artGroupResult.ok).toBe(true);
			if (artGroupResult.ok) {
				artGroupId = artGroupResult.value.id;
			}

			const econGroupResult = await tryCreateGroup(payload, mockRequest, {
				name: "econ",
				course: testCourseId,
			});
			expect(econGroupResult.ok).toBe(true);
			if (econGroupResult.ok) {
				econGroupId = econGroupResult.value.id;
			}

			const mathGroupResult = await tryCreateGroup(payload, mockRequest, {
				name: "math",
				course: testCourseId,
			});
			expect(mathGroupResult.ok).toBe(true);
			if (mathGroupResult.ok) {
				mathGroupId = mathGroupResult.value.id;
			}

			const scienceGroupResult = await tryCreateGroup(payload, mockRequest, {
				name: "science",
				course: testCourseId,
			});
			expect(scienceGroupResult.ok).toBe(true);
			if (scienceGroupResult.ok) {
				scienceGroupId = scienceGroupResult.value.id;
			}

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
				payload,
				user: testUser5.id,
				course: testCourseId,
				role: "student",
				status: "active",
				groups: [artGroupId, econGroupId],
				overrideAccess: true,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		describe("tryCreateEnrollment with groups", () => {
			test("should create enrollment with groups", async () => {
				const testUser6 = await payload.create({
					collection: "users",
					data: {
						email: "test6@example.com",
						password: "testpassword123",
						firstName: "Test6",
						lastName: "User6",
					},
				});

				// Create nested groups
				const artGroup1Result = await tryCreateGroup(payload, mockRequest, {
					name: "group-1",
					course: testCourseId,
					parent: artGroupId,
				});
				expect(artGroup1Result.ok).toBe(true);

				const enrollmentArgs: CreateEnrollmentArgs = {
					payload,
					user: testUser6.id,
					course: testCourseId,
					role: "student",
					status: "active",
					groups: artGroup1Result.ok ? [artGroup1Result.value.id] : [],
					overrideAccess: true,
				};

				const result = await tryCreateEnrollment(enrollmentArgs);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.groups).toBeDefined();
					expect(Array.isArray(result.value.groups)).toBe(true);
				}
			});
		});

		describe("tryAddGroupsToEnrollment", () => {
			test("should add groups to existing enrollment", async () => {
				const result = await tryAddGroupsToEnrollment(
					payload,
					enrollmentId,
					[mathGroupId, scienceGroupId],
					null,
					undefined,
					true,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.groups).toBeDefined();
					const groupIds =
						result.value.groups?.map((g: any) =>
							typeof g === "number" ? g : g.id,
						) || [];

					// Should include original groups
					expect(groupIds).toContain(artGroupId);
					expect(groupIds).toContain(econGroupId);

					// Should include new groups
					expect(groupIds).toContain(mathGroupId);
					expect(groupIds).toContain(scienceGroupId);
				}
			});

			test("should fail when enrollment ID is missing", async () => {
				const result = await tryAddGroupsToEnrollment(
					payload,
					0,
					[mathGroupId],
					null,
					undefined,
					true,
				);

				expect(result.ok).toBe(false);
			});

			test("should fail when groups array is empty", async () => {
				const result = await tryAddGroupsToEnrollment(
					payload,
					enrollmentId,
					[],
					null,
					undefined,
					true,
				);

				expect(result.ok).toBe(false);
			});
		});

		describe("try get course with groups", () => {
			test("should get course with groups", async () => {
				const result = await tryFindCourseById({
					payload,
					courseId: testCourseId,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.groups).toBeDefined();
				}

				// Get all groups for the course
				const groupsResult = await tryFindGroupsByCourse(payload, testCourseId);
				expect(groupsResult.ok).toBe(true);
				if (groupsResult.ok) {
					expect(groupsResult.value.length).toBeGreaterThan(0);
					const groupNames = groupsResult.value.map((g) => g.name);
					expect(groupNames).toContain("art");
					expect(groupNames).toContain("econ");
				}
			});
		});

		describe("tryRemoveGroupsFromEnrollment", () => {
			test("should remove groups from enrollment", async () => {
				const result = await tryRemoveGroupsFromEnrollment(
					payload,
					enrollmentId,
					[artGroupId, scienceGroupId],
					null,
					undefined,
					true,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					const groupIds =
						result.value.groups?.map((g: any) =>
							typeof g === "number" ? g : g.id,
						) || [];

					// Should not contain removed groups
					expect(groupIds).not.toContain(artGroupId);
					expect(groupIds).not.toContain(scienceGroupId);

					// Should still contain other groups
					expect(groupIds).toContain(econGroupId);
					expect(groupIds).toContain(mathGroupId);
				}
			});

			test("should fail when enrollment ID is missing", async () => {
				const result = await tryRemoveGroupsFromEnrollment(
					payload,
					0,
					[mathGroupId],
					null,
					undefined,
					true,
				);

				expect(result.ok).toBe(false);
			});
		});

		describe("tryFindEnrollmentsByGroup", () => {
			test("should find enrollments by group ID", async () => {
				const result = await tryFindEnrollmentsByGroup(
					payload,
					econGroupId,
					10,
					null,
					undefined,
					true,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBeGreaterThan(0);
					// All returned enrollments should be in the econ group
					for (const enrollment of result.value) {
						const groupIds =
							enrollment.groups?.map((g: any) =>
								typeof g === "number" ? g : g.id,
							) || [];
						expect(groupIds).toContain(econGroupId);
					}
				}
			});

			test("should fail when group ID is missing", async () => {
				const result = await tryFindEnrollmentsByGroup(
					payload,
					0,
					10,
					null,
					undefined,
					true,
				);

				expect(result.ok).toBe(false);
			});
		});
	});
});

describe("Enrollment Management Functions with Authentication", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let adminUser: any;
	let testUserId: number;
	let testCourseId: number;
	let adminToken: string;

	// Helper to get authenticated user from token
	const getAuthUser = async (token: string): Promise<any> => {
		const authResult = await payload.auth({
			headers: new Headers({
				Authorization: `Bearer ${token}`,
			}),
		});
		return authResult.user;
	};

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

		// Create admin user for testing
		const adminArgs: CreateEnrollmentArgs = {
			payload,
			user: 1, // We'll create this user first
			course: 1, // We'll create this course first
			role: "student",
			status: "active",
			overrideAccess: true,
		};

		// Create test user
		const testUser = await payload.create({
			collection: "users",
			data: {
				email: "admin@example.com",
				password: "adminpassword123",
				firstName: "Admin",
				lastName: "User",
				role: "admin",
			},
			overrideAccess: true,
		});
		adminUser = testUser;

		// Verify admin
		await payload.update({
			collection: "users",
			id: adminUser.id,
			data: {
				_verified: true,
			},
			overrideAccess: true,
		});

		// Login to get admin token
		const adminLogin = await payload.login({
			collection: "users",
			data: {
				email: "admin@example.com",
				password: "adminpassword123",
			},
		});

		if (!adminLogin.token) {
			throw new Error("Failed to get admin token");
		}

		adminToken = adminLogin.token;

		// Create test user for enrollment
		const testUser2 = await payload.create({
			collection: "users",
			data: {
				email: "test@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
			},
			overrideAccess: true,
		});
		testUserId = testUser2.id;

		// Create test course
		const testCourse = await payload.create({
			collection: "courses",
			data: {
				title: "Test Course",
				description: "A test course for enrollment testing",
				createdBy: adminUser.id,
				slug: "test-course",
				status: "published",
			},
			overrideAccess: true,
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

	describe("tryCreateEnrollment with Authentication", () => {
		test("admin should be able to create enrollments", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				payload,
				user: testUserId,
				course: testCourseId,
				role: "student",
				status: "active",
				authenticatedUser: adminUser,
				overrideAccess: false,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeDefined();
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
			}
		});

		test("unauthenticated request should fail to create enrollment", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				payload,
				user: testUserId,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: false,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);

			expect(result.ok).toBe(false);
		});
	});

	describe("trySearchEnrollments with Authentication", () => {
		test("admin should be able to search enrollments", async () => {
			const searchArgs: SearchEnrollmentsArgs = {
				payload,
				course: testCourseId,
				limit: 10,
				page: 1,
				authenticatedUser: adminUser,
				overrideAccess: false,
			};

			const result = await trySearchEnrollments(searchArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				expect(result.value.totalDocs).toBeGreaterThan(0);
			}
		});

		test("unauthenticated request should fail to search enrollments", async () => {
			const searchArgs: SearchEnrollmentsArgs = {
				payload,
				course: testCourseId,
				limit: 10,
				page: 1,
				overrideAccess: false,
			};

			const result = await trySearchEnrollments(searchArgs);

			expect(result.ok).toBe(false);
		});
	});
});
