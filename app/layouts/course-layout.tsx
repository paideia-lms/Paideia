import { Container, Group, Tabs, Text, Title } from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, Outlet, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-layout";
import classes from "./header-tabs.module.css";
import { typeCreateLoader } from "app/utils/loader-utils";
import { parseAsBoolean } from "nuqs";

enum CourseTab {
	Course = "course",
	Settings = "settings",
	Participants = "participants",
	Grades = "grades",
	Modules = "modules",
	Bin = "bin",
	Backup = "backup",
}

const createLoader = typeCreateLoader<Route.LoaderArgs>();

export const loaderSearchParams = {
	reload: parseAsBoolean.withDefault(false),
};

const createRouteLoader = createLoader({ searchParams: loaderSearchParams });

export const loader = createRouteLoader(
	async ({ context, params, searchParams }) => {
		const { pageInfo } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);
		const courseContext = context.get(courseContextKey);

		if (!userSession?.isAuthenticated) {
			throw new ForbiddenResponse("Unauthorized");
		}

		// Get course view data for tab context
		if (!courseContext) {
			throw new ForbiddenResponse("Course not found or access denied");
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		return {
			course: courseContext.course,
			currentUser: currentUser,
			pageInfo: pageInfo,
			enrolment: courseContext.enrolment,
			permissions: courseContext.permissions,
			params,
			searchParams,
		};
	},
)!;

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseLayout({ loaderData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const { course, pageInfo, permissions } = loaderData;

	// Determine current tab based on route matches
	const getCurrentTab = () => {
		if (pageInfo.is["routes/course.$id.settings"]) return CourseTab.Settings;
		if (pageInfo.is["routes/course.$id.participants/route"])
			return CourseTab.Participants;
		if (
			pageInfo.is["routes/course.$id.grades/route"] ||
			pageInfo.is["routes/course.$id.grades.singleview"]
		)
			return CourseTab.Grades;
		if (pageInfo.is["routes/course.$id.modules"]) return CourseTab.Modules;
		if (pageInfo.is["routes/course.$id.bin"]) return CourseTab.Bin;
		if (pageInfo.is["routes/course.$id.backup"]) return CourseTab.Backup;

		// Default to Course tab for the main course page
		return CourseTab.Course;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		const courseId = course.id.toString();

		switch (value) {
			case CourseTab.Course:
				navigate(href("/course/:courseId", { courseId: courseId }));
				break;
			case CourseTab.Settings:
				navigate(href("/course/:courseId/settings", { courseId: courseId }));
				break;
			case CourseTab.Participants:
				navigate(
					href("/course/:courseId/participants", { courseId: courseId }),
				);
				break;
			case CourseTab.Grades:
				navigate(href("/course/:courseId/grades", { courseId: courseId }));
				break;
			case CourseTab.Modules:
				navigate(href("/course/:courseId/modules", { courseId: courseId }));
				break;
			case CourseTab.Bin:
				navigate(href("/course/:courseId/bin", { courseId: courseId }));
				break;
			case CourseTab.Backup:
				navigate(href("/course/:courseId/backup", { courseId: courseId }));
				break;
		}
	};

	return (
		<div>
			<div className={classes.header}>
				<Container size="xl" className={classes.mainSection}>
					<Group justify="space-between">
						<div>
							<Title order={2} mb="xs">
								{course.title}
							</Title>
							<Text c="dimmed" size="sm">
								{course.slug}
							</Text>
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
								<Tabs.Tab value={CourseTab.Course}>Course</Tabs.Tab>
								{permissions.canSeeSettings.allowed && (
									<Tabs.Tab value={CourseTab.Settings}>Settings</Tabs.Tab>
								)}
								{permissions.canSeeParticipants.allowed && (
									<Tabs.Tab value={CourseTab.Participants}>
										Participants
									</Tabs.Tab>
								)}
								{permissions.canSeeGrades.allowed && (
									<Tabs.Tab value={CourseTab.Grades}>Grades</Tabs.Tab>
								)}
								{permissions.canSeeModules.allowed && (
									<Tabs.Tab value={CourseTab.Modules}>Modules</Tabs.Tab>
								)}
								{permissions.canSeeBin.allowed && (
									<Tabs.Tab value={CourseTab.Bin}>Recycle Bin</Tabs.Tab>
								)}
								{permissions.canSeeBackup.allowed && (
									<Tabs.Tab value={CourseTab.Backup}>Course Reuse</Tabs.Tab>
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
