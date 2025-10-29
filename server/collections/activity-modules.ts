import type { AccessResult, CollectionConfig } from "payload";

// Activity Modules collection - generic container for all learning activities
export const ActivityModules = {
	slug: "activity-modules",
	defaultSort: "-createdAt",
	access: {
		read: (): AccessResult => {
			return true;
		},
		create: ({ req }): AccessResult => {
			// require login to create activity modules
			if (!req.user) return false;
			// only admin, instructor, and content manager can create activity modules
			if (
				req.user.role === "admin" ||
				req.user.role === "instructor" ||
				req.user.role === "content-manager"
			)
				return true;
			// no one else can create activity modules
			return false;
		},
		update: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			return {
				or: [
					{ owner: { equals: req.user.id } },
					{ "grants.grantedTo": { equals: req.user.id } },
				],
			};
		},
		delete: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			return {
				owner: { equals: req.user.id },
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
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Published", value: "published" },
				{ label: "Archived", value: "archived" },
			],
			defaultValue: "draft",
			required: true,
		},
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
		{
			fields: ["status"],
		},
		{
			fields: ["page"],
		},
		{
			fields: ["whiteboard"],
		},
		{
			fields: ["assignment"],
		},
		{
			fields: ["quiz"],
		},
		{
			fields: ["discussion"],
		},
	],
} as const satisfies CollectionConfig;
