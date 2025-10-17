import type { AccessResult, CollectionConfig } from "payload";

// Activity Modules collection - generic container for all learning activities
export const ActivityModules = {
	slug: "activity-modules",
	defaultSort: "-createdAt",
	access: {
		read: ({ req }): AccessResult => {
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
		{
			name: "requirePassword",
			type: "checkbox",
			defaultValue: false,
			label: "Require Password to Access",
		},
		{
			name: "accessPassword",
			type: "text",
			label: "Access Password",
		},
		// Polymorphic relationship to specific activity collections
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
		// Join fields for submissions
		{
			name: "submissions",
			type: "join",
			on: "activityModule",
			collection: "assignment-submissions",
			label: "Assignment Submissions",
			hasMany: true,
		},
		{
			name: "quizSubmissions",
			type: "join",
			on: "activityModule",
			collection: "quiz-submissions",
			label: "Quiz Submissions",
			hasMany: true,
		},
		{
			name: "discussionSubmissions",
			type: "join",
			on: "activityModule",
			collection: "discussion-submissions",
			label: "Discussion Submissions",
			hasMany: true,
		},
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
