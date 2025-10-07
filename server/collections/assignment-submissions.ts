import type { CollectionConfig } from "payload";

// Assignment Submissions collection - student submissions for assignments
export const AssignmentSubmissions = {
	slug: "assignment-submissions",
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
			name: "assignment",
			type: "relationship",
			relationTo: "assignments" as any,
			required: true,
			label: "Assignment",
		},
		{
			name: "assignmentTitle",
			type: "text",
			virtual: `assignment.title`,
			label: "Assignment Title",
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
			name: "attemptNumber",
			type: "number",
			required: true,
			defaultValue: 1,
			min: 1,
			label: "Attempt Number",
		},
		{
			name: "status",
			type: "select",
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Submitted", value: "submitted" },
				{ label: "Graded", value: "graded" },
				{ label: "Returned", value: "returned" },
			],
			defaultValue: "draft",
			required: true,
			label: "Status",
		},
		{
			name: "submittedAt",
			type: "date",
			label: "Submitted At",
		},
		{
			name: "content",
			type: "textarea",
			label: "Submission Content",
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
			name: "isLate",
			type: "checkbox",
			defaultValue: false,
			label: "Late Submission",
		},
		{
			name: "timeSpent",
			type: "number",
			label: "Time Spent (minutes)",
			min: 0,
		},
	],
	indexes: [
		{
			fields: ["activityModule"],
		},
		{
			fields: ["student"],
		},
		{
			fields: ["enrollment"],
		},
		{
			// One submission per student per assignment per attempt
			fields: ["activityModule", "student", "attemptNumber"],
			unique: true,
		},
		{
			fields: ["status"],
		},
		{
			fields: ["submittedAt"],
		},
	],
} as const satisfies CollectionConfig;
