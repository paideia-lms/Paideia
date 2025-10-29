import { Container, Group, Tabs, Text, Title } from "@mantine/core";
import { href, Outlet, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	canSeeCourseBackup,
	canSeeCourseBin,
	canSeeCourseGrades,
	canSeeCourseModules,
	canSeeCourseParticipants,
	canSeeCourseSettings,
} from "server/utils/permissions";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { ForbiddenResponse } from "~/utils/responses";
import type { RouteParams } from "~/utils/routes-utils";
import type { Route } from "./+types/course-layout";
import classes from "./header-tabs.module.css";

enum CourseTab {
	Course = "course",
	Settings = "settings",
	Participants = "participants",
	Grades = "grades",
	Modules = "modules",
	Bin = "bin",
	Backup = "backup",
}

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const { payload, pageInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);
	const { id } = params as RouteParams<"layouts/course-layout">;

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const courseId = Number.parseInt(id, 10);
	if (Number.isNaN(courseId)) {
		throw new ForbiddenResponse("Invalid course ID");
	}

	// Get course view data for tab context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const enrolment = enrolmentContext?.enrolment;

	const canSeeSettings = canSeeCourseSettings(currentUser, enrolment);
	const canSeeParticipants = canSeeCourseParticipants(currentUser, enrolment);
	const canSeeGrades = canSeeCourseGrades(currentUser, enrolment);
	const canSeeModules = canSeeCourseModules(currentUser, enrolment);
	const canSeeBin = canSeeCourseBin(currentUser, enrolment);
	const canSeeBackup = canSeeCourseBackup(currentUser, enrolment);

	return {
		course: courseContext.course,
		currentUser: currentUser,
		pageInfo: pageInfo,
		enrolment: enrolment,
		canSeeSettings: canSeeSettings,
		canSeeParticipants: canSeeParticipants,
		canSeeGrades: canSeeGrades,
		canSeeModules: canSeeModules,
		canSeeBin: canSeeBin,
		canSeeBackup: canSeeBackup,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseLayout({
	loaderData,
	matches,

}: Route.ComponentProps) {
	const navigate = useNavigate();
	const { course, pageInfo, canSeeSettings, canSeeParticipants, canSeeGrades, canSeeModules, canSeeBin, canSeeBackup } = loaderData;

	// Determine current tab based on route matches
	const getCurrentTab = () => {
		if (pageInfo.isCourseSettings) return CourseTab.Settings;
		if (pageInfo.isCourseParticipantsLayout) return CourseTab.Participants;
		if (pageInfo.isCourseGrades) return CourseTab.Grades;
		if (pageInfo.isCourseModules) return CourseTab.Modules;
		if (pageInfo.isCourseBin) return CourseTab.Bin;
		if (pageInfo.isCourseBackup) return CourseTab.Backup;

		// Default to Course tab for the main course page
		return CourseTab.Course;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		const courseId = course.id.toString();

		switch (value) {
			case CourseTab.Course:
				navigate(href("/course/:id", { id: courseId }));
				break;
			case CourseTab.Settings:
				navigate(href("/course/:id/settings", { id: courseId }));
				break;
			case CourseTab.Participants:
				navigate(href("/course/:id/participants", { id: courseId }));
				break;
			case CourseTab.Grades:
				navigate(href("/course/:id/grades", { id: courseId }));
				break;
			case CourseTab.Modules:
				navigate(href("/course/:id/modules", { id: courseId }));
				break;
			case CourseTab.Bin:
				navigate(href("/course/:id/bin", { id: courseId }));
				break;
			case CourseTab.Backup:
				navigate(href("/course/:id/backup", { id: courseId }));
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
								{canSeeSettings && (
									<Tabs.Tab value={CourseTab.Settings}>Settings</Tabs.Tab>
								)}
								{canSeeParticipants && (
									<Tabs.Tab value={CourseTab.Participants}>
										Participants
									</Tabs.Tab>
								)}
								{canSeeGrades && (
									<Tabs.Tab value={CourseTab.Grades}>Grades</Tabs.Tab>
								)}
								{canSeeModules && (
									<Tabs.Tab value={CourseTab.Modules}>Modules</Tabs.Tab>
								)}
								{canSeeBin && (
									<Tabs.Tab value={CourseTab.Bin}>Recycle Bin</Tabs.Tab>
								)}
								{canSeeBackup && (
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
