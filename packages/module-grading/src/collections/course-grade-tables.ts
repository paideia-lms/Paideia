import type { CollectionConfig } from "payload";

export const CourseGradeTables = {
	slug: "course-grade-tables",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			required: true,
			label: "Course",
		},
		{
			name: "courseTitle",
			type: "text",
			virtual: "course.title",
			label: "Course Title",
		},
		{
			name: "gradeLetters",
			type: "array",
			fields: [
				{
					name: "letter",
					type: "text",
					required: true,
					label: "Grade Letter",
				},
				{
					name: "minimumPercentage",
					type: "number",
					required: true,
					min: 0,
					max: 100,
					label: "Minimum Percentage",
				},
			],
			label: "Grade Letters",
		},
		{
			name: "isActive",
			type: "checkbox",
			defaultValue: true,
			label: "Active",
		},
	],
	indexes: [
		{
			fields: ["course"],
			unique: true,
		},
	],
} as const satisfies CollectionConfig;
