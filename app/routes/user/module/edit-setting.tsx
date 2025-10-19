import { Button, Container, Paper, Select, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useFetcher, useLoaderData } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { userModuleContextKey } from "server/contexts/user-module-context";
import {
    type UpdateActivityModuleArgs,
    tryUpdateActivityModule,
} from "server/internal/activity-module-management";
import {
    AssignmentForm,
    DiscussionForm,
    PageForm,
    QuizForm,
    WhiteboardForm,
} from "~/components/activity-module-forms";
import {
    type ActivityModuleFormValues,
    activityModuleSchema,
    transformFormValues,
    transformToActivityData,
} from "~/utils/activity-module-schema";
import { getDataAndContentTypeFromRequest } from "~/utils/get-content-type";
import {
    badRequest,
    NotFoundResponse,
    ok,
    StatusCode,
} from "~/utils/responses";
import type { Route } from "./+types/edit-setting";

export const loader = async ({ context }: Route.LoaderArgs) => {
    const userModuleContext = context.get(userModuleContextKey);

    if (!userModuleContext) {
        throw new NotFoundResponse("Module context not found");
    }

    return {
        module: userModuleContext.module,
    };
};

export const action = async ({
    request,
    context,
    params,
}: Route.ActionArgs) => {
    const payload = context.get(globalContextKey).payload;
    const userSession = context.get(userContextKey);

    if (!userSession?.isAuthenticated) {
        return badRequest({
            success: false,
            error: "You must be logged in to edit modules",
        });
    }

    const moduleId = params.moduleId;
    if (!moduleId) {
        return badRequest({
            success: false,
            error: "Module ID is required",
        });
    }

    const { data } = await getDataAndContentTypeFromRequest(request);
    const parsedData = activityModuleSchema.parse(data);

    const { pageData, whiteboardData, assignmentData, quizData, discussionData } =
        transformToActivityData(parsedData);

    // Build args based on module type (discriminated union)
    const baseArgs = {
        id: Number(moduleId),
        title: parsedData.title,
        description: parsedData.description,
        status: parsedData.status,
        requirePassword: parsedData.requirePassword,
        accessPassword: parsedData.accessPassword,
    };

    let updateArgs: UpdateActivityModuleArgs;
    if (parsedData.type === "page" && pageData) {
        updateArgs = { ...baseArgs, type: "page" as const, pageData };
    } else if (parsedData.type === "whiteboard" && whiteboardData) {
        updateArgs = { ...baseArgs, type: "whiteboard" as const, whiteboardData };
    } else if (parsedData.type === "assignment" && assignmentData) {
        updateArgs = { ...baseArgs, type: "assignment" as const, assignmentData };
    } else if (parsedData.type === "quiz" && quizData) {
        updateArgs = { ...baseArgs, type: "quiz" as const, quizData };
    } else if (parsedData.type === "discussion" && discussionData) {
        updateArgs = { ...baseArgs, type: "discussion" as const, discussionData };
    } else {
        return badRequest({
            success: false,
            error: `Invalid module type or missing data for ${parsedData.type}`,
        });
    }

    const updateResult = await tryUpdateActivityModule(payload, updateArgs);

    if (!updateResult.ok) {
        return badRequest({
            success: false,
            error: updateResult.error.message,
        });
    }

    return ok({
        success: true,
        message: "Module updated successfully",
    });
};

