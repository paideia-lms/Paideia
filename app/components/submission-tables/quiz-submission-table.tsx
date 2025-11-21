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
import { QuizActions } from "~/utils/module-actions";
import { groupSubmissionsByStudent } from "./helpers";

// ============================================================================
// Types
// ============================================================================

type QuizSubmissionType = {
	id: number;
	status: "in_progress" | "completed" | "graded" | "returned";
	attemptNumber: number;
	startedAt?: string | null;
	submittedAt?: string | null;
	timeSpent?: number | null;
	totalScore?: number | null;
	maxScore?: number | null;
	percentage?: number | null;
	student: {
		id: number;
		firstName?: string | null;
		lastName?: string | null;
		email?: string | null;
	};
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

function QuizSubmissionHistoryItem({
	attemptNumber,
	submission,
}: {
	attemptNumber: number;
	submission: QuizSubmissionType;
}) {
	return (
		<Paper withBorder p="md" radius="sm">
			<Stack gap="md">
				<Group justify="space-between">
					<Group gap="sm">
						<Badge size="sm" variant="light">
							Attempt {attemptNumber}
						</Badge>
						<Badge
							color={
								submission.status === "graded"
									? "green"
									: submission.status === "returned"
										? "blue"
										: submission.status === "completed"
											? "yellow"
											: "gray"
							}
							variant="light"
						>
							{submission.status === "in_progress"
								? "In Progress"
								: submission.status === "completed"
									? "Completed"
									: submission.status === "graded"
										? "Graded"
										: "Returned"}
						</Badge>
						{submission.status === "graded" ||
							submission.status === "returned" ? (
							<Badge color="green" variant="filled">
								{submission.totalScore !== null &&
									submission.totalScore !== undefined &&
									submission.maxScore !== null &&
									submission.maxScore !== undefined
									? `${submission.totalScore}/${submission.maxScore}`
									: submission.totalScore !== null &&
										submission.totalScore !== undefined
										? String(submission.totalScore)
										: "-"}
								{submission.percentage !== null &&
									submission.percentage !== undefined
									? ` (${submission.percentage.toFixed(1)}%)`
									: ""}
							</Badge>
						) : null}
						<Text size="xs" c="dimmed">
							ID: {submission.id}
						</Text>
					</Group>
				</Group>
				<Group gap="sm">
					{submission.startedAt && (
						<Text size="sm" c="dimmed">
							Started: {new Date(submission.startedAt).toLocaleString()}
						</Text>
					)}
					{submission.submittedAt && (
						<Text size="sm" c="dimmed">
							{submission.startedAt ? "• " : ""}
							Submitted: {new Date(submission.submittedAt).toLocaleString()}
						</Text>
					)}
					{submission.timeSpent && (
						<Text size="sm" c="dimmed">
							{submission.startedAt || submission.submittedAt ? "• " : ""}
							Time Spent: {Math.round(submission.timeSpent)} min
						</Text>
					)}
				</Group>
			</Stack>
		</Paper>
	);
}

function QuizStudentSubmissionRow({
	courseId,
	enrollment,
	studentSubmissions,
	moduleLinkId,
	onReleaseGrade,
	isReleasing,
}: {
	courseId: number;
	enrollment: Enrollment;
	studentSubmissions: QuizSubmissionType[] | undefined;
	moduleLinkId: number;
	onReleaseGrade?: (courseModuleLinkId: number, enrollmentId: number) => void;
	isReleasing?: boolean;
}) {
	const [opened, { toggle }] = useDisclosure(false);

	const latestSubmission = studentSubmissions?.[0];
	const email = enrollment.email || "-";

	// Sort submissions by attempt number (newest first)
	const sortedSubmissions = studentSubmissions
		? [...studentSubmissions].sort((a, b) => {
			const attemptA = a.attemptNumber || 0;
			const attemptB = b.attemptNumber || 0;
			return attemptB - attemptA;
		})
		: [];

	// Filter to show all submissions that have been submitted (have submittedAt)
	// or are completed/graded/returned
	const submittedSubmissions = sortedSubmissions.filter(
		(sub) =>
			sub.submittedAt !== null ||
			sub.status === "completed" ||
			sub.status === "graded" ||
			sub.status === "returned",
	);

	const hasSubmissions = submittedSubmissions.length > 0;

	// Calculate total score if graded
	const gradedSubmissions = sortedSubmissions.filter(
		(s) => s.status === "graded" || s.status === "returned",
	);
	const totalScore = gradedSubmissions.reduce(
		(sum, s) => sum + (s.totalScore || 0),
		0,
	);
	const maxScore = gradedSubmissions.reduce(
		(sum, s) => sum + (s.maxScore || 0),
		0,
	);
	const averagePercentage =
		gradedSubmissions.length > 0
			? gradedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) /
			gradedSubmissions.length
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
					{latestSubmission ? (
						<Badge
							color={
								latestSubmission.status === "graded"
									? "green"
									: latestSubmission.status === "returned"
										? "blue"
										: latestSubmission.status === "completed"
											? "yellow"
											: "gray"
							}
							variant="light"
						>
							{latestSubmission.status === "in_progress"
								? "In Progress"
								: latestSubmission.status === "completed"
									? "Completed"
									: latestSubmission.status === "graded"
										? "Graded"
										: "Returned"}
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
					{averagePercentage !== null ? (
						<Text size="sm" fw={500}>
							{totalScore > 0 && maxScore > 0
								? `${totalScore}/${maxScore}`
								: ""}{" "}
							({averagePercentage.toFixed(1)}%)
						</Text>
					) : latestSubmission?.status === "completed" ? (
						<Text size="sm" c="dimmed">
							Pending
						</Text>
					) : (
						<Text size="sm" c="dimmed">
							-
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{latestSubmission?.timeSpent ? (
						<Text size="sm">{Math.round(latestSubmission.timeSpent)} min</Text>
					) : (
						<Text size="sm" c="dimmed">
							-
						</Text>
					)}
				</Table.Td>
				<Table.Td>
					{latestSubmission?.submittedAt
						? new Date(latestSubmission.submittedAt).toLocaleString()
						: latestSubmission?.startedAt
							? `Started: ${new Date(latestSubmission.startedAt).toLocaleString()}`
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
											`?action=${QuizActions.GRADE_SUBMISSION}&submissionId=${latestSubmission.id}`
										}
										leftSection={<IconPencil size={14} />}
									>
										Grade
									</Menu.Item>
									{latestSubmission.status === "graded" &&
										latestSubmission.totalScore !== null &&
										latestSubmission.totalScore !== undefined &&
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
					<Table.Td colSpan={8} p={0}>
						<Collapse in={opened}>
							<Box p="md">
								<Stack gap="md">
									<Text size="sm" fw={600}>
										Submission History ({submittedSubmissions.length}{" "}
										{submittedSubmissions.length === 1 ? "attempt" : "attempts"}
										)
									</Text>
									{/* sort by submittedAt descending */}
									{submittedSubmissions
										.sort((a, b) => {
											const dateA = a.submittedAt
												? new Date(a.submittedAt)
												: a.startedAt
													? new Date(a.startedAt)
													: new Date(0);
											const dateB = b.submittedAt
												? new Date(b.submittedAt)
												: b.startedAt
													? new Date(b.startedAt)
													: new Date(0);
											return dateB.getTime() - dateA.getTime();
										})
										.map((submission, index) => (
											<QuizSubmissionHistoryItem
												key={submission.id}
												attemptNumber={
													submission.attemptNumber ??
													submittedSubmissions.length - index
												}
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

export function QuizSubmissionTable({
	courseId,
	enrollments,
	submissions,
	moduleLinkId,
	onReleaseGrade,
	isReleasing,
}: {
	courseId: number;
	enrollments: Enrollment[];
	submissions: QuizSubmissionType[];
	moduleLinkId: number;
	onReleaseGrade?: (courseModuleLinkId: number, enrollmentId: number) => void;
	isReleasing?: boolean;
}) {
	// Filter and validate submissions, then group by student
	const validSubmissions = submissions.filter(
		(submission) =>
			"attemptNumber" in submission &&
			"status" in submission &&
			submission.status !== undefined,
	) as QuizSubmissionType[];

	const quizSubmissionsByStudent =
		groupSubmissionsByStudent(validSubmissions);

	// Sort submissions by attempt number (newest first) for each student
	for (const [studentId, studentSubmissions] of quizSubmissionsByStudent) {
		quizSubmissionsByStudent.set(
			studentId,
			studentSubmissions.sort((a, b) => b.attemptNumber - a.attemptNumber),
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
							<Table.Th style={{ minWidth: 80 }}>Attempts</Table.Th>
							<Table.Th style={{ minWidth: 100 }}>Score</Table.Th>
							<Table.Th style={{ minWidth: 120 }}>Time Spent</Table.Th>
							<Table.Th style={{ minWidth: 180 }}>Latest Submission</Table.Th>
							<Table.Th style={{ minWidth: 100 }}>Actions</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{enrollments.map((enrollment) => {
							const studentSubmissions = quizSubmissionsByStudent.get(
								enrollment.userId,
							);

							return (
								<QuizStudentSubmissionRow
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
