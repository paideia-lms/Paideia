import {
	Alert,
	Badge,
	Container,
	Group,
	Tabs,
	Text,
	Title,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { Outlet, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import { getModuleColor, getModuleIcon } from "~/utils/module-helper";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/user-module-edit-layout";
import classes from "./header-tabs.module.css";
import type { ActivityModule } from "server/payload-types";
import { typeCreateLoader } from "app/utils/loader-utils";
import { getRouteUrl } from "~/utils/search-params-utils";

enum ModuleEditTab {
	// Preview = "preview",
	Setting = "setting",
	Access = "access",
}

const createLoader = typeCreateLoader<Route.LoaderArgs>();

const createRouteLoader = createLoader({});

export const loader = createRouteLoader(async ({ context, params }) => {
	const { pageInfo } = context.get(globalContextKey);
	const userModuleContext = context.get(userModuleContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (!userSession.permissions.canSeeUserModules) {
		throw new ForbiddenResponse(
			"You don't have permission to access this module",
		);
	}

	if (!userModuleContext) {
		throw new ForbiddenResponse("Module context not found");
	}

	return {
		pageInfo,
		module: userModuleContext.module,
		accessType: userModuleContext.accessType,
		params,
	};
})!;

export default function UserModuleEditLayout({
	loaderData,
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const { pageInfo, module, accessType, params } = loaderData;

	// Only show Setting and Access tabs if user can edit
	const canEdit = accessType === "owned" || accessType === "granted";

	// Determine current tab based on pageInfo
	const getCurrentTab = () => {
		if (pageInfo.is["routes/user/module/edit-setting"])
			return ModuleEditTab.Setting;
		if (pageInfo.is["routes/user/module/edit-access"])
			return ModuleEditTab.Access;

		// Default to Preview tab
		return ModuleEditTab.Setting;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;


		switch (value) {
			case ModuleEditTab.Setting:
				navigate(
					getRouteUrl("/user/module/edit/:moduleId", {
						params: { moduleId: params.moduleId.toString() },
					}),
				);
				break;
			case ModuleEditTab.Access:
				navigate(
					getRouteUrl("/user/module/edit/:moduleId/access", {
						params: { moduleId: params.moduleId.toString() },
					}),
				);
				break;
		}
	};

	return (
		<div>
			<div className={classes.header}>
				<Container size="xl" className={classes.mainSection}>
					<Group justify="space-between" align="flex-start">
						<div style={{ flex: 1 }}>
							<Group gap="sm" mb="xs">
								<Title order={2}>{module.title}</Title>
								<Badge
									variant="light"
									color={getModuleColor(module.type as ActivityModule["type"])}
									leftSection={getModuleIcon(
										module.type as ActivityModule["type"],
										14,
									)}
								>
									{module.type}
								</Badge>
							</Group>
							<Text c="dimmed" size="sm" mb="sm">
								{module.description || "No description provided"}
							</Text>
							{accessType === "readonly" && (
								<Alert
									icon={<IconInfoCircle size={16} />}
									title="Read-only Access"
									color="yellow"
									variant="light"
								>
									You have auto-granted read-only access because you have a
									teaching role in a course that uses this module.
								</Alert>
							)}
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
						mt="sm"
					>
						<Tabs.List>
							{canEdit && (
								<Tabs.Tab value={ModuleEditTab.Setting}>Setting</Tabs.Tab>
							)}
							{canEdit && (
								<Tabs.Tab value={ModuleEditTab.Access}>Access</Tabs.Tab>
							)}
						</Tabs.List>
					</Tabs>
				</Container>
			</div>
			<Outlet />
		</div>
	);
}
