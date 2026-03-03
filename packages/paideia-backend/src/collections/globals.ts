import type { GlobalConfig, TextFieldSingleValidation } from "payload";
import { z } from "zod";

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

// Site policies settings - controls media storage and upload limits
export const SitePolicies = {
	slug: "site-policies",
	fields: [
		{
			name: "userMediaStorageTotal",
			type: "number",
			label: "User Media Storage Total (bytes)",
			admin: {
				description:
					"Maximum total storage allowed per user for media files. Leave empty for unlimited storage.",
			},
			min: 0,
			defaultValue: 10 * 1024 * 1024 * 1024, // 10 GB
		},
		{
			name: "siteUploadLimit",
			type: "number",
			label: "Site Upload Limit (bytes)",
			admin: {
				description:
					"Maximum file size allowed for uploads across the site. Leave empty for unlimited size.",
			},
			min: 0,
			defaultValue: 20 * 1024 * 1024, // 20 MB
		},
	],
} as const satisfies GlobalConfig;

// Appearance settings - controls site-level CSS stylesheets and theme
export const AppearanceSettings = {
	slug: "appearance-settings",
	fields: [
		{
			name: "color",
			type: "select",
			label: "Primary Color",
			admin: {
				description:
					"Select the primary color theme for the application. This affects buttons, links, and other interactive elements.",
			},
			options: [
				{ label: "Blue", value: "blue" },
				{ label: "Pink", value: "pink" },
				{ label: "Indigo", value: "indigo" },
				{ label: "Green", value: "green" },
				{ label: "Orange", value: "orange" },
				{ label: "Gray", value: "gray" },
				{ label: "Grape", value: "grape" },
				{ label: "Cyan", value: "cyan" },
				{ label: "Lime", value: "lime" },
				{ label: "Red", value: "red" },
				{ label: "Violet", value: "violet" },
				{ label: "Teal", value: "teal" },
				{ label: "Yellow", value: "yellow" },
			],
			defaultValue: "blue",
		},
		{
			name: "radius",
			type: "select",
			label: "Border Radius",
			admin: {
				description:
					"Select the default border radius for components. This affects buttons, cards, inputs, and other elements.",
			},
			options: [
				{ label: "Extra Small", value: "xs" },
				{ label: "Small", value: "sm" },
				{ label: "Medium", value: "md" },
				{ label: "Large", value: "lg" },
				{ label: "Extra Large", value: "xl" },
			],
			defaultValue: "sm",
		},
		{
			name: "additionalCssStylesheets",
			type: "array",
			label: "Additional CSS Stylesheets",
			admin: {
				description:
					"Add external CSS stylesheet URLs that will be loaded on all pages. Stylesheets are loaded in the order listed, allowing you to control CSS cascade precedence.",
			},
			fields: [
				{
					name: "url",
					type: "text",
					required: true,
					label: "Stylesheet URL",
					admin: {
						description:
							"Full URL to the CSS stylesheet (e.g., https://example.com/style.css). Must be a valid HTTP/HTTPS URL.",
					},
					validate: ((value: string) => {
						return z.url().safeParse(value).success;
					}) as TextFieldSingleValidation,
				},
			],
			defaultValue: [],
		},
		{
			name: "logoLight",
			type: "relationship",
			relationTo: "media",
			label: "Logo (Light Mode)",
			admin: {
				description:
					"Upload the main logo image for light mode. This will be displayed when the site is in light mode.",
			},
		},
		{
			name: "logoDark",
			type: "relationship",
			relationTo: "media",
			label: "Logo (Dark Mode)",
			admin: {
				description:
					"Upload the main logo image for dark mode. This will be displayed when the site is in dark mode.",
			},
		},
		{
			name: "compactLogoLight",
			type: "relationship",
			relationTo: "media",
			label: "Compact Logo (Light Mode)",
			admin: {
				description:
					"Upload a compact version of the logo for light mode. This is typically used in smaller spaces like navigation bars.",
			},
		},
		{
			name: "compactLogoDark",
			type: "relationship",
			relationTo: "media",
			label: "Compact Logo (Dark Mode)",
			admin: {
				description:
					"Upload a compact version of the logo for dark mode. This is typically used in smaller spaces like navigation bars.",
			},
		},
		{
			name: "faviconLight",
			type: "relationship",
			relationTo: "media",
			label: "Favicon (Light Mode)",
			admin: {
				description:
					"Upload the favicon for light mode. This is the small icon displayed in browser tabs and bookmarks.",
			},
		},
		{
			name: "faviconDark",
			type: "relationship",
			relationTo: "media",
			label: "Favicon (Dark Mode)",
			admin: {
				description:
					"Upload the favicon for dark mode. This is the small icon displayed in browser tabs and bookmarks.",
			},
		},
	],
} as const satisfies GlobalConfig;

// Analytics settings - controls site-level analytics scripts
export const AnalyticsSettings = {
	slug: "analytics-settings",
	fields: [
		{
			name: "additionalJsScripts",
			type: "array",
			label: "Additional JavaScript Scripts",
			admin: {
				description:
					"Add external JavaScript script tags that will be loaded on all pages. Scripts are loaded in the order listed. Only external scripts with src attribute are allowed for security.",
			},
			fields: [
				{
					name: "src",
					type: "text",
					required: true,
					label: "Script URL",
					admin: {
						description:
							"Full URL to the JavaScript file (e.g., https://cloud.umami.is/script.js). Must be a valid HTTP/HTTPS URL.",
					},
				},
				{
					name: "defer",
					type: "checkbox",
					label: "Defer",
					defaultValue: false,
					admin: {
						description:
							"When enabled, the script will be executed after the document has been parsed.",
					},
				},
				{
					name: "async",
					type: "checkbox",
					label: "Async",
					defaultValue: false,
					admin: {
						description:
							"When enabled, the script will be executed asynchronously as soon as it is available.",
					},
				},
				{
					name: "dataWebsiteId",
					type: "text",
					label: "Data Website ID",
					admin: {
						description:
							"Data attribute for website ID (e.g., for Umami analytics). This will be added as data-website-id attribute.",
					},
				},
				{
					name: "dataDomain",
					type: "text",
					label: "Data Domain",
					admin: {
						description:
							"Data attribute for domain (e.g., for Plausible analytics). This will be added as data-domain attribute.",
					},
				},
				{
					name: "dataSite",
					type: "text",
					label: "Data Site",
					admin: {
						description:
							"Data attribute for site ID (e.g., for Fathom analytics). This will be added as data-site attribute.",
					},
				},
				{
					name: "dataMeasurementId",
					type: "text",
					label: "Data Measurement ID",
					admin: {
						description:
							"Data attribute for measurement ID (e.g., for Google Analytics). This will be added as data-measurement-id attribute.",
					},
				},
			],
			defaultValue: [],
		},
	],
} as const satisfies GlobalConfig;
