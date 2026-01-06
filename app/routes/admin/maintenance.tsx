import { Button, Group, Stack, Switch, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { createActionMap, typeCreateActionRpc } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetMaintenanceSettings,
	tryUpdateMaintenanceSettings,
} from "server/internal/maintenance-settings";
import { z } from "zod";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/maintenance";

enum Action {
	Update = "update",
}

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);

	const settings = await tryGetMaintenanceSettings({
		payload,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to get maintenance settings");
	});

	return { settings };
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/admin/maintenance",
});

const updateMaintenanceRpc = createActionRpc({
	formDataSchema: z.object({
		maintenanceMode: z.boolean().optional(),
	}),
	method: "POST",
	action: Action.Update,
});

const updateMaintenanceAction = updateMaintenanceRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({
				success: false,
				error: "Unauthorized",
			});
		}

		if (currentUser.role !== "admin") {
			return forbidden({
				success: false,
				error: "Only admins can access this area",
			});
		}

		const { maintenanceMode } = formData;

		const updateResult = await tryUpdateMaintenanceSettings({
			payload,
			req: payloadRequest,
			data: {
				maintenanceMode,
			},
		});

		if (!updateResult.ok) {
			return badRequest({
				success: false,
				error: updateResult.error.message,
			});
		}

		return ok({
			success: true,
			settings: updateResult.value,
		});
	},
);

const useUpdateMaintenance = updateMaintenanceRpc.createHook<
	typeof updateMaintenanceAction
>();

// Export hook for use in component
export { useUpdateMaintenance };

const [action] = createActionMap({
	[Action.Update]: updateMaintenanceAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Maintenance settings updated",
			message: "Your changes have been saved.",
			color: "green",
		});
	} else if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized ||
		actionData?.status === StatusCode.Forbidden
	) {
		notifications.show({
			title: "Failed to update",
			message: actionData?.error || "Failed to update maintenance settings",
			color: "red",
		});
	}

	return actionData;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

export default function AdminMaintenance({ loaderData }: Route.ComponentProps) {
	const { submit: updateMaintenance, isLoading } = useUpdateMaintenance();
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
			<title>Maintenance Mode | Admin | Paideia LMS</title>
			<meta name="description" content="Configure maintenance mode settings" />
			<meta
				property="og:title"
				content="Maintenance Mode | Admin | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Configure maintenance mode settings"
			/>
			<Title order={2}>Maintenance Mode</Title>
			<Text c="dimmed" size="sm">
				When maintenance mode is enabled, only administrators can access the
				system. All other users will be blocked from logging in.
			</Text>
			<form
				onSubmit={form.onSubmit(async (values) => {
					await updateMaintenance({
						values: {
							maintenanceMode: values.maintenanceMode ?? false,
						},
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
						<Button type="submit" loading={isLoading} disabled={isLoading}>
							Save changes
						</Button>
					</Group>
				</Stack>
			</form>
		</Stack>
	);
}
