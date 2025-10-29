import type { CollectionConfig } from "payload";

// Quiz Submissions collection - student submissions for quizzes
export const QuizSubmissions = {
	slug: "quiz-submissions",
	defaultSort: "-createdAt",
	fields: [
		{
			name: "courseModuleLink",
			type: "relationship",
			relationTo: "course-activity-module-links",
			required: true,
			label: "Course Module Link",
		},
		{
			name: "activityModule",
			type: "text",
			virtual: `courseModuleLink.activityModule`,
			label: "Activity Module",
		},
		{
			name: "activityModuleTitle",
			type: "text",
			virtual: `courseModuleLink.activityModule.title`,
			label: "Activity Module Title",
		},
		{
			name: "quiz",
			type: "text",
			virtual: `courseModuleLink.activityModule.quiz`,
			label: "Quiz",
		},
		{
			name: "quizTitle",
			type: "text",
			virtual: `courseModuleLink.activityModule.quiz.title`,
			label: "Quiz Title",
		},
		{
			name: "section",
			type: "text",
			virtual: `courseModuleLink.section`,
			label: "Section",
		},
		{
			name: "sectionTitle",
			type: "text",
			virtual: `courseModuleLink.sectionTitle`,
			label: "Section Title",
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
				{ label: "In Progress", value: "in_progress" },
				{ label: "Completed", value: "completed" },
				{ label: "Graded", value: "graded" },
				{ label: "Returned", value: "returned" },
			],
			defaultValue: "in_progress",
			required: true,
			label: "Status",
		},
		{
			name: "startedAt",
			type: "date",
			label: "Started At",
		},
		{
			name: "submittedAt",
			type: "date",
			label: "Submitted At",
		},
		{
			name: "timeLimit",
			type: "number",
			virtual: `courseModuleLink.activityModule.quiz.timeLimit`,
			label: "Time Limit (minutes)",
		},
		{
			name: "timeSpent",
			type: "number",
			label: "Time Spent (minutes)",
			min: 0,
		},
		{
			name: "answers",
			type: "array",
			fields: [
				{
					name: "questionId",
					type: "text",
					required: true,
					label: "Question ID",
				},
				{
					name: "questionText",
					type: "text",
					label: "Question Text",
				},
				{
					name: "questionType",
					type: "select",
					options: [
						{ label: "Multiple Choice", value: "multiple_choice" },
						{ label: "True/False", value: "true_false" },
						{ label: "Short Answer", value: "short_answer" },
						{ label: "Essay", value: "essay" },
						{ label: "Fill in the Blank", value: "fill_blank" },
					],
					required: true,
					label: "Question Type",
				},
				{
					name: "selectedAnswer",
					type: "text",
					label: "Selected Answer",
				},
				{
					name: "multipleChoiceAnswers",
					type: "array",
					fields: [
						{
							name: "option",
							type: "text",
							required: true,
						},
						{
							name: "isSelected",
							type: "checkbox",
							defaultValue: false,
						},
					],
					label: "Multiple Choice Answers",
				},
				{
					name: "isCorrect",
					type: "checkbox",
					label: "Is Correct",
				},
				{
					name: "pointsEarned",
					type: "number",
					label: "Points Earned",
					min: 0,
				},
				{
					name: "maxPoints",
					type: "number",
					label: "Maximum Points",
					min: 0,
				},
				{
					name: "feedback",
					type: "text",
					label: "Question Feedback",
				},
			],
			label: "Answers",
		},
		{
			name: "totalScore",
			type: "number",
			label: "Total Score",
			min: 0,
		},
		{
			name: "maxScore",
			type: "number",
			label: "Maximum Score",
			min: 0,
		},
		{
			name: "percentage",
			type: "number",
			label: "Percentage",
			min: 0,
			max: 100,
		},
		{
			name: "isLate",
			type: "checkbox",
			defaultValue: false,
			label: "Late Submission",
		},
		{
			name: "autoGraded",
			type: "checkbox",
			defaultValue: false,
			label: "Auto Graded",
		},
	],
	indexes: [
		{
			fields: ["courseModuleLink"],
		},
		{
			fields: ["student"],
		},
		{
			fields: ["enrollment"],
		},
		{
			// One submission per student per course module link per attempt
			fields: ["courseModuleLink", "student", "attemptNumber"],
			unique: true,
		},
		{
			fields: ["status"],
		},
		{
			fields: ["submittedAt"],
		},
		{
			fields: ["totalScore"],
		},
	],
} as const satisfies CollectionConfig;
