import {
	Alert,
	Avatar,
	Badge,
	Container,
	Group,
	Indicator,
	Menu,
	Tabs,
	Text,
	Tooltip,
	UnstyledButton,
	useMantineColorScheme,
} from "@mantine/core";
import {
	IconAlertTriangle,
	IconCalendar,
	IconChevronDown,
	IconLanguage,
	IconLayoutGrid,
	IconLogin,
	IconLogout,
	IconPhoto,
	IconSchool,
	IconSettings,
	IconUser,
	IconUserCheck,
} from "@tabler/icons-react";
import cx from "clsx";
import { useEffect, useState } from "react";
import { href, Link, Outlet, useNavigate } from "react-router";
import { globalContextKey, type PageInfo } from "server/contexts/global-context";
import { type UserSession, userContextKey } from "server/contexts/user-context";
import { StopImpersonatingMenuItem } from "~/routes/api/stop-impersonation";
import type { RouteParams } from "~/utils/routes-utils";
import type { Route } from "./+types/root-layout";
import classes from "./header-tabs.module.css";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const { envVars } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const currentUser =
		userSession?.effectiveUser || userSession?.authenticatedUser;
	const theme = currentUser?.theme ?? "light";
	const isSandboxMode = envVars.SANDBOX_MODE.enabled;
	return {
		userSession,
		theme,
		isSandboxMode,
	};
};

export default function UserLayout({
	loaderData,
	matches,
}: Route.ComponentProps) {
	const { pageInfo } = matches[0].loaderData;
	const { theme } = loaderData;
	const { setColorScheme } = useMantineColorScheme();

	// biome-ignore lint/correctness/useExhaustiveDependencies: theme is intentionally the only dependency
	useEffect(() => {
		setColorScheme(theme);
	}, [theme]);
	return (
		<>
			{loaderData.isSandboxMode && (
				<Alert
					icon={<IconAlertTriangle size={20} />}
					title="Sandbox Mode Enabled"
					color="yellow"
					variant="light"
				>
					<Text size="sm">
						<strong>Warning:</strong> Sandbox mode is currently enabled. In this
						mode, everyone who registers will automatically receive admin role,
						and all users can freely change their system role. This is intended
						for testing and development purposes only. Data is temporary and will
						be reset every midnight.
					</Text>
				</Alert>
			)}
			<HeaderTabs userSession={loaderData.userSession} pageInfo={pageInfo} />
			{/* Sandbox Mode Warning */}
			<Outlet />
		</>
	);
}

enum Tab {
	Dashboard = "Dashboard",
	MyCourses = "My Courses",
	SiteAdmin = "Site Admin",
}

