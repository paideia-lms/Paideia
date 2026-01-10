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
	useMantineTheme,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { IconEdit, IconPlus, IconSearch } from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { parseAsString } from "nuqs/server";
import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router";
import { userContextKey } from "server/contexts/user-context";
import { userProfileContextKey } from "server/contexts/user-profile-context";
import { getModuleColor, getModuleIcon } from "~/utils/module-helper";
import { ForbiddenResponse, NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/user-modules-layout";
import { typeCreateLoader } from "app/utils/loader-utils";
import { useNuqsSearchParams, getRouteUrl } from "~/utils/search-params-utils";

export const loaderSearchParams = {
	search: parseAsString.withDefault(""),
};

const createLoader = typeCreateLoader<Route.LoaderArgs>();

const createRouteLoader = createLoader({
	searchParams: loaderSearchParams,
});

export const loader = createRouteLoader(
	async ({ context, params, searchParams }) => {
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

		if (!userSession.permissions.canSeeUserModules) {
			throw new ForbiddenResponse(
				"You don't have permission to access this page",
			);
		}

		const targetUser = userProfileContext.profileUser;

		const modules = userProfileContext.activityModules;

		return {
			user: {
				id: targetUser.id,
				firstName: targetUser.firstName ?? "",
				lastName: targetUser.lastName ?? "",
			},
			isOwnProfile: userId === currentUser.id,
			modules: modules,
			canCreateModules: userProfileContext.permissions.canCreateModules.allowed,
			canManageModules: userProfileContext.permissions.canManageModules.allowed,
			searchParams,
			params,
		};
	},
);

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

type ModuleSearchInputProps = {
	search: string;
};

function ModuleSearchInput({ search }: ModuleSearchInputProps) {
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);
	const [input, setInput] = useState(search || "");

	useEffect(() => {
		setInput(search || "");
	}, [search]);

	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		setQueryParams({ search: value || "" });
	}, 500);

	return (
		<TextInput
			placeholder="Search modules by title or type..."
			leftSection={<IconSearch size={16} />}
			value={input}
			onChange={(e) => {
				const v = e.currentTarget.value;
				setInput(v);
				debouncedSetQuery(v);
			}}
			mb="md"
		/>
	);
}

export default function UserModulesLayout({
	loaderData,
}: Route.ComponentProps) {
	const { modules, canCreateModules, canManageModules, searchParams, params } =
		loaderData;

	// Helper function to format type display
	const formatType = (type: string) => {
		return type
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	// Filter modules based on search query from URL
	const filteredModules = modules.filter((module) => {
		if (!searchParams.search) return true;
		const query = searchParams.search.toLowerCase();
		return (
			module.title.toLowerCase().includes(query) ||
			module.type.toLowerCase().includes(query)
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

								<ModuleSearchInput search={searchParams.search} />

								{modules.length === 0 ? (
									<Text c="dimmed" ta="center" py="xl" size="sm">
										No activity modules yet.
										{canCreateModules && " Create your first one!"}
									</Text>
								) : filteredModules.length === 0 ? (
									<Text c="dimmed" ta="center" py="xl" size="sm">
										No modules found matching "{searchParams.search}"
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
														params.moduleId === module.id
															? alpha(getThemeColor("blue", theme), 0.1)
															: undefined
													}
													component={Link}
													to={getRouteUrl("/user/module/edit/:moduleId", {
														params: { moduleId: String(module.id) },
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
															color={getModuleColor(module.type)}
															leftSection={getModuleIcon(module.type, 12)}
														>
															{formatType(module.type)}
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
