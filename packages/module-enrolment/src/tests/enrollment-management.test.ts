import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { executeAuthStrategies, getPayload, type Migration, type TypedUser } from "payload";
import sanitizedConfig from "payload.config";
import { UserModule } from "@paideia/module-user";
import { CourseModule } from "@paideia/module-course";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import {
	type CreateEnrollmentArgs,
	type SearchEnrollmentsArgs,
	tryAddGroupsToEnrollment,
	tryCreateEnrollment,
	tryDeleteEnrollment,
	tryFindEnrollmentById,
	tryFindEnrollmentsByGroup,
	tryFindEnrollmentsByUser,
	tryRemoveGroupsFromEnrollment,
	trySearchEnrollments,
	tryUpdateEnrollment,
	type UpdateEnrollmentArgs,
} from "../services/enrollment-management";
import {
	tryCreateGroup,
	tryFindGroupsByCourse,
} from "../services/group-management";
import {
	trySeedGroups,
	trySeedEnrollments,
	enrollmentManagementTestGroupSeedData,
	enrollmentManagementTestEnrollmentSeedData,
} from "../seeding";
import { enrollmentManagementTestUserSeedData } from "../seeding/enrollment-management-test-user-seed-data";
import { enrollmentManagementTestCourseSeedData } from "../seeding/enrollment-management-test-course-seed-data";
import { migrations } from "src/migrations";

