import type { CollectionConfig } from "payload";

// Assignments collection - assignment-specific configuration
export const Assignments = {
	slug: "assignments",
	defaultSort: "-createdAt",
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
			name: "allowLateSubmissions",
			type: "checkbox",
			label: "Allow Late Submissions",
			defaultValue: false,
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
			defaultValue: false,
		},
		{
			name: "requireFileSubmission",
			type: "checkbox",
			label: "Require File Submission",
			defaultValue: false,
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Created By",
		},
	],
	indexes: [
		{
			fields: ["createdBy"],
		},
		{
			fields: ["dueDate"],
		},
	],
} as const satisfies CollectionConfig;
