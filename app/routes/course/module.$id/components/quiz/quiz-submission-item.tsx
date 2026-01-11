import { ActionIcon, Badge, Group, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { Link } from "react-router";
import { getRouteUrl } from "app/utils/search-params-utils";

// ============================================================================
// Types
// ============================================================================

export interface QuizSubmissionData {
	id: number;
	status: "in_progress" | "completed" | "graded" | "returned";
	submittedAt?: string | null;
	startedAt?: string | null;
	attemptNumber: number;
	timeSpent?: number | null;
	totalScore?: number | null;
	maxScore?: number | null;
	percentage?: number | null;
	grade?: {
		baseGrade: number | null;
		maxGrade: number | null;
		gradedAt?: string | null;
	} | null;
}

// ============================================================================
// Components
// ============================================================================

export function QuizSubmissionItem({
	attemptNumber,
	submission,
	moduleLinkId,
}: {
	attemptNumber: number;
	submission: QuizSubmissionData;
	moduleLinkId: number | string;
}) {
	const canViewSubmission =
		submission.status === "completed" ||
		submission.status === "graded" ||
		submission.status === "returned";

	const viewSubmissionUrl = canViewSubmission
		? getRouteUrl("/course/module/:moduleLinkId", {
				params: { moduleLinkId: String(moduleLinkId) },
				searchParams: {
					viewSubmission: submission.id,
					showQuiz: false,
					view: null,
					threadId: null,
					replyTo: null,
				},
			})
		: null;
	return (
		<Paper withBorder p="md">
			<Stack gap="sm">
				<Group justify="space-between">
					<Group gap="xs">
						<Text size="sm" fw={600}>
							Attempt {attemptNumber}
						</Text>
						<Badge
							color={
								submission.status === "graded"
									? "green"
									: submission.status === "returned"
										? "orange"
										: submission.status === "completed"
											? "blue"
											: "gray"
							}
							size="sm"
						>
							{submission.status === "in_progress"
								? "In Progress"
								: submission.status === "completed"
									? "Completed"
									: submission.status === "graded"
										? "Graded"
										: "Returned"}
						</Badge>
						{(submission.status === "graded" ||
							submission.status === "returned") &&
							submission.totalScore !== null &&
							submission.totalScore !== undefined && (
								<Badge color="green" size="sm" variant="filled">
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
							)}
					</Group>
					<Group gap="xs">
						{submission.startedAt && (
							<Text size="xs" c="dimmed">
								Started: {new Date(submission.startedAt).toLocaleString()}
							</Text>
						)}
						{submission.submittedAt && (
							<Text size="xs" c="dimmed">
								{submission.startedAt ? "• " : ""}
								Submitted: {new Date(submission.submittedAt).toLocaleString()}
							</Text>
						)}
						{submission.timeSpent && (
							<Text size="xs" c="dimmed">
								{submission.startedAt || submission.submittedAt ? "• " : ""}
								Time Spent: {Math.round(submission.timeSpent)} min
							</Text>
						)}
						{submission.status === "graded" && submission.grade?.gradedAt && (
							<Text size="xs" c="dimmed">
								{submission.startedAt || submission.submittedAt || submission.timeSpent
									? "• "
									: ""}
								Graded: {new Date(submission.grade.gradedAt).toLocaleString()}
							</Text>
						)}
						{canViewSubmission && viewSubmissionUrl && (
							<Tooltip label="View submission">
								<ActionIcon
									component={Link}
									to={viewSubmissionUrl}
									variant="light"
									color="blue"
									size="sm"
								>
									<IconEye size={16} />
								</ActionIcon>
							</Tooltip>
						)}
					</Group>
				</Group>
			</Stack>
		</Paper>
	);
}
