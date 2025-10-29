import { ActionIcon, AppShell, Box, Container, Grid, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import { Outlet } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { canUpdateCourseStructure } from "server/utils/permissions";
import { CourseStructureTree } from "~/components/course-structure-tree";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-content-layout";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const { pageInfo } = context.get(globalContextKey);
	const courseContext = context.get(courseContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const userSession = context.get(userContextKey);

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found");
	}
	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("User not authenticated");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	console.log("courseStructureTree", courseContext.courseStructureTree);

	return {
		course: courseContext.course,
		courseStructure: courseContext.courseStructure,
		courseStructureTree: courseContext.courseStructureTree,
		courseStructureTreeSimple: courseContext.courseStructureTreeSimple,
		currentUser: currentUser,
		pageInfo: pageInfo,
		enrolment: enrolmentContext?.enrolment,
	};
};

export default function CourseContentLayout({
	loaderData,
	params,
}: Route.ComponentProps) {
	const {
		course,
		courseStructure,
		currentUser,
		enrolment,
		pageInfo: { isCourseSection, isCourseModule },
	} = loaderData;
	const { id } = params;

	const canEdit = canUpdateCourseStructure(currentUser, enrolment);
	const [navbarOpened, { toggle: toggleNavbar }] = useDisclosure(true);

	return (
		<Container size="xl" p='xs'>
			<AppShell>
				<AppShell.Main>
					<Grid columns={24}>
						<Grid.Col span={navbarOpened ? 8 : 1}>
							<Box p="xs">
								<Tooltip label="Toggle sidebar">
									<ActionIcon variant="light" onClick={toggleNavbar}>
										{navbarOpened ? <IconLayoutSidebarLeftCollapse /> : <IconLayoutSidebarLeftExpand />}
									</ActionIcon>
								</Tooltip>
								{navbarOpened && <CourseStructureTree
									currentItemId={
										isCourseSection
											? `s${id}`
											: isCourseModule
												? `m${id}`
												: undefined
									}
									readOnly={!canEdit}
									courseId={course.id}
									courseStructure={courseStructure}
									canSeeStatus={canEdit}
								/>}
							</Box>
						</Grid.Col>
						<Grid.Col span={navbarOpened ? 16 : 23}>
							<Outlet />
						</Grid.Col>
					</Grid>
				</AppShell.Main>
			</AppShell>
		</Container >
	);
}
