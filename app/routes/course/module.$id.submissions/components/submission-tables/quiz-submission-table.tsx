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
import { groupSubmissionsByStudent } from "./helpers";
import {
	type Route,
	View,
	useReleaseGrade,
} from "app/routes/course/module.$id.submissions/route";
import { getRouteUrl } from "~/utils/search-params-utils";
import { QuizSubmissionItemInTable } from "app/routes/course/module.$id.submissions/components/submission-tables/quiz-submission-item-in-table";
import type { QuizSubmissionData } from "app/routes/course/module.$id/components/quiz/quiz-submission-item";

type Enrollment = NonNullable<
	Route.ComponentProps["loaderData"]["enrollments"]
>[number];

// ============================================================================
// Types
// ============================================================================

type QuizSubmissionType = QuizSubmissionData & {
	student: {
		id: number;
		firstName?: string | null;
		lastName?: string | null;
		email?: string | null;
	};
};

// type Enrollment = {
// 	id: number;
// 	userId: number;
// 	name: string;
// 	email?: string | null;
// };

// ============================================================================
// Components
// ============================================================================

function QuizStudentSubmissionRow({
	courseId,
	enrollment,
	studentSubmissions,
	moduleLinkId,
}: {
	courseId: number;
	enrollment: Enrollment;
	studentSubmissions: QuizSubmissionType[] | undefined;
	moduleLinkId: number;
}) {
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
										to={getRouteUrl(
											"/course/module/:moduleLinkId/submissions",
											{
												params: { moduleLinkId: moduleLinkId.toString() },
												searchParams: {
													action: null,
													view: View.GRADING,
													submissionId: latestSubmission.id,
												},
											},
										)}
										leftSection={<IconPencil size={14} />}
									>
										Grade
									</Menu.Item>
									{latestSubmission.status === "graded" &&
										latestSubmission.totalScore !== null &&
										latestSubmission.totalScore !== undefined && (
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
											<QuizSubmissionItemInTable
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
}: {
	courseId: number;
	enrollments: Enrollment[];
	submissions: QuizSubmissionType[];
	moduleLinkId: number;
}) {
	// Filter and validate submissions, then group by student
	const validSubmissions = submissions.filter(
		(submission) =>
			"attemptNumber" in submission &&
			"status" in submission &&
			submission.status,
	) as QuizSubmissionType[];

	const quizSubmissionsByStudent = groupSubmissionsByStudent(validSubmissions);

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
								enrollment.user.id,
							);

							return (
								<QuizStudentSubmissionRow
									key={enrollment.id}
									courseId={courseId}
									enrollment={enrollment}
									studentSubmissions={studentSubmissions}
									moduleLinkId={moduleLinkId}
								/>
							);
						})}
					</Table.Tbody>
				</Table>
			</ScrollArea>
		</Paper>
	);
}
