import { Button, Menu } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import React from "react";
import { href, redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { removeImpersonationCookie } from "~/utils/cookie";
import { badRequest, StatusCode, unauthorized } from "~/utils/responses";
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

	// Get redirect URL from form data, default to "/"
	const formData = await request.formData();
	const redirectTo = (formData.get("redirectTo") as string) ?? "/";

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
};

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

// Custom hook for stopping impersonation
export function useStopImpersonating() {
	const fetcher = useFetcher<typeof clientAction>();

	const stopImpersonating = (redirectTo?: string) => {
		const formData = new FormData();
		if (redirectTo) {
			formData.append("redirectTo", redirectTo);
		}
		fetcher.submit(formData, {
			method: "POST",
			action: href("/api/stop-impersonation"),
		});
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
	redirectTo,
	...props
}: {
	size?: "xs" | "sm" | "md" | "lg" | "xl";
	variant?: "filled" | "light" | "outline" | "subtle" | "default";
	color?: string;
	redirectTo?: string;
} & React.ComponentProps<typeof Button>) {
	const { stopImpersonating, isLoading } = useStopImpersonating();

	return (
		<Button
			size={size}
			color={color}
			variant={variant}
			onClick={() => stopImpersonating(redirectTo)}
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
	const { stopImpersonating, isLoading } = useStopImpersonating();

	return (
		<Menu.Item
			ref={ref}
			leftSection={leftSection}
			color={color}
			onClick={() => stopImpersonating(redirectTo)}
			disabled={isLoading}
			{...props}
		>
			Stop Impersonating
		</Menu.Item>
	);
});

StopImpersonatingMenuItem.displayName = "StopImpersonatingMenuItem";
