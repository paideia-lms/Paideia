import { Stack, Text } from "@mantine/core";
import { AssignmentSubmissionItem, type AssignmentSubmissionData } from "./assignment-submission-item";

// ============================================================================
// Components
// ============================================================================

export function AssignmentSubmissionHistory({
	submissions,
	title = "Submission History",
}: {
	submissions: AssignmentSubmissionData[];
	title?: string;
}) {
	if (submissions.length === 0) {
		return null;
	}

	const sortedSubmissions = [...submissions].sort(
		(a, b) => b.attemptNumber - a.attemptNumber,
	);

	return (
		<Stack gap="md">
			<Text size="lg" fw={600}>
				{title}
			</Text>
			{/* sort by submittedAt descending */}
			{sortedSubmissions
				.sort((a, b) => {
					const dateA = a.submittedAt ? new Date(a.submittedAt) : new Date(0);
					const dateB = b.submittedAt ? new Date(b.submittedAt) : new Date(0);
					return dateB.getTime() - dateA.getTime();
				})
				.map((sub, index) => (
					<AssignmentSubmissionItem
						key={sub.id}
						attemptNumber={
							sub.attemptNumber ?? sortedSubmissions.length - index
						}
						submission={sub}
					/>
				))}
		</Stack>
	);
}
