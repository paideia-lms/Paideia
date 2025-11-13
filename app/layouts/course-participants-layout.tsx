import { Container, Tabs } from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, Outlet, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-participants-layout";
import classes from "./header-tabs.module.css";

enum ParticipantsTab {
	Participants = "participants",
	Profile = "profile",
	Groups = "groups",
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

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		pageInfo,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function CourseParticipantsLayout({
	loaderData,
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const { course, pageInfo } = loaderData;

	// Determine current tab based on page info
	const getCurrentTab = () => {
		if (pageInfo.isCourseParticipantsProfile) return ParticipantsTab.Profile;
		if (pageInfo.isCourseGroups) return ParticipantsTab.Groups;
		return ParticipantsTab.Participants;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		const courseId = course.id.toString();

		switch (value) {
			case ParticipantsTab.Participants:
				navigate(href("/course/:id/participants", { id: courseId }));
				break;
			case ParticipantsTab.Profile:
				navigate(href("/course/:id/participants/profile", { id: courseId }));
				break;
			case ParticipantsTab.Groups:
				navigate(href("/course/:id/groups", { id: courseId }));
				break;
		}
	};

	return (
		<Container size="xl" py="xl">
			<title>{`${course.title} - Participants | Paideia LMS`}</title>
			<meta
				name="description"
				content={`${course.title} participants management`}
			/>
			<meta
				property="og:title"
				content={`${course.title} - Participants | Paideia LMS`}
			/>
			<meta
				property="og:description"
				content={`${course.title} participants management`}
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
					<Tabs.Tab value={ParticipantsTab.Participants}>Participants</Tabs.Tab>
					<Tabs.Tab value={ParticipantsTab.Profile}>Profile</Tabs.Tab>
					<Tabs.Tab value={ParticipantsTab.Groups}>Groups</Tabs.Tab>
				</Tabs.List>
			</Tabs>

			<Outlet />
		</Container>
	);
}
