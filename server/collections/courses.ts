import type { CollectionConfig, TextFieldValidation } from "payload";

// Courses collection - core LMS content
export const Courses = {
	slug: "courses" as const,
	defaultSort: "-createdAt",
	access: {
		create: ({ req }) => {
			// must be logged in to create a course
			if (!req.user) return false;
			// only admin and content manager can create a course
			return req.user.role === "admin" || req.user.role === "content-manager";
		},
		read: ({ req }) => {
			// any one can read any course
			return true;
		},
		update: ({ req }) => {
			// must be logged in to update a course
			if (!req.user) return false;
			// only admin can update a course
			return req.user.role === "admin";
		},
		delete: ({ req }) => {
			if (!req.user) return false;
			// only admin can delete a course
			return req.user.role === "admin";
		},
	},
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		{
			// ! e.g. 'math-101-a-fa-2025'
			name: "slug",
			type: "text",
			required: true,
			unique: true,
			label: "Slug",
			validate: ((value) => {
				// only allow lowercase letters, numbers, and hyphens
				if (value && !/^[a-z0-9-]+$/.test(value)) {
					return "Slug must contain only lowercase letters, numbers, and hyphens";
				}
				return true as const;
			}) as TextFieldValidation,
		},
		{
			name: "description",
			type: "textarea",
			required: true,
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Published", value: "published" },
				{ label: "Archived", value: "archived" },
			],
			defaultValue: "draft",
			required: true,
		},
		{
			name: "thumbnail",
			type: "relationship",
			relationTo: "media",
			label: "Thumbnail",
		},
		{
			name: "tags",
			type: "array",
			fields: [
				{
					name: "tag",
					type: "text",
				},
			],
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
		{
			name: "gradeTable",
			type: "join",
			on: "course",
			collection: "course-grade-tables",
			label: "Course Grade Table",
		},
		{
			name: "enrollments",
			type: "join",
			on: "course",
			collection: "enrollments",
			label: "Enrollments",
			maxDepth: 2,
		},
		{
			name: "groups",
			type: "join",
			on: "course",
			collection: "groups",
			label: "Groups",
			maxDepth: 2,
		},
		{
			name: "category",
			type: "relationship",
			relationTo: "course-categories",
			label: "Category",
		},
		{
			name: "sections",
			type: "join",
			on: "course",
			collection: "course-sections",
			label: "Sections",
			maxDepth: 2,
		},
	],
} as const satisfies CollectionConfig;
