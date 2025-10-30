import { Button, Group, Stack, Switch, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/registration";
import { z } from "zod";
import { useForm } from "@mantine/form";

type RegistrationGlobal = {
    id: number;
    disableRegistration?: boolean;
    showRegistrationButton?: boolean;
};

export async function loader({ context }: Route.LoaderArgs) {
    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }
    const currentUser = userSession.effectiveUser ?? userSession.authenticatedUser;
    if (currentUser.role !== "admin") {
        throw new ForbiddenResponse("Only admins can access this area");
    }

    const global = (await payload.findGlobal({
        slug: "registration-settings",
        user: currentUser,
        overrideAccess: false,
    })) as unknown as RegistrationGlobal;

    return { settings: global };
}

export async function action({ request, context }: Route.ActionArgs) {
    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);
    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }
    const currentUser = userSession.effectiveUser ?? userSession.authenticatedUser;
    if (currentUser.role !== "admin") {
        throw new ForbiddenResponse("Only admins can access this area");
    }

    const { data } = await getDataAndContentTypeFromRequest(request);
    const schema = z.object({
        disableRegistration: z.coerce.boolean().optional(),
        showRegistrationButton: z.coerce.boolean().optional(),
    });
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        throw new ForbiddenResponse("Invalid payload");
    }
    const disableRegistration = Boolean(parsed.data.disableRegistration);
    const showRegistrationButton = Boolean(parsed.data.showRegistrationButton);

    const updated = (await payload.updateGlobal({
        slug: "registration-settings",
        data: { disableRegistration, showRegistrationButton },
        user: currentUser,
        overrideAccess: false,
    })) as unknown as RegistrationGlobal;

    return { success: true as const, settings: updated };
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
    const res = await serverAction();
    if (res?.success) {
        notifications.show({
            title: "Registration settings updated",
            message: "Your changes have been saved.",
            color: "green",
        });
    } else {
        notifications.show({
            title: "Failed to update",
            message: "Unexpected error",
            color: "red",
        });
    }
    return res;
}


export function useUpdateRegistrationConfig() {
    const fetcher = useFetcher<typeof clientAction>();
    const update = (data: { disableRegistration: boolean; showRegistrationButton: boolean }) => {
        const formData = new FormData();
        formData.set("disableRegistration", String(data.disableRegistration));
        formData.set("showRegistrationButton", String(data.showRegistrationButton));
        fetcher.submit(formData, { method: "post", action: href("/admin/registration") });
    };
    return { update, state: fetcher.state, fetcher } as const;
}




export default function AdminRegistration({ loaderData }: Route.ComponentProps) {
    const { state, fetcher } = useUpdateRegistrationConfig();
    const initial = loaderData.settings;


    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            disableRegistration: initial.disableRegistration,
            showRegistrationButton: initial.showRegistrationButton,
        },
    });
    return (
        <Stack gap="md" my="lg">
            <Title order={2}>Registration</Title>
            <fetcher.Form method="post">
                <Stack gap="sm">
                    <Switch
                        {...form.getInputProps("disableRegistration")}
                        key={form.key("disableRegistration")}
                        label="Disable Self-Registration"
                    />
                    {!form.values.disableRegistration && <Switch
                        {...form.getInputProps("showRegistrationButton")}
                        key={form.key("showRegistrationButton")}
                        label="Show Registration Button"
                    />}
                    <Group justify="flex-start" mt="sm">
                        <Button type="submit" loading={state !== "idle"}>
                            Save changes
                        </Button>
                    </Group>
                </Stack>
            </fetcher.Form>
        </Stack>
    );
}


