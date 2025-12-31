import type { AccessResult, CollectionConfig } from "payload";

const slug = "activity-modules" as const;

// Activity Modules collection - generic container for all learning activities
export const ActivityModules = {
	slug,
	defaultSort: "-createdAt",
	access: {
		read: ({ req }): AccessResult => {
			if (!req.user) return false;
			return true;
		},
		create: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (
				req.user.role === "admin" ||
				req.user.role === "instructor" ||
				req.user.role === "content-manager"
			) {
				return true;
			}
			return false;
		},
		update: ({ req }): AccessResult => {
			// must be logged in to update activity modules
			if (!req.user) {
				// req.payload.logger.error(
				// 	`Failed to update activity module: unauthenticated user is not allowed to update activity modules`,
				// );
				return false;
			}

			// admin can update any activity module
			if (req.user.role === "admin") {
				return true;
			}

			// owners and users with grants can update
			const user = req.user;
			const where: AccessResult = {
				or: [
					{ owner: { equals: user.id } },
					{ "grants.grantedTo": { equals: user.id } },
				],
			};
			return where;
		},
		delete: ({ req }): AccessResult => {
			// must be logged in to delete activity modules
			if (!req.user) {
				// req.payload.logger.error(
				// 	`Failed to delete activity module: unauthenticated user is not allowed to delete activity modules`,
				// );
				return false;
			}

			// admin can delete any activity module
			if (req.user.role === "admin") {
				return true;
			}

			// only owners can delete
			const user = req.user;
			return {
				owner: { equals: user.id },
			};
		},
	},
	fields: [
		{
			name: "owner",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Owner",
			admin: {
				description:
					"The owner has full control including deletion. Cannot be changed directly - use ownership transfer function.",
			},
			access: {
				update: () => false,
			},
		},
		{
			name: "title",
			type: "text",
			required: true,
		},
		{
			/**
			 * in page and whiteboard, this is basically the content
			 */
			name: "description",
			type: "textarea",
		},
		{
			name: "type",
			type: "select",
			options: [
				// read only
				{ label: "Page", value: "page" },
				{ label: "Whiteboard", value: "whiteboard" },
				// file allows instructor to upload multiple files for students to access
				{ label: "File", value: "file" },
				// these are the activity with participation
				// assignments allow user to submit and upload their work
				{ label: "Assignment", value: "assignment" },
				// quiz allow user to answer questions and auto grade
				{ label: "Quiz", value: "quiz" },
				// discussion allow students to engage in a topic and interact with each other
				{ label: "Discussion", value: "discussion" },
			],
			required: true,
		},
		// {
		// 	name: "status",
		// 	type: "select",
		// 	options: [
		// 		{ label: "Draft", value: "draft" },
		// 		{ label: "Published", value: "published" },
		// 		{ label: "Archived", value: "archived" },
		// 	],
		// 	defaultValue: "draft",
		// 	required: true,
		// },
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
		// Polymorphic relationship to specific activity collections
		{
			name: "page",
			type: "relationship",
			relationTo: "pages",
			label: "Page Configuration",
		},
		{
			name: "whiteboard",
			type: "relationship",
			relationTo: "whiteboards",
			label: "Whiteboard Configuration",
		},
		{
			name: "assignment",
			type: "relationship",
			relationTo: "assignments",
			label: "Assignment Configuration",
		},
		{
			name: "quiz",
			type: "relationship",
			relationTo: "quizzes",
			label: "Quiz Configuration",
		},
		{
			name: "discussion",
			type: "relationship",
			relationTo: "discussions",
			label: "Discussion Configuration",
		},
		{
			name: "file",
			type: "relationship",
			relationTo: "files",
			label: "File Configuration",
		},
		// NOTE: Join fields for submissions have been removed because submissions
		// now link to course-activity-module-links instead of activity-modules.
		// To access submissions, traverse through course-activity-module-links.
		{
			name: "grants",
			type: "join",
			on: "activityModule",
			collection: "activity-module-grants",
			label: "Access Grants",
			hasMany: true,
		},
		{
			name: "linkedCourses",
			type: "join",
			on: "activityModule",
			collection: "course-activity-module-links",
			label: "Linked Courses",
			hasMany: true,
		},
	],
	indexes: [
		{
			fields: ["owner"],
		},
		{
			fields: ["createdBy"],
		},
		{
			fields: ["type"],
		},
		// {
		// 	fields: ["status"],
		// },
		{
			fields: ["page"],
		},
		{
			fields: ["whiteboard"],
		},
		{
			fields: ["quiz"],
		},
		{
			fields: ["discussion"],
		},
		{
			fields: ["file"],
		},
	],
} as const satisfies CollectionConfig;
