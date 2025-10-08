import type { CollectionConfig, TextFieldValidation } from "payload";
import { courseStructureSchema } from "server/utils/schema";
import z from "zod";

// Courses collection - core LMS content
export const Courses = {
	slug: "courses" as const,
	defaultSort: "-createdAt",
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
			name: "structure",
			type: "json",
			required: true,
			label: "Structure",

			validate: (value) => {
				const result = courseStructureSchema.safeParse(value);
				if (!result.success) {
					console.log("test", z.formatError(result.error)._errors.join(", "));
					return z.formatError(result.error)._errors.join(", ");
				}
				return true;
			},
			typescriptSchema: [
				// @ts-expect-error
				() => "$fix:CourseStructure",
			],
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
		},
		{
			name: "groups",
			type: "text",
			label: "Groups",
			virtual: `enrollments.groups`,
		},
	],
} as const satisfies CollectionConfig;