describe("Enrollment Management Functions", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const courseModule = new CourseModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let testUserId: number;
	let testCourseId: number;
	let noEnrollmentUserId: number;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		const usersResult = (
			await userModule.seedUsers({
				data: enrollmentManagementTestUserSeedData,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		testUserId = usersResult.byEmail.get("testuser1@example.com")!.user.id;

		const coursesResult = (
			await courseModule.seedCourses({
				data: enrollmentManagementTestCourseSeedData,
				usersByEmail: usersResult.getUsersByEmail(),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		testCourseId = coursesResult.getCourseBySlug("cs-101-fa-2025")!.id;

		await trySeedGroups({
			payload,
			data: enrollmentManagementTestGroupSeedData,
			coursesBySlug: coursesResult.coursesBySlug,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		await trySeedEnrollments({
			payload,
			data: enrollmentManagementTestEnrollmentSeedData,
			usersByEmail: usersResult.getUsersByEmail(),
			coursesBySlug: coursesResult.coursesBySlug,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		// Create a user with no enrollments for the create test
		const noEnrollmentUser = await payload.create({
			collection: "users",
			data: {
				email: "no-enrollment@example.com",
				password: "testpassword123",
				firstName: "NoEnrollment",
				lastName: "User",
				theme: "light",
				direction: "ltr",
			},
			overrideAccess: true,
		});
		noEnrollmentUserId = noEnrollmentUser.id;
	});

	afterAll(async () => {
		try {
			await infrastructureModule.migrateFresh({
				migrations: migrations as Migration[],
				forceAcceptWarning: true,
			});
			await infrastructureModule.cleanS3();
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateEnrollment", () => {
		test("should create a new enrollment successfully", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				payload,
				userId: noEnrollmentUserId,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeDefined();
				const userId = result.value.user;
				expect(userId).toBe(noEnrollmentUserId);
				const courseId = result.value.course;
				expect(courseId).toBe(testCourseId);
				expect(result.value.role).toBe("student");
				expect(result.value.status).toBe("active");
				expect(result.value.enrolledAt).toBeDefined();
			}
		});

		test("should fail when trying to create duplicate enrollment", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				payload,
				userId: noEnrollmentUserId,
				course: testCourseId,
				role: "teacher",
				status: "active",
				overrideAccess: true,
				req: undefined,
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
				overrideAccess: true,
			} as CreateEnrollmentArgs;

			const result = await tryCreateEnrollment(enrollmentArgs);
			expect(result.ok).toBe(false);
		});
	});

	describe("tryUpdateEnrollment", () => {
		let enrollmentId: number;

		beforeAll(async () => {
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

			const result = await tryCreateEnrollment({
				payload,
				userId: testUser2.id,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: true,
				req: undefined,
			});
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
				req: undefined,
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
				req: undefined,
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
				req: undefined,
			};

			const result = await tryUpdateEnrollment(updateArgs);
			expect(result.ok).toBe(false);
		});
	});

	describe("tryDeleteEnrollment", () => {
		let enrollmentId: number;

		beforeAll(async () => {
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

			const result = await tryCreateEnrollment({
				payload,
				userId: testUser3.id,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		test("should delete enrollment successfully", async () => {
			const result = await tryDeleteEnrollment({
				payload,
				enrollmentId,
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
				req: undefined,
				overrideAccess: true,
			});
			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryDeleteEnrollment({
				payload,
				enrollmentId: 99999,
				req: undefined,
				overrideAccess: true,
			});
			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindEnrollmentById", () => {
		let enrollmentId: number;

		beforeAll(async () => {
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

			const result = await tryCreateEnrollment({
				payload,
				userId: testUser4.id,
				course: testCourseId,
				role: "student",
				status: "active",
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				enrollmentId = result.value.id;
			}
		});

		test("should find enrollment by ID successfully", async () => {
			const result = await tryFindEnrollmentById({
				payload,
				enrollmentId,
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
				req: undefined,
				overrideAccess: true,
			});
			expect(result.ok).toBe(false);
		});

		test("should fail when enrollment does not exist", async () => {
			const result = await tryFindEnrollmentById({
				payload,
				enrollmentId: 99999,
				req: undefined,
				overrideAccess: true,
			});
			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindEnrollmentsByUser", () => {
		let testUserForEnrollments: number;
		let testCourse2Id: number;
		let testCourse3Id: number;

		beforeAll(async () => {
			const testUserDoc = await payload.create({
				collection: "users",
				data: {
					email: "enrollments@example.com",
					password: "testpassword123",
					firstName: "Enrollments",
					lastName: "User",
					theme: "light",
					direction: "ltr",
				},
				overrideAccess: true,
			});
			testUserForEnrollments = testUserDoc.id;

			const testCourse2 = await payload.create({
				collection: "courses",
				data: {
					title: "Test Course 2",
					description: "A second test course",
					createdBy: testUserForEnrollments,
					slug: "test-course-2",
					status: "published",
				},
				overrideAccess: true,
			});
			testCourse2Id = testCourse2.id;

			const testCourse3 = await payload.create({
				collection: "courses",
				data: {
					title: "Test Course 3",
					description: "A third test course",
					createdBy: testUserForEnrollments,
					slug: "test-course-3",
					status: "published",
				},
				overrideAccess: true,
			});
			testCourse3Id = testCourse3.id;

			const enrollment1Result = await tryCreateEnrollment({
				payload,
				userId: testUserForEnrollments,
				course: testCourse2Id,
				role: "student",
				status: "active",
				req: undefined,
				overrideAccess: true,
			});
			expect(enrollment1Result.ok).toBe(true);

			const enrollment2Result = await tryCreateEnrollment({
				payload,
				userId: testUserForEnrollments,
				course: testCourse3Id,
				role: "teacher",
				status: "active",
				req: undefined,
				overrideAccess: true,
			});
			expect(enrollment2Result.ok).toBe(true);
		});

		test("should find all enrollments for a user", async () => {
			const result = await tryFindEnrollmentsByUser({
				payload,
				userId: testUserForEnrollments,
				req: undefined,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(Array.isArray(result.value)).toBe(true);
				expect(result.value.length).toBeGreaterThanOrEqual(2);
			}
		});

		test("should return empty array for user with no enrollments", async () => {
			const newUser = await payload.create({
				collection: "users",
				data: {
					email: "noenrollments@example.com",
					password: "testpassword123",
					firstName: "No",
					lastName: "Enrollments",
					theme: "light",
					direction: "ltr",
				},
				overrideAccess: true,
			});

			const result = await tryFindEnrollmentsByUser({
				payload,
				userId: newUser.id,
				req: undefined,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(Array.isArray(result.value)).toBe(true);
				expect(result.value.length).toBe(0);
			}
		});

		test("should fail when user ID is missing", async () => {
			const result = await tryFindEnrollmentsByUser({
				payload,
				userId: 0,
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

		beforeAll(async () => {
			const mockRequest = new Request("http://localhost:3000/test");

			const artGroupResult = await tryCreateGroup({
				payload,
				name: "art",
				course: testCourseId,
				req: mockRequest,
				overrideAccess: true,
			});
			expect(artGroupResult.ok).toBe(true);
			if (artGroupResult.ok) artGroupId = artGroupResult.value.id;

			const econGroupResult = await tryCreateGroup({
				payload,
				name: "econ",
				course: testCourseId,
				req: mockRequest,
				overrideAccess: true,
			});
			expect(econGroupResult.ok).toBe(true);
			if (econGroupResult.ok) econGroupId = econGroupResult.value.id;

			const mathGroupResult = await tryCreateGroup({
				payload,
				name: "math",
				course: testCourseId,
				req: mockRequest,
				overrideAccess: true,
			});
			expect(mathGroupResult.ok).toBe(true);
			if (mathGroupResult.ok) mathGroupId = mathGroupResult.value.id;

			const scienceGroupResult = await tryCreateGroup({
				payload,
				name: "science",
				course: testCourseId,
				req: mockRequest,
				overrideAccess: true,
			});
			expect(scienceGroupResult.ok).toBe(true);
			if (scienceGroupResult.ok) scienceGroupId = scienceGroupResult.value.id;

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
				overrideAccess: true,
			});

			const result = await tryCreateEnrollment({
				payload,
				userId: testUser5.id,
				course: testCourseId,
				role: "student",
				status: "active",
				groups: [artGroupId, econGroupId],
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) enrollmentId = result.value.id;
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

				const mockRequest = new Request("http://localhost:3000/test");
				const artGroup1Result = await tryCreateGroup({
					payload,
					req: mockRequest,
					name: "group-1",
					course: testCourseId,
					parent: artGroupId,
					overrideAccess: true,
				});
				expect(artGroup1Result.ok).toBe(true);

				const enrollmentArgs: CreateEnrollmentArgs = {
					payload,
					userId: testUser6.id,
					course: testCourseId,
					role: "student",
					status: "active",
					groups: artGroup1Result.ok ? [artGroup1Result.value.id] : [],
					overrideAccess: true,
					req: undefined,
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
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.groups).toBeDefined();
					const groupIds =
						result.value.groups?.map((g: any) =>
							typeof g === "number" ? g : g.id,
						) || [];

					expect(groupIds).toContain(artGroupId);
					expect(groupIds).toContain(econGroupId);
					expect(groupIds).toContain(mathGroupId);
					expect(groupIds).toContain(scienceGroupId);
				}
			});

			test("should fail when enrollment ID is missing", async () => {
				const result = await tryAddGroupsToEnrollment({
					payload,
					enrollmentId: 0,
					groupIds: [mathGroupId],
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
					req: undefined,
					overrideAccess: true,
				});
				expect(result.ok).toBe(false);
			});
		});

		describe("tryRemoveGroupsFromEnrollment", () => {
			test("should remove groups from enrollment", async () => {
				const result = await tryRemoveGroupsFromEnrollment({
					payload,
					enrollmentId,
					groupIds: [artGroupId, scienceGroupId],
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					const groupIds =
						result.value.groups?.map((g: any) =>
							typeof g === "number" ? g : g.id,
						) || [];

					expect(groupIds).not.toContain(artGroupId);
					expect(groupIds).not.toContain(scienceGroupId);
					expect(groupIds).toContain(econGroupId);
					expect(groupIds).toContain(mathGroupId);
				}
			});

			test("should fail when enrollment ID is missing", async () => {
				const result = await tryRemoveGroupsFromEnrollment({
					payload,
					enrollmentId: 0,
					groupIds: [mathGroupId],
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
					req: undefined,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBeGreaterThan(0);
				}
			});

			test("should fail when group ID is missing", async () => {
				const result = await tryFindEnrollmentsByGroup({
					payload,
					groupId: 0,
					limit: 10,
					req: undefined,
					overrideAccess: true,
				});
				expect(result.ok).toBe(false);
			});
		});

		describe("tryFindGroupsByCourse", () => {
			test("should find all groups for a course", async () => {
				const groupsResult = await tryFindGroupsByCourse({
					payload,
					courseId: testCourseId,
					req: undefined,
					overrideAccess: true,
				});
				expect(groupsResult.ok).toBe(true);
				if (groupsResult.ok) {
					expect(groupsResult.value.length).toBeGreaterThan(0);
					const groupNames = groupsResult.value.map((g: any) => g.name);
					expect(groupNames).toContain("art");
					expect(groupNames).toContain("econ");
				}
			});
		});
	});
});

describe("Enrollment Management Functions with Authentication", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const infrastructureModule = new InfrastructureModule(payload);
	let adminUser: TypedUser | null;
	let testUserId: number;
	let testCourseId: number;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});

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

		await payload.update({
			collection: "users",
			id: adminUser.id,
			data: {
				_verified: true,
			},
			overrideAccess: true,
		});

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
		try {
			await infrastructureModule.migrateFresh({
				migrations: migrations as Migration[],
				forceAcceptWarning: true,
			});
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
				req: { user: adminUser },
				overrideAccess: false,
			};

			const result = await tryCreateEnrollment(enrollmentArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeDefined();
				const userId = result.value.user;
				expect(userId).toBe(testUserId);
				const courseId = result.value.course;
				expect(courseId).toBe(testCourseId);
				expect(result.value.role).toBe("student");
				expect(result.value.status).toBe("active");
			}
		});

		test("unauthenticated request should fail to create enrollment", async () => {
			const enrollmentArgs: CreateEnrollmentArgs = {
				payload,
				userId: testUserId,
				req: { user: null },
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
				req: { user: adminUser },
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
				req: undefined,
			};

			const result = await trySearchEnrollments(searchArgs);
			expect(result.ok).toBe(false);
		});
	});
});
