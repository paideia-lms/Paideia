import type { CollectionConfig } from "payload";

// Enrollments collection - links users to courses with specific roles
export const Enrollments = {
	slug: "enrollments",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "user",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
		{
			name: "userEmail",
			type: "text",
			virtual: `user.email`,
		},
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			required: true,
		},
		{
			name: "courseSlug",
			type: "text",
			virtual: `course.slug`,
		},
		{
			name: "courseTitle",
			type: "text",
			virtual: `course.title`,
		},
		{
			// ! we don't allow multiple roles in a course
			name: "role",
			type: "select",
			options: [
				{ label: "Student", value: "student" },
				{ label: "Teacher", value: "teacher" },
				{ label: "Teaching Assistant", value: "ta" },
				{ label: "Manager", value: "manager" },
			],
			required: true,
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Active", value: "active" },
				{ label: "Inactive", value: "inactive" },
				{ label: "Completed", value: "completed" },
				{ label: "Dropped", value: "dropped" },
			],
			defaultValue: "active",
			required: true,
		},
		{
			name: "enrolledAt",
			type: "date",
		},
		{
			name: "completedAt",
			type: "date",
		},
		{
			name: "groups",
			type: "relationship",
			relationTo: "groups",
			hasMany: true,
			label: "Groups",
		},
	],
	hooks: {},
	// Ensure unique user-course combinations
	indexes: [
		{
			fields: ["user", "course"],
			unique: true,
		},
	],
} as const satisfies CollectionConfig;
