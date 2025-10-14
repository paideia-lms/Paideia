import {
    ActionIcon,
    Avatar,
    Badge,
    Box,
    Button,
    Group,
    Paper,
    Pagination,
    Stack,
    Table,
    Text,
    Title,
} from "@mantine/core";
import { IconEdit, IconTrash, IconUserPlus } from "@tabler/icons-react";
import type { Enrollment, User } from "server/payload-types";
import { getRoleBadgeColor, getRoleLabel, getEnrollmentStatusBadgeColor, getEnrollmentStatusLabel } from "./course-view-utils";
import { href, Link } from "react-router";

interface EnrollmentsSectionProps {
    enrollments: {
        docs: Enrollment[];
        totalDocs: number;
        totalPages: number;
        currentPage?: number;
    };
    currentUserRole: string;
    fetcherState: string;
    onOpenEnrollModal: () => void;
    onEditEnrollment: (enrollment: Enrollment) => void;
    onDeleteEnrollment: (enrollmentId: number) => void;
    onPageChange: (page: number) => void;
}

function getUserId(user: number | User) {
    return typeof user === "number" ? user : user.id;
}

export function EnrollmentsSection({
    enrollments,
    currentUserRole,
    fetcherState,
    onOpenEnrollModal,
    onEditEnrollment,
    onDeleteEnrollment,
    onPageChange,
}: EnrollmentsSectionProps) {
    return (
        <Paper withBorder shadow="sm" p="xl" radius="md">
            <Stack gap="lg">
                <Group justify="space-between">
                    <Title order={2}>Enrollments</Title>
                    {currentUserRole === "admin" && (
                        <Button
                            leftSection={<IconUserPlus size={16} />}
                            onClick={onOpenEnrollModal}
                            disabled={fetcherState === "submitting"}
                        >
                            Enrol User
                        </Button>
                    )}
                </Group>

                {enrollments.docs.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">
                        No users enrolled in this course yet.
                    </Text>
                ) : (
                    <>
                        <Box style={{ overflowX: "auto" }}>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Name</Table.Th>
                                        <Table.Th>Username</Table.Th>
                                        <Table.Th>Email</Table.Th>
                                        <Table.Th>Role</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th>Last Access</Table.Th>
                                        {currentUserRole === "admin" && <Table.Th>Actions</Table.Th>}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {enrollments.docs.map((enrollment: Enrollment) => {
                                        const user = typeof enrollment.user === "object" ? enrollment.user : null;
                                        const firstName = user?.firstName || "Unknown";
                                        const lastName = user?.lastName || "";
                                        const email = user?.email || "Unknown";
                                        const username = email.split("@")[0] || "Unknown";
                                        const fullName = `${firstName} ${lastName}`.trim() || "Unknown";

                                        return (
                                            <Table.Tr key={enrollment.id}>
                                                <Table.Td>
                                                    <Group gap="sm">
                                                        <Avatar size="sm" color="blue">
                                                            {firstName.charAt(0)}{lastName.charAt(0)}
                                                        </Avatar>
                                                        <Text fw={500} component={Link} to={href("/user/profile/:id?", { id: String(getUserId(enrollment.user)) })}>{fullName}</Text>
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text size="sm" >{username}</Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text size="sm">{email}</Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge color={getRoleBadgeColor(enrollment.role)} variant="light">
                                                        {getRoleLabel(enrollment.role)}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge color={getEnrollmentStatusBadgeColor(enrollment.status)}>
                                                        {getEnrollmentStatusLabel(enrollment.status)}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text size="sm" c="dimmed">
                                                        Never
                                                    </Text>
                                                </Table.Td>
                                                {currentUserRole === "admin" && (
                                                    <Table.Td>
                                                        <Group gap="xs">
                                                            <ActionIcon
                                                                variant="light"
                                                                color="blue"
                                                                size="md"
                                                                aria-label="Edit enrollment"
                                                                onClick={() => onEditEnrollment(enrollment)}
                                                                disabled={fetcherState === "submitting"}
                                                            >
                                                                <IconEdit size={16} />
                                                            </ActionIcon>
                                                            <ActionIcon
                                                                variant="light"
                                                                color="red"
                                                                size="md"
                                                                aria-label="Delete enrollment"
                                                                onClick={() => onDeleteEnrollment(enrollment.id)}
                                                                disabled={fetcherState === "submitting"}
                                                            >
                                                                <IconTrash size={16} />
                                                            </ActionIcon>
                                                        </Group>
                                                    </Table.Td>
                                                )}
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        </Box>

                        {enrollments.totalPages > 1 && (
                            <Group justify="center" mt="lg">
                                <Pagination
                                    total={enrollments.totalPages}
                                    value={enrollments.currentPage || 1}
                                    onChange={onPageChange}
                                />
                            </Group>
                        )}
                    </>
                )}
            </Stack>
        </Paper>
    );
}
