import { devConstants } from "../utils/constants";

export const enrollmentManagementTestCourseSeedData = {
	courses: [
		{
			title: "Introduction to Computer Science",
			slug: "cs-101-fa-2025",
			description: "An introductory course covering fundamental concepts of computer science and programming.",
			status: "published" as const,
			createdByEmail: devConstants.ADMIN_EMAIL,
			tags: ["computer science", "programming", "beginner"],
		},
		{
			title: "Advanced Mathematics",
			slug: "math-201-fa-2025",
			description: "Advanced topics in calculus and linear algebra.",
			status: "published" as const,
			createdByEmail: "contentmanager@example.com",
			tags: ["mathematics", "calculus", "advanced"],
		},
		{
			title: "Draft Course",
			slug: "draft-course-2025",
			description: "A course that is still being developed.",
			status: "draft" as const,
			createdByEmail: "instructor@example.com",
		},
	],
};
