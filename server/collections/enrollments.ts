import type { CollectionConfig } from "payload";
import { UnauthorizedError } from "~/utils/error";

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
			type: "array",
			fields: [
				{
					name: "groupPath",
					type: "text",
					required: true,
					label: "Group Path",
					// e.g., "art", "art/group-1", "econ/group-1/subgroup-1"
				},
			],
			label: "Groups",
		},
	],
	hooks: {
		beforeOperation: [
			({ collection, operation, req }) => {
				// Skip authentication in test environment
				if (process.env.NODE_ENV === "test") return;

				const user = req.user;
				console.log("beforeOperation", collection, operation, user);
				if (!user) throw new UnauthorizedError("Unauthorized");
			},
		],
	},
	// Ensure unique user-course combinations
	indexes: [
		{
			fields: ["user", "course"],
			unique: true,
		},
	],
} as const satisfies CollectionConfig;
