import {
    ActionIcon,
    Anchor,
    Badge,
    Box,
    Button,
    Collapse,
    Group,
    Menu,
    Paper,
    ScrollArea,
    Stack,
    Table,
    Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
    IconChevronDown,
    IconChevronRight,
    IconDots,
    IconPencil,
    IconSend,
} from "@tabler/icons-react";
import { href, Link } from "react-router";
import { DiscussionActions } from "~/utils/module-actions";

// ============================================================================
// Types
// ============================================================================

type DiscussionSubmissionType = {
    id: number;
    status: "draft" | "published" | "hidden" | "deleted";
    postType: "thread" | "reply" | "comment";
    title?: string | null;
    content: string;
    publishedAt?: string | null;
    createdAt: string;
    student: {
        id: number;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
    };
    grade?: {
        baseGrade: number | null;
        maxGrade: number | null;
        gradedAt?: string | null;
        feedback?: string | null;
    } | null;
};

type Enrollment = {
    id: number;
    userId: number;
    name: string;
    email?: string | null;
};

// ============================================================================
// Components
// ============================================================================

function DiscussionSubmissionHistoryItem({
    submission,
}: {
    submission: DiscussionSubmissionType;
}) {
    const postTypeLabel =
        submission.postType === "thread"
            ? "Thread"
            : submission.postType === "reply"
                ? "Reply"
                : "Comment";

    return (
        <Paper withBorder p="md" radius="sm">
            <Stack gap="md">
                <Group justify="space-between">
                    <Group gap="sm">
                        <Badge size="sm" variant="light" color="blue">
                            {postTypeLabel}
                        </Badge>
                        <Badge
                            color={
                                submission.status === "published"
                                    ? "green"
                                    : submission.status === "draft"
                                        ? "gray"
                                        : submission.status === "hidden"
                                            ? "yellow"
                                            : "red"
                            }
                            variant="light"
                        >
                            {submission.status}
                        </Badge>
                        {submission.grade &&
                            submission.grade.baseGrade !== null &&
                            submission.grade.baseGrade !== undefined && (
                                <Badge color="green" variant="filled">
                                    {submission.grade.maxGrade !== null &&
                                        submission.grade.maxGrade !== undefined
                                        ? `${submission.grade.baseGrade}/${submission.grade.maxGrade}`
                                        : String(submission.grade.baseGrade)}
                                </Badge>
                            )}
                        <Text size="xs" c="dimmed">
                            ID: {submission.id}
                        </Text>
                    </Group>
                </Group>
                {submission.title && (
                    <Text size="sm" fw={600}>
                        {submission.title}
                    </Text>
                )}
                <Text size="sm" lineClamp={3}>
                    {submission.content}
                </Text>
                <Group gap="sm">
                    {submission.publishedAt && (
                        <Text size="sm" c="dimmed">
                            Published: {new Date(submission.publishedAt).toLocaleString()}
                        </Text>
                    )}
                    {!submission.publishedAt && (
                        <Text size="sm" c="dimmed">
                            Created: {new Date(submission.createdAt).toLocaleString()}
                        </Text>
                    )}
                    {submission.grade?.gradedAt && (
                        <Text size="sm" c="dimmed">
                            • Graded: {new Date(submission.grade.gradedAt).toLocaleString()}
                        </Text>
                    )}
                </Group>
            </Stack>
        </Paper>
    );
}

