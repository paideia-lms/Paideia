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
		{
			name: "maxCategoryDepth",
			type: "number",
			label: "Maximum Category Depth",
			admin: {
				description:
					"Maximum nesting depth for course categories. Leave empty for unlimited depth.",
			},
			min: 1,
		},
	],
} as const satisfies GlobalConfig;

// Registration settings - controls public registration availability and UI
export const RegistrationSettings = {
	slug: "registration-settings",
	fields: [
		{
			name: "disableRegistration",
			type: "checkbox",
			label: "Disable Self-Registration",
			defaultValue: false,
		},
		{
			name: "showRegistrationButton",
			type: "checkbox",
			label: "Show Registration Button",
			defaultValue: true,
		},
	],
} as const satisfies GlobalConfig;

// Maintenance mode settings - controls system maintenance mode
export const MaintenanceSettings = {
	slug: "maintenance-settings",
	fields: [
		{
			name: "maintenanceMode",
			type: "checkbox",
			label: "Maintenance Mode",
			defaultValue: false,
			admin: {
				description:
					"When enabled, only administrators can access the system. All other users will be blocked from logging in.",
			},
		},
	],
} as const satisfies GlobalConfig;
