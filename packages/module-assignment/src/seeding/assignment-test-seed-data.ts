import type { UserModule } from "@paideia/module-user";
import type { CourseModule } from "@paideia/module-course";

type UserSeedData = Parameters<InstanceType<typeof UserModule>["seedUsers"]>[0]["data"];
type CourseSeedData = Parameters<InstanceType<typeof CourseModule>["seedCourses"]>[0]["data"];
type CourseSectionSeedData = Parameters<InstanceType<typeof CourseModule>["seedCourseSections"]>[0]["data"];

export const assignmentTestUserSeedData: UserSeedData = {
	users: [
		{
			email: "admin@example.com",
			password: "admin123",
			firstName: "Admin",
			lastName: "User",
			role: "admin",
			generateApiKey: false,
		},
		{
			email: "instructor@example.com",
			password: "instructor123",
			firstName: "Instructor",
			lastName: "User",
			role: "instructor",
			generateApiKey: false,
		},
		{
			email: "student1@example.com",
			password: "student123",
			firstName: "Student1",
			lastName: "User",
			role: "student",
			generateApiKey: false,
		},
		{
			email: "student2@example.com",
			password: "student123",
			firstName: "Student2",
			lastName: "User",
			role: "student",
			generateApiKey: false,
		},
	],
};

export const assignmentTestCourseSeedData: CourseSeedData = {
	courses: [
		{
			title: "Test Course",
			slug: "test-course",
			description: "A test course for assignment module tests",
			status: "published",
			createdByEmail: "instructor@example.com",
		},
	],
};

export const assignmentTestSectionSeedData: CourseSectionSeedData = {
	sections: [
		{
			courseSlug: "test-course",
			title: "Test Section 1",
			description: "First test section",
			contentOrder: 0,
		},
		{
			courseSlug: "test-course",
			title: "Test Section 2",
			description: "Second test section",
			contentOrder: 1,
		},
	],
};
