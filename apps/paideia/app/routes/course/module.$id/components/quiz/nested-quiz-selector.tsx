import {
	Alert,
	Badge,
	Button,
	Card,
	Code,
	Group,
	Paper,
	Progress,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import {
	IconCheck,
	IconClock,
	IconInfoCircle,
	IconLock,
} from "@tabler/icons-react";
import { StartNestedQuizButton } from "./start-nested-quiz-button";
import {
	loaderSearchParams,
	type Route,
	useMarkQuizAttemptAsComplete,
} from "../../route";
import { useNuqsSearchParams } from "app/utils/router/search-params-utils";
import { useNestedQuizContext } from "./nested-quiz-context";
import type { NestedQuizConfig } from "server/json/raw-quiz-config/v2";
import { useMatches } from "react-router";
import { CodeHighlight } from "@mantine/code-highlight";

/**
 * this component allow user to select a nested quiz to start / continue.
 *
 * by default, the server will treat the quiz as complete if all nested quizzes are completed.
 * but user can still manually mark the quiz as complete using the "Mark as Complete" button.
 * it is just that user will be warned if an nested quiz is not completed.
 */
export function NestedQuizSelector() {
	const matches = useMatches() as Route.ComponentProps["matches"];
	const {
		loaderData: { enableDebugLogs },
	} = matches[0];
	// Get all data from contexts
	const {
		quizConfig,
		isParentTimerExpired,
		submissionId,
		readonly,
		completedQuizIds,
		inProgressQuizIds,
		completionProgress,
		nestedQuizzes,
		completedNestedQuizzes,
		moduleLinkId,
	} = useNestedQuizContext();
	const setSearchParams = useNuqsSearchParams(loaderSearchParams);
	const {
		submit: markQuizAttemptAsComplete,
		isLoading: isMarkingQuizAttemptAsComplete,
	} = useMarkQuizAttemptAsComplete();

	// Helper to check if a quiz is completed
	const isQuizCompleted = (quizId: string): boolean => {
		return completedQuizIds.includes(quizId);
	};

	// Helper to check if a quiz is in progress
	const isQuizInProgress = (quizId: string): boolean => {
		return inProgressQuizIds.includes(quizId);
	};

	// Helper to check if a quiz can be accessed
	const canAccessQuiz = (quiz: NestedQuizConfig): boolean => {
		// If already completed, always accessible for review
		if (completedQuizIds.includes(quiz.id)) {
			return true;
		}

		// If sequential order is required
		if (quizConfig.sequentialOrder) {
			const quizIndex = nestedQuizzes.findIndex((q) => q.id === quiz.id);
			if (quizIndex === -1) {
				return false;
			}

			// First quiz is always accessible
			if (quizIndex === 0) {
				return true;
			}

			// Check if all previous quizzes are completed
			for (let i = 0; i < quizIndex; i++) {
				const prevQuizId = nestedQuizzes[i]!.id;
				if (!completedQuizIds.includes(prevQuizId)) {
					return false;
				}
			}
			return true;
		}

		// Free order - all uncompleted quizzes are accessible
		return true;
	};

	if (nestedQuizzes.length === 0) {
		return (
			<Card withBorder p="xl" radius="md">
				<Text c="dimmed">No nested quizzes available.</Text>
			</Card>
		);
	}

	const completedCount = completedQuizIds.length;
	const totalCount = nestedQuizzes.length;
	const allCompleted = completedCount === totalCount;

	// Get list of incomplete nested quizzes for warning message
	const incompleteQuizzes = nestedQuizzes.filter(
		(quiz) => !completedQuizIds.includes(quiz.id),
	);

	// Handler for marking quiz as complete
	const handleMarkAsComplete = async () => {
		// If not all quizzes are completed, show warning
		if (!allCompleted && incompleteQuizzes.length > 0) {
			const incompleteQuizTitles = incompleteQuizzes
				.map((quiz) => `- ${quiz.title}`)
				.join("\n");
			const warningMessage = `Warning: The following nested quiz(es) are not completed:\n\n${incompleteQuizTitles}\n\nAre you sure you want to mark this quiz as complete?`;

			const confirmed = window.confirm(warningMessage);
			if (!confirmed) {
				return;
			}
		}

		// Mark quiz as complete
		await markQuizAttemptAsComplete({
			values: {
				submissionId,
			},
			params: {
				moduleLinkId,
			},
		});
	};

	return (
		<Stack gap="lg">
			{/* Debug Section */}
			{enableDebugLogs && (
				<Paper withBorder p="md" radius="sm" bg="yellow.0">
					<Stack gap="xs">
						<Text size="sm" fw={600} c="yellow.9">
							Debug Info
						</Text>
						<CodeHighlight
							code={JSON.stringify(
								{
									completedNestedQuizzes,
									completedQuizIds,
									inProgressQuizIds,
									completionProgress,
									allQuizzesCompleted: allCompleted,
									submissionId,
								},
								null,
								2,
							)}
							language="json"
							withCopyButton
						/>
					</Stack>
				</Paper>
			)}
			{/* Header with progress */}
			{readonly ? (
				<Alert color="blue" title="Read-only Mode">
					You are viewing a previously submitted quiz. No changes can be made.
				</Alert>
			) : (
				<Card withBorder p="lg" radius="md">
					<Stack gap="md">
						<Group justify="space-between" align="flex-start">
							<div>
								<Title order={2}>{quizConfig.title}</Title>
								<Text size="sm" c="dimmed" mt="xs">
									Complete all quizzes to finish
								</Text>
							</div>
							<Badge
								size="lg"
								variant="light"
								color={allCompleted ? "green" : "blue"}
							>
								{completedCount} / {totalCount} Completed
							</Badge>
						</Group>
						<Progress value={completionProgress} size="lg" radius="md" />
						{quizConfig.type === "container" && quizConfig.sequentialOrder && (
							<Text size="sm" c="dimmed">
								Note: Quizzes must be completed in order
							</Text>
						)}
					</Stack>
				</Card>
			)}

			{/* Quiz list */}
			{nestedQuizzes.map((quiz, index) => {
				const isCompleted = isQuizCompleted(quiz.id);
				const isInProgress = isQuizInProgress(quiz.id);
				const isAccessible = canAccessQuiz(quiz);
				const isLocked = !isAccessible || isParentTimerExpired;

				return (
					<Card
						key={quiz.id}
						withBorder
						p="lg"
						radius="md"
						style={{
							opacity: isLocked && !isCompleted ? 0.6 : 1,
						}}
					>
						<Stack gap="md">
							<Group justify="space-between" align="flex-start">
								<div style={{ flex: 1 }}>
									<Group gap="sm" mb="xs">
										<Badge variant="outline" size="lg">
											Quiz {index + 1}
										</Badge>
										{readonly ? (
											<Badge color="gray" leftSection={<IconLock size={14} />}>
												Readonly
											</Badge>
										) : isCompleted ? (
											<Badge
												color="green"
												leftSection={<IconCheck size={14} />}
											>
												Completed
											</Badge>
										) : isInProgress ? (
											<Badge color="blue" leftSection={<IconClock size={14} />}>
												In Progress
											</Badge>
										) : isLocked ? (
											<Badge color="gray" leftSection={<IconLock size={14} />}>
												Locked
											</Badge>
										) : (
											<Badge color="blue">Available</Badge>
										)}
									</Group>
									<Title order={3}>{quiz.title}</Title>
									{quiz.description && (
										<Text size="sm" c="dimmed" mt="xs">
											{quiz.description}
										</Text>
									)}
									{(() => {
										const totalQuestions = quiz.pages.reduce(
											(total, page) => total + page.questions.length,
											0,
										);
										return totalQuestions === 0 ? (
											<Alert
												color="yellow"
												icon={<IconInfoCircle size={16} />}
												mt="xs"
											>
												This nested quiz has no questions. Please add questions
												before students can take it.
											</Alert>
										) : null;
									})()}
								</div>
							</Group>

							<Group gap="md">
								{quiz.globalTimer && (
									<Group gap="xs">
										<IconClock size={16} />
										<Text size="sm">
											{Math.floor(quiz.globalTimer / 60)} minutes
										</Text>
									</Group>
								)}
								<Text size="sm" c="dimmed">
									{quiz.pages.length}{" "}
									{quiz.pages.length === 1 ? "page" : "pages"}
								</Text>
							</Group>

							{readonly ? (
								<Button
									fullWidth
									variant="light"
									onClick={() => {
										setSearchParams({
											viewSubmission: submissionId,
											nestedQuizId: quiz.id,
										});
									}}
								>
									View Submission
								</Button>
							) : isParentTimerExpired ? (
								<Button disabled fullWidth variant="light">
									Time Expired
								</Button>
							) : isCompleted ? (
								<Button
									fullWidth
									variant="light"
									onClick={() => {
										setSearchParams({
											viewSubmission: submissionId,
											nestedQuizId: quiz.id,
										});
									}}
								>
									View Submission
								</Button>
							) : isLocked ? (
								<Button disabled fullWidth variant="light">
									Complete Previous Quizzes
								</Button>
							) : isInProgress ? (
								<Button
									fullWidth
									variant="light"
									onClick={() => {
										setSearchParams({
											viewSubmission: submissionId,
											nestedQuizId: quiz.id,
										});
									}}
								>
									Continue Quiz
								</Button>
							) : (
								<StartNestedQuizButton
									submissionId={submissionId}
									nestedQuizId={quiz.id}
								/>
							)}
						</Stack>
					</Card>
				);
			})}

			{/* Mark as Complete Button */}
			{!readonly && (
				<Card withBorder p="lg" radius="md">
					<Stack gap="md">
						<Group justify="space-between" align="center">
							<div>
								<Title order={4}>Complete Quiz</Title>
								<Text size="sm" c="dimmed">
									{allCompleted
										? "All nested quizzes are completed. You can mark this quiz as complete."
										: "You can manually mark this quiz as complete even if not all nested quizzes are finished."}
								</Text>
							</div>
							<Button
								onClick={handleMarkAsComplete}
								loading={isMarkingQuizAttemptAsComplete}
								disabled={isParentTimerExpired}
								leftSection={<IconCheck size={16} />}
								color={allCompleted ? "green" : "orange"}
							>
								Mark as Complete
							</Button>
						</Group>
					</Stack>
				</Card>
			)}
		</Stack>
	);
}
