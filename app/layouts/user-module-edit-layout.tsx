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
import { href, Outlet, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import { canSeeUserModules } from "server/utils/permissions";
import { getModuleColor, getModuleIcon } from "~/utils/module-helper";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/user-module-edit-layout";
import classes from "./header-tabs.module.css";

enum ModuleEditTab {
	Preview = "preview",
	Setting = "setting",
	Access = "access",
}

export const loader = async ({ context }: Route.LoaderArgs) => {
	const { pageInfo } = context.get(globalContextKey);
	const userModuleContext = context.get(userModuleContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!canSeeUserModules(currentUser)) {
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
	};
};

export default function UserModuleEditLayout({
	loaderData,
	params,
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const { pageInfo, module, accessType } = loaderData;

	// Only show Setting and Access tabs if user can edit
	const canEdit = accessType === "owned" || accessType === "granted";

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

	// Determine current tab based on pageInfo
	const getCurrentTab = () => {
		if (pageInfo.isUserModuleEditSetting) return ModuleEditTab.Setting;
		if (pageInfo.isUserModuleEditAccess) return ModuleEditTab.Access;

		// Default to Preview tab
		return ModuleEditTab.Preview;
	};

	const handleTabChange = (value: string | null) => {
		if (!value) return;

		const moduleId = params.moduleId;
		if (!moduleId) return;

		switch (value) {
			case ModuleEditTab.Preview:
				navigate(href("/user/module/edit/:moduleId", { moduleId }));
				break;
			case ModuleEditTab.Setting:
				navigate(href("/user/module/edit/:moduleId/setting", { moduleId }));
				break;
			case ModuleEditTab.Access:
				navigate(href("/user/module/edit/:moduleId/access", { moduleId }));
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
								<Badge color={getStatusColor(module.status)}>
									{module.status}
								</Badge>
								<Badge
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
										14,
									)}
								>
									{formatType(module.type)}
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
							<Tabs.Tab value={ModuleEditTab.Preview}>Preview</Tabs.Tab>
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
