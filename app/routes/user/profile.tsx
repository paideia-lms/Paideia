import { Avatar, Container, Paper, Stack, Text, Title } from "@mantine/core";
import { createLoader, parseAsInteger } from "nuqs/server";
import { href } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { tryFindUserById } from "server/internal/user-management";
import type { Media } from "server/payload-types";
import { NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/profile";

// Describe your search params, and reuse this in useQueryStates / createSerializer:
export const profileSearchParams = {
	id: parseAsInteger,
};

export const loadSearchParams = createLoader(profileSearchParams);

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const { user: currentUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Get user ID from query params, or use current user
	const { id } = loadSearchParams(request);
	const userId = id ? id : currentUser.id;

	// Fetch the user profile
	const userResult = await tryFindUserById({
		payload,
		userId,
		user: currentUser,
		overrideAccess: false,
	});

	if (!userResult.ok) {
		throw new NotFoundResponse("User not found");
	}

	const profileUser = userResult.value;

	// Handle avatar - could be Media object or just ID
	let avatarUrl: string | null = null;
	if (profileUser.avatar) {
		if (typeof profileUser.avatar === "object") {
			avatarUrl = profileUser.avatar.filename
				? href(`/api/media/file/:filename`, {
						filename: profileUser.avatar.filename,
					})
				: null;
		}
	}

	return {
		user: {
			id: profileUser.id,
			firstName: profileUser.firstName ?? "",
			lastName: profileUser.lastName ?? "",
			bio: profileUser.bio ?? "",
			avatarUrl,
		},
		isOwnProfile: userId === currentUser.id,
	};
};

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
	const { user, isOwnProfile } = loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";

	return (
		<Container size="sm" py="xl">
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

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Stack align="center" gap="lg">
					<Avatar src={user.avatarUrl} alt={fullName} size={120} radius={120} />
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
				</Stack>
			</Paper>
		</Container>
	);
}
