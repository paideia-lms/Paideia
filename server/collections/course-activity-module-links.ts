import type { CollectionConfig } from "payload";
import { tryResolveCourseModuleSettingsToLatest } from "server/json/course-module-settings-version-resolver";

/**
 * we need a new collection rather than just a relationship field on the course and activity module
 */
export const CourseActivityModuleLinks = {
	slug: "course-activity-module-links",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "course",
			type: "relationship",
			relationTo: "courses",
			label: "Course",

			required: true,
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
			name: "activityModule",
			type: "relationship",
			relationTo: "activity-modules",
			label: "Activity Module",

			required: true,
		},
		{
			name: "activityModuleName",
			type: "text",
			hasMany: true,
			virtual: `activityModule.title`,
		},
		{
			name: "activityModuleType",
			type: "text",
			virtual: `activityModule.type`,
		},
		{
			name: "section",
			type: "relationship",
			relationTo: "course-sections",
			label: "Section",
			required: true,
		},
		{
			name: "sectionTitle",
			type: "text",
			virtual: `section.title`,
		},
		{
			name: "contentOrder",
			type: "number",
			required: true,
			defaultValue: 0,
			label: "Content Order",
			min: -1,
		},
		{
			name: "settings",
			type: "json",
			label: "Course Module Settings",
			hooks: {
				afterRead: [
					({ value }) => {
						if (!value) return null;
						return tryResolveCourseModuleSettingsToLatest(value);
					},
				],
			},
		},
	],
} as const satisfies CollectionConfig;
