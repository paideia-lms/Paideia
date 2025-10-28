import { Badge, Container, Group, Tabs, Text, Title } from "@mantine/core";
import { href, Outlet, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { canSeeCourseModuleSettings } from "server/utils/permissions";
import {
    getStatusBadgeColor,
    getStatusLabel,
} from "~/components/course-view-utils";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-module-layout";
import classes from "./header-tabs.module.css";

enum ModuleTab {
    Preview = "preview",
    Setting = "setting",
}

export const loader = async ({ context }: Route.LoaderArgs) => {
    const { pageInfo } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);
    const courseContext = context.get(courseContextKey);
    const courseModuleContext = context.get(courseModuleContextKey);
    const enrolmentContext = context.get(enrolmentContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    const currentUser =
        userSession.effectiveUser || userSession.authenticatedUser;

    if (!courseContext) {
        throw new ForbiddenResponse("Course not found or access denied");
    }

    if (!courseModuleContext) {
        throw new ForbiddenResponse("Module not found or access denied");
    }

    return {
        module: courseModuleContext.module,
        moduleSettings: courseModuleContext.moduleLinkSettings,
        course: courseContext.course,
        moduleLinkId: courseModuleContext.moduleLinkId,
        currentUser: currentUser,
        pageInfo: pageInfo,
        enrolment: enrolmentContext?.enrolment,
    };
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
    return <DefaultErrorBoundary error={error} />;
};

export default function CourseModuleLayout({
    loaderData,
}: Route.ComponentProps) {
    const navigate = useNavigate();
    const { module, moduleSettings, moduleLinkId, pageInfo, currentUser, enrolment } =
        loaderData;

    // Determine current tab based on route matches
    const getCurrentTab = () => {
        if (pageInfo.isCourseModuleEdit) return ModuleTab.Setting;
        if (pageInfo.isCourseModule) return ModuleTab.Preview;

        // Default to Preview tab
        return ModuleTab.Preview;
    };

    const handleTabChange = (value: string | null) => {
        if (!value) return;

        const moduleId = moduleLinkId.toString();

        switch (value) {
            case ModuleTab.Preview:
                navigate(href("/course/module/:id", { id: moduleId }));
                break;
            case ModuleTab.Setting:
                navigate(href("/course/module/:id/edit", { id: moduleId }));
                break;
        }
    };

    const canSeeSetting = canSeeCourseModuleSettings(currentUser, enrolment);

    return (
        <div>
            <div className={classes.header}>
                <Container size="xl" className={classes.mainSection}>
                    <Group justify="space-between">
                        <div>
                            <Group gap="xs" mb="xs">
                                <Title order={2}>{moduleSettings?.settings.name ?? module.title}</Title>
                                <Badge color={getStatusBadgeColor(module.status)} variant="light">
                                    {getStatusLabel(module.status)}
                                </Badge>
                            </Group>
                            <Text c="dimmed" size="sm">
                                {module.type.charAt(0).toUpperCase() + module.type.slice(1)}{" "}
                                Module
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
                                <Tabs.Tab value={ModuleTab.Preview}>{module.type.charAt(0).toUpperCase() + module.type.slice(1)}</Tabs.Tab>
                                {canSeeSetting && (
                                    <Tabs.Tab value={ModuleTab.Setting}>Setting</Tabs.Tab>
                                )}
                            </Tabs.List>
                        </Tabs>
                    </Group>
                </Container>
            </div>
            <Outlet />
        </div>
    );
}

