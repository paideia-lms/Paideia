import {
	Alert,
	Container,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { href } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	ForbiddenResponse,
	NotFoundResponse,
} from "~/utils/responses";
import type { Route } from "./+types/edit";

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

	// Handle avatar - could be Media object or just ID
	let avatarUrl: string | null = null;
	if (targetUser.avatar) {
		if (typeof targetUser.avatar === "object") {
			avatarUrl = targetUser.avatar.filename
				? href(`/api/media/file/:filename`, {
					filename: targetUser.avatar.filename,
				})
				: null;
		}
	}

	return {
		user: {
			id: targetUser.id,
			firstName: targetUser.firstName ?? "",
			lastName: targetUser.lastName ?? "",
			bio: targetUser.bio ?? "",
			avatarUrl,
		},
	};
};


export default function EditProfilePage() {
	return (
		<Container size="lg" py="xl">
			<title>Preferences | Paideia LMS</title>
			<meta
				name="description"
				content="Manage your preferences and settings"
			/>
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

					<Alert
						variant="light"
						color="blue"
						title="Coming Soon"
						icon={<IconInfoCircle />}
					>
						<Text size="sm">
							User preferences and settings management is currently under
							development. You will be able to customize your experience here,
							including notification settings, language preferences, and more.
						</Text>
					</Alert>
				</Paper>
			</Stack>
		</Container>
	);
}