export const clientAction = async ({
    serverAction,
}: Route.ClientActionArgs) => {
    const actionData = await serverAction();

    if (actionData?.status === StatusCode.Ok) {
        notifications.show({
            title: "Success",
            message: actionData?.message,
            color: "green",
        });
    }

    return actionData;
};
export default function EditModulePage() {
    const { module } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof clientAction>();

    // Extract activity-specific data
    const pageData = module.page;
    const whiteboardData = module.whiteboard;
    const assignmentData = module.assignment;
    const quizData = module.quiz;
    const discussionData = module.discussion;

    const form = useForm<ActivityModuleFormValues>({
        mode: "uncontrolled",
        initialValues: {
            title: module.title,
            description: module.description || "",
            type: module.type,
            status: module.status,
            requirePassword: module.requirePassword || false,
            accessPassword: module.accessPassword || "",
            // Page fields
            pageContent: pageData?.content || "",
            // Whiteboard fields
            whiteboardContent: whiteboardData?.content || "",
            // Assignment fields
            assignmentInstructions: assignmentData?.instructions || "",
            assignmentDueDate: assignmentData?.dueDate
                ? new Date(assignmentData.dueDate)
                : null,
            assignmentMaxAttempts: assignmentData?.maxAttempts || 1,
            assignmentAllowLateSubmissions:
                assignmentData?.allowLateSubmissions || false,
            assignmentRequireTextSubmission:
                assignmentData?.requireTextSubmission || false,
            assignmentRequireFileSubmission:
                assignmentData?.requireFileSubmission || false,
            // Quiz fields
            quizInstructions: quizData?.instructions || "",
            quizDueDate: quizData?.dueDate ? new Date(quizData.dueDate) : null,
            quizMaxAttempts: quizData?.maxAttempts || 1,
            quizPoints: quizData?.points || 100,
            quizTimeLimit: quizData?.timeLimit || 60,
            quizGradingType: quizData?.gradingType || "automatic",
            // Discussion fields
            discussionInstructions: discussionData?.instructions || "",
            discussionDueDate: discussionData?.dueDate
                ? new Date(discussionData.dueDate)
                : null,
            discussionRequireThread: discussionData?.requireThread || false,
            discussionRequireReplies: discussionData?.requireReplies || false,
            discussionMinReplies: discussionData?.minReplies || 1,
        },
        validate: {
            title: (value) =>
                value.trim().length === 0 ? "Title is required" : null,
        },
    });

    const selectedType = form.getValues().type;

    return (
        <Container size="md" py="xl">
            <title>Edit Activity Module | Paideia LMS</title>
            <meta
                name="description"
                content="Edit an activity module in Paideia LMS"
            />
            <meta property="og:title" content="Edit Activity Module | Paideia LMS" />
            <meta
                property="og:description"
                content="Edit an activity module in Paideia LMS"
            />

            <Stack gap="xl">
                {/* Edit Form */}
                <Paper withBorder shadow="md" p="xl" radius="md">
                    <Title order={2} mb="lg">
                        Edit Activity Module
                    </Title>

                    <fetcher.Form
                        method="POST"
                        onSubmit={form.onSubmit((values) => {
                            const submissionData = transformFormValues(values);
                            fetcher.submit(submissionData, {
                                method: "POST",
                                encType: "application/json",
                            });
                        })}
                    >
                        <Stack gap="md">
                            <Select
                                {...form.getInputProps("type")}
                                key={form.key("type")}
                                label="Module Type"
                                placeholder="Select module type"
                                required
                                withAsterisk
                                disabled
                                data={[
                                    { value: "page", label: "Page" },
                                    { value: "whiteboard", label: "Whiteboard" },
                                    { value: "assignment", label: "Assignment" },
                                    { value: "quiz", label: "Quiz" },
                                    { value: "discussion", label: "Discussion" },
                                ]}
                            />

                            {selectedType === "page" && <PageForm form={form} />}
                            {selectedType === "whiteboard" && (
                                <WhiteboardForm
                                    form={form}
                                    isLoading={fetcher.state === "submitting"}
                                />
                            )}
                            {selectedType === "assignment" && <AssignmentForm form={form} />}
                            {selectedType === "quiz" && <QuizForm form={form} />}
                            {selectedType === "discussion" && <DiscussionForm form={form} />}

                            <Button
                                type="submit"
                                size="lg"
                                mt="lg"
                                loading={fetcher.state === "submitting"}
                            >
                                Update Module
                            </Button>
                        </Stack>
                    </fetcher.Form>
                </Paper>
            </Stack>
        </Container>
    );
}
