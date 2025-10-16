import { Container, Paper, Text, Title } from "@mantine/core";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.bin";

export const loader = async ({
    context,
    params,
}: Route.LoaderArgs) => {
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    const courseId = Number.parseInt(params.id, 10);
    if (Number.isNaN(courseId)) {
        throw new ForbiddenResponse("Invalid course ID");
    }

    // TODO: Add course access check and fetch deleted items data
    return {
        courseId,
        deletedItems: [], // Placeholder data
    };
};

export default function CourseBinPage() {
    return (
        <Container size="lg" py="xl">
            <title>Recycle Bin | Course | Paideia LMS</title>
            <meta name="description" content="Course recycle bin" />
            <meta property="og:title" content="Recycle Bin | Course | Paideia LMS" />
            <meta property="og:description" content="Course recycle bin" />

            <Paper withBorder shadow="md" p="xl" radius="md">
                <Title order={2} mb="md">
                    Recycle Bin
                </Title>
                <Text c="dimmed">
                    This page will contain deleted items that can be restored.
                </Text>
            </Paper>
        </Container>
    );
}
