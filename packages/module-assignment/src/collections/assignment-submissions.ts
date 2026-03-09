import type { AccessResult, CollectionConfig } from "payload";

export const AssignmentSubmissions = {
	slug: "assignment-submissions",
	defaultSort: "-createdAt",
	access: {
		read: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin" || req.user.role === "instructor") return true;
			return {
				student: { equals: req.user.id },
			};
		},
		create: ({ req }): AccessResult => {
			if (!req.user) return false;
			return true;
		},
		update: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin" || req.user.role === "instructor") return true;
			return {
				student: { equals: req.user.id },
			};
		},
		delete: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;
			return false;
		},
	},
	fields: [
		{
			name: "assignment",
			type: "relationship",
			relationTo: "assignments",
			required: true,
			label: "Assignment",
		},
		{
			name: "student",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Student",
		},
		{
			name: "attemptNumber",
			type: "number",
			required: true,
			defaultValue: 1,
			min: 1,
			label: "Attempt Number",
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Submitted", value: "submitted" },
				{ label: "Graded", value: "graded" },
				{ label: "Returned", value: "returned" },
			],
			defaultValue: "draft",
			required: true,
			label: "Status",
		},
		{
			name: "submittedAt",
			type: "date",
			label: "Submitted At",
		},
		{
			name: "content",
			type: "textarea",
			label: "Submission Content",
		},
		{
			name: "attachments",
			type: "array",
			fields: [
				{
					name: "file",
					type: "relationship",
					relationTo: "media",
					required: true,
				},
				{
					name: "description",
					type: "text",
					label: "File Description",
				},
			],
			label: "Attachments",
		},
		{
			name: "grade",
			type: "number",
			label: "Grade",
			min: 0,
		},
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
			name: "isLate",
			type: "checkbox",
			defaultValue: false,
			label: "Late Submission",
		},
		{
			name: "timeSpent",
			type: "number",
			label: "Time Spent (minutes)",
			min: 0,
		},
	],
	indexes: [
		{ fields: ["assignment"] },
		{ fields: ["student"] },
		{ fields: ["assignment", "student", "attemptNumber"], unique: true },
		{ fields: ["status"] },
		{ fields: ["submittedAt"] },
	],
} as const satisfies CollectionConfig;