function DiscussionStudentSubmissionRow({
    courseId,
    enrollment,
    studentSubmissions,
    moduleLinkId,
    onReleaseGrade,
    isReleasing,
}: {
    courseId: number;
    enrollment: Enrollment;
    studentSubmissions: DiscussionSubmissionType[] | undefined;
    moduleLinkId: number;
    onReleaseGrade?: (courseModuleLinkId: number, enrollmentId: number) => void;
    isReleasing?: boolean;
}) {
    const [opened, { toggle }] = useDisclosure(false);

    // Filter to only published submissions
    const publishedSubmissions = studentSubmissions
        ? studentSubmissions.filter((sub) => sub.status === "published")
        : [];

    // Sort by publishedAt or createdAt (newest first)
    const sortedSubmissions = [...publishedSubmissions].sort((a, b) => {
        const dateA = a.publishedAt
            ? new Date(a.publishedAt)
            : new Date(a.createdAt);
        const dateB = b.publishedAt
            ? new Date(b.publishedAt)
            : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
    });

    const hasSubmissions = sortedSubmissions.length > 0;
    const latestSubmission = sortedSubmissions[0];
    const email = enrollment.email || "-";

    // Count posts by type
    const threadCount = sortedSubmissions.filter(
        (sub) => sub.postType === "thread",
    ).length;
    const replyCount = sortedSubmissions.filter(
        (sub) => sub.postType === "reply",
    ).length;
    const commentCount = sortedSubmissions.filter(
        (sub) => sub.postType === "comment",
    ).length;

    // Calculate total score if graded
    const gradedSubmissions = sortedSubmissions.filter(
        (sub) =>
            sub.grade &&
            sub.grade.baseGrade !== null &&
            sub.grade.baseGrade !== undefined,
    );
    const totalScore = gradedSubmissions.reduce(
        (sum, sub) => sum + (sub.grade?.baseGrade || 0),
        0,
    );
    const maxScore = gradedSubmissions.reduce(
        (sum, sub) => sum + (sub.grade?.maxGrade || 0),
        0,
    );
    const averagePercentage =
        gradedSubmissions.length > 0 && maxScore > 0
            ? (totalScore / maxScore) * 100
            : null;

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
                                to={
                                    href("/course/:courseId/participants/profile", {
                                        courseId: String(courseId),
                                    }) + `?userId=${enrollment.userId}`
                                }
                                size="sm"
                            >
                                {enrollment.name}
                            </Anchor>
                        </div>
                    </Group>
                </Table.Td>
                <Table.Td>{email}</Table.Td>
                <Table.Td>
                    {hasSubmissions ? (
                        <Badge color="green" variant="light">
                            Active
                        </Badge>
                    ) : (
                        <Badge color="gray" variant="light">
                            No posts
                        </Badge>
                    )}
                </Table.Td>
                <Table.Td>
                    {hasSubmissions ? (
                        <Stack gap={2}>
                            <Text size="sm">
                                {threadCount} {threadCount === 1 ? "thread" : "threads"}
                            </Text>
                            <Text size="xs" c="dimmed">
                                {replyCount} replies, {commentCount} comments
                            </Text>
                        </Stack>
                    ) : (
                        <Text size="sm" c="dimmed">
                            0
                        </Text>
                    )}
                </Table.Td>
                <Table.Td>
                    {averagePercentage !== null ? (
                        <Text size="sm" fw={500}>
                            {totalScore > 0 && maxScore > 0
                                ? `${totalScore}/${maxScore}`
                                : ""}{" "}
                            ({averagePercentage.toFixed(1)}%)
                        </Text>
                    ) : (
                        <Text size="sm" c="dimmed">
                            -
                        </Text>
                    )}
                </Table.Td>
                <Table.Td>
                    {latestSubmission?.publishedAt
                        ? new Date(latestSubmission.publishedAt).toLocaleString()
                        : latestSubmission?.createdAt
                            ? new Date(latestSubmission.createdAt).toLocaleString()
                            : "-"}
                </Table.Td>
                <Table.Td>
                    <Group gap="xs">
                        {hasSubmissions && latestSubmission ? (
                            <Menu position="bottom-end">
                                <Menu.Target>
                                    <ActionIcon variant="light" size="lg">
                                        <IconDots size={18} />
                                    </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Item
                                        component={Link}
                                        to={
                                            href("/course/module/:moduleLinkId/submissions", {
                                                moduleLinkId: String(moduleLinkId),
                                            }) +
                                            `?action=${DiscussionActions.GRADE_SUBMISSION}&submissionId=${latestSubmission.id}`
                                        }
                                        leftSection={<IconPencil size={14} />}
                                    >
                                        Grade
                                    </Menu.Item>
                                    {latestSubmission.grade &&
                                        latestSubmission.grade.baseGrade !== null &&
                                        latestSubmission.grade.baseGrade !== undefined &&
                                        onReleaseGrade && (
                                            <Menu.Item
                                                leftSection={<IconSend size={14} />}
                                                onClick={() => {
                                                    onReleaseGrade(moduleLinkId, enrollment.id);
                                                }}
                                                disabled={isReleasing}
                                            >
                                                {isReleasing ? "Releasing..." : "Release Grade"}
                                            </Menu.Item>
                                        )}
                                </Menu.Dropdown>
                            </Menu>
                        ) : (
                            <Button size="xs" variant="light" disabled>
                                Actions
                            </Button>
                        )}
                    </Group>
                </Table.Td>
            </Table.Tr>
            {hasSubmissions && (
                <Table.Tr>
                    <Table.Td colSpan={7} p={0}>
                        <Collapse in={opened}>
                            <Box p="md">
                                <Stack gap="md">
                                    <Text size="sm" fw={600}>
                                        Post History ({sortedSubmissions.length}{" "}
                                        {sortedSubmissions.length === 1 ? "post" : "posts"})
                                    </Text>
                                    {sortedSubmissions.map((submission) => (
                                        <DiscussionSubmissionHistoryItem
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

export function DiscussionSubmissionTable({
    courseId,
    enrollments,
    submissions,
    moduleLinkId,
    onReleaseGrade,
    isReleasing,
}: {
    courseId: number;
    enrollments: Enrollment[];
    submissions: DiscussionSubmissionType[];
    moduleLinkId: number;
    onReleaseGrade?: (courseModuleLinkId: number, enrollmentId: number) => void;
    isReleasing?: boolean;
}) {
    // Create a map of discussion submissions by student ID
    const discussionSubmissionsByStudent = new Map<
        number,
        DiscussionSubmissionType[]
    >();
    for (const submission of submissions) {
        if (
            "postType" in submission &&
            "content" in submission &&
            submission.student &&
            typeof submission.student === "object" &&
            "id" in submission.student
        ) {
            const studentId = submission.student.id;
            if (!discussionSubmissionsByStudent.has(studentId)) {
                discussionSubmissionsByStudent.set(studentId, []);
            }
            discussionSubmissionsByStudent
                .get(studentId)
                ?.push(submission as DiscussionSubmissionType);
        }
    }

    // Sort submissions by publishedAt or createdAt (newest first) for each student
    for (const [studentId, studentSubmissions] of discussionSubmissionsByStudent) {
        discussionSubmissionsByStudent.set(
            studentId,
            studentSubmissions.sort((a, b) => {
                const dateA = a.publishedAt
                    ? new Date(a.publishedAt)
                    : new Date(a.createdAt);
                const dateB = b.publishedAt
                    ? new Date(b.publishedAt)
                    : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime();
            }),
        );
    }

    return (
        <Paper withBorder shadow="sm" p="md" radius="md">
            <ScrollArea>
                <Table highlightOnHover style={{ minWidth: 900 }}>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ minWidth: 200 }}>Student Name</Table.Th>
                            <Table.Th style={{ minWidth: 200 }}>Email</Table.Th>
                            <Table.Th style={{ minWidth: 100 }}>Status</Table.Th>
                            <Table.Th style={{ minWidth: 150 }}>Posts</Table.Th>
                            <Table.Th style={{ minWidth: 100 }}>Score</Table.Th>
                            <Table.Th style={{ minWidth: 180 }}>Latest Post</Table.Th>
                            <Table.Th style={{ minWidth: 100 }}>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {enrollments.map((enrollment) => {
                            const studentSubmissions = discussionSubmissionsByStudent.get(
                                enrollment.userId,
                            );

                            return (
                                <DiscussionStudentSubmissionRow
                                    key={enrollment.id}
                                    courseId={courseId}
                                    enrollment={enrollment}
                                    studentSubmissions={studentSubmissions}
                                    moduleLinkId={moduleLinkId}
                                    onReleaseGrade={onReleaseGrade}
                                    isReleasing={isReleasing}
                                />
                            );
                        })}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </Paper>
    );
}
