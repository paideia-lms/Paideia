import type { AccessResult, CollectionConfig } from "payload";

export const Assignments = {
	slug: "assignments",
	defaultSort: "-createdAt",
	access: {
		read: ({ req }): AccessResult => {
			if (!req.user) return false;
			return true;
		},
		create: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (
				req.user.role === "admin" ||
				req.user.role === "instructor" ||
				req.user.role === "content-manager"
			) {
				return true;
			}
			return false;
		},
		update: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;
			return {
				createdBy: { equals: req.user.id },
			};
		},
		delete: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;
			return {
				createdBy: { equals: req.user.id },
			};
		},
	},
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
			label: "Assignment Title",
		},
		{
			name: "description",
			type: "textarea",
			label: "Assignment Description",
		},
		{
			name: "instructions",
			type: "textarea",
			label: "Instructions for Students",
		},
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			required: true,
			label: "Course",
		},
		{
			name: "section",
			type: "relationship",
			relationTo: "course-sections",
			required: true,
			label: "Course Section",
		},
		{
			name: "dueDate",
			type: "date",
			label: "Due Date",
		},
		{
			name: "maxAttempts",
			type: "number",
			label: "Maximum Attempts",
			defaultValue: 1,
			min: 1,
		},
		{
			name: "allowedFileTypes",
			type: "array",
			fields: [
				{
					name: "extension",
					type: "text",
					required: true,
					label: "File Extension",
				},
				{
					name: "mimeType",
					type: "text",
					required: true,
					label: "MIME Type",
				},
			],
			label: "Allowed File Types",
		},
		{
			name: "maxFileSize",
			type: "number",
			label: "Maximum File Size (MB)",
			defaultValue: 10,
			min: 0,
		},
		{
			name: "maxFiles",
			type: "number",
			label: "Maximum Number of Files",
			defaultValue: 1,
			min: 1,
		},
		{
			name: "requireTextSubmission",
			type: "checkbox",
			label: "Require Text Submission",
			defaultValue: true,
		},
		{
			name: "requireFileSubmission",
			type: "checkbox",
			label: "Require File Submission",
			defaultValue: false,
		},
		{
			name: "maxGrade",
			type: "number",
			label: "Maximum Grade",
			defaultValue: 100,
			min: 0,
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Created By",
		},
		{
			name: "submissions",
			type: "join",
			on: "assignment",
			collection: "assignment-submissions",
			label: "Submissions",
			hasMany: true,
		},
	],
	indexes: [
		{ fields: ["createdBy"] },
		{ fields: ["course"] },
		{ fields: ["section"] },
	],
} as const satisfies CollectionConfig;
