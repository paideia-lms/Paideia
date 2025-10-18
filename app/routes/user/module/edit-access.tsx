import { Container, Paper, Title } from "@mantine/core";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";

import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/edit-access";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    const currentUser =
        userSession.effectiveUser || userSession.authenticatedUser;

    return {}
};

export default function UserModuleEditAccess({
    loaderData,
}: Route.ComponentProps) {

    return (
        <Container size="xl" py="xl">
            <Paper withBorder shadow="sm" p="xl" radius="md">
                <Title order={3} mb="lg">
                    Access Control
                </Title>

            </Paper>
        </Container>
    );
}

