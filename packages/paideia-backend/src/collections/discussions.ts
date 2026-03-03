import type { AccessResult, CollectionConfig } from "payload";

// Discussions collection - discussion-specific configuration
export const Discussions = {
	slug: "discussions",
	defaultSort: "-createdAt",
	access: {
		read: async ({ req }): Promise<AccessResult> => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			// Allow access if user created it or has access to any activity module using this discussion
			const activityModules = await req.payload.find({
				collection: "activity-modules",
				where: {
					discussion: { exists: true },
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
					typeof mod.discussion === "number"
						? mod.discussion
						: mod.discussion?.id,
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
					discussion: { exists: true },
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
					typeof mod.discussion === "number"
						? mod.discussion
						: mod.discussion?.id,
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
			label: "Discussion Title",
		},
		{
			name: "description",
			type: "textarea",
			label: "Discussion Description",
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
			name: "requireThread",
			type: "checkbox",
			label: "Require Thread Creation",
			defaultValue: true,
		},
		{
			name: "requireReplies",
			type: "checkbox",
			label: "Require Replies to Threads",
			defaultValue: true,
		},
		{
			name: "minReplies",
			type: "number",
			label: "Minimum Number of Replies per Thread",
			defaultValue: 2,
			min: 0,
		},
		{
			name: "minWordsPerPost",
			type: "number",
			label: "Minimum Words per Post",
			defaultValue: 50,
			min: 0,
		},
		{
			name: "allowAttachments",
			type: "checkbox",
			label: "Allow File Attachments",
			defaultValue: true,
		},
		{
			name: "allowUpvotes",
			type: "checkbox",
			label: "Allow Thread Upvoting",
			defaultValue: true,
		},
		{
			name: "allowEditing",
			type: "checkbox",
			label: "Allow Post Editing",
			defaultValue: true,
		},
		{
			name: "allowDeletion",
			type: "checkbox",
			label: "Allow Post Deletion",
			defaultValue: false,
		},
		{
			name: "moderationRequired",
			type: "checkbox",
			label: "Require Moderation",
			defaultValue: false,
		},
		{
			name: "anonymousPosting",
			type: "checkbox",
			label: "Allow Anonymous Posting",
			defaultValue: false,
		},
		{
			name: "groupDiscussion",
			type: "checkbox",
			label: "Group Discussion",
			defaultValue: false,
		},
		{
			name: "maxGroupSize",
			type: "number",
			label: "Maximum Group Size",
			min: 2,
		},
		{
			name: "threadSorting",
			type: "select",
			options: [
				{ label: "Most Recent", value: "recent" },
				{ label: "Most Upvoted", value: "upvoted" },
				{ label: "Most Active", value: "active" },
				{ label: "Alphabetical", value: "alphabetical" },
			],
			defaultValue: "recent",
			label: "Default Thread Sorting",
		},
		{
			name: "pinnedThreads",
			type: "array",
			fields: [
				{
					name: "thread",
					type: "relationship",
					relationTo: "discussion-submissions",
					required: true,
				},
				{
					name: "pinnedAt",
					type: "date",
					required: true,
				},
				{
					name: "pinnedBy",
					type: "relationship",
					relationTo: "users",
					required: true,
				},
			],
			label: "Pinned Threads",
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
		{
			fields: ["threadSorting"],
		},
	],
} as const satisfies CollectionConfig;
