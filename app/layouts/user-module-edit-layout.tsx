import { Badge, Container, Group, Tabs, Text, Title } from "@mantine/core";
import { href, Outlet, useNavigate } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import { ForbiddenResponse } from "~/utils/responses";
import classes from "./header-tabs.module.css";
import type { Route } from "./+types/user-module-edit-layout";

enum ModuleEditTab {
    Preview = "preview",
    Setting = "setting",
    Access = "access",
}

export const loader = async ({ context }: Route.LoaderArgs) => {
    const { pageInfo } = context.get(globalContextKey);
    const userModuleContext = context.get(userModuleContextKey);

    if (!userModuleContext) {
        throw new ForbiddenResponse("Module context not found");
    }

    return {
        pageInfo,
        module: userModuleContext.module,
    };
};

export default function UserModuleEditLayout({
    loaderData,
    params,
}: Route.ComponentProps) {
    const navigate = useNavigate();
    const { pageInfo, module } = loaderData;

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
                    <Group justify="space-between">
                        <div>
                            <Group gap="sm" mb="xs">
                                <Title order={2}>{module.title}</Title>
                                <Badge color={getStatusColor(module.status)}>
                                    {module.status}
                                </Badge>
                                <Badge variant="light">{formatType(module.type)}</Badge>
                            </Group>
                            <Text c="dimmed" size="sm">
                                {module.description || "No description provided"}
                            </Text>
                        </div>
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
                                <Tabs.Tab value={ModuleEditTab.Preview}>Preview</Tabs.Tab>
                                <Tabs.Tab value={ModuleEditTab.Setting}>Setting</Tabs.Tab>
                                <Tabs.Tab value={ModuleEditTab.Access}>Access</Tabs.Tab>
                            </Tabs.List>
                        </Tabs>
                    </Group>
                </Container>
            </div>
            <Outlet />
        </div>
    );
}

