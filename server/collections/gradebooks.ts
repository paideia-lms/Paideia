import type { CollectionConfig } from "payload";

// Gradebooks collection - manages gradebooks for courses
export const Gradebooks = {
	slug: "gradebooks",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			required: true,
			label: "Course",
			hasMany: false,
		},
		{
			name: "courseTitle",
			type: "text",
			virtual: `course.title`,
			label: "Course Title",
		},
		{
			/**
			 * ! we allow a gradebook to be disabled
			 */
			name: "enabled",
			type: "checkbox",
			label: "Enabled",
			defaultValue: true,
		},
		{
			name: "categories",
			type: "join",
			on: "gradebook",
			collection: "gradebook-categories",
			label: "Categories",
			hasMany: true,
		},
		{
			name: "items",
			type: "join",
			on: "gradebook",
			collection: "gradebook-items",
			label: "Grade Items",
			hasMany: true,
		},
	],
	indexes: [
		{
			// One gradebook per course
			fields: ["course"],
			unique: true,
		},
	],
} as const satisfies CollectionConfig;
