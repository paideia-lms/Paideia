import {
    Anchor,
    Button,
    Container,
    Group,
    Paper,
    Stack,
    Text,
    TextInput,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { href, redirect, useFetcher, useNavigate } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import type { CourseModuleSettingsV1 } from "server/json/course-module-settings.types";
import { tryUpdateCourseModuleSettings } from "server/internal/course-activity-module-link-management";
import { assertRequestMethod } from "~/utils/assert-request-method";
import {
    badRequest,
    ForbiddenResponse,
    StatusCode,
    unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/module.$id.edit";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
    const userSession = context.get(userContextKey);
    const courseContext = context.get(courseContextKey);
    const courseModuleContext = context.get(courseModuleContextKey);

    if (!userSession?.isAuthenticated) {
        throw new ForbiddenResponse("Unauthorized");
    }

    const moduleLinkId = Number.parseInt(params.id, 10);
    if (Number.isNaN(moduleLinkId)) {
        throw new ForbiddenResponse("Invalid module link ID");
    }

    if (!courseContext) {
        throw new ForbiddenResponse("Course not found or access denied");
    }

    if (!courseModuleContext) {
        throw new ForbiddenResponse("Module not found or access denied");
    }

    // Check if user can edit
    const currentUser =
        userSession.effectiveUser || userSession.authenticatedUser;
    const canEdit =
        currentUser.role === "admin" ||
        currentUser.role === "content-manager" ||
        courseContext.course.enrollments.some(
            (enrollment: { userId: number; role: string }) =>
                enrollment.userId === currentUser.id &&
                (enrollment.role === "teacher" || enrollment.role === "ta"),
        );

    if (!canEdit) {
        throw new ForbiddenResponse(
            "You don't have permission to edit this module",
        );
    }

    return {
        course: courseContext.course,
        module: courseModuleContext.module,
        moduleLinkId: courseModuleContext.moduleLinkId,
        settings: courseModuleContext.moduleLinkSettings,
    };
};

export const action = async ({ request, context, params }: Route.ActionArgs) => {
    assertRequestMethod(request.method, "POST");

    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        return unauthorized({ error: "Unauthorized" });
    }

    const moduleLinkId = Number.parseInt(params.id, 10);
    if (Number.isNaN(moduleLinkId)) {
        return badRequest({ error: "Invalid module link ID" });
    }

    const formData = await request.formData();
    const moduleType = formData.get("moduleType") as string;
    const name = formData.get("name") as string;

    if (!moduleType) {
        return badRequest({ error: "Module type is required" });
    }

    // Build settings based on module type
    let settings: CourseModuleSettingsV1;

    switch (moduleType) {
        case "page":
        case "whiteboard":
            settings = {
                version: "v1",
                settings: {
                    type: moduleType,
                    name: name || undefined,
                },
            };
            break;

        case "assignment": {
            const allowSubmissionsFrom = formData.get("allowSubmissionsFrom") as string;
            const dueDate = formData.get("dueDate") as string;
            const cutoffDate = formData.get("cutoffDate") as string;

            settings = {
                version: "v1",
                settings: {
                    type: "assignment",
                    name: name || undefined,
                    allowSubmissionsFrom: allowSubmissionsFrom || undefined,
                    dueDate: dueDate || undefined,
                    cutoffDate: cutoffDate || undefined,
                },
            };
            break;
        }

        case "quiz": {
            const openingTime = formData.get("openingTime") as string;
            const closingTime = formData.get("closingTime") as string;

            settings = {
                version: "v1",
                settings: {
                    type: "quiz",
                    name: name || undefined,
                    openingTime: openingTime || undefined,
                    closingTime: closingTime || undefined,
                },
            };
            break;
        }

        case "discussion": {
            const dueDate = formData.get("dueDate") as string;
            const cutoffDate = formData.get("cutoffDate") as string;

            settings = {
                version: "v1",
                settings: {
                    type: "discussion",
                    name: name || undefined,
                    dueDate: dueDate || undefined,
                    cutoffDate: cutoffDate || undefined,
                },
            };
            break;
        }

        default:
            return badRequest({ error: "Invalid module type" });
    }

    // Update the settings
    const result = await tryUpdateCourseModuleSettings(
        payload,
        request,
        moduleLinkId,
        settings,
    );

    if (!result.ok) {
        return badRequest({ error: result.error.message });
    }

    // Redirect to the module page
    return redirect(href("/course/module/:id", { id: moduleLinkId.toString() }));
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
    const actionData = await serverAction();

    if (actionData?.status === StatusCode.BadRequest) {
        notifications.show({
            title: "Error",
            message:
                typeof actionData.error === "string"
                    ? actionData.error
                    : "Failed to update module settings",
            color: "red",
        });
    }

    return actionData;
}

