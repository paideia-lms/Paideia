import {
	ActionIcon,
	AppShell,
	Box,
	Container,
	Grid,
	Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
	IconLayoutSidebarLeftCollapse,
	IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import { Outlet } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { CourseStructureTree } from "~/components/course-structure-tree";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-content-layout";
import { typeCreateLoader } from "app/utils/loader-utils";

const createLoader = typeCreateLoader<Route.LoaderArgs>();

const createRouteLoader = createLoader({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const { pageInfo } = context.get(globalContextKey);
	const courseContext = context.get(courseContextKey);
	const userSession = context.get(userContextKey);

	if (!courseContext) {
		throw new ForbiddenResponse("Course not found");
	}
	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("User not authenticated");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	return {
		course: courseContext.course,
		courseStructure: courseContext.courseStructure,
		courseStructureTree: courseContext.courseStructureTree,
		courseStructureTreeSimple: courseContext.courseStructureTreeSimple,
		currentUser: currentUser,
		pageInfo: pageInfo,
		enrolment: courseContext.enrolment,
		canEdit: courseContext.permissions.canUpdateStructure.allowed,
		params,
	};
})!;

export default function CourseContentLayout({
	loaderData,
	params,
}: Route.ComponentProps) {
	const {
		course,
		courseStructure,
		canEdit,
		pageInfo
	} = loaderData;
	const { courseId, sectionId, moduleLinkId } = params;

	const [navbarOpened, { toggle: toggleNavbar }] = useDisclosure(true);

	return (
		<Container size="xl" p="xs">
			<AppShell>
				<AppShell.Main>
					<Grid columns={24}>
						<Grid.Col span={navbarOpened ? 8 : 1}>
							<Box p="xs">
								<Tooltip label="Toggle sidebar">
									<ActionIcon variant="light" onClick={toggleNavbar}>
										{navbarOpened ? (
											<IconLayoutSidebarLeftCollapse />
										) : (
											<IconLayoutSidebarLeftExpand />
										)}
									</ActionIcon>
								</Tooltip>
								{navbarOpened && (
									<CourseStructureTree
										currentItemId={
											pageInfo.is["routes/course/section.$id"]
												? `s${sectionId}`
												: pageInfo.is["layouts/course-module-layout"]
													? `m${moduleLinkId}`
													: undefined
										}
										readOnly={!canEdit}
										courseId={course.id}
										courseStructure={courseStructure}
										canSeeStatus={canEdit}
									/>
								)}
							</Box>
						</Grid.Col>
						<Grid.Col span={navbarOpened ? 16 : 23}>
							<Outlet />
						</Grid.Col>
					</Grid>
				</AppShell.Main>
			</AppShell>
		</Container>
	);
}
