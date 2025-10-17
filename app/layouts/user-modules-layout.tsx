import {
	ActionIcon,
	AppShell,
	Badge,
	Box,
	Grid,
	Group,
	Paper,
	ScrollArea,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { IconEdit, IconPlus } from "@tabler/icons-react";
import { href, Link, Outlet } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { tryFindUserById } from "server/internal/user-management";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { ForbiddenResponse, NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/user-modules-layout";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const { payload } = context.get(globalContextKey);
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
	const userId = params.id ? Number(params.id) : currentUser.id;

	// Check if user can access this data
	if (userId !== currentUser.id && currentUser.role !== "admin") {
		throw new ForbiddenResponse("You can only view your own data");
	}

	// Fetch the target user
	const userResult = await tryFindUserById({
		payload,
		userId,
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
		overrideAccess: false,
	});

	if (!userResult.ok) {
		throw new NotFoundResponse("User not found");
	}

	const targetUser = userResult.value;

	const modules = userProfileContext.activityModules;

	// Check if user can create modules (only for own profile)
	const canCreateModules =
		userId === currentUser.id &&
		(currentUser.role === "admin" ||
			currentUser.role === "instructor" ||
			currentUser.role === "content-manager");

	// Check if user can manage modules (edit/delete) - only for own profile or if admin
	const canManageModules =
		userId === currentUser.id || currentUser.role === "admin";

	return {
		user: {
			id: targetUser.id,
			firstName: targetUser.firstName ?? "",
			lastName: targetUser.lastName ?? "",
		},
		isOwnProfile: userId === currentUser.id,
		modules: modules,
		canCreateModules,
		canManageModules,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function UserModulesLayout({
	loaderData,
}: Route.ComponentProps) {
	const { modules, canCreateModules, canManageModules } = loaderData;

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
		<AppShell>
			<AppShell.Main>
				<Grid>
					<Grid.Col span={4}>
						<Box p="md">
							<Paper withBorder shadow="sm" p="md" radius="md">
								<Group justify="space-between" mb="md">
									<Title order={3}>Activity Modules</Title>
									{canCreateModules && (
										<ActionIcon
											component={Link}
											to="/user/module/new"
											variant="filled"
											color="blue"
											size="lg"
											aria-label="Create new module"
										>
											<IconPlus size={18} />
										</ActionIcon>
									)}
								</Group>

								{modules.length === 0 ? (
									<Text c="dimmed" ta="center" py="xl" size="sm">
										No activity modules yet.
										{canCreateModules && " Create your first one!"}
									</Text>
								) : (
									<ScrollArea h={600}>
										<Stack gap="xs">
											{modules.map((module) => (
												<Paper
													key={module.id}
													withBorder
													p="sm"
													radius="sm"
													style={{ cursor: "pointer" }}
													component={Link}
													to={href("/user/module/edit/:moduleId", {
														moduleId: String(module.id),
													})}
												>
													<Group justify="space-between" mb="xs">
														<Text fw={500} size="sm" lineClamp={1}>
															{module.title}
														</Text>
														{canManageModules && (
															<ActionIcon
																size="sm"
																variant="subtle"
																color="blue"
																aria-label="Edit module"
															>
																<IconEdit size={14} />
															</ActionIcon>
														)}
													</Group>
													<Group gap="xs" mb="xs">
														<Badge size="xs" variant="light">
															{formatType(module.type)}
														</Badge>
														<Badge
															size="xs"
															color={getStatusColor(module.status)}
														>
															{module.status}
														</Badge>
													</Group>
													<Text size="xs" c="dimmed">
														{module.linkedCourses.length} linked course
														{module.linkedCourses.length !== 1 ? "s" : ""}
													</Text>
												</Paper>
											))}
										</Stack>
									</ScrollArea>
								)}
							</Paper>
						</Box>
					</Grid.Col>
					<Grid.Col span={8}>
						<Outlet />
					</Grid.Col>
				</Grid>
			</AppShell.Main>
		</AppShell>
	);
}
