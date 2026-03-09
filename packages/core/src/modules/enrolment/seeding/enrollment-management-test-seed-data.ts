import { devConstants } from "../../../utils/constants";
import type { EnrollmentSeedData } from "./enrollment-seed-schema";

export const enrollmentManagementTestEnrollmentSeedData: EnrollmentSeedData = {
	enrollments: [
		{
			userEmail: devConstants.ADMIN_EMAIL,
			courseSlug: "cs-101-fa-2025",
			role: "teacher",
			status: "active",
			groupPaths: ["Section A"],
		},
		{
			userEmail: "testuser1@example.com",
			courseSlug: "cs-101-fa-2025",
			role: "student",
			status: "active",
			groupPaths: ["Section A"],
		},
		{
			userEmail: "testuser2@example.com",
			courseSlug: "cs-101-fa-2025",
			role: "ta",
			status: "active",
			groupPaths: ["Section B"],
		},
		{
			userEmail: "contentmanager@example.com",
			courseSlug: "math-201-fa-2025",
			role: "teacher",
			status: "active",
			groupPaths: ["Math Section"],
		},
		{
			userEmail: "testuser1@example.com",
			courseSlug: "math-201-fa-2025",
			role: "student",
			status: "active",
		},
		{
			userEmail: devConstants.ADMIN_EMAIL,
			courseSlug: "draft-course-2025",
			role: "teacher",
			status: "active",
		},
	],
};
