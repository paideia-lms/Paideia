import { Container, Group, Tabs, Text, Title } from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, Outlet, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseSectionContextKey } from "server/contexts/course-section-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { canSeeCourseSectionSettings } from "server/utils/permissions";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-section-layout";
import classes from "./header-tabs.module.css";

enum SectionTab {
	Section = "section",
	Setting = "setting",
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const { pageInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseSectionContext = context.get(courseSectionContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	if (!courseSectionContext) {
		throw new ForbiddenResponse("Section not found or access denied");
	}

	return {
		section: courseSectionContext,
		course: courseContext.course,
		currentUser: currentUser,
		pageInfo: pageInfo,
		enrolment: enrolmentContext?.enrolment,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseSectionLayout({
	loaderData,
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const { section, course, pageInfo, currentUser, enrolment } = loaderData;

	// Determine current tab based on route matches
	const getCurrentTab = () => {
		if (pageInfo.isCourseSectionEdit) return SectionTab.Setting;
		if (pageInfo.isCourseSection) return SectionTab.Section;

		// Default to Section tab
		return SectionTab.Section;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		const sectionId = section.id.toString();

		switch (value) {
			case SectionTab.Section:
				navigate(
					href("/course/section/:sectionId", { sectionId: String(sectionId) }),
				);
				break;
			case SectionTab.Setting:
				navigate(
					href("/course/section/:sectionId/edit", {
						sectionId: String(sectionId),
					}),
				);
				break;
		}
	};

	const canSeeSetting = canSeeCourseSectionSettings(
		currentUser,
		enrolment,
	).allowed;

	return (
		<div>
			<div className={classes.header}>
				<Container size="xl" className={classes.mainSection}>
					<Group justify="space-between">
						<div>
							<Title order={2} mb="xs">
								{section.title}
							</Title>
							<Text c="dimmed" size="sm">
								{section.description}
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
								<Tabs.Tab value={SectionTab.Section}>Section</Tabs.Tab>
								{canSeeSetting && (
									<Tabs.Tab value={SectionTab.Setting}>Setting</Tabs.Tab>
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
