import type { CollectionConfig } from "payload";

// Discussions collection - discussion-specific configuration
export const Discussions = {
	slug: "discussions",
	defaultSort: "-createdAt",
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
			name: "requireInitialPost",
			type: "checkbox",
			label: "Require Initial Post",
			defaultValue: true,
		},
		{
			name: "requireReplies",
			type: "checkbox",
			label: "Require Replies",
			defaultValue: true,
		},
		{
			name: "minReplies",
			type: "number",
			label: "Minimum Number of Replies",
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
			name: "allowLikes",
			type: "checkbox",
			label: "Allow Likes/Reactions",
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
