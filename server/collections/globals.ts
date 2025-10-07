import type { GlobalConfig } from "payload";

// System-level Grade Table Global - default grade letters for the entire system
export const SystemGradeTable = {
	slug: "system-grade-table",
	fields: [
		{
			name: "gradeLetters",
			type: "array",
			fields: [
				{
					name: "letter",
					type: "text",
					required: true,
					label: "Grade Letter",
				},
				{
					name: "minimumPercentage",
					type: "number",
					required: true,
					min: 0,
					max: 100,
					label: "Minimum Percentage",
				},
			],
			label: "Grade Letters",
			defaultValue: [
				{ letter: "A+", minimumPercentage: 90 },
				{ letter: "A", minimumPercentage: 85 },
				{ letter: "A-", minimumPercentage: 80 },
				{ letter: "B+", minimumPercentage: 77 },
				{ letter: "B", minimumPercentage: 73 },
				{ letter: "B-", minimumPercentage: 70 },
				{ letter: "C+", minimumPercentage: 67 },
				{ letter: "C", minimumPercentage: 63 },
				{ letter: "C-", minimumPercentage: 60 },
				{ letter: "D+", minimumPercentage: 57 },
				{ letter: "D", minimumPercentage: 53 },
				{ letter: "D-", minimumPercentage: 50 },
				{ letter: "F", minimumPercentage: 0 },
			],
		},
	],
} as const satisfies GlobalConfig;
