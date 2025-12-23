import {
	ActionIcon,
	Anchor,
	Badge,
	Button,
	Group,
	Menu,
	Paper,
	ScrollArea,
	Stack,
	Table,
	Text,
} from "@mantine/core";
import { IconDots, IconPencil, IconSend } from "@tabler/icons-react";
import { countBy } from "es-toolkit/array";
import { href, Link } from "react-router";
import {
	calculateDiscussionGradingStats,
	filterPublishedSubmissions,
	getDiscussionGradingStatusColor,
	getDiscussionGradingStatusLabel,
	type InterestedSubmissionType,
	sortSubmissionsByDate,
	groupAndSortDiscussionSubmissions,
	type DiscussionSubmissionType,
} from "./helpers";
import {
	type Route,
	View,
	getRouteUrl,
} from "app/routes/course/module.$id.submissions/route";

type Enrollment = NonNullable<
	Route.ComponentProps["loaderData"]["enrollments"]
>[number];

// ============================================================================
// Components
// ============================================================================

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
	studentSubmissions: InterestedSubmissionType[] | undefined;
	moduleLinkId: number;
	onReleaseGrade?: (courseModuleLinkId: number, enrollmentId: number) => void;
	isReleasing?: boolean;
}) {
	// Filter to only published submissions and sort by date
	const publishedSubmissions = filterPublishedSubmissions(studentSubmissions);
	const sortedSubmissions = sortSubmissionsByDate(publishedSubmissions);

	const hasSubmissions = sortedSubmissions.length > 0;
	const latestSubmission = sortedSubmissions[0];
	const email = enrollment.userEmail || "-";

	// Count posts by type
	const {
		thread: threadCount,
		reply: replyCount,
		comment: commentCount,
	} = countBy(sortedSubmissions, (sub) => sub.postType);

	// Calculate grading status and statistics
	const { gradingStatus, averageScore, maxGrade } =
		calculateDiscussionGradingStats(sortedSubmissions);

	return (
		<Table.Tr>
			<Table.Td>
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
			</Table.Td>
			<Table.Td>{email}</Table.Td>
			<Table.Td>
				{hasSubmissions ? (
					<Badge
						color={getDiscussionGradingStatusColor(gradingStatus)}
						variant="light"
					>
						{getDiscussionGradingStatusLabel(gradingStatus)}
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
				{averageScore !== null && maxGrade !== null ? (
					<Text size="sm" fw={500}>
						{averageScore.toFixed(1)}/{maxGrade}
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
									to={getRouteUrl(
										{
											view: View.GRADING,
											submissionId: latestSubmission.id,
										},
										moduleLinkId,
									)}
									leftSection={<IconPencil size={14} />}
								>
									Grade
								</Menu.Item>
								{(gradingStatus === "graded" ||
									gradingStatus === "partially-graded") &&
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
	// Filter and validate submissions, then group and sort by student
	const interestedSubmissions = submissions.filter(
		(submission) => "postType" in submission && "content" in submission,
	);

	const discussionSubmissionsByStudent = groupAndSortDiscussionSubmissions(
		interestedSubmissions,
	);

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
								enrollment.user.id,
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
