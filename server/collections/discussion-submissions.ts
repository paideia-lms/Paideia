import type { CollectionConfig } from "payload";

// Discussion Submissions collection - threads and replies in discussions
export const DiscussionSubmissions = {
	slug: "discussion-submissions",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "activityModule",
			type: "relationship",
			relationTo: "activity-modules",
			required: true,
			label: "Activity Module",
		},
		{
			name: "discussion",
			type: "relationship",
			relationTo: "discussions",
			required: true,
			label: "Discussion",
		},
		{
			name: "discussionTitle",
			type: "text",
			virtual: `discussion.title`,
			label: "Discussion Title",
		},
		{
			name: "student",
			type: "relationship",
			relationTo: "users",
			required: true,
			label: "Student",
		},
		{
			name: "studentEmail",
			type: "text",
			virtual: `student.email`,
			label: "Student Email",
		},
		{
			name: "studentName",
			type: "text",
			virtual: `student.firstName`,
			label: "Student Name",
		},
		{
			name: "enrollment",
			type: "relationship",
			relationTo: "enrollments",
			required: true,
			label: "Enrollment",
		},
		{
			name: "course",
			type: "text",
			virtual: `enrollment.course`,
			label: "Course",
		},
		{
			name: "courseTitle",
			type: "text",
			virtual: `enrollment.course.title`,
			label: "Course Title",
		},
		{
			name: "parentThread",
			type: "relationship",
			relationTo: "discussion-submissions",
			label: "Parent Thread",
		},
		{
			name: "postType",
			type: "select",
			options: [
				{ label: "Thread", value: "thread" },
				{ label: "Reply", value: "reply" },
				{ label: "Comment", value: "comment" },
			],
			defaultValue: "thread",
			required: true,
			label: "Post Type",
		},
		{
			name: "title",
			type: "text",
			label: "Thread/Post Title",
		},
		{
			name: "content",
			type: "textarea",
			required: true,
			label: "Post Content",
		},
		{
			name: "attachments",
			type: "array",
			fields: [
				{
					name: "file",
					type: "relationship",
					relationTo: "media",
					required: true,
				},
				{
					name: "description",
					type: "text",
					label: "File Description",
				},
			],
			label: "Attachments",
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Published", value: "published" },
				{ label: "Hidden", value: "hidden" },
				{ label: "Deleted", value: "deleted" },
			],
			defaultValue: "published",
			required: true,
			label: "Status",
		},
		{
			name: "publishedAt",
			type: "date",
			label: "Published At",
		},
		{
			name: "editedAt",
			type: "date",
			label: "Last Edited At",
		},
		{
			name: "isEdited",
			type: "checkbox",
			defaultValue: false,
			label: "Has Been Edited",
		},
		{
			name: "replies",
			type: "join",
			on: "parentThread",
			collection: "discussion-submissions",
			label: "Replies",
			hasMany: true,
		},
		{
			name: "upvotes",
			type: "array",
			fields: [
				{
					name: "user",
					type: "relationship",
					relationTo: "users",
					required: true,
				},
				{
					name: "upvotedAt",
					type: "date",
					required: true,
				},
			],
			label: "Upvotes",
		},
		{
			name: "lastActivityAt",
			type: "date",
			label: "Last Activity At",
		},
		{
			name: "isPinned",
			type: "checkbox",
			defaultValue: false,
			label: "Pinned Thread",
		},
		{
			name: "isLocked",
			type: "checkbox",
			defaultValue: false,
			label: "Locked Thread",
		},
	],
	indexes: [
		{
			fields: ["activityModule"],
		},
		{
			fields: ["discussion"],
		},
		{
			fields: ["student"],
		},
		{
			fields: ["enrollment"],
		},
		{
			fields: ["parentThread"],
		},
		{
			fields: ["postType"],
		},
		{
			fields: ["status"],
		},
		{
			fields: ["publishedAt"],
		},
		{
			fields: ["isPinned"],
		},
		{
			fields: ["lastActivityAt"],
		},
		{
			fields: ["postType", "lastActivityAt"],
		},
	],
} as const satisfies CollectionConfig;
