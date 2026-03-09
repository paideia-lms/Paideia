import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload, type Migration } from "payload";
import sanitizedConfig from "payload.config";
import { UserModule } from "@paideia/module-user";
import { CourseModule } from "@paideia/module-course";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import { trySeedAssignments } from "../seeding/assignments-builder";
import {
	assignmentTestUserSeedData,
	assignmentTestCourseSeedData,
	assignmentTestSectionSeedData,
} from "../seeding/assignment-test-seed-data";
import { predefinedAssignmentSeedData } from "../seeding/predefined-assignment-seed-data";
import { migrations } from "src/migrations";
import type { User, Course, CourseSection } from "../payload-types";

describe("Assignments Builder", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const courseModule = new CourseModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);

	let usersByEmail: Map<string, User>;
	let coursesBySlug: Map<string, Course>;
	let sectionsByTitle: Map<string, CourseSection>;

	beforeAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		const usersResult = (
			await userModule.seedUsers({
				data: assignmentTestUserSeedData,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		usersByEmail = usersResult.getUsersByEmail();

		const coursesResult = (
			await courseModule.seedCourses({
				data: {
					courses: [
						...assignmentTestCourseSeedData.courses,
						{
							title: "Intro to CS",
							slug: "intro-to-cs",
							description: "Introduction to Computer Science",
							status: "published" as const,
							createdByEmail: "admin@example.com",
						},
					],
				},
				usersByEmail,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		coursesBySlug = new Map(coursesResult.courses.map(c => [c.slug, c]));

		const sectionsResult = (
			await courseModule.seedCourseSections({
				data: {
					sections: [
						...assignmentTestSectionSeedData.sections,
						{
							courseSlug: "intro-to-cs",
							title: "Week 1",
							description: "Week 1 content",
							contentOrder: 0,
						},
						{
							courseSlug: "intro-to-cs",
							title: "Week 2",
							description: "Week 2 content",
							contentOrder: 1,
						},
					],
				},
				coursesBySlug,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		sectionsByTitle = new Map(sectionsResult.sections.map(s => [s.title, s]));
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

	test("should seed assignments from predefined data", async () => {
		const result = await trySeedAssignments({
			payload,
			data: predefinedAssignmentSeedData,
			usersByEmail,
			coursesBySlug,
			sectionsByTitle,
			overrideAccess: true,
			req: undefined,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.assignments).toHaveLength(2);
			expect(result.value.assignments[0]!.title).toBe("Introduction Essay");
			expect(result.value.assignments[1]!.title).toBe("Programming Exercise 1");
		}
	});
});
