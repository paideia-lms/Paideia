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
	MultiSelect,
	Paper,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useClipboard, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
	IconCheck,
	IconCopy,
	IconDots,
	IconDownload,
	IconMail,
	IconSend,
	IconTrash,
	IconUserPlus,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import {
	getEnrollmentStatusBadgeColor,
	getEnrollmentStatusLabel,
	getEnrolmentRoleBadgeColor,
	getRoleLabel,
} from "../../../utils/course-view-utils";
import type { Route } from "app/routes/course.$id.participants/route";
import { DeleteEnrollmentButton } from "./delete-enrollment-modal";
import { EditEnrollmentButton } from "./edit-enrollment-modal";
import { getRouteUrl } from "app/utils/search-params-utils";
import type { SearchUser } from "~/routes/api/search-users";
import { SearchUserCombobox } from "~/routes/api/search-users";
import { useEnrollUser } from "../route";

type Enrollment = NonNullable<Route.ComponentProps["loaderData"]["enrolment"]>;

interface EnrollmentsSectionProps {
	courseId: number;
	enrollments: Enrollment[];
	currentUserRole: string;
	availableGroups: Array<{ value: string; label: string }>;
	enrolledUserIds: number[];
}

interface EnrollUserButtonProps {
	courseId: number;
	enrolledUserIds: number[];
	availableGroups: Array<{ value: string; label: string }>;
	disabled?: boolean;
}

function EnrollUserButton({
	courseId,
	enrolledUserIds,
	availableGroups,
	disabled = false,
}: EnrollUserButtonProps) {
	const [opened, { open, close }] = useDisclosure(false);
	const { submit: enrollUser, isLoading: isEnrolling } = useEnrollUser();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			selectedUsers: [] as SearchUser[],
			role: null as string | null,
			status: null as string | null,
			groups: [] as string[],
		},
		validate: {
			selectedUsers: (value) =>
				value.length === 0 ? "At least one user must be selected" : null,
			role: (value) => (!value ? "Role is required" : null),
			status: (value) => (!value ? "Status is required" : null),
		},
	});

	const handleSubmit = form.onSubmit(async (values) => {
		// Submit each user enrollment
		for (const user of values.selectedUsers) {
			await enrollUser({
				values: {
					userId: user.id,
					role: values.role as Enrollment["role"],
					status: values.status as Enrollment["status"],
					groups: values.groups.map(Number),
				},
				params: { courseId: courseId },
			});
		}
		form.reset();
		close();
	});

	return (
		<>
			<Button
				leftSection={<IconUserPlus size={16} />}
				onClick={open}
				disabled={disabled || isEnrolling}
			>
				Enrol User
			</Button>
			<Modal
				opened={opened}
				onClose={close}
				title="Enrol Users"
				centered
				size="md"
			>
				<form onSubmit={handleSubmit}>
					<Stack gap="md">
						<SearchUserCombobox
							value={form.getValues().selectedUsers}
							onChange={(users) => {
								form.setFieldValue("selectedUsers", users);
							}}
							placeholder="Search and select users to enroll..."
							excludeUserIds={enrolledUserIds}
							disabled={isEnrolling}
						/>
						<Select
							label="Role"
							placeholder="Select role"
							data={[
								{ value: "student", label: "Student" },
								{ value: "teacher", label: "Teacher" },
								{ value: "ta", label: "Teaching Assistant" },
								{ value: "manager", label: "Manager" },
							]}
							key={form.key("role")}
							{...form.getInputProps("role")}
							disabled={isEnrolling}
						/>
						<Select
							label="Status"
							placeholder="Select status"
							data={[
								{ value: "active", label: "Active" },
								{ value: "inactive", label: "Inactive" },
								{ value: "completed", label: "Completed" },
								{ value: "dropped", label: "Dropped" },
							]}
							key={form.key("status")}
							{...form.getInputProps("status")}
							disabled={isEnrolling}
						/>
						<MultiSelect
							label="Groups"
							placeholder="Select groups (optional)"
							data={availableGroups}
							key={form.key("groups")}
							{...form.getInputProps("groups")}
							disabled={isEnrolling}
							searchable
							clearable
						/>
						<Group justify="flex-end" gap="sm">
							<Button variant="default" onClick={close}>
								Cancel
							</Button>
							<Button type="submit" loading={isEnrolling}>
								Enrol {form.getValues().selectedUsers.length} User
								{form.getValues().selectedUsers.length !== 1 ? "s" : ""}
							</Button>
						</Group>
					</Stack>
				</form>
			</Modal>
		</>
	);
}

