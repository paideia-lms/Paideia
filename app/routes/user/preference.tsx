import {
	Button,
	Container,
	Group,
	Paper,
	Radio,
	Stack,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { pick } from "es-toolkit";
import { href } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { serverOnly$ } from "vite-env-only/macros";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryFindUserById,
	tryUpdateUser,
} from "server/internal/user-management";
import { z } from "zod";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
} from "~/utils/responses";
import type { Route } from "./+types/preference";

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createUpdatePreferenceActionRpc = createActionRpc({
	formDataSchema: z.object({
		theme: z.enum(["light", "dark"]),
		direction: z.enum(["ltr", "rtl"]),
	}),
	method: "POST",
});

export function getRouteUrl(userId?: number) {
	return href("/user/preference/:id?", {
		id: userId ? userId.toString() : undefined,
	});
}

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const { payload, payloadRequest } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const { id } = params;

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Determine which user to edit
	let targetUserId: number;
	if (id !== undefined) {
		// If id is provided, check if the user is admin
		if (Number(id) !== currentUser.id && currentUser.role !== "admin") {
			throw new ForbiddenResponse("Only admins can edit other users");
		}
		targetUserId = Number(id);
	} else {
		// If no id provided, edit current user
		targetUserId = currentUser.id;
	}

	// Fetch the target user
	const targetUser = await tryFindUserById({
		payload,
		userId: targetUserId,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new NotFoundResponse("User not found");
	});

	return {
		user: pick(targetUser, [
			"id",
			"firstName",
			"lastName",
			"bio",
			"theme",
			"direction",
		]),
	};
};

const [updatePreferenceAction, useUpdateUserPreference] =
	createUpdatePreferenceActionRpc(
		serverOnly$(async ({ context, formData }) => {
			const { payload, payloadRequest } = context.get(globalContextKey);
			const userSession = context.get(userContextKey);

			if (!userSession?.isAuthenticated) {
				throw new NotFoundResponse("Unauthorized");
			}

			// Use effectiveUser if impersonating, otherwise use authenticatedUser
			const currentUser =
				userSession.effectiveUser || userSession.authenticatedUser;

			// Update user theme and direction
			const updateResult = await tryUpdateUser({
				payload,
				userId: currentUser.id,
				data: {
					theme: formData.theme,
					direction: formData.direction,
				},
				req: payloadRequest,
			});

			if (!updateResult.ok) {
				return badRequest({
					success: false,
					error: "Failed to update preferences.",
				});
			}

			return ok({ success: true });
		})!,
		{
			action: (args) =>
				getRouteUrl(args.params?.id ? Number(args.params.id) : undefined),
		},
	);

// Export hook for use in components
export { useUpdateUserPreference };

export const action = updatePreferenceAction;

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success) {
		notifications.show({
			title: "Success",
			message: "Preferences updated successfully!",
			color: "green",
		});
	} else if (actionData && "error" in actionData) {
		notifications.show({
			title: "Error",
			message: actionData.error as string,
			color: "red",
		});
	}

	return actionData;
}

export default function PreferencesPage({ loaderData }: Route.ComponentProps) {
	const { user } = loaderData;
	const { submit: updatePreference, isLoading } = useUpdateUserPreference();
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			theme: loaderData.user.theme,
			direction: loaderData.user.direction ?? "ltr",
		},
	});

	const handleSubmit = form.onSubmit((values) => {
		updatePreference({
			params: {
				id: user.id,
			},
			values: {
				theme: values.theme as "light" | "dark",
				direction: values.direction as "ltr" | "rtl",
			},
		});
	});

	return (
		<Container size="lg" py="xl">
			<title>Preferences | Paideia LMS</title>
			<meta name="description" content="Manage your preferences and settings" />
			<meta property="og:title" content="Preferences | Paideia LMS" />
			<meta
				property="og:description"
				content="Manage your preferences and settings"
			/>

			<Stack gap="xl">
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="md">
						Preferences
					</Title>

					<form onSubmit={handleSubmit}>
						<Stack gap="md">
							<Radio.Group
								{...form.getInputProps("theme")}
								key={form.key("theme")}
								label="Theme"
								description="Choose your preferred color scheme"
							>
								<Group mt="xs">
									<Radio value="light" label="Light" />
									<Radio value="dark" label="Dark" />
								</Group>
							</Radio.Group>

							<Radio.Group
								{...form.getInputProps("direction")}
								key={form.key("direction")}
								label="Text Direction"
								description="Choose your preferred text direction"
							>
								<Group mt="xs">
									<Radio value="ltr" label="Left to Right" />
									<Radio value="rtl" label="Right to Left" />
								</Group>
							</Radio.Group>

							<Group justify="flex-end">
								<Button type="submit" loading={isLoading}>
									Save Preferences
								</Button>
							</Group>
						</Stack>
					</form>
				</Paper>
			</Stack>
		</Container>
	);
}
