import { devConstants } from "../../../utils/constants";
import type { CourseSeedData } from "./course-seed-schema";
import type { CourseSectionSeedData } from "./course-section-seed-schema";

export const courseManagementTestCourseSeedData: CourseSeedData = {
	courses: [
		{
			title: "Introduction to Computer Science",
			slug: "cs-101-fa-2025",
			description: "An introductory course covering fundamental concepts of computer science and programming.",
			status: "published",
			createdByEmail: devConstants.ADMIN_EMAIL,
			tags: ["computer science", "programming", "beginner"],
		},
		{
			title: "Advanced Mathematics",
			slug: "math-201-fa-2025",
			description: "Advanced topics in calculus and linear algebra.",
			status: "published",
			createdByEmail: "contentmanager@example.com",
			tags: ["mathematics", "calculus", "advanced"],
		},
		{
			title: "Draft Course",
			slug: "draft-course-2025",
			description: "A course that is still being developed.",
			status: "draft",
			createdByEmail: "instructor@example.com",
		},
	],
};

export const courseManagementTestSectionSeedData: CourseSectionSeedData = {
	sections: [
		{
			courseSlug: "cs-101-fa-2025",
			title: "Week 1: Introduction",
			description: "Introduction to the course and basic concepts",
			contentOrder: 0,
		},
		{
			courseSlug: "cs-101-fa-2025",
			title: "Week 2: Variables and Data Types",
			description: "Understanding variables and different data types",
			contentOrder: 1,
		},
		{
			courseSlug: "cs-101-fa-2025",
			title: "Week 2.1: Practice Exercises",
			description: "Hands-on exercises for Week 2",
			parentSectionTitle: "Week 2: Variables and Data Types",
			contentOrder: 0,
		},
		{
			courseSlug: "math-201-fa-2025",
			title: "Module 1: Limits and Continuity",
			description: "Foundational concepts of calculus",
			contentOrder: 0,
		},
		{
			courseSlug: "math-201-fa-2025",
			title: "Module 2: Derivatives",
			description: "Introduction to derivatives",
			contentOrder: 1,
		},
	],
};
