import type { UserModule } from "@paideia/module-user";
import type { CourseSeedData } from "./course-seed-schema";

type UserSeedData = UserModule.UserSeedData;

/**
 * Seed data for course-section-management.test.ts.
 * Provides one admin user and one test course for section management tests.
 */
export const courseSectionManagementTestUserSeedData: UserSeedData = {
	users: [
		{
			email: "testuser@example.com",
			password: "testpassword123",
			firstName: "Test",
			lastName: "User",
			role: "admin",
			generateApiKey: false,
			login: true,
		},
	],
};

export const courseSectionManagementTestCourseSeedData: CourseSeedData = {
	courses: [
		{
			title: "Test Course",
			slug: "test-course",
			description: "A test course for section management",
			status: "published",
			createdByEmail: "testuser@example.com",
		},
	],
};
