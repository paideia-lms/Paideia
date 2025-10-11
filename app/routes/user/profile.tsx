import {
	Avatar,
	Badge,
	Button,
	Card,
	Container,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { href, Link } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { tryGetUserActivityModules } from "server/internal/activity-module-management";
import { tryFindUserById } from "server/internal/user-management";
import { NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/profile";

export const loader = async ({
	request,
	context,
	params,
}: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const { user: currentUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Get user ID from route params, or use current user
	const userId = params.id ? Number(params.id) : currentUser.id;

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

	// Fetch activity modules for the current logged-in user
	const modulesResult = await tryGetUserActivityModules(payload, {
		userId: currentUser.id,
		limit: 50,
	});

	const modules = modulesResult.ok ? modulesResult.value.docs : [];

	// Check if user can create modules
	const canCreateModules =
		currentUser.role === "admin" ||
		currentUser.role === "instructor" ||
		currentUser.role === "content-manager";

	// Check if user can edit this profile
	const canEdit = userId === currentUser.id || currentUser.role === "admin";

	return {
		user: {
			id: profileUser.id,
			firstName: profileUser.firstName ?? "",
			lastName: profileUser.lastName ?? "",
			bio: profileUser.bio ?? "",
			avatarUrl,
		},
		isOwnProfile: userId === currentUser.id,
		modules,
		canCreateModules,
		canEdit,
	};
};

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
	const { user, isOwnProfile, modules, canCreateModules, canEdit } = loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";

	// Helper function to get badge color based on status
	const getStatusColor = (status: string) => {
		switch (status) {
			case "published":
				return "green";
			case "draft":
				return "yellow";
			case "archived":
				return "gray";
			default:
				return "blue";
		}
	};

	// Helper function to format type display
	const formatType = (type: string) => {
		return type
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

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
						{canEdit && (
							<Button
								component={Link}
								to={isOwnProfile ? "/user/edit" : `/user/edit/${user.id}`}
								variant="light"
								fullWidth
							>
								Edit Profile
							</Button>
						)}
					</Stack>
				</Paper>

				{/* Activity Modules Section */}
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Group justify="space-between" mb="lg">
						<Title order={3}>Activity Modules</Title>
						{isOwnProfile && canCreateModules && (
							<Button component={Link} to="/user/module/new" size="sm">
								Create Module
							</Button>
						)}
					</Group>

					{modules.length === 0 ? (
						<Text c="dimmed" ta="center" py="xl">
							No activity modules yet.
							{isOwnProfile && canCreateModules && " Create your first one!"}
						</Text>
					) : (
						<Stack gap="md">
							{modules.map((module) => (
								<Card key={module.id} withBorder padding="lg" radius="md">
									<Group justify="space-between" mb="xs">
										<Text fw={600} size="lg">
											{module.title}
										</Text>
										<Group gap="xs">
											<Badge color={getStatusColor(module.status)}>
												{module.status}
											</Badge>
											<Badge variant="light">{formatType(module.type)}</Badge>
										</Group>
									</Group>
									{module.description && (
										<Text size="sm" c="dimmed" lineClamp={2}>
											{module.description}
										</Text>
									)}
								</Card>
							))}
						</Stack>
					)}
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
