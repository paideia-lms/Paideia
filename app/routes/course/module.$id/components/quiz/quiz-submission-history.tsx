import { Stack, Text } from "@mantine/core";
import { QuizSubmissionItem } from "./quiz-submission-item";
import type { QuizSubmissionData } from "./quiz-submission-item";

// ============================================================================
// Components
// ============================================================================

export function QuizSubmissionHistory({
	submissions,
	title = "Submission History",
}: {
	submissions: QuizSubmissionData[];
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
				.map((sub, index) => (
					<QuizSubmissionItem
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
