import { Container, Paper, Text, Title } from "@mantine/core";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.participants";
import { courseContextKey } from "server/contexts/course-context";

export const loader = async ({
    context,
    params,
}: Route.LoaderArgs) => {
    const userSession = context.get(userContextKey);
    const courseContext = context.get(courseContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    const courseId = Number.parseInt(params.id, 10);


    if (Number.isNaN(courseId)) {
        throw new ForbiddenResponse("Invalid course ID");
    }

    if (!courseContext) {
        throw new ForbiddenResponse("Course not found");
    }

    // TODO: Add course access check and fetch participants data
    return {
        courseId,
        participants: courseContext.course.enrollments,
    };
};

export default function CourseParticipantsPage() {
    return (
        <Container size="lg" py="xl">
            <title>Participants | Course | Paideia LMS</title>
            <meta name="description" content="Course participants management" />
            <meta property="og:title" content="Participants | Course | Paideia LMS" />
            <meta property="og:description" content="Course participants management" />

            <Paper withBorder shadow="md" p="xl" radius="md">
                <Title order={2} mb="md">
                    Course Participants
                </Title>
                <Text c="dimmed">
                    This page will contain participant management functionality.
                </Text>
            </Paper>
        </Container>
    );
}
