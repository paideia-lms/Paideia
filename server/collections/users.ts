import type { AccessResult, CollectionConfig } from "payload";

// Enhanced Users collection with LMS fields
export const Users = {
	auth: {
		verify: true,
	},
	access: {
		read: ({ req }): AccessResult => {
			if (!req.user) return false;
			// admin can read all users
			if (req.user.role === "admin") return true;
			// everyone can read everyone else's profile
			return true;
		},
		create: ({ req }): AccessResult => {
			// require login to create users
			if (!req.user) return false;
			// admin can create users
			if (req.user.role === "admin") return true;
			// no one else can create users
			return false;
		},
		update: ({ req }): AccessResult => {
			// require login to update users
			if (!req.user) return false;
			// admin can update all users
			if (req.user.role === "admin") return true;
			// only users can update their own profile
			return {
				or: [{ id: { equals: req.user.id } }],
			};
		},
		delete: ({ req }): AccessResult => {
			// require login to delete users
			if (!req.user) return false;
			// admin can delete all users
			if (req.user.role === "admin") return true;
			// no one else can delete users
			return false;
		},
	},
	fields: [
		{
			saveToJWT: true,
			name: "firstName",
			type: "text",
		},
		{
			saveToJWT: true,
			name: "lastName",
			type: "text",
		},
		{
			saveToJWT: true,
			name: "role",
			type: "select",
			options: [
				// 1. **System Admin**: Full control over platform settings, user management, and global configurations (e.g., category nesting limits). *Pro*: Centralizes high-level management. *Con*: Risk of over-privileged accounts; limit to few users.
				// 2. **Content Manager**: Manages global content libraries, templates, and shared resources across categories. *Pro*: Supports consistency. *Con*: Needs clear boundaries to avoid course-level conflicts.
				// 3. **Analytics Viewer**: Access to platform-wide reports and usage data. *Pro*: Enables data-driven decisions. *Con*: Privacy concerns if not restricted properly.
				// 4. **Instructor**: Manages courses, content, and assessments within a category.
				// 5. **Student**: Learns from courses within a category.
				{ label: "Admin", value: "admin" },
				{ label: "Content Manager", value: "content-manager" },
				{ label: "Analytics Viewer", value: "analytics-viewer" },
				{ label: "Instructor", value: "instructor" },
				{ label: "Student", value: "student" },
			],
			defaultValue: "student",
		},
		{
			name: "bio",
			type: "textarea",
		},
		{
			saveToJWT: true,
			name: "avatar",
			type: "relationship",
			relationTo: "media",
			label: "Avatar",
		},
	],
	slug: "users" as const,
} as const satisfies CollectionConfig;
