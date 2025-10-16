import { courseContextKey } from "server/contexts/course-context";
import type { Route } from "./+types/course-content-layout";

import { AppShell, Grid, ScrollArea } from "@mantine/core";
import { Outlet } from "react-router";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import { globalContextKey } from "server/contexts/global-context";
// TODO: Update CourseStructureTree to use new course-sections system
// import { CourseStructureTree } from "~/routes/api/course-structure-tree";
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

    const currentUser = userSession.effectiveUser || userSession.authenticatedUser;

    return {
        course: courseContext.course,
        currentUser: currentUser,
        pageInfo: pageInfo,
        enrolment: enrolmentContext?.enrolment,
    };
};

export default function CourseContentLayout({ loaderData }: Route.ComponentProps) {
    const { course, currentUser } = loaderData;

    // Check if user can edit the course structure
    const canEdit =
        currentUser.role === "admin" ||
        currentUser.role === "content-manager" ||
        course.createdBy.id === currentUser.id;

    // Transform module links to the format expected by the tree
    const moduleLinks = course.moduleLinks.map(link => ({
        id: link.id,
        activityModule: {
            id: link.activityModule.id,
            title: link.activityModule.title,
            type: link.activityModule.type,
            status: link.activityModule.status,
        },
    }));

    return (
        <AppShell>
            <AppShell.Main>
                <Grid>
                    <Grid.Col span={4}>
                        <ScrollArea h="100vh" p="md">
                            {/* TODO: Update CourseStructureTree to use new course-sections system */}
                            {/* <CourseStructureTree
                                structure={course.structure}
                                moduleLinks={moduleLinks}
                                readOnly={!canEdit}
                                courseId={course.id}
                            /> */}
                            <div>Course structure will be updated to use sections</div>
                        </ScrollArea>
                    </Grid.Col>
                    <Grid.Col span={8}>
                        <Outlet />
                    </Grid.Col>
                </Grid>
            </AppShell.Main>
        </AppShell>
    );
}