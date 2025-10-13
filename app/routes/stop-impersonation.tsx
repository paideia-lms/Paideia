import { redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { removeImpersonationCookie } from "~/utils/cookie";
import { badRequest, StatusCode, unauthorized } from "~/utils/responses";
import { notifications } from "@mantine/notifications";
import { Button, Menu } from "@mantine/core";
import React from "react";
import type { Route } from "./+types/stop-impersonation";

export const action = async ({ request, context }: Route.ActionArgs) => {
    const payload = context.get(globalContextKey).payload;
    const requestInfo = context.get(globalContextKey).requestInfo;
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        return unauthorized({ error: "Unauthorized" });
    }

    if (!userSession.isImpersonating) {
        return badRequest({ error: "Not currently impersonating" });
    }

    // Remove impersonation cookie and redirect to admin's profile
    throw redirect("/", {
        headers: {
            "Set-Cookie": removeImpersonationCookie(
                requestInfo.domainUrl,
                request.headers,
                payload,
            ),
        },
    });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
    const actionData = await serverAction();

    if (actionData?.status === StatusCode.BadRequest || actionData?.status === StatusCode.Unauthorized) {
        notifications.show({
            title: "Error",
            message: actionData.error,
            color: "red",
        });
    }

    return actionData;
}

// Custom hook for stopping impersonation
export function useStopImpersonating() {
    const fetcher = useFetcher<typeof clientAction>();

    const stopImpersonating = () => {
        fetcher.submit({}, { method: "POST", action: "/stop-impersonation" });
    };

    return {
        stopImpersonating,
        isLoading: fetcher.state === "submitting",
    };
}

// Button component for profile page
export function StopImpersonatingButton({
    size = "xs",
    variant = "light",
    color = "orange",
    ...props
}: {
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    variant?: "filled" | "light" | "outline" | "subtle" | "default";
    color?: string;
} & React.ComponentProps<typeof Button>) {
    const { stopImpersonating, isLoading } = useStopImpersonating();

    return (
        <Button
            size={size}
            color={color}
            variant={variant}
            onClick={stopImpersonating}
            loading={isLoading}
            {...props}
        >
            Stop Impersonating
        </Button>
    );
}

// Menu item component for root layout
export const StopImpersonatingMenuItem = React.forwardRef<
    HTMLButtonElement,
    {
        leftSection?: React.ReactNode;
        color?: string;
    } & React.ComponentProps<typeof Menu.Item>
>(({ leftSection, color = "orange", ...props }, ref) => {
    const { stopImpersonating, isLoading } = useStopImpersonating();

    return (
        <Menu.Item
            ref={ref}
            leftSection={leftSection}
            color={color}
            onClick={stopImpersonating}
            disabled={isLoading}
            {...props}
        >
            Stop Impersonating
        </Menu.Item>
    );
});

StopImpersonatingMenuItem.displayName = "StopImpersonatingMenuItem";
