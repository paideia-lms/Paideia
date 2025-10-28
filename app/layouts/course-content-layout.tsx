import { AppShell, Box, Container, Grid, Paper, Text } from "@mantine/core";
import { Outlet, useNavigation } from "react-router";
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

	return (
		<Container size="xl" p='xs'>
			<AppShell>
				<AppShell.Main>
					<Grid>
						<Grid.Col span={4}>
							<Box p="md">
								<CourseStructureTree
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
								/>
							</Box>
						</Grid.Col>
						<Grid.Col span={8}>
							<Outlet />
						</Grid.Col>
					</Grid>
				</AppShell.Main>
			</AppShell>
		</Container>
	);
}
