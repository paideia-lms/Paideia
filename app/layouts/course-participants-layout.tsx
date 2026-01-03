import { Container, Tabs } from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, Outlet, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-participants-layout";
import classes from "./header-tabs.module.css";
import { typeCreateLoader } from "app/utils/loader-utils";

enum ParticipantsTab {
	Participants = "participants",
	Profile = "profile",
	Groups = "groups",
}

const createLoader = typeCreateLoader<Route.LoaderArgs>();

const createRouteLoader = createLoader({});

export const loader = createRouteLoader(async ({ context, params }) => {
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

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		pageInfo,
		params,
	};
})!;

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
		if (pageInfo.is["routes/course.$id.participants.profile"])
			return ParticipantsTab.Profile;
		if (pageInfo.is["routes/course.$id.groups"]) return ParticipantsTab.Groups;
		return ParticipantsTab.Participants;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		const courseId = course.id.toString();

		switch (value) {
			case ParticipantsTab.Participants:
				navigate(
					href("/course/:courseId/participants", { courseId: courseId }),
				);
				break;
			case ParticipantsTab.Profile:
				navigate(
					href("/course/:courseId/participants/profile", {
						courseId: courseId,
					}),
				);
				break;
			case ParticipantsTab.Groups:
				navigate(href("/course/:courseId/groups", { courseId: courseId }));
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
