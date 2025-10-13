import { Outlet, Link, href, useNavigate, useMatches } from "react-router";
import { userContextKey } from "server/contexts/user-context";
import type { Route } from "./+types/root-layout";
import { useState } from 'react';
import {
	IconChevronDown,
	IconLogout,
	IconUser,
	IconSchool,
	IconCalendar,
	IconPhoto,
	IconSettings,
	IconLanguage,
	IconLogin,
} from '@tabler/icons-react';
import cx from 'clsx';
import {
	Avatar,
	Container,
	Group,
	Menu,
	Tabs,
	Text,
	UnstyledButton,
} from '@mantine/core';
import classes from './header-tabs.module.css';
import type { PageInfo } from "server/contexts/global-context";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);

	// If no user session or not authenticated, return null user
	if (!userSession?.isAuthenticated) {
		return {
			user: null,
			isImpersonating: false,
		};
	}

	// Use effectiveUser if impersonating, otherwise use authenticatedUser
	const currentUser = userSession.effectiveUser || userSession.authenticatedUser;

	// Handle avatar - could be Media object or just ID
	let avatarUrl: string | null = null;
	if (currentUser.avatar) {
		if (typeof currentUser.avatar === "object" && currentUser.avatar.filename) {
			avatarUrl = `/api/media/file/${currentUser.avatar.filename}`;
		}
	}

	return {
		user: {
			id: currentUser.id,
			firstName: currentUser.firstName ?? "",
			lastName: currentUser.lastName ?? "",
			email: currentUser.email,
			role: currentUser.role,
			avatarUrl,
		},
		isImpersonating: userSession.isImpersonating,
	};
};

export default function UserLayout({ loaderData, matches }: Route.ComponentProps) {

	const { pageInfo } = matches[0].loaderData
	return (
		<>
			<HeaderTabs user={loaderData.user} pageInfo={pageInfo} />
			<Outlet />
		</>
	);
}


interface User {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
	role: "student" | "instructor" | "admin" | "content-manager" | "analytics-viewer" | null | undefined;
	avatarUrl: string | null;
}

enum Tab {
	Dashboard = 'Dashboard',
	MyCourses = 'My Courses',
	SiteAdmin = 'Site Admin',
}

export function HeaderTabs({ user, pageInfo }: { user: User | null, pageInfo: PageInfo }) {
	const navigate = useNavigate();
	const [userMenuOpened, setUserMenuOpened] = useState(false);

	const isAuthenticated = user !== null;

	// Determine current tab based on route matches
	const getCurrentTab = () => {
		// Check if we're on the admin route
		if (pageInfo.isAdmin) return Tab.SiteAdmin;

		// Check if we're on course-related routes
		if (pageInfo.isMyCourses) return Tab.MyCourses;

		// Default to Dashboard for root and other routes
		return Tab.Dashboard;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		switch (value) {
			case 'Dashboard':
				navigate(href('/'));
				break;
			case 'My Courses':
				navigate(href('/course'));
				break;
			case 'Site Admin':
				navigate(href('/admin/*', { '*': '' }));
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
							<Tabs.Tab value={Tab.Dashboard}>
								Dashboard
							</Tabs.Tab>
							<Tabs.Tab value={Tab.MyCourses}>
								My Courses
							</Tabs.Tab>
							{isAuthenticated && user.role === 'admin' && (
								<Tabs.Tab value={Tab.SiteAdmin}>
									Site Admin
								</Tabs.Tab>
							)}
						</Tabs.List>
					</Tabs>
					<Menu
						width={260}
						position="bottom-end"
						transitionProps={{ transition: 'pop-top-right' }}
						onClose={() => setUserMenuOpened(false)}
						onOpen={() => setUserMenuOpened(true)}
						withinPortal
					>
						<Menu.Target>
							<UnstyledButton
								className={cx(classes.user, { [classes.userActive]: userMenuOpened })}
							>
								<Group gap={7}>
									{isAuthenticated ? (
										<Avatar src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} radius="xl" size={20} />
									) : (
										<Avatar radius="xl" size={20} color="gray">
											<IconUser size={12} />
										</Avatar>
									)}
									<Text fw={500} size="sm" lh={1} mr={3}>
										{isAuthenticated ? `${user.firstName} ${user.lastName}` : 'Not signed in'}
									</Text>
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
										to={href("/user/profile/:id?", { id: undefined })}
									>
										Profile
									</Menu.Item>
									<Menu.Item leftSection={<IconSchool size={16} stroke={1.5} />}>
										Grades
									</Menu.Item>
									<Menu.Item leftSection={<IconCalendar size={16} stroke={1.5} />}>
										Calendar
									</Menu.Item>
									<Menu.Item leftSection={<IconPhoto size={16} stroke={1.5} />}>
										Media
									</Menu.Item>

									<Menu.Divider />

									<Menu.Item leftSection={<IconSettings size={16} stroke={1.5} />}>
										Preferences
									</Menu.Item>
									<Menu.Item leftSection={<IconLanguage size={16} stroke={1.5} />}>
										Languages
									</Menu.Item>

									<Menu.Divider />

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
