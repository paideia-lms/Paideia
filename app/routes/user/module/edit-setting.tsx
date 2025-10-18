import {
    Button,
    Checkbox,
    Container,
    NumberInput,
    Paper,
    Select,
    Stack,
    Textarea,
    TextInput,
    Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { href, redirect } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
    tryGetActivityModuleById,
    tryUpdateActivityModule,
} from "server/internal/activity-module-management";
import { canManageActivityModules } from "server/utils/permissions";
import { z } from "zod";
import {
    type ActivityModuleFormValues,
    activityModuleSchema,
    transformFormValues,
    transformToActivityData,
} from "~/utils/activity-module-schema";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import {
    BadRequestResponse,
    ForbiddenResponse,
    InternalServerErrorResponse,
    NotFoundResponse,
} from "~/utils/responses";
import type { Route } from "./+types/edit-setting";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    return {}
};



export default function UserModuleEditSetting({
    loaderData,
}: Route.ComponentProps) {


    return (
        <Container size="xl" py="xl">
            <Paper withBorder shadow="sm" p="xl" radius="md">
                <Title order={3} mb="lg">
                    Module Settings
                </Title>

            </Paper>
        </Container>
    );
}

