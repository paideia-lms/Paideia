import type { CollectionConfig } from "payload";

// Course Sections collection - hierarchical sections within courses
export const CourseSections = {
	slug: "course-sections" as const,
	defaultSort: "contentOrder",
	access: {
		create: ({ req }) => {
			// must be logged in to create a section
			if (!req.user) return false;
			// only admin and content manager can create a section
			return req.user.role === "admin" || req.user.role === "content-manager";
		},
		read: ({ req }) => {
			// any one can read any section
			return true;
		},
		update: ({ req }) => {
			// must be logged in to update a section
			if (!req.user) return false;
			// only admin can update a section
			return req.user.role === "admin";
		},
		delete: ({ req }) => {
			if (!req.user) return false;
			// only admin can delete a section
			return req.user.role === "admin";
		},
	},
	fields: [
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			required: true,
			label: "Course",
		},
		{
			name: "courseName",
			type: "text",
			virtual: `course.title`,
		},
		{
			name: "courseSlug",
			type: "text",
			virtual: `course.slug`,
		},
		{
			name: "title",
			type: "text",
			required: true,
			label: "Section Title",
		},
		{
			name: "description",
			type: "textarea",
			label: "Section Description",
		},
		{
			name: "parentSection",
			type: "relationship",
			relationTo: "course-sections",
			label: "Parent Section",
			// Allow null for root sections
		},
		{
			name: "parentSectionTitle",
			type: "text",
			virtual: `parentSection.title`,
		},
		{
			name: "order",
			type: "number",
			required: true,
			defaultValue: 0,
			label: "Order",
			min: 0,
		},
		{
			name: "contentOrder",
			type: "number",
			required: true,
			defaultValue: 0,
			label: "Content Order",
			min: 0,
		},
		{
			name: "activityModules",
			type: "join",
			on: "section",
			collection: "course-activity-module-links",
			label: "Activity Modules",
			maxDepth: 2,
		},
		{
			name: "childSections",
			type: "join",
			on: "parentSection",
			collection: "course-sections",
			label: "Child Sections",
			maxDepth: 1,
		},
	],
} as const satisfies CollectionConfig;
