import {
    Badge,
    Button,
    Container,
    Group,
    Paper,
    Stack,
    Text,
    Title,
} from "@mantine/core";
import { Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindCourseActivityModuleLinkById } from "server/internal/course-activity-module-link-management";
import {
    getStatusBadgeColor,
    getStatusLabel,
} from "~/components/course-view-utils";
import {
    badRequest,
    ForbiddenResponse,
    ok,
} from "~/utils/responses";
import type { Route } from "./+types/module.$id";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
    const userSession = context.get(userContextKey);
    const enrolmentContext = context.get(enrolmentContextKey);
    const courseContext = context.get(courseContextKey);
    const payload = context.get(globalContextKey).payload;

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    const moduleLinkId = Number.parseInt(params.id, 10);
    if (Number.isNaN(moduleLinkId)) {
        return badRequest({
            error: "Invalid module link ID",
        });
    }

    // Get course context to ensure user has access to this course
    if (!courseContext) {
        throw new ForbiddenResponse("Course not found or access denied");
    }

    // Fetch the module link with depth to get the activity module
    const moduleLinkResult = await tryFindCourseActivityModuleLinkById(payload, moduleLinkId);

    if (!moduleLinkResult.ok) {
        throw new ForbiddenResponse("Module not found or access denied");
    }

    const moduleLink = moduleLinkResult.value;

    // Ensure the module link belongs to the current course
    if (typeof moduleLink.course === "object" && moduleLink.course.id !== courseContext.course.id) {
        throw new ForbiddenResponse("Module does not belong to this course");
    }

    return ok({
        moduleLink,
        course: courseContext.course,
    });
};

export default function ModulePage({ loaderData }: Route.ComponentProps) {
    if ("error" in loaderData) {
        return (
            <Container size="md" py="xl">
                <Paper withBorder shadow="md" p="xl" radius="md">
                    <Title order={2} mb="md" c="red">
                        Error
                    </Title>
                    <Text>{loaderData.error}</Text>
                </Paper>
            </Container>
        );
    }

    const { moduleLink, course } = loaderData;
    const activityModule = moduleLink.activityModule;

    // Handle different module types
    const renderModuleContent = () => {
        switch (activityModule.type) {
            case "page":
                return (
                    <div>
                        <Title order={3} mb="md">
                            Page Content
                        </Title>
                        <Text>This is a page module. Content rendering would go here.</Text>
                    </div>
                );
            case "assignment":
                return (
                    <div>
                        <Title order={3} mb="md">
                            Assignment
                        </Title>
                        <Text>This is an assignment module. Assignment details would go here.</Text>
                    </div>
                );
            case "quiz":
                return (
                    <div>
                        <Title order={3} mb="md">
                            Quiz
                        </Title>
                        <Text>This is a quiz module. Quiz questions would go here.</Text>
                    </div>
                );
            case "discussion":
                return (
                    <div>
                        <Title order={3} mb="md">
                            Discussion
                        </Title>
                        <Text>This is a discussion module. Discussion content would go here.</Text>
                    </div>
                );
            case "whiteboard":
                return (
                    <div>
                        <Title order={3} mb="md">
                            Whiteboard
                        </Title>
                        <Text>This is a whiteboard module. Whiteboard content would go here.</Text>
                    </div>
                );
            default:
                return (
                    <div>
                        <Title order={3} mb="md">
                            Unknown Module Type
                        </Title>
                        <Text>This module type is not yet supported.</Text>
                    </div>
                );
        }
    };

    return (
        <Container size="xl" py="xl">
            <title>{activityModule.title} | {course.title} | Paideia LMS</title>
            <meta name="description" content={`View ${activityModule.title} in ${course.title}`} />

            <Stack gap="xl">
                <Group justify="space-between" align="flex-start">
                    <div>
                        <Title order={1} mb="xs">
                            {activityModule.title}
                        </Title>
                        <Group gap="sm">
                            <Badge color={getStatusBadgeColor(activityModule.status)} variant="light">
                                {getStatusLabel(activityModule.status)}
                            </Badge>
                            <Text size="sm" c="dimmed">
                                {activityModule.type.charAt(0).toUpperCase() + activityModule.type.slice(1)} Module
                            </Text>
                        </Group>
                    </div>
                    <Button component={Link} to={`/course/${course.id}`} variant="light">
                        Back to Course
                    </Button>
                </Group>

                <Paper withBorder shadow="sm" p="xl">
                    {renderModuleContent()}
                </Paper>
            </Stack>
        </Container>
    );
}
