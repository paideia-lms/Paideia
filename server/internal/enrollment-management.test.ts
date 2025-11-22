import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
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
				theme: "light",
				direction: "ltr",
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
				userId: testUserId,
				course: testCourseId,
				role: "student",
				status: "active",
				user: null,
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
				userId: testUserId,
				course: testCourseId,
				role: "teacher",
				status: "active",
				user: null,
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
				userId: testUserId,
				role: "student",
				status: "active",
				user: null,
				overrideAccess: true,
			} as CreateEnrollmentArgs;

			const result = await tryCreateEnrollment(enrollmentArgs);

			expect(result.ok).toBe(false);
		});

		test("should fail when role is missing", async () => {
			const enrollmentArgs = {
				payload,
				userId: testUserId,
				course: testCourseId,
				status: "active",
				user: null,
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
					theme: "light",
					direction: "ltr",
				},
			});

			const enrollmentArgs: CreateEnrollmentArgs = {
				payload,
				userId: testUser2.id,
				user: null,
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
				expect(result.value.role).toBe("teacher");
				expect(result.value.status).toBe("completed");
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
					theme: "light",
					direction: "ltr",
				},
			});

			const enrollmentArgs: CreateEnrollmentArgs = {
				payload,
				userId: testUser3.id,
				user: null,
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
			const result = await tryDeleteEnrollment({
				payload,
				enrollmentId,
				user: null,
				req: undefined,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(enrollmentId);
			}
		});

		test("should fail when enrollment ID is missing", async () => {
			const result = await tryDeleteEnrollment({
				payload,
				enrollmentId: 0,
				user: null,
				req: undefined,
				overrideAccess: true,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryDeleteEnrollment({
				payload,
				enrollmentId: 99999,
				user: null,
				req: undefined,
				overrideAccess: true,
			});

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
					theme: "light",
					direction: "ltr",
				},
			});

			const enrollmentArgs: CreateEnrollmentArgs = {
				payload,
				userId: testUser4.id,
				user: null,
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
			const result = await tryFindEnrollmentById({
				payload,
				enrollmentId,
				user: null,
				req: undefined,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(enrollmentId);
				expect(result.value.role).toBe("student");
				expect(result.value.status).toBe("active");
			}
		});

		test("should fail when enrollment ID is missing", async () => {
			const result = await tryFindEnrollmentById({
				payload,
				enrollmentId: 0,
				user: null,
				req: undefined,
				overrideAccess: true,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryFindEnrollmentById({
				payload,
				enrollmentId: 99999,
				user: null,
				req: undefined,
				overrideAccess: true,
			});

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
		let testUserToken: string;

		// Helper to get authenticated user from token
		const getAuthUser = async (token: string): Promise<TypedUser | null> => {
			const authResult = await payload.auth({
				headers: new Headers({
					Authorization: `Bearer ${token}`,
				}),
			});
			return authResult.user;
		};

		beforeAll(async () => {
			mockRequest = new Request("http://localhost:3000/test");

			// Verify test user so they can login
			await payload.update({
				collection: "users",
				id: testUserId,
				data: {
					_verified: true,
				},
				overrideAccess: true,
			});

			// Login to get token
			const login = await payload.login({
				collection: "users",
				data: {
					email: "test@example.com",
					password: "testpassword123",
				},
			});

			if (!login.token) {
				throw new Error("Failed to get authentication token");
			}

			testUserToken = login.token;

			// Create groups first
			const artGroupResult = await tryCreateGroup({
				payload,
				name: "art",
				course: testCourseId,
				req: mockRequest,
				// ! beforeAll and afterAll can have overrideAccess: true because they are not part of the test suite and are not affected by the test suite.
				overrideAccess: true,
			});
			expect(artGroupResult.ok).toBe(true);
			if (artGroupResult.ok) {
				artGroupId = artGroupResult.value.id;
			}

			const econGroupResult = await tryCreateGroup({
				payload,
				name: "econ",
				course: testCourseId,
				req: mockRequest,
				// ! beforeAll and afterAll can have overrideAccess: true because they are not part of the test suite and are not affected by the test suite.
				overrideAccess: true,
			});
			expect(econGroupResult.ok).toBe(true);
			if (econGroupResult.ok) {
				econGroupId = econGroupResult.value.id;
			}

			const mathGroupResult = await tryCreateGroup({
				payload,
				name: "math",
				course: testCourseId,
				req: mockRequest,
				// ! beforeAll and afterAll can have overrideAccess: true because they are not part of the test suite and are not affected by the test suite.
				overrideAccess: true,
			});
			expect(mathGroupResult.ok).toBe(true);
			if (mathGroupResult.ok) {
				mathGroupId = mathGroupResult.value.id;
			}

			const scienceGroupResult = await tryCreateGroup({
				payload,
				name: "science",
				course: testCourseId,
				req: mockRequest,
				// ! beforeAll and afterAll can have overrideAccess: true because they are not part of the test suite and are not affected by the test suite.
				overrideAccess: true,
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
					theme: "light",
					direction: "ltr",
				},
				// ! beforeAll and afterAll can have overrideAccess: true because they are not part of the test suite and are not affected by the test suite.
				overrideAccess: true,
			});

			const enrollmentArgs: CreateEnrollmentArgs = {
				payload,
				userId: testUser5.id,
				user: null,
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
						theme: "light",
						direction: "ltr",
					},
					overrideAccess: true,
				});

				// Verify user so they can login
				await payload.update({
					collection: "users",
					id: testUser6.id,
					data: {
						_verified: true,
					},
					overrideAccess: true,
				});

				// Login to get token
				const login6 = await payload.login({
					collection: "users",
					data: {
						email: "test6@example.com",
						password: "testpassword123",
					},
				});

				if (!login6.token) {
					throw new Error("Failed to get authentication token");
				}

				// Get authenticated user
				const testUser6Auth = await getAuthUser(login6.token);
				if (!testUser6Auth) {
					throw new Error("Failed to get authenticated user");
				}

				// Create nested groups
				const artGroup1Result = await tryCreateGroup({
					payload,
					req: mockRequest,
					name: "group-1",
					course: testCourseId,
					parent: artGroupId,
					user: testUser6Auth,
				});
				expect(artGroup1Result.ok).toBe(true);

				const enrollmentArgs: CreateEnrollmentArgs = {
					payload,
					userId: testUser6.id,
					user: null,
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
				const result = await tryAddGroupsToEnrollment({
					payload,
					enrollmentId,
					groupIds: [mathGroupId, scienceGroupId],
					user: null,
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.groups).toBeDefined();
					const groupIds =
						result.value.groups?.map((g) =>
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
				const result = await tryAddGroupsToEnrollment({
					payload,
					enrollmentId: 0,
					groupIds: [mathGroupId],
					user: null,
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(false);
			});

			test("should fail when groups array is empty", async () => {
				const result = await tryAddGroupsToEnrollment({
					payload,
					enrollmentId,
					groupIds: [],
					user: null,
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("try get course with groups", () => {
			test("should get course with groups", async () => {
				// Get authenticated user
				const testUserAuth = await getAuthUser(testUserToken);
				if (!testUserAuth) {
					throw new Error("Failed to get authenticated user");
				}

				const result = await tryFindCourseById({
					payload,
					courseId: testCourseId,
					user: testUserAuth,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.groups).toBeDefined();
				}

				// Get all groups for the course
				const groupsResult = await tryFindGroupsByCourse({
					payload,
					courseId: testCourseId,
					user: testUserAuth,
				});
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
				const result = await tryRemoveGroupsFromEnrollment({
					payload,
					enrollmentId,
					groupIds: [artGroupId, scienceGroupId],
					user: null,
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					const groupIds =
						result.value.groups?.map((g) =>
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
				const result = await tryRemoveGroupsFromEnrollment({
					payload,
					enrollmentId: 0,
					groupIds: [mathGroupId],
					user: null,
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("tryFindEnrollmentsByGroup", () => {
			test("should find enrollments by group ID", async () => {
				const result = await tryFindEnrollmentsByGroup({
					payload,
					groupId: econGroupId,
					limit: 10,
					user: null,
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBeGreaterThan(0);
					// All returned enrollments should be in the econ group
					for (const enrollment of result.value) {
						const groupIds =
							enrollment.groups?.map((g) =>
								typeof g === "number" ? g : g.id,
							) || [];
						expect(groupIds).toContain(econGroupId);
					}
				}
			});

			test("should fail when group ID is missing", async () => {
				const result = await tryFindEnrollmentsByGroup({
					payload,
					groupId: 0,
					limit: 10,
					user: null,
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(false);
			});
		});
	});
});

describe("Enrollment Management Functions with Authentication", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let adminUser: TypedUser | null;
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

		// Create admin user for testing
		const testUser = await payload.create({
			collection: "users",
			data: {
				email: "admin@example.com",
				password: "adminpassword123",
				firstName: "Admin",
				lastName: "User",
				role: "admin",
				theme: "light",
				direction: "ltr",
			},
			overrideAccess: true,
		});
		adminUser = testUser as TypedUser;

		// Verify admin
		await payload.update({
			collection: "users",
			id: adminUser.id,
			data: {
				_verified: true,
			},
			overrideAccess: true,
		});

		// Create test user for enrollment
		const testUser2 = await payload.create({
			collection: "users",
			data: {
				email: "test@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
				theme: "light",
				direction: "ltr",
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
				userId: testUserId,
				course: testCourseId,
				role: "student",
				status: "active",
				user: adminUser,
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
				userId: testUserId,
				user: null,
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
				user: adminUser,
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
