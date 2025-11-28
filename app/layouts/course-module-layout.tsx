import {
	Badge,
	Container,
	Group,
	parseThemeColor,
	Tabs,
	Text,
	Title,
	useMantineTheme,
} from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, Outlet, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import type { LatestCourseModuleSettings } from "server/json";
import {
	canSeeCourseModuleSettings,
	canSeeModuleSubmissions,
} from "server/utils/permissions";
import {
	getStatusBadgeColor,
	getStatusLabel,
} from "~/components/course-view-utils";
import { getModuleIcon } from "~/utils/module-helper";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-module-layout";
import classes from "./header-tabs.module.css";

enum ModuleTab {
	Preview = "preview",
	Setting = "setting",
	Submissions = "submissions",
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const { pageInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	if (!courseModuleContext) {
		throw new ForbiddenResponse("Module not found or access denied");
	}

	return {
		module: courseModuleContext.activityModule,
		moduleSettings: courseModuleContext.settings,
		course: courseContext.course,
		moduleLinkId: courseModuleContext.id,
		currentUser: currentUser,
		pageInfo: pageInfo,
		enrolment: enrolmentContext?.enrolment,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseModuleLayout({
	loaderData,
	params,
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const {
		module,
		moduleSettings,
		// moduleLinkId,
		pageInfo,
		currentUser,
		enrolment,
	} = loaderData;
	const { moduleLinkId } = params;

	const theme = useMantineTheme();
	// Determine current tab based on route matches
	const getCurrentTab = () => {
		if (pageInfo.isCourseModuleEdit) return ModuleTab.Setting;
		if (pageInfo.isCourseModuleSubmissions) return ModuleTab.Submissions;
		if (pageInfo.isCourseModule) return ModuleTab.Preview;

		// Default to Preview tab
		return ModuleTab.Preview;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		switch (value) {
			case ModuleTab.Preview:
				navigate(href("/course/module/:moduleLinkId", { moduleLinkId }));
				break;
			case ModuleTab.Setting:
				navigate(href("/course/module/:moduleLinkId/edit", { moduleLinkId }));
				break;
			case ModuleTab.Submissions:
				navigate(
					href("/course/module/:moduleLinkId/submissions", { moduleLinkId }),
				);
				break;
		}
	};

	const canSeeSetting = canSeeCourseModuleSettings(
		currentUser,
		enrolment,
	).allowed;
	const canSeeSubmissions = canSeeModuleSubmissions(
		currentUser,
		enrolment,
	).allowed;

	// Check if module type supports submissions
	const hasSubmissions = ["assignment", "quiz", "discussion"].includes(
		module.type,
	);
	const submissionTabLabel = module.type === "quiz" ? "Result" : "Submissions";

	return (
		<div>
			<div className={classes.header}>
				<Container size="xl" className={classes.mainSection}>
					<Group justify="space-between">
						<div>
							<Group gap="xs" mb="xs">
								<Title order={2}>{moduleSettings?.name ?? module.title}</Title>
								<Badge
									color={getStatusBadgeColor(module.status)}
									variant="light"
								>
									{getStatusLabel(module.status)}
								</Badge>
							</Group>
							<Group gap="xs" wrap="nowrap">
								{getModuleIcon(
									module.type as "quiz" | "assignment" | "discussion",
									16,
									parseThemeColor({ color: "dimmed", theme }).value,
								)}
								<Text c="dimmed" size="sm">
									{module.type.charAt(0).toUpperCase() + module.type.slice(1)}{" "}
									Module
								</Text>
							</Group>
						</div>
						<Tabs
							value={getCurrentTab()}
							onChange={handleTabChange}
							variant="outline"
							classNames={{
								root: classes.tabs,
								list: classes.tabsList,
								tab: classes.tab,
							}}
						>
							<Tabs.List>
								<Tabs.Tab
									value={ModuleTab.Preview}
									leftSection={
										(module.type === "quiz" ||
											module.type === "assignment" ||
											module.type === "discussion") &&
										getModuleIcon(
											module.type as "quiz" | "assignment" | "discussion",
											16,
										)
									}
								>
									{module.type.charAt(0).toUpperCase() + module.type.slice(1)}
								</Tabs.Tab>
								{canSeeSetting && (
									<Tabs.Tab value={ModuleTab.Setting}>Setting</Tabs.Tab>
								)}
								{hasSubmissions && canSeeSubmissions && (
									<Tabs.Tab value={ModuleTab.Submissions}>
										{submissionTabLabel}
									</Tabs.Tab>
								)}
							</Tabs.List>
						</Tabs>
					</Group>
				</Container>
			</div>
			<Outlet />
		</div>
	);
}
