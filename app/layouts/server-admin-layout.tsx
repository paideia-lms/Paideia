import { Container, Group, Tabs, TextInput, Title } from "@mantine/core";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { parseAsString, parseAsStringEnum } from "nuqs";
import { Outlet, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/server-admin-layout";
import classes from "./header-tabs.module.css";
import { typeCreateLoader } from "app/utils/loader-utils";
import { useNuqsSearchParams } from "~/utils/search-params-utils";
import { useDebouncedCallback } from "@mantine/hooks";
import { useState, useEffect } from "react";
import { getRouteUrl } from "~/utils/search-params-utils";

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

export const loaderSearchParams = {
	tab: parseAsStringEnum(Object.values(AdminTab)).withDefault(AdminTab.General),
	search: parseAsString.withDefault(""),
};

const createLoader = typeCreateLoader<Route.LoaderArgs>();

const createRouteLoader = createLoader({
	searchParams: loaderSearchParams,
});

export const loader = createRouteLoader(
	async ({ context, searchParams, params }) => {
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

		return {
			user: currentUser,
			pageInfo,
			searchParams,
			params,
		};
	},
)!;

export const ErrorBoundary = ({ error }: { error: Error }) => {
	return <DefaultErrorBoundary error={error} />;
};

type SearchInputProps = {
	search: string;
};

const SearchInput = ({ search }: SearchInputProps) => {
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);
	const [input, setInput] = useState(search || "");

	// biome-ignore lint/correctness/useExhaustiveDependencies: search is intentionally the only dependency
	useEffect(() => {
		setInput(search || "");
	}, [search]);

	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		setQueryParams({ search: value || "" });
	}, 500);

	return (
		<TextInput
			placeholder="Search"
			w={300}
			value={input}
			onChange={(event) => {
				const v = event.currentTarget.value;
				setInput(v);
				debouncedSetQuery(v);
			}}
		/>
	);
};

export default function ServerAdminLayout({
	loaderData,
}: Route.ComponentProps) {
	const { pageInfo, searchParams } = loaderData;
	const navigate = useNavigate();

	// Determine current tab based on route matches or query param
	const getCurrentTab = () => {
		if (pageInfo.is["routes/admin/users"]) return AdminTab.Users;
		if (
			pageInfo.is["routes/admin/courses"] ||
			pageInfo.is["routes/admin/course-new"] ||
			pageInfo.is["routes/admin/categories"] ||
			pageInfo.is["routes/admin/category-new"]
		)
			return AdminTab.Courses;
		if (
			pageInfo.is["routes/admin/system"] ||
			pageInfo.is["routes/admin/test-email"] ||
			pageInfo.is["routes/admin/dependencies"] ||
			pageInfo.is["routes/admin/cron-jobs"] ||
			pageInfo.is["routes/admin/scheduled-tasks"] ||
			pageInfo.is["routes/admin/maintenance"] ||
			pageInfo.is["routes/admin/media"]
		)
			return AdminTab.Server;
		if (pageInfo.is["routes/admin/migrations"]) return AdminTab.Development;
		if (
			pageInfo.is["routes/admin/appearance"] ||
			pageInfo.is["routes/admin/appearance/theme"] ||
			pageInfo.is["routes/admin/appearance/logo"]
		)
			return AdminTab.Appearance;
		if (
			pageInfo.is["routes/admin/sitepolicies"] ||
			pageInfo.is["routes/admin/analytics"] ||
			pageInfo.is["routes/admin/registration"]
		)
			return AdminTab.General;
		// Default to query param or 'general'
		return searchParams.tab ?? AdminTab.General;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		// setQueryParams({ tab: value as AdminTab });

		switch (value) {
			case AdminTab.General:
			case AdminTab.Grades:
			case AdminTab.Plugins:
			case AdminTab.Appearance:
			case AdminTab.Reports:
			case AdminTab.Development:
				// Navigate to index with query param
				navigate(
					getRouteUrl("/admin/*", {
						params: { "*": "" },
						searchParams: { tab: value },
					}),
				);
				break;
			case AdminTab.Users:
				navigate(getRouteUrl("/admin/users", {}));
				break;
			case AdminTab.Courses:
				navigate(getRouteUrl("/admin/courses", { searchParams: {} }));
				break;
			case AdminTab.Server:
				navigate(getRouteUrl("/admin/system", {}));
				break;
		}
	};
	return (
		<div>
			<div className={classes.header}>
				<Container size="xl" className={classes.mainSection}>
					<Group justify="space-between" mb="md">
						<Title order={1}>Site administration</Title>
						<SearchInput search={searchParams.search} />
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
