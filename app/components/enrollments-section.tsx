import {
	ActionIcon,
	Avatar,
	Badge,
	Box,
	Button,
	Checkbox,
	Group,
	Input,
	Menu,
	Modal,
	Paper,
	Stack,
	Table,
	Text,
	Textarea,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
	IconEdit,
	IconTrash,
	IconUserPlus,
	IconDots,
	IconMail,
	IconDownload,
	IconSend,
	IconCopy,
	IconCheck,
} from "@tabler/icons-react";
import { useState } from "react";
import { href, Link } from "react-router";
import { notifications } from "@mantine/notifications";
import { useClipboard } from "@mantine/hooks";
import type { Enrollment } from "server/contexts/course-context";
import {
	getEnrollmentStatusBadgeColor,
	getEnrollmentStatusLabel,
	getRoleBadgeColor,
	getRoleLabel,
} from "./course-view-utils";

interface EnrollmentsSectionProps {
	courseId: number
	enrollments: Enrollment[];
	currentUserRole: string;
	fetcherState: string;
	onOpenEnrollModal: () => void;
	onEditEnrollment: (enrollment: Enrollment) => void;
	onDeleteEnrollment: (enrollmentId: number) => void;
}

// Email modal component
interface EmailModalProps {
	opened: boolean;
	onClose: () => void;
	recipients: Array<{ name: string; email: string }>;
	onSend: (subject: string, message: string) => void;
}

function EmailModal({ opened, onClose, recipients, onSend }: EmailModalProps) {
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			subject: "",
			message: "",
		},
		validate: {
			subject: (value) => (value.trim().length === 0 ? "Subject is required" : null),
			message: (value) => (value.trim().length === 0 ? "Message is required" : null),
		},
	});

	const handleSubmit = form.onSubmit((values) => {
		onSend(values.subject, values.message);
		form.reset();
		onClose();
	});

	return (
		<Modal opened={opened} onClose={onClose} title="Send Email" size="lg">
			<form onSubmit={handleSubmit}>
				<Stack gap="md">
					<Box>
						<Text size="sm" fw={500} mb="xs">
							Recipients ({recipients.length})
						</Text>
						<Paper withBorder p="sm" bg="gray.0">
							<Group gap="xs">
								{recipients.map((recipient) => (
									<Badge key={recipient.email} size="sm" variant="light">
										{recipient.name}
									</Badge>
								))}
							</Group>
						</Paper>
					</Box>

					<Input.Wrapper label="Subject" required>
						<Input
							placeholder="Enter email subject..."
							{...form.getInputProps("subject")}
						/>
					</Input.Wrapper>

					<Textarea
						label="Message"
						placeholder="Enter your message..."
						minRows={6}
						required
						{...form.getInputProps("message")}
					/>

					<Group justify="flex-end" gap="xs">
						<Button variant="default" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" leftSection={<IconSend size={16} />}>
							Send Email
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}

