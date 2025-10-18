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
import { data, href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryUpdateUser } from "server/internal/user-management";
import { z } from "zod";
import {
	assertRequestMethod,
	assertRequestMethodInRemix,
} from "~/utils/assert-request-method";
import {
	ContentType,
	getDataAndContentTypeFromRequest,
} from "~/utils/get-content-type";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
} from "~/utils/responses";
import type { Route } from "./+types/preference";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
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
	const targetUser = await payload.findByID({
		collection: "users",
		id: targetUserId,
	});

	if (!targetUser) {
		throw new NotFoundResponse("User not found");
	}

	return {
		user: pick(targetUser, ["id", "firstName", "lastName", "bio", "theme"]),
	};
};

const actionSchema = z.object({
	theme: z.enum(["light", "dark"]),
});

export const action = async ({ context, request }: Route.ActionArgs) => {
	assertRequestMethodInRemix(request.method, "POST");
	const payload = context.get(globalContextKey).payload;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Parse form data
	const { data } = await getDataAndContentTypeFromRequest(request);
	const parsed = actionSchema.safeParse(data);

	if (!parsed.success) {
		return badRequest({
			success: false,
			error: parsed.error.message,
		});
	}

	const { theme } = parsed.data;

	// Update user theme
	const updateResult = await tryUpdateUser({
		payload,
		userId: currentUser.id,
		data: {
			theme,
		},
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
		overrideAccess: false,
	});

	if (!updateResult.ok) {
		return badRequest({
			success: false,
			error: "Failed to update theme preference.",
		});
	}

	return ok({ success: true });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.success) {
		notifications.show({
			title: "Success",
			message: "Theme preference updated successfully!",
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

// Custom hook for updating user preferences
export function useUpdateUserPreference() {
	const fetcher = useFetcher<typeof clientAction>();

	const updatePreference = (userId: string, theme: "light" | "dark") => {
		fetcher.submit(
			{
				theme: theme,
			},
			{
				method: "POST",
				action: href("/user/preference/:id?", {
					id: userId,
				}),
				encType: ContentType.JSON,
			},
		);
	};

	return {
		updatePreference,
		isLoading: fetcher.state !== "idle",
		data: fetcher.data,
	};
}

export default function PreferencesPage({ loaderData }: Route.ComponentProps) {
	const { user } = loaderData;
	const { updatePreference, isLoading } = useUpdateUserPreference();
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			theme: loaderData.user.theme,
		},
	});

	const handleSubmit = (values: { theme: string }) => {
		updatePreference(String(user.id), values.theme as "light" | "dark");
	};

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

					<form onSubmit={form.onSubmit(handleSubmit)}>
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
