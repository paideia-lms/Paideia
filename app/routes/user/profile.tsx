import {
	Avatar,
	Button,
	Container,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUserCheck } from "@tabler/icons-react";
import { href, Link, redirect, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { tryFindUserById } from "server/internal/user-management";
import { setImpersonationCookie } from "~/utils/cookie";
import {
	badRequest,
	NotFoundResponse,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/profile";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const userProfileContext = context.get(userProfileContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	if (!userProfileContext) {
		throw new NotFoundResponse("User profile context not found");
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user ID from route params, or use current user
	const userId = params.id ? Number(params.id) : currentUser.id;

	// Check if user can edit this profile
	const canEdit = userId === currentUser.id || currentUser.role === "admin";

	// Check if user can impersonate (admin viewing someone else's profile, not an admin, and not already impersonating)
	const canImpersonate =
		userSession.authenticatedUser.role === "admin" &&
		userId !== userSession.authenticatedUser.id &&
		userProfileContext.profileUser.role !== "admin" &&
		!userSession.isImpersonating;

	return {
		user: userProfileContext.profileUser,
		isOwnProfile: userId === currentUser.id,
		canEdit,
		canImpersonate,
		isImpersonating: userSession.isImpersonating,
		authenticatedUser: userSession.authenticatedUser,
	};
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const { payload, requestInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const { authenticatedUser: currentUser } = userSession;

	const formData = await request.formData();
	const intent = formData.get("intent");

	// Handle impersonation actions
	if (intent === "impersonate") {
		if (currentUser.role !== "admin") {
			return unauthorized({ error: "Only admins can impersonate users" });
		}

		const targetUserId = Number(formData.get("targetUserId"));
		if (Number.isNaN(targetUserId)) {
			return badRequest({ error: "Invalid target user ID" });
		}

		// Verify the target user exists and is not an admin
		const targetUserResult = await tryFindUserById({
			payload,
			userId: targetUserId,
			user: {
				...currentUser,
				avatar: currentUser.avatar?.id,
			},
			overrideAccess: true,
		});

		if (!targetUserResult.ok || !targetUserResult.value) {
			return badRequest({ error: "Target user not found" });
		}

		const targetUser = targetUserResult.value;
		if (targetUser.role === "admin") {
			return badRequest({ error: "Cannot impersonate admin users" });
		}

		// Get redirect URL from form data, default to "/"
		const redirectTo = (formData.get("redirectTo") as string) || "/";

		// Set impersonation cookie and redirect
		throw redirect(redirectTo, {
			headers: {
				"Set-Cookie": setImpersonationCookie(
					targetUserId,
					requestInfo.domainUrl,
					request.headers,
					payload,
				),
			},
		});
	}

	// No other actions supported on profile page
	return badRequest({ error: "Invalid action" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized
	) {
		notifications.show({
			title: "Error",
			message: actionData?.error,
			color: "red",
		});
	}
	// Impersonation actions redirect, so no notification needed

	return actionData;
}

// Reusable hook for impersonation functionality
export const useImpersonate = () => {
	const fetcher = useFetcher();

	const impersonate = (targetUserId: number, redirectTo?: string) => {
		const formData = new FormData();
		formData.append("intent", "impersonate");
		formData.append("targetUserId", String(targetUserId));
		if (redirectTo) {
			formData.append("redirectTo", redirectTo);
		}
		// Submit to profile route action which handles impersonation
		fetcher.submit(formData, {
			method: "POST",
			action: "/user/profile",
		});
	};

	return {
		impersonate,
		isLoading: fetcher.state === "submitting",
		fetcher,
	};
};

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
	const { user, isOwnProfile, canEdit, canImpersonate } = loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const { impersonate, isLoading } = useImpersonate();

	return (
		<Container size="md" py="xl">
			<title>{`${fullName} | Profile | Paideia LMS`}</title>
			<meta
				name="description"
				content={`View ${isOwnProfile ? "your" : fullName + "'s"} profile information`}
			/>
			<meta
				property="og:title"
				content={`${fullName} | Profile | Paideia LMS`}
			/>
			<meta
				property="og:description"
				content={`View ${isOwnProfile ? "your" : fullName + "'s"} profile information`}
			/>

			<Stack gap="xl">
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Stack align="center" gap="lg">
						<Avatar
							src={user.avatarUrl}
							alt={fullName}
							size={120}
							radius={120}
						/>
						<div style={{ textAlign: "center" }}>
							<Title order={2} mb="xs">
								{fullName}
							</Title>
							{isOwnProfile && (
								<Text size="sm" c="dimmed" mb="md">
									Your Profile
								</Text>
							)}
						</div>
						{user.bio && (
							<div style={{ width: "100%" }}>
								<Text size="sm" fw={600} mb="xs">
									Bio
								</Text>
								<Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
									{user.bio}
								</Text>
							</div>
						)}
						<Group gap="md" w="100%">
							{canEdit && (
								<Button
									component={Link}
									to={href("/user/overview/:id?", {
										id: user.id.toString(),
									})}
									variant="light"
								>
									Edit Profile
								</Button>
							)}
							{canImpersonate && (
								<Button
									variant="light"
									color="orange"
									onClick={() => impersonate(user.id)}
									loading={isLoading}
									leftSection={<IconUserCheck size={16} />}
								>
									Impersonate User
								</Button>
							)}
						</Group>
					</Stack>
				</Paper>

				{/* Activity Modules Section */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Group justify="space-between" align="center">
						<div>
							<Title order={3} mb="xs">
								Activity Modules
							</Title>
							<Text size="sm" c="dimmed">
								View {isOwnProfile ? "your" : "their"} activity modules
							</Text>
						</div>
						<Button
							component={Link}
							to={isOwnProfile ? "/user/modules" : `/user/modules/${user.id}`}
							variant="light"
						>
							View Modules
						</Button>
					</Group>
				</Paper>

				{/* Notes Link */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Group justify="space-between" align="center">
						<div>
							<Title order={3} mb="xs">
								Notes
							</Title>
							<Text size="sm" c="dimmed">
								View {isOwnProfile ? "your" : "their"} notes and activity
							</Text>
						</div>
						<Button
							component={Link}
							to={isOwnProfile ? "/user/notes" : `/user/notes/${user.id}`}
							variant="light"
						>
							View Notes
						</Button>
					</Group>
				</Paper>
			</Stack>
		</Container>
	);
}