export function EnrollmentsSection({
	enrollments,
	courseId,
	currentUserRole,
	fetcherState,
	onOpenEnrollModal,
	onEditEnrollment,
	onDeleteEnrollment,
}: EnrollmentsSectionProps) {
	const [selectedRows, setSelectedRows] = useState<number[]>([]);
	const [emailModalOpened, setEmailModalOpened] = useState(false);
	const clipboard = useClipboard({ timeout: 2000 });

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

	// Get selected enrollments
	const selectedEnrollments = enrollments.filter((e) =>
		selectedRows.includes(e.id),
	);

	// Batch email functionality
	const handleBatchEmail = () => {
		setEmailModalOpened(true);
	};

	const handleSendEmail = (subject: string, message: string) => {
		// TODO: Implement actual email sending via API
		console.log("Sending email to:", selectedEnrollments.map((e) => e.email));
		console.log("Subject:", subject);
		console.log("Message:", message);

		notifications.show({
			title: "Email Sent",
			message: `Email sent to ${selectedEnrollments.length} recipient${selectedEnrollments.length === 1 ? "" : "s"}`,
			color: "green",
		});

		setSelectedRows([]);
	};

	// CSV export functionality
	const handleBatchExport = () => {
		const headers = [
			"Name",
			"Email",
			"Role",
			"Status",
			"Groups",
			"User ID",
			"Enrollment ID",
		];

		const rows = selectedEnrollments.map((enrollment) => [
			enrollment.name || "",
			enrollment.email || "",
			getRoleLabel(enrollment.role),
			getEnrollmentStatusLabel(enrollment.status),
			enrollment.groups.map((g) => g.name).join("; "),
			enrollment.userId.toString(),
			enrollment.id.toString(),
		]);

		// Create CSV content
		const csvContent = [
			headers.join(","),
			...rows.map((row) =>
				row
					.map((cell) => {
						// Escape quotes and wrap in quotes if contains comma, quote, or newline
						const escaped = cell.replace(/"/g, '""');
						return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
					})
					.join(","),
			),
		].join("\n");

		// Create blob and download
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const link = document.createElement("a");
		const url = URL.createObjectURL(blob);

		link.setAttribute("href", url);
		link.setAttribute(
			"download",
			`enrollments-export-${new Date().toISOString().split("T")[0]}.csv`,
		);
		link.style.visibility = "hidden";

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		notifications.show({
			title: "Export Successful",
			message: `Exported ${selectedEnrollments.length} enrollment${selectedEnrollments.length === 1 ? "" : "s"} to CSV`,
			color: "green",
		});

		setSelectedRows([]);
	};

	const handleBatchDelete = () => {
		console.log("Delete selected enrollments:", selectedRows);
		// TODO: Implement batch delete functionality
	};

	// Copy email addresses to clipboard
	const handleCopyEmails = () => {
		const emails = selectedEnrollments
			.map((e) => e.email)
			.filter(Boolean)
			.join(", ");

		clipboard.copy(emails);

		notifications.show({
			title: "Copied to Clipboard",
			message: `Copied ${selectedEnrollments.length} email address${selectedEnrollments.length === 1 ? "" : "es"}`,
			color: "green",
		});
	};

	return (
		<>
			<EmailModal
				opened={emailModalOpened}
				onClose={() => setEmailModalOpened(false)}
				recipients={selectedEnrollments.map((e) => ({
					name: e.name || "Unknown",
					email: e.email || "",
				}))}
				onSend={handleSendEmail}
			/>

			<Paper withBorder shadow="sm" p="xl" radius="md">
				<Stack gap="lg">
					<Group justify="space-between">
						<Group gap="md">
							<Title order={2}>Enrollments</Title>
							{selectedRows.length > 0 && (
								<Badge size="lg" variant="filled">
									{selectedRows.length} selected
								</Badge>
							)}
						</Group>
						<Group gap="xs">
							{selectedRows.length > 0 && (
								<>
									<Button
										variant="light"
										leftSection={<IconMail size={16} />}
										onClick={handleBatchEmail}
										size="sm"
									>
										Email Selected
									</Button>
									<Button
										variant="light"
										color={clipboard.copied ? "teal" : undefined}
										leftSection={
											clipboard.copied ? <IconCheck size={16} /> : <IconCopy size={16} />
										}
										onClick={handleCopyEmails}
										size="sm"
									>
										{clipboard.copied ? "Copied!" : "Copy Emails"}
									</Button>
									<Button
										variant="light"
										leftSection={<IconDownload size={16} />}
										onClick={handleBatchExport}
										size="sm"
									>
										Export CSV
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
												onClick={handleBatchDelete}
											>
												Delete Selected
											</Menu.Item>
										</Menu.Dropdown>
									</Menu>
								</>
							)}
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
										<Table.Th style={{ width: 40 }}>
											<Checkbox
												aria-label="Select all rows"
												checked={allSelected}
												indeterminate={someSelected}
												onChange={handleSelectAll}
											/>
										</Table.Th>
										<Table.Th>Name</Table.Th>
										<Table.Th>Email</Table.Th>
										<Table.Th>Role</Table.Th>
										<Table.Th>Status</Table.Th>
										<Table.Th>Groups</Table.Th>
										<Table.Th>Last Access</Table.Th>
										{currentUserRole === "admin" && <Table.Th>Actions</Table.Th>}
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{enrollments.map((enrollment: Enrollment) => {
										const email = enrollment.email || "Unknown";
										const fullName = enrollment.name || "Unknown";
										const isSelected = selectedRows.includes(enrollment.id);

										return (
											<Table.Tr
												key={enrollment.id}
												bg={
													isSelected
														? "var(--mantine-color-blue-light)"
														: undefined
												}
											>
												<Table.Td>
													<Checkbox
														aria-label="Select row"
														checked={isSelected}
														onChange={(event) =>
															handleSelectRow(
																enrollment.id,
																event.currentTarget.checked,
															)
														}
													/>
												</Table.Td>
												<Table.Td>
													<Group gap="sm">
														<Avatar size="sm" color="blue">
															{fullName.charAt(0)}
														</Avatar>
														<Text
															fw={500}
															component={Link}
															to={href("/course/:id/participants/profile", {
																id: courseId.toString(),
															}) + `?userId=${enrollment.userId}`}
														>
															{fullName}
														</Text>
													</Group>
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
													{enrollment.groups.length > 0 ? (
														<Group gap="xs">
															{enrollment.groups.map((group) => (
																<Badge
																	key={group.id}
																	size="sm"
																	styles={{
																		root: {
																			"--badge-bg": group.color,
																		},
																	}}
																>
																	{group.name}
																</Badge>
															))}
														</Group>
													) : (
														<Text size="sm" c="dimmed">
															No groups
														</Text>
													)}
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
		</>
	);
}