// Batch email button component with integrated modal
interface BatchEmailButtonProps {
	selectedEnrollments: Enrollment[];
	onEmailSent?: () => void;
}

function BatchEmailButton({
	selectedEnrollments,
	onEmailSent,
}: BatchEmailButtonProps) {
	const [opened, setOpened] = useState(false);
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			subject: "",
			message: "",
		},
		validate: {
			subject: (value) =>
				value.trim().length === 0 ? "Subject is required" : null,
			message: (value) =>
				value.trim().length === 0 ? "Message is required" : null,
		},
	});

	const recipients = selectedEnrollments.map((e) => ({
		name: e.user.firstName + " " + e.user.lastName,
		email: e.user.email || "",
	}));

	const handleSubmit = form.onSubmit((values) => {
		// TODO: Implement actual email sending via API
		console.log(
			"Sending email to:",
			selectedEnrollments.map((e) => e.user.email),
		);
		console.log("Subject:", values.subject);
		console.log("Message:", values.message);

		notifications.show({
			title: "NOT IMPLEMENTED",
			message: `This feature is not implemented yet.`,
			color: "red",
		});

		form.reset();
		setOpened(false);
		onEmailSent?.();
	});

	if (selectedEnrollments.length === 0) {
		return null;
	}

	return (
		<>
			<Button
				variant="light"
				leftSection={<IconMail size={16} />}
				onClick={() => setOpened(true)}
				size="sm"
			>
				Email Selected
			</Button>
			<Modal opened={opened} onClose={() => setOpened(false)} title="Send Email" size="lg">
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
							<Button variant="default" onClick={() => setOpened(false)}>
								Cancel
							</Button>
							<Button type="submit" leftSection={<IconSend size={16} />}>
								Send Email
							</Button>
						</Group>
					</Stack>
				</form>
			</Modal>
		</>
	);
}

export function EnrollmentsSection({
	enrollments,
	courseId,
	currentUserRole,
	availableGroups,
	enrolledUserIds,
}: EnrollmentsSectionProps) {
	const [selectedRows, setSelectedRows] = useState<number[]>([]);
	const clipboard = useClipboard({ timeout: 2000 });

	const allRowIds = enrollments.map((e) => e.id);
	const allSelected =
		allRowIds.length > 0 && selectedRows.length === allRowIds.length;
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

	const handleEmailSent = () => {
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
			enrollment.user.firstName + " " + enrollment.user.lastName,
			enrollment.user.email || "",
			getRoleLabel(enrollment.role),
			getEnrollmentStatusLabel(enrollment.status),
			enrollment.groups.map((g) => g.name).join("; "),
			enrollment.user.id.toString(),
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
			.map((e) => e.user.email)
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
								<BatchEmailButton
									selectedEnrollments={selectedEnrollments}
									onEmailSent={handleEmailSent}
								/>
								<Button
									variant="light"
									color={clipboard.copied ? "teal" : undefined}
									leftSection={
										clipboard.copied ? (
											<IconCheck size={16} />
										) : (
											<IconCopy size={16} />
										)
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
							<EnrollUserButton
								courseId={courseId}
								enrolledUserIds={enrolledUserIds}
								availableGroups={availableGroups}
							/>
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
									{currentUserRole === "admin" && (
										<Table.Th>Actions</Table.Th>
									)}
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{enrollments.map((enrollment) => {
									const email = enrollment.user.email || "Unknown";
									const fullName =
										enrollment.user.firstName +
										" " +
										enrollment.user.lastName;
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
														to={getRouteUrl("/course/:courseId/participants/profile", { params: { courseId: courseId.toString() }, searchParams: { userId: enrollment.user.id } })}
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
													color={getEnrolmentRoleBadgeColor(enrollment.role)}
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
														<EditEnrollmentButton
															enrollment={enrollment}
															courseId={courseId}
															availableGroups={availableGroups}
														/>
														<DeleteEnrollmentButton
															enrollmentId={enrollment.id}
															courseId={courseId}
														/>
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
