import {
	Avatar,
	Badge,
	Container,
	Group,
	Tabs,
	Text,
	Title,
} from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { href, Outlet, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindUserById } from "server/internal/user-management";
import { canSeeUserModules } from "server/utils/permissions";
import { ForbiddenResponse, NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/user-layout";
import classes from "./header-tabs.module.css";

enum UserTab {
	Profile = "profile",
	Preference = "preference",
	Modules = "modules",
	Grades = "grades",
	Notes = "notes",
	Media = "media",
}

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const { payload, pageInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user ID from route params, or use current user
	const userId = params.id ? Number(params.id) : currentUser.id;

	// Check if user can access this data
	if (userId !== currentUser.id && currentUser.role !== "admin") {
		throw new ForbiddenResponse("You can only view your own data");
	}

	// Fetch the target user
	const userResult = await tryFindUserById({
		payload,
		userId,
		user: currentUser,
		overrideAccess: false,
	});

	if (!userResult.ok) {
		throw new NotFoundResponse("User not found");
	}

	const targetUser = userResult.value;

	// Handle avatar - could be Media object or just ID
	let avatarUrl: string | null = null;
	if (targetUser.avatar) {
		if (typeof targetUser.avatar === "object") {
			avatarUrl = targetUser.avatar.filename
				? href(`/api/media/file/:filenameOrId`, {
					filenameOrId: targetUser.avatar.filename,
				})
				: null;
		}
	}

	const canSeeModules = canSeeUserModules(currentUser);

	return {
		user: {
			id: targetUser.id,
			firstName: targetUser.firstName ?? "",
			lastName: targetUser.lastName ?? "",
			email: targetUser.email,
			role: targetUser.role,
			avatarUrl,
		},
		pageInfo: pageInfo,
		isOwnData: userId === currentUser.id,
		canSeeModules,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function UserLayout({ loaderData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const { user, pageInfo, isOwnData, canSeeModules } = loaderData;

	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";

	// Determine current tab based on route matches
	const getCurrentTab = () => {
		if (pageInfo.isUserOverview) return UserTab.Profile;
		if (pageInfo.isUserPreference) return UserTab.Preference;
		if (
			pageInfo.isUserModules ||
			pageInfo.isUserModuleNew ||
			pageInfo.isUserModuleEdit
		)
			return UserTab.Modules;
		if (pageInfo.isUserGrades) return UserTab.Grades;
		if (
			pageInfo.isUserNotes ||
			pageInfo.isUserNoteCreate ||
			pageInfo.isUserNoteEdit
		)
			return UserTab.Notes;
		if (pageInfo.isUserMedia) return UserTab.Media;

		// Default to Profile tab
		return UserTab.Profile;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		const userIdParam = isOwnData ? undefined : user.id.toString();

		switch (value) {
			case UserTab.Profile:
				navigate(
					href("/user/overview/:id?", {
						id: userIdParam ? userIdParam : undefined,
					}),
				);
				break;
			case UserTab.Preference:
				navigate(
					href("/user/preference/:id?", {
						id: userIdParam ? userIdParam : undefined,
					}),
				);
				break;
			case UserTab.Modules:
				navigate(
					href("/user/modules/:id?", {
						id: userIdParam ? userIdParam : undefined,
					}),
				);
				break;
			case UserTab.Grades:
				navigate(
					href("/user/grades/:id?", {
						id: userIdParam ? userIdParam : undefined,
					}),
				);
				break;
			case UserTab.Notes:
				navigate(
					href("/user/notes/:id?", {
						id: userIdParam ? userIdParam : undefined,
					}),
				);
				break;
			case UserTab.Media:
				navigate(
					href("/user/media/:id?", {
						id: userIdParam ? userIdParam : undefined,
					}),
				);
				break;
		}
	};

	return (
		<div>
			<div className={classes.header}>
				<Container size="xl" className={classes.mainSection}>
					<Group justify="space-between">
						<Group>
							<Avatar
								src={user.avatarUrl}
								alt={fullName}
								size={48}
								radius={48}
							/>
							<div>
								<Group gap="xs" mb={4}>
									<Title order={2}>{fullName}</Title>
									{user.role && (
										<Badge variant="light" size="lg">
											{user.role}
										</Badge>
									)}
								</Group>
								<Text c="dimmed" size="sm">
									{user.email}
								</Text>
							</div>
						</Group>
						<Tabs
							value={getCurrentTab()}
							onChange={handleTabChange}
							variant="outline"
							classNames={{
								root: classes.tabs,
								list: classes.tabsList,
								tab: classes.tab,
							}}
						>
							<Tabs.List>
								<Tabs.Tab value={UserTab.Profile}>Profile</Tabs.Tab>
								<Tabs.Tab value={UserTab.Preference}>Preference</Tabs.Tab>
								{canSeeModules && (
									<Tabs.Tab value={UserTab.Modules}>Modules</Tabs.Tab>
								)}
								<Tabs.Tab value={UserTab.Grades}>Grades</Tabs.Tab>
								<Tabs.Tab value={UserTab.Notes}>Notes</Tabs.Tab>
								<Tabs.Tab value={UserTab.Media}>Media</Tabs.Tab>
							</Tabs.List>
						</Tabs>
					</Group>
				</Container>
			</div>
			<Outlet />
		</div>
	);
}
