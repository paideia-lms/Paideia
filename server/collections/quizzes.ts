import type { AccessResult, CollectionConfig } from "payload";

// Quizzes collection - quiz-specific configuration
export const Quizzes = {
	slug: "quizzes",
	defaultSort: "-createdAt",
	access: {
		read: async ({ req }): Promise<AccessResult> => {
			if (!req.user) return false;
			if (req.user.role === "admin") return true;

			// Allow access if user created it or has access to any activity module using this quiz
			const activityModules = await req.payload.find({
				collection: "activity-modules",
				where: {
					quiz: { exists: true },
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
				.map((mod) => (typeof mod.quiz === "number" ? mod.quiz : mod.quiz?.id))
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
					quiz: { exists: true },
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
				.map((mod) => (typeof mod.quiz === "number" ? mod.quiz : mod.quiz?.id))
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
			label: "Quiz Title",
		},
		{
			name: "description",
			type: "textarea",
			label: "Quiz Description",
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
			name: "points",
			type: "number",
			label: "Total Points",
			defaultValue: 100,
			min: 0,
		},
		{
			name: "gradingType",
			type: "select",
			options: [
				{ label: "Automatic", value: "automatic" },
				{ label: "Manual", value: "manual" },
			],
			defaultValue: "automatic",
			label: "Grading Type",
		},
		{
			name: "timeLimit",
			type: "number",
			label: "Time Limit (minutes)",
			min: 0,
		},
		{
			name: "showCorrectAnswers",
			type: "checkbox",
			defaultValue: false,
			label: "Show Correct Answers After Submission",
		},
		{
			name: "allowMultipleAttempts",
			type: "checkbox",
			defaultValue: false,
			label: "Allow Multiple Attempts",
		},
		{
			name: "shuffleQuestions",
			type: "checkbox",
			defaultValue: false,
			label: "Shuffle Questions",
		},
		{
			name: "shuffleAnswers",
			type: "checkbox",
			defaultValue: false,
			label: "Shuffle Answer Options",
		},
		{
			name: "showOneQuestionAtATime",
			type: "checkbox",
			defaultValue: false,
			label: "Show One Question at a Time",
		},
		{
			name: "requirePassword",
			type: "checkbox",
			defaultValue: false,
			label: "Require Password to Access",
		},
		{
			name: "accessPassword",
			type: "text",
			label: "Access Password",
		},
		{
			name: "questions",
			type: "array",
			fields: [
				{
					name: "questionText",
					type: "textarea",
					required: true,
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
						{ label: "Matching", value: "matching" },
						{ label: "Ordering", value: "ordering" },
					],
					required: true,
					label: "Question Type",
				},
				{
					name: "points",
					type: "number",
					required: true,
					label: "Points",
					min: 0,
				},
				{
					name: "options",
					type: "array",
					fields: [
						{
							name: "text",
							type: "text",
							required: true,
							label: "Option Text",
						},
						{
							name: "isCorrect",
							type: "checkbox",
							defaultValue: false,
							label: "Is Correct Answer",
						},
						{
							name: "feedback",
							type: "textarea",
							label: "Feedback",
						},
					],
					label: "Answer Options",
				},
				{
					name: "correctAnswer",
					type: "text",
					label: "Correct Answer (for short answer/essay)",
				},
				{
					name: "explanation",
					type: "textarea",
					label: "Explanation",
				},
				{
					name: "hints",
					type: "array",
					fields: [
						{
							name: "hint",
							type: "text",
							required: true,
							label: "Hint Text",
						},
					],
					label: "Hints",
				},
			],
			label: "Questions",
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
