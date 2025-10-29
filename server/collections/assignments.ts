import type { AccessResult, CollectionConfig } from "payload";

// Assignments collection - assignment-specific configuration
export const Assignments = {
	slug: "assignments",
	defaultSort: "-createdAt",
	access: {
		read: async ({ req }): Promise<AccessResult> => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			// Allow access if user created it or has access to any activity module using this assignment
			const activityModules = await req.payload.find({
				collection: "activity-modules",
				where: {
					assignment: { exists: true },
				},
				depth: 0,
			});

			const accessibleModuleIds = activityModules.docs
				.filter((mod) => {
					const owner =
						typeof mod.owner === "number" ? mod.owner : mod.owner?.id;
					const createdBy =
						typeof mod.createdBy === "number"
							? mod.createdBy
							: mod.createdBy?.id;
					return owner === req.user?.id || createdBy === req.user?.id;
				})
				.map((mod) =>
					typeof mod.assignment === "number"
						? mod.assignment
						: mod.assignment?.id,
				)
				.filter((id): id is number => id !== undefined);

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

			const activityModules = await req.payload.find({
				collection: "activity-modules",
				where: {
					assignment: { exists: true },
				},
				depth: 0,
			});

			const accessibleModuleIds = activityModules.docs
				.filter((mod) => {
					const owner =
						typeof mod.owner === "number" ? mod.owner : mod.owner?.id;
					const createdBy =
						typeof mod.createdBy === "number"
							? mod.createdBy
							: mod.createdBy?.id;
					return owner === req.user?.id || createdBy === req.user?.id;
				})
				.map((mod) =>
					typeof mod.assignment === "number"
						? mod.assignment
						: mod.assignment?.id,
				)
				.filter((id): id is number => id !== undefined);

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
			name: "dueDate",
			type: "date",
			label: "Due Date",
		},
		{
			name: "maxAttempts",
			type: "number",
			label: "Maximum Attempts",
			defaultValue: 1,
			min: 1,
		},
		{
			name: "allowLateSubmissions",
			type: "checkbox",
			label: "Allow Late Submissions",
			defaultValue: false,
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
		{
			fields: ["dueDate"],
		},
	],
} as const satisfies CollectionConfig;
