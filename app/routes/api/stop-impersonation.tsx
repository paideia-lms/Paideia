import { Button, Menu } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import React from "react";
import { href, redirect } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { z } from "zod";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { removeImpersonationCookie } from "~/utils/cookie";
import { badRequest, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/stop-impersonation";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createStopImpersonationActionRpc = createActionRpc({
	formDataSchema: z.object({
		redirectTo: z.string().optional(),
	}),
	method: "POST",
});

export function getRouteUrl() {
	return href("/api/stop-impersonation");
}

const [stopImpersonationAction, useStopImpersonating] =
	createStopImpersonationActionRpc(
		serverOnly$(async ({ context, formData, request }) => {
			const payload = context.get(globalContextKey).payload;
			const requestInfo = context.get(globalContextKey).requestInfo;
			const userSession = context.get(userContextKey);

			if (!userSession?.isAuthenticated) {
				return unauthorized({ error: "Unauthorized" });
			}

			if (!userSession.isImpersonating) {
				return badRequest({ error: "Not currently impersonating" });
			}

			// Get redirect URL from form data, default to "/"
			const redirectTo = formData.redirectTo ?? "/";

			// Remove impersonation cookie and redirect
			return redirect(redirectTo, {
				headers: {
					"Set-Cookie": removeImpersonationCookie(
						requestInfo.domainUrl,
						request.headers,
						payload,
					),
				},
			});
		})!,
		{
			action: getRouteUrl,
		},
	);

// Export hook for use in components
export { useStopImpersonating };

export const action = stopImpersonationAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}

	return actionData;
}

// Button component for profile page
export function StopImpersonatingButton({
	size = "xs",
	variant = "light",
	color = "orange",
	redirectTo,
	...props
}: {
	size?: "xs" | "sm" | "md" | "lg" | "xl";
	variant?: "filled" | "light" | "outline" | "subtle" | "default";
	color?: string;
	redirectTo?: string;
} & React.ComponentProps<typeof Button>) {
	const { submit: stopImpersonating, isLoading } = useStopImpersonating();

	return (
		<Button
			size={size}
			color={color}
			variant={variant}
			onClick={() =>
				stopImpersonating({
					values: {
						...(redirectTo && { redirectTo }),
					},
				})
			}
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
		redirectTo?: string;
	} & React.ComponentProps<typeof Menu.Item>
>(({ leftSection, color = "orange", redirectTo, ...props }, ref) => {
	const { submit: stopImpersonating, isLoading } = useStopImpersonating();

	return (
		<Menu.Item
			ref={ref}
			leftSection={leftSection}
			color={color}
			onClick={() =>
				stopImpersonating({
					values: {
						...(redirectTo && { redirectTo }),
					},
				})
			}
			disabled={isLoading}
			{...props}
		>
			Stop Impersonating
		</Menu.Item>
	);
});

StopImpersonatingMenuItem.displayName = "StopImpersonatingMenuItem";
