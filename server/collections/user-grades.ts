import type { CollectionConfig } from "payload";

// User Grades collection - individual grades for users with layered grade system
export const UserGrades = {
	slug: "user-grades",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "enrollment",
			type: "relationship",
			relationTo: "enrollments",
			required: true,
			label: "Enrollment",
		},
		{
			name: "user",
			type: "text",
			virtual: `enrollment.user`,
			label: "User",
		},
		{
			name: "userEmail",
			type: "text",
			virtual: `enrollment.user.email`,
			label: "User Email",
		},
		{
			name: "course",
			type: "text",
			virtual: `enrollment.course`,
			label: "Course",
		},
		{
			name: "courseTitle",
			type: "text",
			virtual: `enrollment.course.title`,
			label: "Course Title",
		},
		{
			name: "gradebookItem",
			type: "relationship",
			relationTo: "gradebook-items",
			required: true,
			label: "Gradebook Item",
		},
		{
			name: "maxGrade",
			type: "number",
			virtual: `gradebookItem.maxGrade`,
			label: "Maximum Grade",
		},
		// Submission reference (optional - for activity-based grades)
		{
			name: "submission",
			type: "relationship",
			relationTo: [
				"assignment-submissions",
				"quiz-submissions",
				"discussion-submissions",
			],
			label: "Submission",
		},
		{
			name: "submissionType",
			type: "select",
			options: [
				{ label: "Assignment", value: "assignment" },
				{ label: "Quiz", value: "quiz" },
				{ label: "Discussion", value: "discussion" },
				{ label: "Manual", value: "manual" },
			],
			defaultValue: "manual",
			label: "Grade Source",
		},
		// Base grade layer
		{
			name: "baseGrade",
			type: "number",
			label: "Base Grade",
			min: 0,
		},
		{
			name: "baseGradeSource",
			type: "select",
			options: [
				{ label: "From Submission", value: "submission" },
				{ label: "Manual Entry", value: "manual" },
			],
			defaultValue: "manual",
			label: "Base Grade Source",
		},
		// Adjustments layer
		{
			name: "adjustments",
			type: "array",
			fields: [
				{
					name: "type",
					type: "select",
					options: [
						{ label: "Bonus Points", value: "bonus" },
						{ label: "Penalty", value: "penalty" },
						{ label: "Late Deduction", value: "late_deduction" },
						{ label: "Participation", value: "participation" },
						{ label: "Curve", value: "curve" },
						{ label: "Other", value: "other" },
					],
					required: true,
					label: "Adjustment Type",
				},
				{
					name: "points",
					type: "number",
					required: true,
					label: "Points",
				},
				{
					name: "reason",
					type: "text",
					required: true,
					label: "Reason",
				},
				{
					name: "appliedBy",
					type: "relationship",
					relationTo: "users",
					required: true,
					label: "Applied By",
				},
				{
					name: "appliedAt",
					type: "date",
					required: true,
					label: "Applied At",
				},
				{
					name: "isActive",
					type: "checkbox",
					defaultValue: true,
					label: "Active",
				},
			],
			label: "Grade Adjustments",
		},
		// Override layer
		{
			name: "isOverridden",
			type: "checkbox",
			defaultValue: false,
			label: "Grade Overridden",
		},
		{
			name: "overrideGrade",
			type: "number",
			label: "Override Grade",
			min: 0,
		},
		{
			name: "overrideReason",
			type: "text",
			label: "Override Reason",
		},
		{
			name: "overriddenBy",
			type: "relationship",
			relationTo: "users",
			label: "Overridden By",
		},
		{
			name: "overriddenAt",
			type: "date",
			label: "Overridden At",
		},
		// Feedback
		{
			name: "feedback",
			type: "textarea",
			label: "Feedback",
		},
		{
			name: "gradedBy",
			type: "relationship",
			relationTo: "users",
			label: "Graded By",
		},
		{
			name: "gradedAt",
			type: "date",
			label: "Graded At",
		},
		{
			name: "submittedAt",
			type: "date",
			label: "Submitted At",
		},
		// Status
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Graded", value: "graded" },
				{ label: "Returned", value: "returned" },
			],
			defaultValue: "draft",
			label: "Status",
		},
	],
	indexes: [
		{
			// One grade per enrollment per item
			fields: ["enrollment", "gradebookItem"],
			unique: true,
		},
		{
			fields: ["gradebookItem"],
		},
		{
			fields: ["enrollment"],
		},
	],
} as const satisfies CollectionConfig;
