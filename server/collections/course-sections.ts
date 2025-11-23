import type { CollectionConfig } from "payload";
import type { CustomTFunction } from "server/utils/db/custom-translations";
import { match, P } from "ts-pattern";
import { CustomForbidden } from "./utils/custom-forbidden";
export const slug = "course-sections" as const;

// Course Sections collection - hierarchical sections within courses
export const CourseSections = {
	slug,
	defaultSort: "contentOrder",
	access: {
		create: ({ req }) => {
			return match(req.user)
				.with(
					P.union(
						// must be logged in to create a section
						P.nullish,
						// only admin, instructor, and content manager can create a section
						{ role: P.not(P.union("admin", "instructor", "content-manager")) },
					),
					(user) => {
						throw new CustomForbidden(
							"create",
							user?.role ?? "unauthenticated",
							slug,
							req.t as CustomTFunction,
						);
					},
				)
				.otherwise(() => {
					// Proceed with the allowed logic (no throw occurs here)
					return true;
				});
		},
		read: ({ req }) => {
			// any one can read any section
			return true;
		},
		update: ({ req }) => {
			return match(req.user)
				.with(
					P.union(
						// must be logged in to update a section
						P.nullish,
						// only admin, instructor, and content manager can update a section
						{ role: P.not(P.union("admin", "instructor", "content-manager")) },
					),
					(user) => {
						throw new CustomForbidden(
							"update",
							user?.role ?? "unauthenticated",
							slug,
							req.t as CustomTFunction,
						);
					},
				)
				.otherwise(() => {
					return true;
				});
		},
		delete: ({ req }) => {
			return match(req.user)
				.with(
					P.union(
						// must be logged in to delete a section
						P.nullish,
						// only admin, instructor, and content manager can delete a section
						{ role: P.not(P.union("admin", "instructor", "content-manager")) },
					),
					(user) => {
						throw new CustomForbidden(
							"delete",
							user?.role ?? "unauthenticated",
							slug,
							req.t as CustomTFunction,
						);
					},
				)
				.otherwise(() => {
					return true;
				});
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
			name: "contentOrder",
			type: "number",
			required: true,
			defaultValue: 0,
			label: "Content Order",
			min: -1,
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
