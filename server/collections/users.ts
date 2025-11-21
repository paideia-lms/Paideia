import type { AccessResult, CollectionConfig } from "payload";
import { envVars } from "server/env";

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
			// if sandbox mode is enabled, admin can update all users
			if (envVars.SANDBOX_MODE.enabled) {
				// user can update their own profile however they want
				return {
					or: [{ id: { equals: req.user.id } }],
				};
			}
			// admin can update all users except other admins
			if (req.user.role === "admin") {
				return {
					or: [
						{ id: { equals: req.user.id } },
						{ role: { not_equals: "admin" } },
					],
				};
			}
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
		// Default auth fields including email, username, and password can be overridden by defining a custom field with the same name in your collection config.
		// see https://payloadcms.com/docs/authentication/overview#access-control
		{
			name: "email", // or 'username'
			type: "text",
			access: {
				// ! we does not allow users to update their email
				update: () => false,
			},
		},
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
			access: {
				update: ({ req, doc }): boolean => {
					// require login to update role
					if (!req.user) return false;

					// doc is the document being updated (target user)
					if (!doc || typeof doc !== "object") return false;

					const targetUserId =
						"id" in doc && typeof doc.id === "number" ? doc.id : null;
					if (!targetUserId) return false;

					const targetUserRole =
						"role" in doc && typeof doc.role === "string" ? doc.role : null;
					const isFirstUser = targetUserId === 1;

					// Prevent first user from changing their admin role
					if (isFirstUser && req.data?.role && req.data.role !== "admin") {
						return false;
					}

					// Prevent admins from changing other admin users' roles
					if (
						req.user.role === "admin" &&
						targetUserId !== req.user.id &&
						targetUserRole === "admin"
					) {
						return false;
					}

					// Allow users to update their own role (except first user is handled above)
					if (targetUserId === req.user.id) {
						return true;
					}

					// Allow admins to update other users' roles (except other admins, handled above)
					if (req.user.role === "admin") {
						return true;
					}

					// Default deny
					return false;
				},
			},
		},
		{
			name: "bio",
			type: "textarea",
		},
		{
			name: "theme",
			type: "select",
			options: [
				{ label: "Light", value: "light" },
				{ label: "Dark", value: "dark" },
			],
			defaultValue: "light",
			required: true,
			saveToJWT: true,
		},
		{
			name: "direction",
			type: "select",
			options: [
				{ label: "Left to Right", value: "ltr" },
				{ label: "Right to Left", value: "rtl" },
			],
			defaultValue: "ltr",
			required: true,
			saveToJWT: true,
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
