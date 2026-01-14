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
import { IconCheck, IconClock, IconLock } from "@tabler/icons-react";
import { StartNestedQuizButton } from "./start-nested-quiz-button";
import { loaderSearchParams } from "../../route";
import { useNuqsSearchParams } from "app/utils/search-params-utils";
import { useNestedQuizContext } from "./nested-quiz-context";
import type { NestedQuizConfig } from "server/json/raw-quiz-config/v2";

export function NestedQuizSelector() {
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
	} = useNestedQuizContext();
	const setSearchParams = useNuqsSearchParams(loaderSearchParams);

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

	return (
		<Stack gap="lg">
			{/* Debug Section */}
			<Paper withBorder p="md" radius="sm" bg="yellow.0">
				<Stack gap="xs">
					<Text size="sm" fw={600} c="yellow.9">
						Debug Info
					</Text>
					<Code block>
						{JSON.stringify(
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
					</Code>
				</Stack>
			</Paper>
			{/* Header with progress */}
			{readonly ?
				<Alert color="blue" title="Read-only Mode">
					You are viewing a previously submitted quiz. No changes can be
					made.
				</Alert>

				: <Card withBorder p="lg" radius="md">
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
				</Card>}

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
										{
											readonly ? (
												<Badge color="gray" leftSection={<IconLock size={14} />}>
													Readonly
												</Badge>
											) :
												isCompleted ? (
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
		</Stack>
	);
}