type UpdateModuleValues = {
    moduleType: string;
    name?: string;
    // Assignment fields
    allowSubmissionsFrom?: Date | null;
    assignmentDueDate?: Date | null;
    assignmentCutoffDate?: Date | null;
    // Quiz fields
    quizOpeningTime?: Date | null;
    quizClosingTime?: Date | null;
    // Discussion fields
    discussionDueDate?: Date | null;
    discussionCutoffDate?: Date | null;
};

const useUpdateCourseModule = () => {
    const fetcher = useFetcher<typeof action>();

    const updateModule = (values: UpdateModuleValues) => {
        const formData = new FormData();
        formData.append("moduleType", values.moduleType);

        if (values.name) {
            formData.append("name", values.name);
        }

        // Add module-specific fields
        if (values.moduleType === "assignment") {
            if (values.allowSubmissionsFrom) {
                formData.append("allowSubmissionsFrom", values.allowSubmissionsFrom.toISOString());
            }
            if (values.assignmentDueDate) {
                formData.append("dueDate", values.assignmentDueDate.toISOString());
            }
            if (values.assignmentCutoffDate) {
                formData.append("cutoffDate", values.assignmentCutoffDate.toISOString());
            }
        } else if (values.moduleType === "quiz") {
            if (values.quizOpeningTime) {
                formData.append("openingTime", values.quizOpeningTime.toISOString());
            }
            if (values.quizClosingTime) {
                formData.append("closingTime", values.quizClosingTime.toISOString());
            }
        } else if (values.moduleType === "discussion") {
            if (values.discussionDueDate) {
                formData.append("dueDate", values.discussionDueDate.toISOString());
            }
            if (values.discussionCutoffDate) {
                formData.append("cutoffDate", values.discussionCutoffDate.toISOString());
            }
        }

        fetcher.submit(formData, { method: "POST" });
    };

    return {
        updateModule,
        isLoading: fetcher.state !== "idle",
        state: fetcher.state,
        data: fetcher.data,
    };
};

