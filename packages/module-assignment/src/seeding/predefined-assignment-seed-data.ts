import type { AssignmentSeedData } from "./assignment-seed-schema";

export const predefinedAssignmentSeedData: AssignmentSeedData = {
	assignments: [
		{
			title: "Introduction Essay",
			description: "Write a short essay about yourself.",
			instructions: "Submit a 500-word essay introducing yourself to the class.",
			courseSlug: "intro-to-cs",
			sectionTitle: "Week 1",
			maxAttempts: 1,
			maxGrade: 100,
			requireTextSubmission: true,
			requireFileSubmission: false,
			createdByEmail: "admin@example.com",
		},
		{
			title: "Programming Exercise 1",
			description: "Basic programming exercise.",
			instructions: "Complete the coding challenge and submit your source file.",
			courseSlug: "intro-to-cs",
			sectionTitle: "Week 2",
			maxAttempts: 3,
			maxGrade: 100,
			requireTextSubmission: false,
			requireFileSubmission: true,
			createdByEmail: "admin@example.com",
		},
	],
};
