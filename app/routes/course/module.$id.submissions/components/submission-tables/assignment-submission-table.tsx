import {
	ActionIcon,
	Anchor,
	Badge,
	Box,
	Button,
	Checkbox,
	Collapse,
	Group,
	Menu,
	Paper,
	ScrollArea,
	Stack,
	Table,
	Text,
} from "@mantine/core";
import { useDisclosure, useClipboard } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
	IconChevronDown,
	IconChevronRight,
	IconDots,
	IconPencil,
	IconSend,
	IconMail,
	IconTrash,
} from "@tabler/icons-react";
import { href, Link } from "react-router";
import {
	type SubmissionData,
	SubmissionHistoryItem,
} from "~/components/submission-history";
import { groupSubmissionsByStudent } from "./helpers";

import {
	type Route,
	View,
	useDeleteSubmission,
	useReleaseGrade,
} from "app/routes/course/module.$id.submissions/route";
import { getRouteUrl } from "~/utils/search-params-utils";
import { useState } from "react";

type Enrollment = NonNullable<
	Route.ComponentProps["loaderData"]["enrollments"]
>[number];

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
// Components
// ============================================================================

export function AssignmentBatchActions({
	selectedCount,
	selectedEnrollments,
	onClearSelection,
}: {
	selectedCount: number;
	selectedEnrollments: Array<Enrollment>;
	onClearSelection: () => void;
}) {
	const clipboard = useClipboard({ timeout: 2000 });

	const handleBatchEmailCopy = () => {
		const emailAddresses = selectedEnrollments
			.map((e) => e.user.email)
			.filter((email): email is string => email !== null && email !== undefined)
			.join(", ");

		if (emailAddresses) {
			clipboard.copy(emailAddresses);
			notifications.show({
				title: "Copied",
				message: `Copied ${selectedEnrollments.length} email address${selectedEnrollments.length !== 1 ? "es" : ""} to clipboard`,
				color: "green",
			});
		}
	};

	if (selectedCount === 0) {
		return null;
	}

	return (
		<Paper withBorder p="md">
			<Group justify="space-between">
				<Group gap="md">
					<Badge size="lg" variant="filled">
						{selectedCount} selected
					</Badge>
					<Text size="sm" c="dimmed">
						Batch actions available
					</Text>
				</Group>
				<Group gap="xs">
					<Button
						variant="light"
						color={clipboard.copied ? "teal" : "blue"}
						leftSection={<IconMail size={16} />}
						onClick={handleBatchEmailCopy}
						size="sm"
					>
						{clipboard.copied ? "Copied!" : "Copy Emails"}
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
								onClick={onClearSelection}
							>
								Clear Selection
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Group>
			</Group>
		</Paper>
	);
}