export function HeaderTabs({
	userSession,
	pageInfo,
}: {
	userSession: UserSession | null;
	pageInfo: PageInfo;
}) {
	const navigate = useNavigate();
	const [userMenuOpened, setUserMenuOpened] = useState(false);

	const isAuthenticated = userSession?.isAuthenticated ?? false;
	const currentUser =
		userSession?.effectiveUser || userSession?.authenticatedUser;
	const isImpersonating = userSession?.isImpersonating ?? false;
	const authenticatedUser = userSession?.authenticatedUser;

	// Check if user is admin (check effective user if impersonating, otherwise authenticated user)
	const isAdmin = isImpersonating
		? authenticatedUser?.role === "admin"
		: currentUser?.role === "admin";

	// Determine redirect URL based on current location
	// If in a course, redirect back to that course after stopping impersonation
	const getStopImpersonationRedirect = () => {
		if (pageInfo.isInCourse) {
			const { id } = pageInfo.params as RouteParams<"layouts/course-layout">;
			return href("/course/:id", { id });
		}
		return href("/"); // Default to dashboard
	};

	// Determine current tab based on route matches
	const getCurrentTab = () => {
		// Check if we're on the admin route
		if (pageInfo.isInAdminLayout) return Tab.SiteAdmin;

		// Check if we're on course-related routes
		if (pageInfo.isMyCourses) return Tab.MyCourses;

		// Default to Dashboard for root and other routes
		if (pageInfo.isDashboard) return Tab.Dashboard;

		return null;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		switch (value) {
			case Tab.Dashboard:
				navigate(href("/"));
				break;
			case Tab.MyCourses:
				navigate(href("/course"));
				break;
			case Tab.SiteAdmin:
				navigate(href("/admin/*", { "*": "" }));
				break;
		}
	};

	return (
		<div className={classes.header}>
			<Container size="xl" className={classes.mainSection}>
				<Group justify="space-between">
					<Text>Paideia LMS</Text>
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
							<Tabs.Tab value={Tab.Dashboard}>Dashboard</Tabs.Tab>
							<Tabs.Tab value={Tab.MyCourses}>My Courses</Tabs.Tab>
							{isAuthenticated && currentUser?.role === "admin" && (
								<Tabs.Tab value={Tab.SiteAdmin}>Site Admin</Tabs.Tab>
							)}
						</Tabs.List>
					</Tabs>
					<Menu
						width={260}
						position="bottom-end"
						transitionProps={{ transition: "pop-top-right" }}
						onClose={() => setUserMenuOpened(false)}
						onOpen={() => setUserMenuOpened(true)}
						withinPortal
					>
						<Menu.Target>
							<UnstyledButton
								className={cx(classes.user, {
									[classes.userActive]: userMenuOpened,
								})}
							>
								<Group gap={7}>
									{isAuthenticated && currentUser ? (
										isImpersonating && authenticatedUser ? (
											<Tooltip.Group openDelay={300} closeDelay={100}>
												<Avatar.Group spacing="sm">
													<Tooltip
														label={
															`Logged in as: ${authenticatedUser.firstName ?? ""} ${authenticatedUser.lastName ?? ""}`.trim() ||
															"Admin"
														}
														withArrow
													>
														<Avatar
															src={
																authenticatedUser.avatar?.filename
																	? href(`/api/media/file/:filenameOrId`, {
																		filenameOrId:
																			authenticatedUser.avatar.filename,
																	})
																	: null
															}
															alt={
																`${authenticatedUser.firstName ?? ""} ${authenticatedUser.lastName ?? ""}`.trim() ||
																"Admin"
															}
															radius="xl"
															size={20}
														/>
													</Tooltip>
													<Tooltip
														label={
															`Impersonating: ${currentUser.firstName ?? ""} ${currentUser.lastName ?? ""}`.trim() ||
															"Anonymous"
														}
														withArrow
													>
														<Avatar
															src={
																currentUser.avatar?.filename
																	? href(`/api/media/file/:filenameOrId`, {
																		filenameOrId: currentUser.avatar.filename,
																	})
																	: null
															}
															alt={
																`${currentUser.firstName ?? ""} ${currentUser.lastName ?? ""}`.trim() ||
																"Anonymous"
															}
															radius="xl"
															size={20}
														/>
													</Tooltip>
												</Avatar.Group>
											</Tooltip.Group>
										) : (
											<Avatar
												src={
													currentUser.avatar?.filename
														? href(`/api/media/file/:filenameOrId`, {
															filenameOrId: currentUser.avatar.filename,
														})
														: null
												}
												alt={
													`${currentUser.firstName ?? ""} ${currentUser.lastName ?? ""}`.trim() ||
													"Anonymous"
												}
												radius="xl"
												size={20}
											/>
										)
									) : (
										<Avatar radius="xl" size={20} color="gray">
											<IconUser size={12} />
										</Avatar>
									)}
									<Text fw={500} size="sm" lh={1} mr={3}>
										{isAuthenticated && currentUser
											? `${currentUser.firstName ?? ""} ${currentUser.lastName ?? ""}`.trim() ||
											"Anonymous"
											: "Not signed in"}
									</Text>
									{isAdmin && (
										<Badge size="sm" color="red" variant="light">
											Admin
										</Badge>
									)}
									<IconChevronDown size={12} stroke={1.5} />
								</Group>
							</UnstyledButton>
						</Menu.Target>
						<Menu.Dropdown>
							{isAuthenticated ? (
								<>
									<Menu.Item
										leftSection={<IconUser size={16} stroke={1.5} />}
										component={Link}
										to={href("/user/overview/:id?", {
											id: currentUser?.id ? String(currentUser.id) : "",
										})}
									>
										Profile
									</Menu.Item>
									<Menu.Item
										leftSection={<IconLayoutGrid size={16} stroke={1.5} />}
										component={Link}
										to={href("/user/modules/:id?", {
											id: currentUser?.id ? String(currentUser.id) : "",
										})}
									>
										Modules
									</Menu.Item>
									<Menu.Item
										leftSection={<IconSchool size={16} stroke={1.5} />}
										component={Link}
										to={href("/user/grades/:id?", {
											id: currentUser?.id ? String(currentUser.id) : "",
										})}
									>
										Grades
									</Menu.Item>
									<Menu.Item
										leftSection={<IconCalendar size={16} stroke={1.5} />}
									// component={Link}
									// to={href("/user/calendar/:id?", { id: currentUser?.id ? String(currentUser.id) : "" })}
									>
										Calendar
									</Menu.Item>
									<Menu.Item leftSection={<IconPhoto size={16} stroke={1.5} />}>
										Media
									</Menu.Item>

									<Menu.Divider />

									<Menu.Item
										leftSection={<IconSettings size={16} stroke={1.5} />}
										component={Link}
										to={href("/user/preference/:id?", {
											id: currentUser?.id ? String(currentUser.id) : "",
										})}
									>
										Preferences
									</Menu.Item>
									<Menu.Item
										leftSection={<IconLanguage size={16} stroke={1.5} />}
									>
										Languages
									</Menu.Item>

									<Menu.Divider />
									{/* Impersonation Status */}
									{isImpersonating && authenticatedUser && currentUser && (
										<StopImpersonatingMenuItem
											leftSection={<IconUserCheck size={16} stroke={1.5} />}
											color="orange"
											redirectTo={getStopImpersonationRedirect()}
										/>
									)}
									<Menu.Item
										leftSection={<IconLogout size={16} stroke={1.5} />}
										component={Link}
										to={href("/logout")}
									>
										Logout
									</Menu.Item>
								</>
							) : (
								<Menu.Item
									leftSection={<IconLogin size={16} stroke={1.5} />}
									component={Link}
									to={href("/login")}
								>
									Login
								</Menu.Item>
							)}
						</Menu.Dropdown>
					</Menu>
				</Group>
			</Container>
		</div>
	);
}
