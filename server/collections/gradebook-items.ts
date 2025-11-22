import type { CollectionConfig } from "payload";

// Gradebook Items collection - individual gradeable items
export const GradebookItems = {
	slug: "gradebook-items",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "gradebook",
			type: "relationship",
			relationTo: "gradebooks",
			required: true,
			label: "Gradebook",
		},
		{
			name: "category",
			type: "relationship",
			relationTo: "gradebook-categories",
			label: "Category",
		},
		{
			// ! this is the manual item name
			// ! this should be overridden by the activity module name
			name: "name",
			type: "text",
			required: true,
			label: "Item Name",
		},
		{
			name: "sortOrder",
			type: "number",
			required: true,
			label: "Sort Order",
		},
		{
			name: "description",
			type: "textarea",
			label: "Description",
		},
		{
			// ! if this is null, then the item is not a course activity module, it is a manual item
			name: "activityModule",
			type: "relationship",
			relationTo: "course-activity-module-links",
			label: "Active Module",
		},
		{
			name: "activityModuleName",
			type: "text",
			virtual: `activityModule.activityModule.title`,
			label: "Activity Module Name",
		},
		{
			name: "activityModuleType",
			type: "text",
			virtual: `activityModule.activityModule.type`,
			label: "Activity Module Type",
		},
		{
			name: "maxGrade",
			type: "number",
			required: true,
			defaultValue: 100,
			label: "Maximum Grade",
			min: 0,
		},
		{
			name: "minGrade",
			type: "number",
			required: true,
			defaultValue: 0,
			label: "Minimum Grade",
			min: 0,
		},
		{
			// weight can null
			name: "weight",
			type: "number",
			label: "Weight (%)",
			min: 0,
			max: 100,
		},
		{
			name: "extraCredit",
			type: "checkbox",
			defaultValue: false,
			label: "Extra Credit",
		},
		{
			name: "userGrades",
			type: "join",
			on: "gradebookItem",
			collection: "user-grades",
			label: "User Grades",
			hasMany: true,
		},
	],
	indexes: [
		{
			fields: ["gradebook"],
		},
		{
			fields: ["category"],
		},
	],
} as const satisfies CollectionConfig;
