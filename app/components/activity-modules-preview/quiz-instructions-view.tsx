import {
	Alert,
	Button,
	Group,
	Paper,
	Stack,
	Text,
	Title,
	Typography,
} from "@mantine/core";
import {
	IconClock,
	IconEye,
	IconInfoCircle,
	IconPlayerPlay,
} from "@tabler/icons-react";
import prettyMs from "pretty-ms";

// ============================================================================
// Types
// ============================================================================

interface QuizData {
	id: number;
	instructions: string | null;
	dueDate: string | null;
	maxAttempts: number | null;
	timeLimit: number | null;
	points: number | null;
}

interface QuizSubmissionData {
	id: number;
	status: "in_progress" | "completed" | "graded" | "returned";
	submittedAt?: string | null;
	attemptNumber: number;
}

interface QuizInstructionsViewProps {
	quiz: QuizData | null;
	allSubmissions: QuizSubmissionData[];
	onStartQuiz: () => void;
	canStartAttempt?: boolean; // Whether user can start/continue quiz attempt
	quizRemainingTime?: number; // Remaining time in seconds for in-progress attempts
	canPreview?: boolean; // Whether user can preview the quiz
}

// ============================================================================
// Component
// ============================================================================

export function QuizInstructionsView({
	quiz,
	allSubmissions,
	onStartQuiz,
	canStartAttempt = true,
	quizRemainingTime,
	canPreview = false,
}: QuizInstructionsViewProps) {
	if (!quiz) {
		return (
			<Paper withBorder p="xl" radius="md">
				<Stack gap="md">
					<Title order={3}>Quiz Instructions</Title>
					<Text c="dimmed">No quiz data available.</Text>
				</Stack>
			</Paper>
		);
	}

	// Count all attempts that have been started (including in_progress)
	// This gives a more accurate count of attempts used
	const attemptCount = allSubmissions.length;
	const completedCount = allSubmissions.filter(
		(s) =>
			s.status === "completed" ||
			s.status === "graded" ||
			s.status === "returned",
	).length;
	// Check if there's an in_progress attempt
	const hasInProgressAttempt = allSubmissions.some(
		(s) => s.status === "in_progress",
	);
	// Check if timer has expired for in-progress attempt
	const isTimerExpired =
		hasInProgressAttempt &&
		(quizRemainingTime === undefined || quizRemainingTime <= 0);
	const maxAttempts = quiz.maxAttempts || null;
	// Can start more if permission allows AND timer hasn't expired
	const canStartMore = canStartAttempt && !isTimerExpired;

	const formatTimeLimit = (minutes: number | null) => {
		if (!minutes) return null;
		// Convert minutes to milliseconds for pretty-ms
		const milliseconds = minutes * 60 * 1000;
		return prettyMs(milliseconds, { verbose: true });
	};

	// timeLimit is now derived from globalTimer in course-module-context.ts
	// It's already in minutes, so we can use it directly
	const effectiveTimeLimit = quiz.timeLimit;

	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="lg">
				<Group justify="space-between" align="flex-start">
					<Title order={3}>Quiz Instructions</Title>
					<Group gap="sm">
						{canPreview && (
							<Button
								leftSection={<IconEye size={16} />}
								variant="light"
								onClick={() => {
									// Mock preview action - no effect for now
								}}
							>
								Preview Quiz
							</Button>
						)}
						{canStartMore && (
							<Button
								leftSection={<IconPlayerPlay size={16} />}
								onClick={onStartQuiz}
							>
								{hasInProgressAttempt
									? `Continue Quiz (Attempt ${attemptCount})`
									: completedCount > 0
										? "Start New Attempt"
										: "Start Quiz"}
							</Button>
						)}
					</Group>
				</Group>

				{Boolean(maxAttempts) && (
					<Alert
						color={canStartMore ? "blue" : "yellow"}
						icon={<IconInfoCircle size={16} />}
					>
						{attemptCount} of {maxAttempts} attempt
						{maxAttempts !== 1 ? "s" : ""} used
						{!canStartMore && !canStartAttempt && " - Maximum attempts reached"}
					</Alert>
				)}

				{effectiveTimeLimit ? (
					<Alert color="blue" icon={<IconClock size={16} />}>
						<Text size="sm" fw={500}>
							Time Limit: {formatTimeLimit(effectiveTimeLimit)}
						</Text>
						<Text size="xs" c="dimmed" mt={4}>
							The timer will start when you begin the quiz and cannot be paused.
						</Text>
					</Alert>
				) : (
					<Text c="dimmed">No time limit.</Text>
				)}

				{quiz.points && (
					<Text size="sm" c="dimmed">
						Total Points: {quiz.points}
					</Text>
				)}

				{quiz.instructions ? (
					<div>
						<Text size="sm" fw={500} mb="xs">
							Instructions:
						</Text>
						<Typography
							className="tiptap"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
							dangerouslySetInnerHTML={{ __html: quiz.instructions }}
							style={{
								minHeight: "100px",
								lineHeight: "1.6",
							}}
						/>
					</div>
				) : (
					<Text c="dimmed">No instructions provided.</Text>
				)}
			</Stack>
		</Paper>
	);
}
