import {
	ActionIcon,
	Avatar,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
import { IconEdit, IconTrash, IconUserPlus } from "@tabler/icons-react";
import { href, Link } from "react-router";
import type { Enrollment } from "server/contexts/course-context";
import {
	getEnrollmentStatusBadgeColor,
	getEnrollmentStatusLabel,
	getRoleBadgeColor,
	getRoleLabel,
} from "./course-view-utils";

interface EnrollmentsSectionProps {
	enrollments: Enrollment[];
	currentUserRole: string;
	fetcherState: string;
	onOpenEnrollModal: () => void;
	onEditEnrollment: (enrollment: Enrollment) => void;
	onDeleteEnrollment: (enrollmentId: number) => void;
}

export function EnrollmentsSection({
	enrollments,
	currentUserRole,
	fetcherState,
	onOpenEnrollModal,
	onEditEnrollment,
	onDeleteEnrollment,
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

				{enrollments.length === 0 ? (
					<Text c="dimmed" ta="center" py="xl">
						No users enrolled in this course yet.
					</Text>
				) : (
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
								{enrollments.map((enrollment: Enrollment) => {
									const email = enrollment.email || "Unknown";
									const username = email.split("@")[0] || "Unknown";
									const fullName = enrollment.name || "Unknown";

									return (
										<Table.Tr key={enrollment.id}>
											<Table.Td>
												<Group gap="sm">
													<Avatar size="sm" color="blue">
														{fullName.charAt(0)}
													</Avatar>
													<Text
														fw={500}
														component={Link}
														to={href("/user/profile/:id?", {
															id: String(enrollment.userId),
														})}
													>
														{fullName}
													</Text>
												</Group>
											</Table.Td>
											<Table.Td>
												<Text size="sm">{username}</Text>
											</Table.Td>
											<Table.Td>
												<Text size="sm">{email}</Text>
											</Table.Td>
											<Table.Td>
												<Badge
													color={getRoleBadgeColor(enrollment.role)}
													variant="light"
												>
													{getRoleLabel(enrollment.role)}
												</Badge>
											</Table.Td>
											<Table.Td>
												<Badge
													color={getEnrollmentStatusBadgeColor(
														enrollment.status,
													)}
												>
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
				)}
			</Stack>
		</Paper>
	);
}
