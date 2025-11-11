import { Container, Group, Tabs, TextInput, Title } from "@mantine/core";
import { parseAsString, useQueryState } from "nuqs";
import { href, Outlet, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import { tryGetContext } from "~/utils/try-get-context";
import type { Route } from "./+types/server-admin-layout";
import classes from "./header-tabs.module.css";

enum AdminTab {
	General = "general",
	Users = "users",
	Courses = "courses",
	Grades = "grades",
	Plugins = "plugins",
	Appearance = "appearance",
	Server = "server",
	Reports = "reports",
	Development = "development",
}

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const contextResult = tryGetContext(context, globalContextKey);

	if (!contextResult.ok) {
		throw new BadRequestResponse("Context not found");
	}

	const { pageInfo } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can access this area");
	}

	const url = new URL(request.url);
	const tabParam = url.searchParams.get("tab");

	return {
		user: currentUser,
		tabParam: tabParam ?? AdminTab.General,
		pageInfo,
	};
};

export const ErrorBoundary = ({ error }: { error: Error }) => {
	return <DefaultErrorBoundary error={error} />;
};

const SearchInput = () => {
	const [searchQuery, setSearchQuery] = useQueryState("search");

	return (
		<TextInput
			placeholder="Search"
			w={300}
			value={searchQuery ?? ""}
			onChange={(event) => setSearchQuery(event.currentTarget.value)}
		/>
	);
};

export default function ServerAdminLayout({
	loaderData,
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const { pageInfo, tabParam } = loaderData;
	const [activeTab, setActiveTab] = useQueryState(
		"tab",
		parseAsString
			.withDefault(tabParam ?? AdminTab.General)
			.withOptions({ shallow: false }),
	);

	// Determine current tab based on route matches or query param
	const getCurrentTab = () => {
		if (pageInfo.isAdminUsers) return AdminTab.Users;
		if (pageInfo.isAdminRegistration) return AdminTab.General;
		if (
			pageInfo.isAdminCourses ||
			pageInfo.isAdminCourseNew ||
			pageInfo.isAdminCategories ||
			pageInfo.isAdminCategoryNew
		)
			return AdminTab.Courses;
		if (
			pageInfo.isAdminSystem ||
			pageInfo.isAdminTestEmail ||
			pageInfo.isAdminDependencies ||
			pageInfo.isAdminCronJobs ||
			pageInfo.isAdminMaintenance ||
			pageInfo.isAdminMedia
		)
			return AdminTab.Server;
		if (pageInfo.isAdminSitePolicies) return AdminTab.General;
		if (pageInfo.isAdminMigrations) return AdminTab.Development;
		if (pageInfo.isAdminAppearance) return AdminTab.Appearance;
		// Default to query param or 'general'
		return activeTab ?? AdminTab.General;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		navigate(href("/admin/*", { "*": "" }) + `?tab=${value}`);

		// switch (value) {
		// 	case AdminTab.General:
		// 	case AdminTab.Grades:
		// 	case AdminTab.Plugins:
		// 	case AdminTab.Appearance:
		// 	case AdminTab.Reports:
		// 	case AdminTab.Development:

		// 		// Navigate to index with query param
		// 		navigate(href("/admin/*", { "*": "" }) + `?tab=${value}`);
		// 		break;
		// case AdminTab.Users:
		// 	navigate(href("/admin/users"));
		// 	break;
		// case AdminTab.Courses:
		// 	navigate(href("/admin/courses"));
		// 	break;
		// case AdminTab.Server:
		// 	navigate(href("/admin/system"));
		// 	break;
	};

	return (
		<div>
			<div className={classes.header}>
				<Container size="xl" className={classes.mainSection}>
					<Group justify="space-between" mb="md">
						<Title order={1}>Site administration</Title>
						<SearchInput />
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
							<Tabs.Tab value={AdminTab.General}>General</Tabs.Tab>
							<Tabs.Tab value={AdminTab.Users}>Users</Tabs.Tab>
							<Tabs.Tab value={AdminTab.Courses}>Courses</Tabs.Tab>
							<Tabs.Tab value={AdminTab.Grades}>Grades</Tabs.Tab>
							<Tabs.Tab value={AdminTab.Plugins}>Plugins</Tabs.Tab>
							<Tabs.Tab value={AdminTab.Appearance}>Appearance</Tabs.Tab>
							<Tabs.Tab value={AdminTab.Server}>Server</Tabs.Tab>
							<Tabs.Tab value={AdminTab.Reports}>Reports</Tabs.Tab>
							<Tabs.Tab value={AdminTab.Development}>Development</Tabs.Tab>
						</Tabs.List>
					</Tabs>
				</Container>
			</div>
			<Container size="xl">
				<Outlet />
			</Container>
		</div>
	);
}
