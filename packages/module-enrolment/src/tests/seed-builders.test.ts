import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "payload.config";
import { UserModule } from "@paideia/module-user";
import { CourseModule } from "@paideia/module-course";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import type { Migration } from "payload";
import { migrations } from "src/migrations";
import {
	trySeedGroups,
	trySeedEnrollments,
	predefinedGroupSeedData,
	predefinedEnrollmentSeedData,
	type SeedGroupsResult,
	type SeedEnrollmentsResult,
} from "../seeding";
import { enrollmentManagementTestCourseSeedData } from "../seeding/enrollment-management-test-course-seed-data";
import { devConstants } from "../utils/constants";

describe("Groups Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const courseModule = new CourseModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let usersResult: UserModule.SeedUsersResult;
	let coursesResult: CourseModule.SeedCoursesResult;
	let groupsResult: SeedGroupsResult;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		usersResult = (
			await userModule.seedUsers({
				data: UserModule.seedData.users,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		coursesResult = (
			await courseModule.seedCourses({
				data: enrollmentManagementTestCourseSeedData,
				usersByEmail: usersResult.getUsersByEmail(),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		groupsResult = await trySeedGroups({
			payload,
			data: predefinedGroupSeedData,
			coursesBySlug: coursesResult.coursesBySlug,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();
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

	test("seeds groups from predefined data successfully", () => {
		expect(groupsResult.groups.length).toBe(
			predefinedGroupSeedData.groups.length,
		);
		for (const group of groupsResult.groups) {
			expect(group.id).toBeDefined();
			expect(group.name).toBeDefined();
			expect(group.path).toBeDefined();
			expect(group.course).toBeDefined();
		}
	});

	test("returns correct structure with groups array", () => {
		expect(groupsResult.groups).toBeDefined();
		expect(Array.isArray(groupsResult.groups)).toBe(true);
	});

	test("returns groupsByPath map", () => {
		expect(groupsResult.groupsByPath).toBeDefined();
		expect(groupsResult.groupsByPath instanceof Map).toBe(true);
	});

	test("returns getGroupByPath helper function", () => {
		expect(groupsResult.getGroupByPath).toBeDefined();
		expect(typeof groupsResult.getGroupByPath).toBe("function");
	});

	test("getGroupByPath retrieves root group", () => {
		const group = groupsResult.getGroupByPath("Section A");
		expect(group).toBeDefined();
		expect(group?.name).toBe("Section A");
	});

	test("getGroupByPath retrieves nested group", () => {
		const group = groupsResult.getGroupByPath("Section A/Subsection A1");
		expect(group).toBeDefined();
		expect(group?.name).toBe("Subsection A1");
	});

	test("parent-child relationship is correct", () => {
		const parentGroup = groupsResult.getGroupByPath("Section A");
		const childGroup = groupsResult.getGroupByPath("Section A/Subsection A1");
		expect(parentGroup).toBeDefined();
		expect(childGroup).toBeDefined();
		expect(childGroup?.parent).toBe(parentGroup?.id);
	});

	test("course association is correct", () => {
		const cs101 = coursesResult.getCourseBySlug("cs-101-fa-2025");
		const sectionA = groupsResult.getGroupByPath("Section A");
		expect(sectionA).toBeDefined();
		expect(sectionA?.course).toBe(cs101?.id);
	});

	test("groups in different courses are independent", () => {
		const mathSection = groupsResult.getGroupByPath("Math Section");
		const math201 = coursesResult.getCourseBySlug("math-201-fa-2025");
		expect(mathSection).toBeDefined();
		expect(mathSection?.course).toBe(math201?.id);
	});

	test("groups are accessible via course relationship", async () => {
		const cs101 = coursesResult.getCourseBySlug("cs-101-fa-2025");
		const groups = await payload.find({
			collection: "groups",
			where: { course: { equals: cs101!.id } },
			overrideAccess: true,
		});
		expect(groups.docs.length).toBe(3);
	});
});

describe("Enrollments Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const courseModule = new CourseModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let usersResult: UserModule.SeedUsersResult;
	let coursesResult: CourseModule.SeedCoursesResult;
	let groupsResult: SeedGroupsResult;
	let enrollmentsResult: SeedEnrollmentsResult;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		usersResult = (
			await userModule.seedUsers({
				data: UserModule.seedData.users,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		coursesResult = (
			await courseModule.seedCourses({
				data: enrollmentManagementTestCourseSeedData,
				usersByEmail: usersResult.getUsersByEmail(),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		groupsResult = await trySeedGroups({
			payload,
			data: predefinedGroupSeedData,
			coursesBySlug: coursesResult.coursesBySlug,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		enrollmentsResult = await trySeedEnrollments({
			payload,
			data: predefinedEnrollmentSeedData,
			usersByEmail: usersResult.getUsersByEmail(),
			coursesBySlug: coursesResult.coursesBySlug,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();
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

	test("seeds enrollments from predefined data successfully", () => {
		expect(enrollmentsResult.enrollments.length).toBe(
			predefinedEnrollmentSeedData.enrollments.length,
		);
		for (const enrollment of enrollmentsResult.enrollments) {
			expect(enrollment.id).toBeDefined();
			expect(enrollment.user).toBeDefined();
			expect(enrollment.course).toBeDefined();
			expect(enrollment.role).toBeDefined();
			expect(enrollment.status).toBeDefined();
		}
	});

	test("returns correct structure with enrollments array", () => {
		expect(enrollmentsResult.enrollments).toBeDefined();
		expect(Array.isArray(enrollmentsResult.enrollments)).toBe(true);
	});

	test("returns enrollmentsByKey map", () => {
		expect(enrollmentsResult.enrollmentsByKey).toBeDefined();
		expect(enrollmentsResult.enrollmentsByKey instanceof Map).toBe(true);
	});

	test("returns getEnrollmentByKey helper function", () => {
		expect(enrollmentsResult.getEnrollmentByKey).toBeDefined();
		expect(typeof enrollmentsResult.getEnrollmentByKey).toBe("function");
	});

	test("getEnrollmentByKey retrieves enrollment", () => {
		const enrollment = enrollmentsResult.getEnrollmentByKey(
			devConstants.ADMIN_EMAIL,
			"cs-101-fa-2025",
		);
		expect(enrollment).toBeDefined();
		expect(enrollment?.role).toBe("teacher");
	});

	test("role is set correctly for different enrollments", () => {
		const teacherEnrollment = enrollmentsResult.getEnrollmentByKey(
			devConstants.ADMIN_EMAIL,
			"cs-101-fa-2025",
		);
		expect(teacherEnrollment?.role).toBe("teacher");

		const studentEnrollment = enrollmentsResult.getEnrollmentByKey(
			"user@example.com",
			"math-201-fa-2025",
		);
		expect(studentEnrollment?.role).toBe("student");
	});

	test("status defaults to active", () => {
		for (const enrollment of enrollmentsResult.enrollments) {
			expect(enrollment.status).toBe("active");
		}
	});

	test("enrollments with groups are linked correctly", () => {
		const adminCs101 = enrollmentsResult.getEnrollmentByKey(
			devConstants.ADMIN_EMAIL,
			"cs-101-fa-2025",
		);
		expect(adminCs101).toBeDefined();
		expect(adminCs101?.groups).toBeDefined();
		expect(Array.isArray(adminCs101?.groups)).toBe(true);
		expect(adminCs101?.groups.length).toBeGreaterThan(0);
	});

	test("enrollments without groups have empty groups array", () => {
		const adminDraft = enrollmentsResult.getEnrollmentByKey(
			devConstants.ADMIN_EMAIL,
			"draft-course-2025",
		);
		expect(adminDraft).toBeDefined();
		expect(adminDraft?.groups).toBeDefined();
		expect(adminDraft?.groups.length).toBe(0);
	});

	test("enrollments are accessible via user relationship", async () => {
		const adminEntry = usersResult.byEmail.get(devConstants.ADMIN_EMAIL)!;
		const enrollments = await payload.find({
			collection: "enrollments",
			where: { user: { equals: adminEntry.user.id } },
			overrideAccess: true,
		});
		expect(enrollments.docs.length).toBeGreaterThanOrEqual(2);
	});
});
