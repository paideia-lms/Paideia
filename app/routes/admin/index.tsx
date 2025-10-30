import { Badge, Box, Stack, Title } from "@mantine/core";
import { useQueryState } from "nuqs";
import { href, Link } from "react-router";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import type { Route } from "./+types/index";

export const loader = async ({ request }: Route.LoaderArgs) => {
	const url = new URL(request.url);
	const tabParam = url.searchParams.get("tab") ?? "general";

	return { tabParam };
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

interface AdminItem {
	title: string;
	href?: string;
}

interface AdminSection {
	title: string;
	items: AdminItem[];
}

interface AdminTab {
	title: string;
	sections: { [key: string]: AdminSection };
}

const adminTabs: { [key: string]: AdminTab } = {
	general: {
		title: "General",
		sections: {
			general: {
				title: "General",
				items: [
					{ title: "Notifications" },
					{ title: "Registration" },
					{ title: "Feedback settings" },
					{ title: "Advanced features" },
					{ title: "Site admin presets" },
				],
			},
			ai: {
				title: "AI",
				items: [{ title: "AI providers" }, { title: "AI placements" }],
			},
			analytics: {
				title: "Analytics",
				items: [
					{ title: "Site information" },
					{ title: "Analytics settings" },
					{ title: "Analytics models" },
				],
			},
			hsp: {
				title: "HSP",
				items: [
					{ title: "HSP overview" },
					{ title: "Manage HSP content types" },
					{ title: "HSP settings" },
				],
			},
			licence: {
				title: "Licence",
				items: [{ title: "Licence settings" }, { title: "Licence manager" }],
			},
			location: {
				title: "Location",
				items: [{ title: "Location settings" }],
			},
			language: {
				title: "Language",
				items: [
					{ title: "Language settings" },
					{ title: "Language customisation" },
					{ title: "Language packs" },
				],
			},
			messaging: {
				title: "Messaging",
				items: [
					{ title: "Messaging settings" },
					{ title: "Notification settings" },
				],
			},
			payments: {
				title: "Payments",
				items: [{ title: "Payment accounts" }],
			},
			security: {
				title: "Security",
				items: [
					{ title: "IP blocker" },
					{ title: "Site security settings" },
					{ title: "HTTP security" },
					{ title: "Notifications" },
				],
			},
			site_home: {
				title: "Site home",
				items: [{ title: "Site home settings" }],
			},
			mobile_app: {
				title: "Mobile app",
				items: [
					{ title: "Mobile settings" },
					{ title: "Mobile app subscription" },
					{ title: "Mobile authentication" },
					{ title: "Mobile appearance" },
					{ title: "Mobile features" },
				],
			},
		},
	},
	users: {
		title: "Users",
		sections: {
			users: {
				title: "Users",
				items: [
					{ title: "Browse list of users", href: href("/admin/users") },
					{ title: "Bulk user actions" },
					{ title: "Add a new user" },
					{ title: "User management" },
					{ title: "User default preferences" },
					{ title: "User profile fields" },
				],
			},
			accounts: {
				title: "Accounts",
				items: [
					{ title: "Cohorts" },
					{ title: "Cohort custom fields" },
					{ title: "Merge user accounts" },
					{ title: "Merge user account logs" },
					{ title: "Upload users" },
					{ title: "Upload user pictures" },
				],
			},
			permissions: {
				title: "Permissions",
				items: [
					{ title: "User policies" },
					{ title: "Site administrators" },
					{ title: "Define roles" },
					{ title: "Assign system roles" },
					{ title: "Check system permissions" },
					{ title: "Capability overview" },
					{ title: "Assign user roles to cohort" },
					{ title: "Unsupported role assignments" },
				],
			},
			privacy: {
				title: "Privacy and policies",
				items: [
					{ title: "Privacy settings" },
					{ title: "Policy settings" },
					{ title: "Data requests" },
					{ title: "Data registry" },
					{ title: "Data deletion" },
					{ title: "Plugin privacy registry" },
				],
			},
		},
	},
	courses: {
		title: "Courses",
		sections: {
			courses: {
				title: "Courses",
				items: [
					{
						title: "Manage courses",
						href: href("/admin/courses"),
					},
					{
						title: "Manage categories",
						href: href("/admin/categories"),
					},
					{ title: "Add a category", href: href("/admin/category/new") },
					{ title: "Add a new course", href: href("/admin/course/new") },
					{ title: "Restore course" },
					{ title: "Download course content" },
					{ title: "Course request" },
					{ title: "Upload courses" },
				],
			},
			default_settings: {
				title: "Default settings",
				items: [
					{ title: "Course default settings" },
					{ title: "Default activity completion" },
					{ title: "Course custom fields" },
				],
			},
			groups: {
				title: "Groups",
				items: [
					{ title: "Group custom fields" },
					{ title: "Grouping custom fields" },
				],
			},
			activity_chooser: {
				title: "Activity chooser",
				items: [
					{ title: "Activity chooser settings" },
					{ title: "Recommended activities" },
				],
			},
			backups: {
				title: "Backups",
				items: [
					{ title: "General backup defaults" },
					{ title: "General import defaults" },
					{ title: "Automated backup setup" },
					{ title: "General restore defaults" },
					{ title: "Asynchronous backup/restore" },
				],
			},
		},
	},
	grades: {
		title: "Grades",
		sections: {
			grades: {
				title: "Grades",
				items: [
					{ title: "General settings" },
					{ title: "Grade category settings" },
					{ title: "Grade item settings" },
					{ title: "Scales" },
					{ title: "Outcomes" },
					{ title: "Letters" },
				],
			},
			report_settings: {
				title: "Report settings",
				items: [
					{ title: "Grader report" },
					{ title: "Grade history" },
					{ title: "Overview report" },
					{ title: "User report" },
				],
			},
		},
	},
	plugins: {
		title: "Plugins",
		sections: {
			activity_modules: {
				title: "Activity modules",
				items: [
					{ title: "Manage activities" },
					{ title: "Activity chooser settings" },
					{ title: "Activity completion" },
					{ title: "Activity results block" },
				],
			},
			admin_tools: {
				title: "Admin tools",
				items: [
					{ title: "Manage admin tools" },
					{ title: "Site administration" },
					{ title: "Support contact" },
					{ title: "CLI scripts" },
				],
			},
			antivirus: {
				title: "Antivirus",
				items: [
					{ title: "Manage antivirus plugins" },
					{ title: "ClamAV" },
					{ title: "Virus scanning" },
				],
			},
			authentication: {
				title: "Authentication",
				items: [
					{ title: "Manage authentication" },
					{ title: "Manual accounts" },
					{ title: "OAuth 2 services" },
					{ title: "CAS server (SSO)" },
				],
			},
			availability: {
				title: "Availability restrictions",
				items: [
					{ title: "Manage restrictions" },
					{ title: "Date" },
					{ title: "Grade" },
					{ title: "Group" },
				],
			},
			blocks: {
				title: "Blocks",
				items: [
					{ title: "Manage blocks" },
					{ title: "Activity results" },
					{ title: "Comments" },
					{ title: "Course overview" },
				],
			},
			caching: {
				title: "Caching",
				items: [
					{ title: "Cache stores" },
					{ title: "Cache usage" },
					{ title: "Request cache" },
					{ title: "Session cache" },
				],
			},
			content_bank: {
				title: "Content bank",
				items: [
					{ title: "Manage content bank" },
					{ title: "Content types" },
					{ title: "H5P" },
				],
			},
			course_formats: {
				title: "Course formats",
				items: [
					{ title: "Topics format" },
					{ title: "Weekly format" },
					{ title: "Single activity format" },
				],
			},
			custom_fields: {
				title: "Custom fields",
				items: [
					{ title: "Manage custom fields" },
					{ title: "Course custom fields" },
					{ title: "User custom fields" },
				],
			},
			data_formats: {
				title: "Data formats",
				items: [
					{ title: "Manage data formats" },
					{ title: "Excel spreadsheet" },
					{ title: "CSV" },
				],
			},
			document_converters: {
				title: "Document converters",
				items: [
					{ title: "Manage converters" },
					{ title: "LibreOffice" },
					{ title: "Google Drive" },
				],
			},
			enrolment: {
				title: "Enrolment",
				items: [
					{ title: "Manage enrolment plugins" },
					{ title: "Self enrolment" },
					{ title: "Manual enrolment" },
					{ title: "Cohort sync" },
				],
			},
			filters: {
				title: "Filters",
				items: [
					{ title: "Manage filters" },
					{ title: "Content cleanup" },
					{ title: "Email protection" },
					{ title: "URL to link" },
				],
			},
			local_plugins: {
				title: "Local plugins",
				items: [
					{ title: "Manage local plugins" },
					{ title: "Custom local plugin" },
				],
			},
			logging: {
				title: "Logging",
				items: [
					{ title: "Manage log stores" },
					{ title: "Standard log" },
					{ title: "External database log" },
				],
			},
			ml: {
				title: "Machine learning backend settings",
				items: [{ title: "Python ML backend" }],
			},
			media: {
				title: "Media players",
				items: [{ title: "VideoJS player" }, { title: "Audio player" }],
			},
			payment: {
				title: "Payment gateways",
				items: [
					{ title: "Manage payment gateways" },
					{ title: "PayPal" },
					{ title: "Stripe" },
				],
			},
			qbank: {
				title: "Question bank plugins",
				items: [
					{ title: "Manage question bank" },
					{ title: "Question preview" },
				],
			},
			qbehaviour: {
				title: "Question behaviours",
				items: [
					{ title: "Deferred feedback" },
					{ title: "Interactive with multiple tries" },
					{ title: "Immediate feedback" },
				],
			},
			qtype: {
				title: "Question types",
				items: [
					{ title: "Manage question types" },
					{ title: "Calculated" },
					{ title: "Essay" },
					{ title: "Multiple choice" },
				],
			},
			reports: {
				title: "Reports",
				items: [
					{ title: "Manage reports" },
					{ title: "Course reports" },
					{ title: "User reports" },
				],
			},
			repositories: {
				title: "Repositories",
				items: [
					{ title: "Manage repositories" },
					{ title: "Content bank" },
					{ title: "File system" },
					{ title: "Recent files" },
				],
			},
			search: {
				title: "Search",
				items: [{ title: "Manage global search" }, { title: "Solr" }],
			},
			sms: {
				title: "SMS",
				items: [{ title: "Manage SMS gateways" }],
			},
			editors: {
				title: "Text editors",
				items: [
					{ title: "Manage editors" },
					{ title: "Atto editor" },
					{ title: "TinyMCE editor" },
					{ title: "Plain text area" },
				],
			},
		},
	},
	appearance: {
		title: "Appearance",
		sections: {
			appearance: {
				title: "Appearance",
				items: [
					{ title: "Logos" },
					{ title: "Course card colours" },
					{ title: "Calendar" },
					{ title: "Blog" },
					{ title: "Navigation" },
					{ title: "HTML settings" },
					{ title: "Paideia Docs" },
					{ title: "Default Dashboard page" },
					{ title: "Default profile page" },
					{ title: "Courses" },
					{ title: "Manage tags" },
					{ title: "Additional HTML" },
					{ title: "Templates" },
					{ title: "Advanced theme settings" },
					{ title: "Themes" },
					{ title: "User tours" },
				],
			},
		},
	},
	server: {
		title: "Server",
		sections: {
			server: {
				title: "Server",
				items: [
					{ title: "System information", href: href("/admin/system") },
					{ title: "System paths" },
					{ title: "Support contact" },
					{ title: "Session handling" },
					{ title: "Statistics" },
					{ title: "HTTP" },
					{ title: "Maintenance mode" },
					{ title: "Cleanup" },
					{ title: "Environment" },
					{ title: "Performance" },
					{ title: "Update notifications" },
					{ title: "Test email", href: href("/admin/test-email") },
				],
			},
			file_redaction: {
				title: "File redaction",
				items: [{ title: "EXIF remover" }],
			},
			tasks: {
				title: "Tasks",
				items: [
					{ title: "Task processing" },
					{ title: "Task log configuration" },
					{ title: "Task logs" },
					{ title: "Scheduled tasks" },
					{ title: "Ad hoc tasks" },
					{ title: "Tasks running now" },
				],
			},
			email: {
				title: "Email",
				items: [
					{ title: "Outgoing mail configuration" },
					{ title: "Incoming mail configuration" },
					{ title: "Message handlers" },
				],
			},
			web_services: {
				title: "Web services",
				items: [
					{ title: "Overview" },
					{ title: "API Documentation" },
					{ title: "External services" },
					{ title: "Manage protocols" },
					{ title: "Manage tokens" },
				],
			},
		},
	},
	reports: {
		title: "Reports",
		sections: {
			reports: {
				title: "Reports",
				items: [
					{ title: "Comments" },
					{ title: "Backups" },
					{ title: "Benchmark" },
					{ title: "Config changes" },
					{ title: "Course overview" },
					{ title: "Course size" },
					{ title: "Events list" },
					{ title: "Antivirus failures" },
					{ title: "Insights" },
					{ title: "Logs" },
					{ title: "Live logs" },
					{ title: "Performance overview" },
					{ title: "Question instances" },
					{ title: "Security checks" },
					{ title: "Statistics" },
					{ title: "System status" },
					{ title: "Theme usage" },
					{ title: "Accessibility toolkit" },
					{ title: "Event monitoring rules" },
					{ title: "Spam cleaner" },
				],
			},
			report_builder: {
				title: "Report builder",
				items: [
					{ title: "Custom reports" },
					{ title: "Custom report settings" },
				],
			},
			mfa: {
				title: "MFA reports",
				items: [{ title: "All factor report" }],
			},
		},
	},
	development: {
		title: "Development",
		sections: {
			development: {
				title: "Development",
				items: [
					{ title: "Debugging" },
					{ title: "Paideia REST API UI (SwaggerUI)" },
					{ title: "Purge caches" },
					{ title: "Third party libraries" },
					{ title: "Hooks overview" },
					{ title: "Acceptance testing" },
					{ title: "Make test course" },
					{ title: "Template library" },
				],
			},
			experimental: {
				title: "Experimental",
				items: [
					{ title: "Experimental settings" },
					{ title: "Database migration" },
				],
			},
		},
	},
};

export default function AdminPage() {
	const [activeTab] = useQueryState("tab", {
		defaultValue: "general",
	});

	const tabData = adminTabs[activeTab ?? "general"];

	return (
		<Box pt="xl">
			<title>Site Administration | Paideia LMS</title>
			<meta
				name="description"
				content="Manage and configure your Paideia LMS installation"
			/>
			<meta property="og:title" content="Site Administration | Paideia LMS" />
			<meta
				property="og:description"
				content="Manage and configure your Paideia LMS installation"
			/>

			{tabData && (
				<Stack gap="lg">
					{Object.entries(tabData.sections).map(([sectionKey, section]) => (
						<Box key={sectionKey}>
							<Title order={2} mb="md">
								{section.title}
							</Title>
							<Stack gap="sm">
								{section.items.map((item) => (
									<Box
										key={item.title}
										p="md"
										style={{
											textDecoration: "none",
											color: "inherit",
											border: "1px solid var(--mantine-color-gray-3)",
											borderRadius: "var(--mantine-radius-sm)",
											cursor: "pointer",
										}}
										component={Link}
										to={item.href ?? "#"}
									>
										<Title order={4} mb="xs">
											{item.title}{" "}
											{!item.href && (
												<Badge color="gray" variant="light">
													Coming soon
												</Badge>
											)}
										</Title>
									</Box>
								))}
							</Stack>
						</Box>
					))}
				</Stack>
			)}
		</Box>
	);
}
