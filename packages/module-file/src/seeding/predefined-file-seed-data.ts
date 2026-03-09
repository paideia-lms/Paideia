import { devConstants } from "../utils/constants";
import type { FileSeedData } from "./file-seed-schema";

export const predefinedFileSeedData: FileSeedData = {
	files: [
		{
			title: "Course Syllabus",
			description: "The official course syllabus for this semester",
			userEmail: devConstants.ADMIN_EMAIL,
		},
		{
			title: "Lecture Notes Week 1",
			description: "Introduction and overview materials",
			userEmail: "user@example.com",
		},
		{
			title: "Lab Worksheet",
			description: "Worksheet for the first lab session",
			userEmail: "user@example.com",
		},
	],
};
