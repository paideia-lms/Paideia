import type { CollectionConfig } from "payload";

// Gradebook Categories collection - hierarchical categories within gradebooks
export const GradebookCategories = {
	slug: "gradebook-categories",
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
			name: "parent",
			type: "relationship",
			relationTo: "gradebook-categories",
			label: "Parent Category",
		},
		{
			name: "name",
			type: "text",
			required: true,
			label: "Category Name",
		},
		{
			name: "description",
			type: "textarea",
			label: "Description",
		},
		{
			name: "weight",
			type: "number",
			label: "Weight (%)",
			min: 0,
			max: 100,
		},
		// sort_order BIGINT(19) NOT NULL DEFAULT 0, -- Order within parent context
		{
			name: "sortOrder",
			type: "number",
			label: "Sort Order",
			required: true,
		},
		{
			name: "subcategories",
			type: "join",
			on: "parent",
			collection: "gradebook-categories",
			label: "Subcategories",
			hasMany: true,
		},
		{
			name: "items",
			type: "join",
			on: "category",
			collection: "gradebook-items",
			label: "Grade Items",
			hasMany: true,
		},
	],
	indexes: [
		{
			fields: ["gradebook"],
		},
		{
			fields: ["parent"],
		},
	],
} as const satisfies CollectionConfig;
