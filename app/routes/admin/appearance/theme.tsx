import { Button, Group, Select, Stack, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
    tryGetAppearanceSettings,
    tryUpdateAppearanceSettings,
} from "server/internal/appearance-settings";
import { z } from "zod";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import {
    badRequest,
    ForbiddenResponse,
    forbidden,
    ok,
    unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/theme";

type AppearanceGlobal = {
    id: number;
    color?: string;
    radius?: "xs" | "sm" | "md" | "lg" | "xl";
};

const validColors = [
    "blue",
    "pink",
    "indigo",
    "green",
    "orange",
    "gray",
    "grape",
    "cyan",
    "lime",
    "red",
    "violet",
    "teal",
    "yellow",
] as const;

const validRadius = ["xs", "sm", "md", "lg", "xl"] as const;

const inputSchema = z.object({
    color: z.enum([...validColors] as [string, ...string[]]).optional(),
    radius: z.enum([...validRadius] as [string, ...string[]]).optional(),
});

export async function loader({ context }: Route.LoaderArgs) {
    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }
    const currentUser =
        userSession.effectiveUser ?? userSession.authenticatedUser;
    if (currentUser.role !== "admin") {
        throw new ForbiddenResponse("Only admins can access this area");
    }

    const settings = await tryGetAppearanceSettings({
        payload,
        // ! this is a system request, we don't care about access control
        overrideAccess: true,
    });

    if (!settings.ok) {
        throw new ForbiddenResponse("Failed to get appearance settings");
    }

    return { settings: settings.value };
}

export async function action({ request, context }: Route.ActionArgs) {
    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);
    if (!userSession?.isAuthenticated) {
        return unauthorized({ error: "Unauthorized" });
    }
    const currentUser =
        userSession.effectiveUser ?? userSession.authenticatedUser;
    if (currentUser.role !== "admin") {
        return forbidden({ error: "Only admins can access this area" });
    }

    const { data } = await getDataAndContentTypeFromRequest(request);

    const parsed = inputSchema.safeParse(data);
    if (!parsed.success) {
        return badRequest({ error: z.prettifyError(parsed.error) });
    }
    const { color, radius } = parsed.data;

    const updateResult = await tryUpdateAppearanceSettings({
        payload,
        user: {
            ...currentUser,
            avatar: currentUser.avatar?.id,
        },
        data: {
            color,
            radius: radius as "xs" | "sm" | "md" | "lg" | "xl" | undefined,
        },
        overrideAccess: false,
    });

    if (!updateResult.ok) {
        return forbidden({ error: updateResult.error.message });
    }

    return ok({
        success: true as const,
        settings: updateResult.value as unknown as AppearanceGlobal,
    });
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
    const res = await serverAction();
    if (res?.status === 200) {
        notifications.show({
            title: "Theme settings updated",
            message: "Your changes have been saved.",
            color: "green",
        });
    } else {
        notifications.show({
            title: "Failed to update",
            message: typeof res?.error === "string" ? res.error : "Unexpected error",
            color: "red",
        });
    }
    return res;
}

export function useUpdateTheme() {
    const fetcher = useFetcher<typeof clientAction>();
    const update = (data: {
        color?: string;
        radius?: "xs" | "sm" | "md" | "lg" | "xl";
    }) => {
        fetcher.submit(data, {
            method: "post",
            action: href("/admin/appearance/theme"),
            encType: "application/json",
        });
    };
    return { update, state: fetcher.state } as const;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    return <DefaultErrorBoundary error={error} />;
}

export default function AdminTheme({ loaderData }: Route.ComponentProps) {
    const { state, update } = useUpdateTheme();
    const {
        settings: { color, radius },
    } = loaderData;

    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            color: color ?? "blue",
            radius: radius ?? "sm",
        },
    });

    return (
        <Stack gap="md" my="lg">
            <title>Theme Settings | Admin | Paideia LMS</title>
            <meta
                name="description"
                content="Configure theme settings including primary color and border radius."
            />
            <meta
                property="og:title"
                content="Theme Settings | Admin | Paideia LMS"
            />
            <meta
                property="og:description"
                content="Configure theme settings including primary color and border radius."
            />
            <Title order={2}>Theme Settings</Title>

            <form
                method="post"
                onSubmit={form.onSubmit((values) => {
                    update({
                        color: values.color,
                        radius: values.radius,
                    });
                })}
            >
                <Stack gap="md">
                    {/* Theme Color Selection */}
                    <div>
                        <Text size="sm" fw={500} mb="xs">
                            Primary Color
                        </Text>
                        <Text c="dimmed" size="sm" mb="sm">
                            Select the primary color theme for the application. This affects
                            buttons, links, and other interactive elements.
                        </Text>
                        <Group gap="xs">
                            {validColors.map((colorValue) => {
                                const isSelected = form.getValues().color === colorValue;
                                return (
                                    <Button
                                        key={colorValue}
                                        variant={isSelected ? "filled" : "outline"}
                                        color={colorValue}
                                        onClick={() => {
                                            form.setFieldValue("color", colorValue);
                                        }}
                                        style={{
                                            textTransform: "capitalize",
                                            minWidth: 80,
                                        }}
                                    >
                                        {colorValue}
                                    </Button>
                                );
                            })}
                        </Group>
                    </div>

                    {/* Border Radius Selection */}
                    <div>
                        <Text size="sm" fw={500} mb="xs">
                            Border Radius
                        </Text>
                        <Text c="dimmed" size="sm" mb="sm">
                            Select the default border radius for components. This affects
                            buttons, cards, inputs, and other elements.
                        </Text>
                        <Select
                            {...form.getInputProps("radius")}
                            key={form.key("radius")}
                            data={[
                                { value: "xs", label: "Extra Small" },
                                { value: "sm", label: "Small" },
                                { value: "md", label: "Medium" },
                                { value: "lg", label: "Large" },
                                { value: "xl", label: "Extra Large" },
                            ]}
                            style={{ maxWidth: 300 }}
                        />
                    </div>

                    <Group justify="flex-start" mt="sm">
                        <Button type="submit" loading={state !== "idle"}>
                            Save changes
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Stack>
    );
}

