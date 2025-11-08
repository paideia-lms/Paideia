import { Button, Group, Stack, Switch, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetMaintenanceSettings,
	tryUpdateMaintenanceSettings,
} from "server/internal/maintenance-settings";
import { z } from "zod";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/maintenance";

type MaintenanceGlobal = {
	id: number;
	maintenanceMode?: boolean;
};

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

	const settings = await tryGetMaintenanceSettings({
		payload,
		// ! this is a system request, we don't care about access control
		overrideAccess: true,
	});

	if (!settings.ok) {
		throw new ForbiddenResponse("Failed to get maintenance settings");
	}

	return { settings: settings.value };
}

const inputSchema = z.object({
	maintenanceMode: z.preprocess((val) => {
		if (typeof val === "string") {
			return val === "true";
		}
		return Boolean(val);
	}, z.boolean().optional()),
});

export async function action({ request, context }: Route.ActionArgs) {
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

	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsed = inputSchema.safeParse(data);
	if (!parsed.success) {
		throw new ForbiddenResponse("Invalid payload");
	}
	const { maintenanceMode } = parsed.data;

	const updateResult = await tryUpdateMaintenanceSettings({
		payload,
		user: currentUser as unknown as import("server/payload-types").User,
		data: {
			maintenanceMode,
		},
		overrideAccess: false,
	});

	if (!updateResult.ok) {
		throw new ForbiddenResponse(updateResult.error.message);
	}

	return {
		success: true as const,
		settings: updateResult.value as unknown as MaintenanceGlobal,
	};
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const res = await serverAction();
	if (res?.success) {
		notifications.show({
			title: "Maintenance settings updated",
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

export function useUpdateMaintenanceConfig() {
	const fetcher = useFetcher<typeof clientAction>();
	const update = (data: { maintenanceMode: boolean }) => {
		const formData = new FormData();
		formData.set("maintenanceMode", data.maintenanceMode ? "true" : "false");
		fetcher.submit(formData, {
			method: "post",
			action: href("/admin/maintenance"),
		});
	};
	return { update, state: fetcher.state } as const;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

export default function AdminMaintenance({ loaderData }: Route.ComponentProps) {
	const { state, update } = useUpdateMaintenanceConfig();
	const {
		settings: { maintenanceMode },
	} = loaderData;

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			maintenanceMode,
		},
	});
	return (
		<Stack gap="md" my="lg">
			<Title order={2}>Maintenance Mode</Title>
			<Text c="dimmed" size="sm">
				When maintenance mode is enabled, only administrators can access the
				system. All other users will be blocked from logging in.
			</Text>
			<form
				method="post"
				onSubmit={form.onSubmit((values) => {
					update({
						maintenanceMode: values.maintenanceMode ?? false,
					});
				})}
			>
				<Stack gap="sm">
					<Switch
						{...form.getInputProps("maintenanceMode", { type: "checkbox" })}
						key={form.key("maintenanceMode")}
						label="Enable Maintenance Mode"
					/>
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
