import {
	ActionIcon,
	AppShell,
	alpha,
	Badge,
	Box,
	Grid,
	Group,
	getThemeColor,
	Paper,
	ScrollArea,
	Stack,
	Text,
	TextInput,
	Title,
	useMantineColorScheme,
	useMantineTheme,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { IconEdit, IconPlus, IconSearch } from "@tabler/icons-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { href, Link, Outlet } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { tryFindUserById } from "server/internal/user-management";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { getModuleColor, getModuleIcon } from "~/utils/module-helper";
import { ForbiddenResponse, NotFoundResponse } from "~/utils/responses";
import type { RouteParams } from "~/utils/routes-utils";
import type { Route } from "./+types/user-modules-layout";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const { payload, pageInfo } = context.get(globalContextKey);
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

	const isInUserModuleEditLayout = pageInfo.isInUserModuleEditLayout;

	let moduleId: number | null = null;
	if (isInUserModuleEditLayout) {
		const { moduleId: moduleIdParam } =
			params as RouteParams<"layouts/user-module-edit-layout">;
		moduleId = Number(moduleIdParam);
	}

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
		moduleId,
	};
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export default function UserModulesLayout({
	loaderData,
}: Route.ComponentProps) {
	const { modules, canCreateModules, canManageModules, moduleId } = loaderData;
	const [searchQuery, setSearchQuery] = useQueryState("search");
	const [inputValue, setInputValue] = useState(searchQuery ?? "");

	// Debounced function to update URL query state
	const debouncedSetSearchQuery = useDebouncedCallback((value: string) => {
		setSearchQuery(value || null);
	}, 500);

	// Handle input change with immediate feedback
	const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.currentTarget.value;
		setInputValue(value);
		debouncedSetSearchQuery(value);
	};

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

	// Filter modules based on search query from URL
	const filteredModules = modules.filter((module) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			module.title.toLowerCase().includes(query) ||
			module.type.toLowerCase().includes(query) ||
			module.status.toLowerCase().includes(query)
		);
	});

	const theme = useMantineTheme();

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

								<TextInput
									placeholder="Search modules by title, type, or status..."
									leftSection={<IconSearch size={16} />}
									value={inputValue}
									onChange={handleSearchChange}
									mb="md"
								/>

								{modules.length === 0 ? (
									<Text c="dimmed" ta="center" py="xl" size="sm">
										No activity modules yet.
										{canCreateModules && " Create your first one!"}
									</Text>
								) : filteredModules.length === 0 ? (
									<Text c="dimmed" ta="center" py="xl" size="sm">
										No modules found matching "{inputValue}"
									</Text>
								) : (
									<ScrollArea h={600}>
										<Stack gap="xs">
											{filteredModules.map((module) => (
												<Paper
													key={module.id}
													withBorder
													p="sm"
													radius="sm"
													// if moduleId is set and it is the same as the module.id, then add a class to the paper
													style={{ cursor: "pointer" }}
													bg={
														moduleId === module.id
															? alpha(getThemeColor("blue", theme), 0.1)
															: undefined
													}
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
														<Badge
															size="xs"
															variant="light"
															color={getModuleColor(
																module.type as
																	| "page"
																	| "whiteboard"
																	| "assignment"
																	| "quiz"
																	| "discussion",
															)}
															leftSection={getModuleIcon(
																module.type as
																	| "page"
																	| "whiteboard"
																	| "assignment"
																	| "quiz"
																	| "discussion",
																12,
															)}
														>
															{formatType(module.type)}
														</Badge>
														<Badge
															size="xs"
															color={getStatusColor(module.status)}
														>
															{module.status}
														</Badge>
														{module.accessType === "readonly" && (
															<Badge size="xs" color="gray" variant="outline">
																Read Only
															</Badge>
														)}
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
