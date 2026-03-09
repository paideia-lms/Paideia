import type { CollectionConfig } from "payload";

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
			virtual: "course.title",
			label: "Course Title",
		},
		{
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
			fields: ["course"],
			unique: true,
		},
	],
} as const satisfies CollectionConfig;