function StudentSubmissionRow({
	courseId,
	enrollment,
	studentSubmissions,
	isSelected,
	onSelectRow,
	canDelete,
	moduleLinkId,
}: {
	courseId: number;
	enrollment: Enrollment;
	studentSubmissions: SubmissionType[] | undefined;
	isSelected: boolean;
	onSelectRow: (enrollmentId: number, checked: boolean) => void;
	canDelete: boolean;
	moduleLinkId: number;
}) {
	const { submit: deleteSubmission } = useDeleteSubmission();
	const { submit: releaseGrade, isLoading: isReleasing } = useReleaseGrade();
	const [opened, { toggle }] = useDisclosure(false);

	const latestSubmission = studentSubmissions?.[0];
	const email = enrollment.userEmail || "-";

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
								to={
									href("/course/:courseId/participants/profile", {
										courseId: String(courseId),
									}) + `?userId=${enrollment.user.id}`
								}
								size="sm"
							>
								{enrollment.user.firstName} {enrollment.user.lastName}
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
											// href("/course/module/:moduleLinkId/submissions", {
											// 	moduleLinkId: String(moduleLinkId),
											// }) +
											// `?action=${AssignmentActions.GRADE_SUBMISSION}&submissionId=${latestSubmission.id}`
											getRouteUrl("/course/module/:moduleLinkId/submissions", {
												params: { moduleLinkId: moduleLinkId.toString() },
												searchParams: {
													action: null,
													view: View.GRADING,
													submissionId: latestSubmission.id,
												},
											})
										}
										leftSection={<IconPencil size={14} />}
									>
										Grade
									</Menu.Item>
									{latestSubmission.grade &&
										latestSubmission.grade.baseGrade !== null &&
										latestSubmission.grade.baseGrade !== undefined && (
											<Menu.Item
												leftSection={<IconSend size={14} />}
												onClick={() => {
													releaseGrade({
														params: {
															moduleLinkId: moduleLinkId,
														},
														values: {
															courseModuleLinkId: moduleLinkId,
															enrollmentId: enrollment.id,
														},
													});
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
					<Table.Td colSpan={8} p={0}>
						<Collapse in={opened}>
							<Box p="md">
								<Stack gap="md">
									<Text size="sm" fw={600}>
										Submission History ({submittedSubmissions.length}{" "}
										{submittedSubmissions.length === 1 ? "attempt" : "attempts"}
										)
									</Text>
									{/* sort by submittedAt ascending */}
									{submittedSubmissions
										.sort((a, b) => {
											const dateA = a.submittedAt
												? new Date(a.submittedAt)
												: new Date(0);
											const dateB = b.submittedAt
												? new Date(b.submittedAt)
												: new Date(0);
											return dateB.getTime() - dateA.getTime();
										})
										.map((submission, index) => (
											<SubmissionHistoryItem
												key={submission.id}
												attemptNumber={
													submission.attemptNumber ??
													submittedSubmissions.length - index
												}
												submission={submission}
												showDelete={canDelete}
												onDelete={(submissionId) => {
													deleteSubmission({
														params: {
															moduleLinkId: moduleLinkId,
														},
														values: {
															submissionId: submissionId,
														},
													});
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

export function AssignmentSubmissionTable({
	courseId,
	enrollments,
	submissions,
	canDelete,
	moduleLinkId,
}: {
	courseId: number;
	enrollments: Enrollment[];
	submissions: SubmissionType[];
	canDelete: boolean;
	moduleLinkId: number;
}) {
	const [selectedRows, setSelectedRows] = useState<number[]>([]);

	const handleSelectRow = (enrollmentId: number, checked: boolean) => {
		setSelectedRows(
			checked
				? [...selectedRows, enrollmentId]
				: selectedRows.filter((id) => id !== enrollmentId),
		);
	};

	const handleClearSelection = () => {
		setSelectedRows([]);
	};

	const selectedEnrollments = enrollments.filter((e) =>
		selectedRows.includes(e.id),
	);

	// Group submissions by student ID
	const submissionsByStudent = groupSubmissionsByStudent(submissions);

	const allRowIds = enrollments.map((e) => e.id);
	const allSelected =
		allRowIds.length > 0 && selectedRows.length === allRowIds.length;
	const someSelected = selectedRows.length > 0 && !allSelected;

	const handleSelectAll = () => {
		// Select all or deselect all
		if (allSelected) {
			for (const id of allRowIds) {
				handleSelectRow(id, false);
			}
		} else {
			for (const id of allRowIds) {
				handleSelectRow(id, true);
			}
		}
	};

	return (
		<Stack gap="md">
			<AssignmentBatchActions
				selectedCount={selectedRows.length}
				selectedEnrollments={selectedEnrollments}
				onClearSelection={handleClearSelection}
			/>
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
									enrollment.user.id,
								);

								return (
									<StudentSubmissionRow
										key={enrollment.id}
										courseId={courseId}
										enrollment={enrollment}
										studentSubmissions={studentSubmissions}
										isSelected={selectedRows.includes(enrollment.id)}
										onSelectRow={handleSelectRow}
										canDelete={canDelete}
										moduleLinkId={moduleLinkId}
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
