import type { CollectionConfig } from "payload";

// Category Role Assignments - category-level management roles with cascading permissions
export const CategoryRoleAssignments = {
	slug: "category-role-assignments" as const,
	defaultSort: "-assignedAt",
	fields: [
		{
			name: "user",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "User",
		},
		{
			name: "category",
			type: "relationship",
			relationTo: "course-categories",
			required: true,
			label: "Category",
		},
		{
			name: "role",
			type: "select",
			options: [
				{
					label: "Category Admin",
					value: "category-admin",
				},
				{
					label: "Category Coordinator",
					value: "category-coordinator",
				},
				{
					label: "Category Reviewer",
					value: "category-reviewer",
				},
			],
			required: true,
			admin: {
				description:
					"Category Admin: Manages category settings, nested subcategories, and direct courses. " +
					"Category Coordinator: Assigns roles within category, monitors course counts. " +
					"Category Reviewer: Views analytics and content without edit rights.",
			},
		},
		{
			name: "assignedBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Assigned By",
		},
		{
			name: "assignedAt",
			type: "date",
			defaultValue: () => new Date().toISOString(),
			label: "Assigned At",
		},
		{
			name: "notes",
			type: "textarea",
			label: "Assignment Notes",
			admin: {
				description: "Optional notes about why this role was assigned",
			},
		},
	],
	indexes: [
		{
			fields: ["user", "category"],
			unique: true, // One role per user per category
		},
		{
			fields: ["category"], // Fast lookup of all users with roles on a category
		},
		{
			fields: ["user"], // Fast lookup of all categories where user has roles
		},
	],
} as const satisfies CollectionConfig;
