import {
    ActionIcon,
    Anchor,
    Badge,
    Box,
    Button,
    Checkbox,
    Collapse,
    Container,
    Group,
    Menu,
    Paper,
    ScrollArea,
    Stack,
    Table,
    Text,
    Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
    IconChevronDown,
    IconChevronRight,
    IconPencil,
    IconDots,
    IconMail,
    IconDownload,
    IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { href, Link, useFetcher } from "react-router";
import { notifications } from "@mantine/notifications";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryDeleteAssignmentSubmission } from "server/internal/assignment-submission-management";
import { canDeleteSubmissions, canSeeModuleSubmissions } from "server/utils/permissions";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import {
    SubmissionHistoryItem,
    type SubmissionData,
} from "~/components/submission-history";
import { badRequest, ForbiddenResponse, StatusCode, unauthorized } from "~/utils/responses";
import type { Route } from "./+types/module.$id.submissions";

export const loader = async ({ context }: Route.LoaderArgs) => {
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

    // Check if user can see submissions
    const canSee = canSeeModuleSubmissions(
        currentUser,
        enrolmentContext?.enrolment,
    );

    if (!canSee) {
        throw new ForbiddenResponse(
            "You don't have permission to view submissions",
        );
    }

    // Check if user can delete submissions
    const canDelete = canDeleteSubmissions(
        currentUser,
        enrolmentContext?.enrolment,
    );

    // Get all enrollments for this course to show all students, filter out students
    const enrollments = courseContext.course.enrollments.filter(enrollment => enrollment.role === "student");

    return {
        module: courseModuleContext.module,
        moduleSettings: courseModuleContext.moduleLinkSettings,
        course: courseContext.course,
        enrollments,
        submissions: courseModuleContext.submissions,
        moduleLinkId: courseModuleContext.moduleLinkId,
        canDelete,
    };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
    assertRequestMethod(request.method, "DELETE");

    const { payload } = context.get(globalContextKey);
    const userSession = context.get(userContextKey);
    const enrolmentContext = context.get(enrolmentContextKey);

    if (!userSession?.isAuthenticated) {
        return unauthorized({ error: "Unauthorized" });
    }

    const currentUser = userSession.effectiveUser || userSession.authenticatedUser;

    // Check if user can delete submissions
    const canDelete = canDeleteSubmissions(
        currentUser,
        enrolmentContext?.enrolment,
    );

    if (!canDelete) {
        return unauthorized({ error: "You don't have permission to delete submissions" });
    }

    // Get submission ID from request
    const formData = await request.formData();
    const submissionId = formData.get("submissionId");

    if (!submissionId || typeof submissionId !== "string") {
        return badRequest({ error: "Submission ID is required" });
    }

    const id = Number.parseInt(submissionId, 10);
    if (Number.isNaN(id)) {
        return badRequest({ error: "Invalid submission ID" });
    }

    // Delete the submission
    const deleteResult = await tryDeleteAssignmentSubmission(payload, id);

    if (!deleteResult.ok) {
        return badRequest({ error: deleteResult.error.message });
    }

    return { success: true };
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
    const actionData = await serverAction();

    if ("status" in actionData && (actionData.status === StatusCode.BadRequest || actionData.status === StatusCode.Unauthorized)) {
        notifications.show({
            title: "Error",
            message:
                "error" in actionData && typeof actionData.error === "string"
                    ? actionData.error
                    : "Failed to delete submission",
            color: "red",
        });
    } else if ("success" in actionData && actionData.success) {
        notifications.show({
            title: "Success",
            message: "Submission deleted successfully",
            color: "green",
        });
    }

    return actionData;
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
    return <DefaultErrorBoundary error={error} />;
};

// ============================================================================
// Types
// ============================================================================

type SubmissionType = SubmissionData & {
    student: {
        id: number;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
    };
};

// ============================================================================
// Sub-components
// ============================================================================

