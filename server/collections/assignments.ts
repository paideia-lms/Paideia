import { tryGetContext } from "app/utils/try-get-context";
import type { AccessResult, CollectionConfig } from "payload";
import { stripDepth } from "server/internal/utils/internal-function-utils";
import {
	courseContextKey,
	enrolmentContextKey,
} from "server/contexts/utils/context-keys";

// Assignments collection - assignment-specific configuration
export const Assignments = {
	slug: "assignments",
	defaultSort: "-createdAt",
	access: {
		read: async ({ req }): Promise<AccessResult> => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			console.log("req", req.url);
			console.log("req", req.headers);

			const context = req.context.routerContext ?? req._c;
			if (context) {
				const courseContext = tryGetContext(context, courseContextKey);
				const enrolmentContext = tryGetContext(context, enrolmentContextKey);

				if (courseContext && enrolmentContext) {
					// the user has an enrolment to this course
					// TODO: do something, for now, we just let it pass
					return true;
				}
			}

			// Allow access if user created it or has access to any activity module using this assignment
			const activityModules = await req.payload
				.find({
					collection: "activity-modules",
					where: {
						assignment: { exists: true },
					},
					depth: 0,
				})
				.then(stripDepth<0, "find">());

			const accessibleModuleIds = activityModules.docs
				.filter((mod) => {
					return mod.owner === req.user?.id || mod.createdBy === req.user?.id;
				})
				.map((mod) => mod.assignment)
				.filter(Boolean);

			return {
				or: [
					{ createdBy: { equals: req.user.id } },
					{ id: { in: accessibleModuleIds } },
				],
			};
		},
		update: async ({ req }): Promise<AccessResult> => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			const activityModules = await req.payload
				.find({
					collection: "activity-modules",
					where: {
						assignment: { exists: true },
					},
					depth: 0,
				})
				.then(stripDepth<0, "find">());

			const accessibleModuleIds = activityModules.docs
				.filter((mod) => {
					return mod.owner === req.user?.id || mod.createdBy === req.user?.id;
				})
				.map((mod) => mod.assignment)
				.filter(Boolean);

			return {
				or: [
					{ createdBy: { equals: req.user.id } },
					{ id: { in: accessibleModuleIds } },
				],
			};
		},
		delete: ({ req }): AccessResult => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			return {
				createdBy: { equals: req.user.id },
			};
		},
	},
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
			label: "Assignment Title",
		},
		{
			name: "description",
			type: "textarea",
			label: "Assignment Description",
		},
		{
			name: "instructions",
			type: "textarea",
			label: "Instructions for Students",
		},
		{
			name: "allowedFileTypes",
			type: "array",
			fields: [
				{
					name: "extension",
					type: "text",
					required: true,
					label: "File Extension",
				},
				{
					name: "mimeType",
					type: "text",
					required: true,
					label: "MIME Type",
				},
			],
			label: "Allowed File Types",
		},
		{
			name: "maxFileSize",
			type: "number",
			label: "Maximum File Size (MB)",
			defaultValue: 10,
			min: 0,
		},
		{
			name: "maxFiles",
			type: "number",
			label: "Maximum Number of Files",
			defaultValue: 1,
			min: 1,
		},
		{
			name: "requireTextSubmission",
			type: "checkbox",
			label: "Require Text Submission",
			defaultValue: true,
		},
		{
			name: "requireFileSubmission",
			type: "checkbox",
			label: "Require File Submission",
			defaultValue: true,
		},
		{
			name: "createdBy",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Created By",
		},
	],
	indexes: [
		{
			fields: ["createdBy"],
		},
	],
} as const satisfies CollectionConfig;
