import { Container, Tabs } from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { useQueryState } from "nuqs";
import { Outlet } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { canSeeCourseGrades } from "server/utils/permissions";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-grades-layout";
import classes from "./header-tabs.module.css";

enum GradesTab {
	Report = "report",
	Setup = "setup",
}

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const { pageInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		throw new BadRequestResponse("Invalid course ID");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if user can see course grades
	const canSeeGrades = canSeeCourseGrades(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrolmentContext?.enrolment
			? {
					id: enrolmentContext.enrolment.id,
					userId: enrolmentContext.enrolment.userId,
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
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseGradesLayout({
	loaderData,
}: Route.ComponentProps) {
	const { course } = loaderData;
	const [activeTab, setActiveTab] = useQueryState("tab", {
		defaultValue: GradesTab.Report,
	});

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
				value={activeTab ?? GradesTab.Report}
				onChange={(value) => setActiveTab(value)}
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
				</Tabs.List>
			</Tabs>

			<Outlet />
		</Container>
	);
}