export default function ModuleEditPage({ loaderData }: Route.ComponentProps) {

    const { course, module, moduleLinkId, settings } = loaderData;
    const navigate = useNavigate();
    const { updateModule, isLoading } = useUpdateCourseModule();

    // Parse existing settings
    const existingSettings = settings?.settings;

    // Use custom name if available, otherwise use module title
    const displayName = existingSettings?.name ?? module.title;

    // Initialize form with existing values
    const form = useForm({
        mode: "uncontrolled",
        initialValues: {
            moduleType: module.type,
            name: existingSettings?.name || "",
            // Assignment fields
            allowSubmissionsFrom: existingSettings?.type === "assignment" && existingSettings.allowSubmissionsFrom
                ? new Date(existingSettings.allowSubmissionsFrom)
                : null,
            assignmentDueDate: existingSettings?.type === "assignment" && existingSettings.dueDate
                ? new Date(existingSettings.dueDate)
                : null,
            assignmentCutoffDate: existingSettings?.type === "assignment" && existingSettings.cutoffDate
                ? new Date(existingSettings.cutoffDate)
                : null,
            // Quiz fields
            quizOpeningTime: existingSettings?.type === "quiz" && existingSettings.openingTime
                ? new Date(existingSettings.openingTime)
                : null,
            quizClosingTime: existingSettings?.type === "quiz" && existingSettings.closingTime
                ? new Date(existingSettings.closingTime)
                : null,
            // Discussion fields
            discussionDueDate: existingSettings?.type === "discussion" && existingSettings.dueDate
                ? new Date(existingSettings.dueDate)
                : null,
            discussionCutoffDate: existingSettings?.type === "discussion" && existingSettings.cutoffDate
                ? new Date(existingSettings.cutoffDate)
                : null,
        },
    });

    const handleSubmit = (values: typeof form.values) => {
        updateModule(values);
    };

    const title = `Edit Module Settings | ${displayName} | ${course.title} | Paideia LMS`;

    return (
        <Container size="md" py="xl">
            <title>
                {title}
            </title>
            <meta name="description" content="Edit course module settings" />
            <meta property="og:title" content={title} />
            <meta property="og:description" content="Edit course module settings" />

            <Stack gap="xl">
                <Group justify="space-between" align="center">
                    <Text size="sm" c="dimmed">
                        Editing course-specific settings for this module.
                        <Anchor
                            href={href("/user/module/edit/:moduleId", { moduleId: module.id.toString() })}
                            ml="xs"
                        >
                            Edit module content →
                        </Anchor>
                    </Text>
                </Group>

                <Paper shadow="sm" p="xl" withBorder>
                    <form onSubmit={form.onSubmit(handleSubmit)}>
                        <Stack gap="md">
                            <TextInput
                                label="Custom Module Name"
                                placeholder="Leave empty to use default module name"
                                disabled={isLoading}
                                description="Override the module name for this course"
                                {...form.getInputProps("name")}
                            />

                            {module.type === "assignment" && (
                                <>
                                    <DateTimePicker
                                        label="Allow Submissions From"
                                        placeholder="Select date and time"
                                        disabled={isLoading}
                                        clearable
                                        description="When students can start submitting"
                                        {...form.getInputProps("allowSubmissionsFrom")}
                                    />

                                    <DateTimePicker
                                        label="Due Date"
                                        placeholder="Select date and time"
                                        disabled={isLoading}
                                        clearable
                                        description="Assignment due date"
                                        {...form.getInputProps("assignmentDueDate")}
                                    />

                                    <DateTimePicker
                                        label="Cutoff Date"
                                        placeholder="Select date and time"
                                        disabled={isLoading}
                                        clearable
                                        description="Latest possible submission time"
                                        {...form.getInputProps("assignmentCutoffDate")}
                                    />
                                </>
                            )}

                            {module.type === "quiz" && (
                                <>
                                    <DateTimePicker
                                        label="Opening Time"
                                        placeholder="Select date and time"
                                        disabled={isLoading}
                                        clearable
                                        description="When quiz becomes available"
                                        {...form.getInputProps("quizOpeningTime")}
                                    />

                                    <DateTimePicker
                                        label="Closing Time"
                                        placeholder="Select date and time"
                                        disabled={isLoading}
                                        clearable
                                        description="When quiz closes"
                                        {...form.getInputProps("quizClosingTime")}
                                    />
                                </>
                            )}

                            {module.type === "discussion" && (
                                <>
                                    <DateTimePicker
                                        label="Due Date"
                                        placeholder="Select date and time"
                                        disabled={isLoading}
                                        clearable
                                        description="Discussion due date"
                                        {...form.getInputProps("discussionDueDate")}
                                    />

                                    <DateTimePicker
                                        label="Cutoff Date"
                                        placeholder="Select date and time"
                                        disabled={isLoading}
                                        clearable
                                        description="Discussion cutoff date"
                                        {...form.getInputProps("discussionCutoffDate")}
                                    />
                                </>
                            )}

                            {(module.type === "page" || module.type === "whiteboard") && (
                                <Text c="dimmed" size="sm">
                                    Only custom name can be configured for {module.type} modules.
                                </Text>
                            )}

                            <Group justify="flex-end" mt="md">
                                <Button
                                    variant="subtle"
                                    onClick={() =>
                                        navigate(
                                            href("/course/module/:id", { id: moduleLinkId.toString() }),
                                        )
                                    }
                                    disabled={isLoading}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" loading={isLoading}>
                                    Save Settings
                                </Button>
                            </Group>
                        </Stack>
                    </form>
                </Paper>
            </Stack>
        </Container>
    );
}