function StudentSubmissionRow({
    enrollment,
    studentSubmissions,
    isSelected,
    onSelectRow,
    canDelete,
    onDeleteSubmission,
    moduleLinkId,
}: {
    enrollment: Route.ComponentProps["loaderData"]["enrollments"][number];
    studentSubmissions: SubmissionType[] | undefined;
    isSelected: boolean;
    onSelectRow: (enrollmentId: number, checked: boolean) => void;
    canDelete: boolean;
    onDeleteSubmission: (submissionId: number) => void;
    moduleLinkId: number;
}) {
    const [opened, { toggle }] = useDisclosure(false);

    const latestSubmission = studentSubmissions?.[0];
    const email = enrollment.email || "-";
    const studentId = enrollment.userId;

    // Sort submissions by attempt number (newest first)
    const sortedSubmissions = studentSubmissions
        ? [...studentSubmissions].sort((a, b) => {
            const attemptA = a.attemptNumber || 0;
            const attemptB = b.attemptNumber || 0;
            return attemptB - attemptA;
        })
        : [];

    // Filter out draft submissions for display
    const submittedSubmissions = sortedSubmissions.filter(
        (sub) => sub.status !== "draft",
    );

    const hasSubmissions = submittedSubmissions.length > 0;

    return (
        <>
            <Table.Tr
            >
                <Table.Td>
                    <Checkbox
                        aria-label="Select row"
                        checked={isSelected}
                        onChange={(event) =>
                            onSelectRow(enrollment.id, event.currentTarget.checked)
                        }
                    />
                </Table.Td>
                <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                        {hasSubmissions && (
                            <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={toggle}
                                aria-label={opened ? "Collapse" : "Expand"}
                            >
                                {opened ? (
                                    <IconChevronDown size={16} />
                                ) : (
                                    <IconChevronRight size={16} />
                                )}
                            </ActionIcon>
                        )}
                        {!hasSubmissions && <Box style={{ width: 28 }} />}
                        <div>
                            <Anchor
                                component={Link}
                                to={href("/user/profile/:id?", { id: studentId.toString() })}
                                size="sm"
                            >
                                {enrollment.name}
                            </Anchor>
                        </div>
                    </Group>
                </Table.Td>
                <Table.Td>{email}</Table.Td>
                <Table.Td>
                    {latestSubmission && "status" in latestSubmission ? (
                        <Badge
                            color={
                                latestSubmission.status === "graded"
                                    ? "green"
                                    : latestSubmission.status === "submitted"
                                        ? "blue"
                                        : "gray"
                            }
                            variant="light"
                        >
                            {latestSubmission.status === "draft"
                                ? "No submission"
                                : latestSubmission.status}
                        </Badge>
                    ) : (
                        <Badge color="gray" variant="light">
                            No submission
                        </Badge>
                    )}
                </Table.Td>
                <Table.Td>
                    {hasSubmissions ? (
                        <Text size="sm">{submittedSubmissions.length}</Text>
                    ) : (
                        <Text size="sm" c="dimmed">
                            0
                        </Text>
                    )}
                </Table.Td>
                <Table.Td>
                    {latestSubmission &&
                        "submittedAt" in latestSubmission &&
                        latestSubmission.submittedAt
                        ? new Date(latestSubmission.submittedAt).toLocaleString()
                        : "-"}
                </Table.Td>
                <Table.Td>
                    <Group gap="xs">
                        <Button
                            component={Link}
                            to={
                                hasSubmissions && latestSubmission
                                    ? href("/course/module/:id/grading", {
                                        id: moduleLinkId.toString(),
                                    }) + `?submissionId=${latestSubmission.id}`
                                    : "#"
                            }
                            size="xs"
                            variant="light"
                            leftSection={<IconPencil size={14} />}
                            disabled={!hasSubmissions}
                        >
                            Grade
                        </Button>
                    </Group>
                </Table.Td>
            </Table.Tr>
            {hasSubmissions && (
                <Table.Tr>
                    <Table.Td colSpan={8} p={0}>
                        <Collapse in={opened}>
                            <Box p="md" >
                                <Stack gap="md">
                                    <Text size="sm" fw={600}>
                                        Submission History ({submittedSubmissions.length}{" "}
                                        {submittedSubmissions.length === 1 ? "attempt" : "attempts"}
                                        )
                                    </Text>
                                    {/* sort by submittedAt ascending */}
                                    {submittedSubmissions.sort((a, b) => {
                                        const dateA = a.submittedAt ? new Date(a.submittedAt) : new Date(0);
                                        const dateB = b.submittedAt ? new Date(b.submittedAt) : new Date(0);
                                        return dateB.getTime() - dateA.getTime();
                                    }).map((submission, index) => (
                                        <SubmissionHistoryItem
                                            key={submission.id}
                                            attemptNumber={submittedSubmissions.length - index}
                                            submission={submission}
                                            showDelete={canDelete}
                                            onDelete={(submissionId) => {
                                                onDeleteSubmission(submissionId);
                                            }}
                                            showGrade={true}
                                            moduleLinkId={moduleLinkId}
                                        />
                                    ))}
                                </Stack>
                            </Box>
                        </Collapse>
                    </Table.Td>
                </Table.Tr>
            )}
        </>
    );
}

