import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "../../../payload.config";
import {
	trySeedCourses,
	type SeedCoursesResult,
} from "../seeding/courses-builder";
import {
	trySeedCourseSections,
	type SeedCourseSectionsResult,
} from "../seeding/course-sections-builder";
import {
	trySeedUsers,
	type SeedUsersResult,
} from "../../user/seeding/users-builder";
import { predefinedUserSeedData } from "../../user/seeding/predefined-user-seed-data";
import {
	courseManagementTestCourseSeedData,
	courseManagementTestSectionSeedData,
} from "../seeding/course-management-test-seed-data";
import { devConstants } from "../../../utils/constants";

describe("Courses Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	let usersResult: SeedUsersResult;
	let coursesResult: SeedCoursesResult;
	let sectionsResult: SeedCourseSectionsResult;

	beforeAll(async () => {
		while (!payload.db.drizzle) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		await payload.db.migrateFresh({
			forceAcceptWarning: true,
		});

		usersResult = await trySeedUsers({
			payload,
			data: predefinedUserSeedData,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		coursesResult = await trySeedCourses({
			payload,
			data: courseManagementTestCourseSeedData,
			usersByEmail: usersResult.getUsersByEmail(),
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		sectionsResult = await trySeedCourseSections({
			payload,
			data: courseManagementTestSectionSeedData,
			coursesBySlug: coursesResult.coursesBySlug,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();
	});

	afterAll(async () => {
		await payload.db.migrateFresh({
			forceAcceptWarning: true,
		});
	});

	describe("Courses seeding", () => {
		test("seeds courses from test data successfully", () => {
			expect(coursesResult.courses.length).toBe(
				courseManagementTestCourseSeedData.courses.length,
			);
			for (const course of coursesResult.courses) {
				expect(course.id).toBeDefined();
				expect(course.title).toBeDefined();
				expect(course.slug).toBeDefined();
				expect(course.description).toBeDefined();
				expect(course.status).toBeDefined();
				expect(course.createdBy).toBeDefined();
			}
		});

		test("returns correct structure with courses array", () => {
			expect(coursesResult.courses).toBeDefined();
			expect(Array.isArray(coursesResult.courses)).toBe(true);
		});

		test("returns coursesBySlug map", () => {
			expect(coursesResult.coursesBySlug).toBeDefined();
			expect(coursesResult.coursesBySlug instanceof Map).toBe(true);
		});

		test("returns getCourseBySlug helper function", () => {
			expect(coursesResult.getCourseBySlug).toBeDefined();
			expect(typeof coursesResult.getCourseBySlug).toBe("function");
		});

		test("getCourseBySlug retrieves course by slug", () => {
			const course = coursesResult.getCourseBySlug("cs-101-fa-2025");
			expect(course).toBeDefined();
			expect(course?.title).toBe("Introduction to Computer Science");
		});

		test("createdBy matches seeded user for admin course", () => {
			const adminCourse = coursesResult.courses.find(
				(c) => c.slug === "cs-101-fa-2025",
			);
			expect(adminCourse).toBeDefined();
			const adminEntry = usersResult.byEmail.get(devConstants.ADMIN_EMAIL)!;
			const createdBy =
				typeof adminCourse!.createdBy === "number"
					? adminCourse!.createdBy
					: adminCourse!.createdBy.id;
			expect(createdBy).toBe(adminEntry.user.id);
		});

		test("createdBy matches seeded user for content-manager course", () => {
			const cmCourse = coursesResult.courses.find(
				(c) => c.slug === "math-201-fa-2025",
			);
			expect(cmCourse).toBeDefined();
			const cmEntry = usersResult.byEmail.get("contentmanager@example.com")!;
			const createdBy =
				typeof cmCourse!.createdBy === "number"
					? cmCourse!.createdBy
					: cmCourse!.createdBy.id;
			expect(createdBy).toBe(cmEntry.user.id);
		});

		test("status is set correctly for published courses", () => {
			const publishedCourses = coursesResult.courses.filter(
				(c) => c.status === "published",
			);
			expect(publishedCourses.length).toBe(2);
		});

		test("status is set correctly for draft courses", () => {
			const draftCourses = coursesResult.courses.filter(
				(c) => c.status === "draft",
			);
			expect(draftCourses.length).toBe(1);
		});

		test("tags are set correctly", () => {
			const course = coursesResult.getCourseBySlug("cs-101-fa-2025");
			expect(course).toBeDefined();
			expect(course?.tags).toBeDefined();
			expect(course?.tags?.length).toBe(3);
			const tagValues = course?.tags?.map((t) => t.tag);
			expect(tagValues).toContain("computer science");
			expect(tagValues).toContain("programming");
			expect(tagValues).toContain("beginner");
		});
	});

	describe("Course Sections seeding", () => {
		test("seeds sections from test data successfully", () => {
			expect(sectionsResult.sections.length).toBe(
				courseManagementTestSectionSeedData.sections.length,
			);
			for (const section of sectionsResult.sections) {
				expect(section.id).toBeDefined();
				expect(section.title).toBeDefined();
				expect(section.course).toBeDefined();
				expect(section.contentOrder).toBeDefined();
			}
		});

		test("returns correct structure with sections array", () => {
			expect(sectionsResult.sections).toBeDefined();
			expect(Array.isArray(sectionsResult.sections)).toBe(true);
		});

		test("returns sectionsByTitle map", () => {
			expect(sectionsResult.sectionsByTitle).toBeDefined();
			expect(sectionsResult.sectionsByTitle instanceof Map).toBe(true);
		});

		test("returns getSectionByTitle helper function", () => {
			expect(sectionsResult.getSectionByTitle).toBeDefined();
			expect(typeof sectionsResult.getSectionByTitle).toBe("function");
		});

		test("getSectionByTitle retrieves section by title", () => {
			const section = sectionsResult.getSectionByTitle(
				"Week 1: Introduction",
			);
			expect(section).toBeDefined();
			expect(section?.title).toBe("Week 1: Introduction");
		});

		test("course association is correct", () => {
			const cs101Course = coursesResult.getCourseBySlug("cs-101-fa-2025");
			const week1Section = sectionsResult.getSectionByTitle(
				"Week 1: Introduction",
			);
			expect(week1Section).toBeDefined();
			expect(week1Section?.course).toBe(cs101Course?.id);
		});

		test("parentSection association is correct for nested sections", () => {
			const parentSection = sectionsResult.getSectionByTitle(
				"Week 2: Variables and Data Types",
			);
			const childSection = sectionsResult.getSectionByTitle(
				"Week 2.1: Practice Exercises",
			);
			expect(parentSection).toBeDefined();
			expect(childSection).toBeDefined();
			expect(childSection?.parentSection).toBe(parentSection?.id);
		});

		test("contentOrder is set correctly", () => {
			const week1 = sectionsResult.getSectionByTitle("Week 1: Introduction");
			const week2 = sectionsResult.getSectionByTitle(
				"Week 2: Variables and Data Types",
			);
			expect(week1?.contentOrder).toBeDefined();
			expect(week2?.contentOrder).toBeDefined();
			expect(week1!.contentOrder).toBeLessThan(week2!.contentOrder);
		});

		test("description is set when provided", () => {
			const section = sectionsResult.getSectionByTitle(
				"Week 1: Introduction",
			);
			expect(section).toBeDefined();
			expect(section?.description).toBe(
				"Introduction to the course and basic concepts",
			);
		});
	});
});
