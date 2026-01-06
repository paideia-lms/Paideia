import { Button, Group, Stack, Switch, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { createActionMap, typeCreateActionRpc } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryGetRegistrationSettings,
	tryUpdateRegistrationSettings,
} from "server/internal/registration-settings";
import { z } from "zod";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/registration";

enum Action {
	Update = "update",
}

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context }) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}
	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;
	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can access this area");
	}

	const settings = await tryGetRegistrationSettings({
		payload,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to get registration settings");
	});

	return { settings };
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/admin/registration",
});

const updateRegistrationRpc = createActionRpc({
	formDataSchema: z.object({
		disableRegistration: z.boolean().optional(),
		showRegistrationButton: z.boolean().optional(),
	}),
	method: "POST",
	action: Action.Update,
});

const updateRegistrationAction = updateRegistrationRpc.createAction(
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

		const { disableRegistration, showRegistrationButton } = formData;

		const updateResult = await tryUpdateRegistrationSettings({
			payload,
			req: payloadRequest,
			data: {
				disableRegistration,
				showRegistrationButton,
			},
			overrideAccess: false,
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

const useUpdateRegistration = updateRegistrationRpc.createHook<
	typeof updateRegistrationAction
>();

// Export hook for use in component
export { useUpdateRegistration };

const [action] = createActionMap({
	[Action.Update]: updateRegistrationAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Registration settings updated",
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
			message: actionData?.error || "Failed to update registration settings",
			color: "red",
		});
	}

	return actionData;
}

export default function AdminRegistration({
	loaderData,
}: Route.ComponentProps) {
	const { submit: updateRegistration, isLoading } = useUpdateRegistration();
	const {
		settings: { disableRegistration, showRegistrationButton },
	} = loaderData;

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			disableRegistration: disableRegistration,
			showRegistrationButton: showRegistrationButton,
		},
	});


	return (
		<Stack gap="md" my="lg">
			<title>Registration Settings | Admin | Paideia LMS</title>
			<meta name="description" content="Configure user registration settings" />
			<meta
				property="og:title"
				content="Registration Settings | Admin | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Configure user registration settings"
			/>
			{/* <pre>
                {JSON.stringify(loaderData, null, 2)}
            </pre> */}
			<Title order={2}>Registration</Title>
			<form onSubmit={form.onSubmit(async (values) => {
				await updateRegistration({
					values: {
						disableRegistration: values.disableRegistration,
						showRegistrationButton: values.showRegistrationButton,
					},
				});
			})}>
				<Stack gap="sm">
					<Switch
						{...form.getInputProps("disableRegistration", { type: "checkbox" })}
						key={form.key("disableRegistration")}
						label="Disable Self-Registration"
					/>
					{!form.values.disableRegistration && (
						<Switch
							{...form.getInputProps("showRegistrationButton", {
								type: "checkbox",
							})}
							key={form.key("showRegistrationButton")}
							label="Show Registration Button"
						/>
					)}
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