// ============================================================================
// Hooks
// ============================================================================

const useDeleteSubmission = () => {
    const fetcher = useFetcher<typeof clientAction>();

    const deleteSubmission = (submissionId: number) => {
        const formData = new FormData();
        formData.append("submissionId", submissionId.toString());

        fetcher.submit(formData, {
            method: "DELETE",
        });
    };

    return {
        deleteSubmission,
        isDeleting: fetcher.state !== "idle",
        state: fetcher.state,
        data: fetcher.data,
    };
};

// ============================================================================
// Main Component
// ============================================================================

export default function ModuleSubmissionsPage({
    loaderData,
}: Route.ComponentProps) {
    const { module, moduleSettings, course, enrollments, submissions, canDelete } =
        loaderData;

    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const { deleteSubmission } = useDeleteSubmission();

    const title = `${moduleSettings?.settings.name ?? module.title} - ${module.type === "quiz" ? "Results" : "Submissions"} | ${course.title} | Paideia LMS`;

    // Create a map of submissions by student ID
    const submissionsByStudent = new Map<number, SubmissionType[]>();
    for (const submission of submissions) {
        const studentId = submission.student.id;
        if (!submissionsByStudent.has(studentId)) {
            submissionsByStudent.set(studentId, []);
        }
        submissionsByStudent.get(studentId)?.push(submission as SubmissionType);
    }

    const allRowIds = enrollments.map((e) => e.id);
    const allSelected = allRowIds.length > 0 && selectedRows.length === allRowIds.length;
    const someSelected = selectedRows.length > 0 && !allSelected;

    const handleSelectAll = () => {
        setSelectedRows(allSelected ? [] : allRowIds);
    };

    const handleSelectRow = (enrollmentId: number, checked: boolean) => {
        setSelectedRows(
            checked
                ? [...selectedRows, enrollmentId]
                : selectedRows.filter((id) => id !== enrollmentId),
        );
    };

    // Mock batch actions
    const handleBatchEmail = () => {
        console.log("Send email to selected students:", selectedRows);
        // TODO: Implement batch email functionality
    };

    const handleBatchExport = () => {
        console.log("Export selected submissions:", selectedRows);
        // TODO: Implement batch export functionality
    };

    const handleBatchGrade = () => {
        console.log("Batch grade selected submissions:", selectedRows);
        // TODO: Implement batch grading functionality
    };

    // Render content based on module type
    const renderSubmissions = () => {
        if (module.type === "assignment") {
            return (
                <Stack gap="md">
                    {selectedRows.length > 0 && (
                        <Paper withBorder p="md" >
                            <Group justify="space-between">
                                <Group gap="md">
                                    <Badge size="lg" variant="filled">
                                        {selectedRows.length} selected
                                    </Badge>
                                    <Text size="sm" c="dimmed">
                                        Batch actions available
                                    </Text>
                                </Group>
                                <Group gap="xs">
                                    <Button
                                        variant="light"
                                        leftSection={<IconPencil size={16} />}
                                        onClick={handleBatchGrade}
                                        size="sm"
                                    >
                                        Grade Selected
                                    </Button>
                                    <Button
                                        variant="light"
                                        leftSection={<IconMail size={16} />}
                                        onClick={handleBatchEmail}
                                        size="sm"
                                    >
                                        Email
                                    </Button>
                                    <Button
                                        variant="light"
                                        leftSection={<IconDownload size={16} />}
                                        onClick={handleBatchExport}
                                        size="sm"
                                    >
                                        Export
                                    </Button>
                                    <Menu position="bottom-end">
                                        <Menu.Target>
                                            <ActionIcon variant="light" size="lg">
                                                <IconDots size={18} />
                                            </ActionIcon>
                                        </Menu.Target>
                                        <Menu.Dropdown>
                                            <Menu.Item
                                                color="red"
                                                leftSection={<IconTrash size={16} />}
                                                onClick={() => console.log("Clear selection")}
                                            >
                                                Clear Selection
                                            </Menu.Item>
                                        </Menu.Dropdown>
                                    </Menu>
                                </Group>
                            </Group>
                        </Paper>
                    )}
                    <Paper withBorder shadow="sm" p="md" radius="md">
                        <ScrollArea>
                            <Table highlightOnHover style={{ minWidth: 900 }}>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th style={{ width: 40 }}>
                                            <Checkbox
                                                aria-label="Select all rows"
                                                checked={allSelected}
                                                indeterminate={someSelected}
                                                onChange={handleSelectAll}
                                            />
                                        </Table.Th>
                                        <Table.Th style={{ minWidth: 200 }}>Student Name</Table.Th>
                                        <Table.Th style={{ minWidth: 200 }}>Email</Table.Th>
                                        <Table.Th style={{ minWidth: 120 }}>Status</Table.Th>
                                        <Table.Th style={{ minWidth: 80 }}>Attempts</Table.Th>
                                        <Table.Th style={{ minWidth: 180 }}>Latest Submission</Table.Th>
                                        <Table.Th style={{ minWidth: 100 }}>Actions</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {enrollments.map((enrollment) => {
                                        const studentSubmissions = submissionsByStudent.get(
                                            enrollment.userId,
                                        );

                                        return (
                                            <StudentSubmissionRow
                                                key={enrollment.id}
                                                enrollment={enrollment}
                                                studentSubmissions={studentSubmissions}
                                                isSelected={selectedRows.includes(enrollment.id)}
                                                onSelectRow={handleSelectRow}
                                                canDelete={canDelete}
                                                onDeleteSubmission={deleteSubmission}
                                                moduleLinkId={loaderData.moduleLinkId}
                                            />
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        </ScrollArea>
                    </Paper>
                </Stack>
            );
        }

        if (module.type === "quiz") {
            return (
                <Paper withBorder shadow="sm" p="xl" radius="md">
                    <Group justify="center" align="center" style={{ minHeight: 200 }}>
                        <div style={{ textAlign: "center" }}>
                            <Title order={3} c="dimmed" mb="md">
                                Quiz Results
                            </Title>
                            <Text c="dimmed">Quiz results view coming soon...</Text>
                        </div>
                    </Group>
                </Paper>
            );
        }

        if (module.type === "discussion") {
            return (
                <Paper withBorder shadow="sm" p="xl" radius="md">
                    <Group justify="center" align="center" style={{ minHeight: 200 }}>
                        <div style={{ textAlign: "center" }}>
                            <Title order={3} c="dimmed" mb="md">
                                Discussion Submissions
                            </Title>
                            <Text c="dimmed">Discussion submissions view coming soon...</Text>
                        </div>
                    </Group>
                </Paper>
            );
        }

        return null;
    };

    return (
        <Container size="xl" py="xl">
            <title>{title}</title>
            <meta name="description" content={`${module.title} submissions`} />
            <meta property="og:title" content={title} />
            <meta
                property="og:description"
                content={`${module.title} submissions`}
            />

            {renderSubmissions()}
        </Container>
    );
}

