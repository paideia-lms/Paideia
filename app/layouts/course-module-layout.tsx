import {
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
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { getModuleIcon } from "~/utils/module-helper";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-module-layout";
import classes from "./header-tabs.module.css";
import { typeCreateLoader } from "app/utils/loader-utils";

enum ModuleTab {
	Preview = "preview",
	Setting = "setting",
	Submissions = "submissions",
}

const createLoader = typeCreateLoader<Route.LoaderArgs>();

const createRouteLoader = createLoader({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const { pageInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);

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
		enrolment: courseContext.enrolment,
		permissions: courseModuleContext.permissions,
		params,
	};
})!;

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
		permissions,
	} = loaderData;
	const { moduleLinkId } = params;

	const theme = useMantineTheme();
	// Determine current tab based on route matches
	const getCurrentTab = () => {
		if (pageInfo.is["routes/course/module.$id.edit"]) return ModuleTab.Setting;
		if (pageInfo.is["routes/course/module.$id.submissions/route"])
			return ModuleTab.Submissions;
		if (pageInfo.is["routes/course/module.$id/route"]) return ModuleTab.Preview;

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
								{permissions.canSeeSettings.allowed && (
									<Tabs.Tab value={ModuleTab.Setting}>Setting</Tabs.Tab>
								)}
								{hasSubmissions && permissions.canSeeSubmissions.allowed && (
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
