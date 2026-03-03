import {
	ActionIcon,
	Badge,
	Group,
	Menu,
	Paper,
	Stack,
	Text,
} from "@mantine/core";
import { IconDots, IconPencil } from "@tabler/icons-react";
import { Link } from "react-router";
import { getRouteUrl } from "app/utils/router/search-params-utils";
import type { QuizSubmissionData } from "app/routes/course/module.$id/components/quiz/quiz-submission-item";

// ============================================================================
// Components
// ============================================================================

export function QuizSubmissionItemInTable({
	attemptNumber,
	submission,
	moduleLinkId,
	showGrade = true,
}: {
	attemptNumber: number;
	submission: QuizSubmissionData;
	moduleLinkId?: number;
	showGrade?: boolean;
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
					{showGrade && moduleLinkId && (
						<Menu position="bottom-end" shadow="md">
							<Menu.Target>
								<ActionIcon variant="light" aria-label="Actions">
									<IconDots size={16} />
								</ActionIcon>
							</Menu.Target>
							<Menu.Dropdown>
								<Menu.Item
									component={Link}
									to={getRouteUrl(
										"/course/module/:moduleLinkId/submissions/:submissionId",
										{
											params: {
												moduleLinkId: moduleLinkId.toString(),
												submissionId: submission.id.toString(),
											},
										},
									)}
									leftSection={<IconPencil size={16} />}
								>
									Grade
								</Menu.Item>
							</Menu.Dropdown>
						</Menu>
					)}
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
