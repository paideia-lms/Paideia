import { Badge, Group, Paper, Stack, Text } from "@mantine/core";

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
}: {
	attemptNumber: number;
	submission: QuizSubmissionData;
}) {
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
					</Group>
				</Group>
			</Stack>
		</Paper>
	);
}
