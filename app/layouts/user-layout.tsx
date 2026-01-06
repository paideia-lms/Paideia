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
import { Outlet, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse, NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/user-layout";
import classes from "./header-tabs.module.css";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { typeCreateLoader } from "app/utils/loader-utils";
import { getRouteUrl } from "~/utils/search-params-utils";

enum UserTab {
	Profile = "profile",
	Preference = "preference",
	Modules = "modules",
	Grades = "grades",
	Notes = "notes",
	Media = "media",
}

const createLoader = typeCreateLoader<Route.LoaderArgs>();

const createRouteLoader = createLoader({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const { pageInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const userProfileContext = context.get(userProfileContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (!userProfileContext) {
		throw new NotFoundResponse("User profile context not found");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Get user ID from route params, or use current user
	const userId = userProfileContext.profileUser.id;

	// Check if user can access this data
	if (userId !== currentUser.id && currentUser.role !== "admin") {
		throw new ForbiddenResponse("You can only view your own data");
	}

	// Fetch the target user
	const targetUser = userProfileContext.profileUser;

	return {
		user: targetUser,
		pageInfo: pageInfo,
		isOwnData: userId === currentUser.id,
		canSeeModules: userSession.permissions.canSeeUserModules,
		params,
	};
})!;

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function UserLayout({ loaderData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const { user, pageInfo, isOwnData, canSeeModules } = loaderData;

	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";

	// Determine current tab based on route matches
	const getCurrentTab = () => {
		if (pageInfo.is["routes/user/overview"]) return UserTab.Profile;
		if (pageInfo.is["routes/user/preference"]) return UserTab.Preference;
		if (
			pageInfo.is["routes/user/modules"] ||
			pageInfo.is["routes/user/module/new"] ||
			pageInfo.is["routes/user/module/edit-setting"]
		)
			return UserTab.Modules;
		if (pageInfo.is["routes/user/grades"]) return UserTab.Grades;
		if (
			pageInfo.is["routes/user/notes"] ||
			pageInfo.is["routes/user/note-create"] ||
			pageInfo.is["routes/user/note-edit"]
		)
			return UserTab.Notes;
		if (pageInfo.is["routes/user/media"]) return UserTab.Media;

		// Default to Profile tab
		return UserTab.Profile;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		const userIdParam = isOwnData ? undefined : user.id.toString();

		switch (value) {
			case UserTab.Profile:
				navigate(
					getRouteUrl("/user/overview/:id?", {
						params: userIdParam ? { id: userIdParam } : undefined,
					}),
				);
				break;
			case UserTab.Preference:
				navigate(
					getRouteUrl("/user/preference/:id?", {
						params: userIdParam ? { id: userIdParam } : undefined,
					}),
				);
				break;
			case UserTab.Modules:
				navigate(
					getRouteUrl("/user/modules/:id?", {
						params: userIdParam ? { id: userIdParam } : undefined,
					}),
				);
				break;
			case UserTab.Grades:
				navigate(
					getRouteUrl("/user/grades/:id?", {
						params: userIdParam ? { id: userIdParam } : undefined,
					}),
				);
				break;
			case UserTab.Notes:
				navigate(
					getRouteUrl("/user/notes/:id?", {
						params: userIdParam ? { id: userIdParam } : undefined,
						searchParams: { date: null },
					}),
				);
				break;
			case UserTab.Media:
				navigate(
					getRouteUrl("/user/media/:id?", {
						params: userIdParam ? { id: userIdParam } : undefined,
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
