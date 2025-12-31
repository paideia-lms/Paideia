import { Container, Tabs } from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { parseAsStringEnum } from "nuqs";
import { href, Outlet, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { permissions } from "server/utils/permissions";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-grades-layout";
import classes from "./header-tabs.module.css";
import { typeCreateLoader } from "app/utils/loader-utils";

enum GradesTab {
	Report = "report",
	Setup = "setup",
	SingleView = "singleview",
}

const createLoader = typeCreateLoader<Route.LoaderArgs>();

const createRouteLoader = createLoader({
	searchParams: {
		tab: parseAsStringEnum([
			GradesTab.Report,
			GradesTab.Setup,
			GradesTab.SingleView,
		]).withDefault(GradesTab.Report),
	},
});

export const loader = createRouteLoader(async ({ context, searchParams }) => {
	const { pageInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if user can see course grades
	const canSeeGrades = permissions.course.canSeeGrades(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrolmentContext?.enrolment
			? {
					id: enrolmentContext.enrolment.id,
					role: enrolmentContext.enrolment.role,
				}
			: undefined,
	);

	if (!canSeeGrades) {
		throw new ForbiddenResponse(
			"You don't have permission to view course grades",
		);
	}

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		pageInfo,
		tab: searchParams.tab,
	};
})!;

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseGradesLayout({
	loaderData,
}: Route.ComponentProps) {
	const { course, pageInfo, tab } = loaderData;
	const navigate = useNavigate();

	// Determine current tab based on route matches
	const getCurrentTab = () => {
		if (pageInfo.is["routes/course.$id.grades.singleview"])
			return GradesTab.SingleView;
		if (tab === GradesTab.Setup) return GradesTab.Setup;
		// Default to Report tab
		return GradesTab.Report;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		const courseId = course.id.toString();

		switch (value) {
			case GradesTab.Report:
				navigate(href("/course/:courseId/grades", { courseId }));
				break;
			case GradesTab.Setup:
				navigate(href("/course/:courseId/grades", { courseId }) + "?tab=setup");
				break;
			case GradesTab.SingleView:
				navigate(href("/course/:courseId/grades/singleview", { courseId }));
				break;
		}
	};

	return (
		<Container size="xl" py="xl">
			<title>{`${course.title} - Grades | Paideia LMS`}</title>
			<meta name="description" content={`${course.title} grades management`} />
			<meta
				property="og:title"
				content={`${course.title} - Grades | Paideia LMS`}
			/>
			<meta
				property="og:description"
				content={`${course.title} grades management`}
			/>

			<Tabs
				value={getCurrentTab()}
				onChange={handleTabChange}
				variant="outline"
				mb="md"
				classNames={{
					root: classes.tabs,
					list: classes.tabsList,
					tab: classes.tab,
				}}
			>
				<Tabs.List>
					<Tabs.Tab value={GradesTab.Report}>Grader Report</Tabs.Tab>
					<Tabs.Tab value={GradesTab.Setup}>Gradebook Setup</Tabs.Tab>
					<Tabs.Tab value={GradesTab.SingleView}>Single View</Tabs.Tab>
				</Tabs.List>
			</Tabs>

			<Outlet />
		</Container>
	);
}
