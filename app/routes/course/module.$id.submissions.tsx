import {
    ActionIcon,
    Anchor,
    Badge,
    Box,
    Button,
    Collapse,
    Container,
    Group,
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
} from "@tabler/icons-react";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { canSeeModuleSubmissions } from "server/utils/permissions";
import { DefaultErrorBoundary } from "~/components/admin-error-boundary";
import {
    SubmissionHistoryItem,
    type SubmissionData,
} from "~/components/submission-history";
import { ForbiddenResponse } from "~/utils/responses";
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

    // Get all enrollments for this course to show all students, filter out students
    const enrollments = courseContext.course.enrollments.filter(enrollment => enrollment.role === "student");

    return {
        module: courseModuleContext.module,
        moduleSettings: courseModuleContext.moduleLinkSettings,
        course: courseContext.course,
        enrollments,
        submissions: courseModuleContext.submissions,
        moduleLinkId: courseModuleContext.moduleLinkId,
    };
};

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
}: {
    enrollment: Route.ComponentProps["loaderData"]["enrollments"][number];
    studentSubmissions: SubmissionType[] | undefined;
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
            <Table.Tr>
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
                            component="a"
                            href="#"
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
                    <Table.Td colSpan={7} p={0}>
                        <Collapse in={opened}>
                            <Box p="md" bg="gray.0">
                                <Stack gap="md">
                                    <Text size="sm" fw={600}>
                                        Submission History ({submittedSubmissions.length}{" "}
                                        {submittedSubmissions.length === 1 ? "attempt" : "attempts"}
                                        )
                                    </Text>
                                    {submittedSubmissions.map((submission) => (
                                        <SubmissionHistoryItem
                                            key={submission.id}
                                            submission={submission}
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
// Main Component
// ============================================================================

export default function ModuleSubmissionsPage({
    loaderData,
}: Route.ComponentProps) {
    const { module, moduleSettings, course, enrollments, submissions } =
        loaderData;

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

    // Render content based on module type
    const renderSubmissions = () => {
        if (module.type === "assignment") {
            return (
                <Paper withBorder shadow="sm" p="md" radius="md">
                    <ScrollArea>
                        <Table highlightOnHover style={{ minWidth: 900 }}>
                            <Table.Thead>
                                <Table.Tr>
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
                                        />
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                </Paper>
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

