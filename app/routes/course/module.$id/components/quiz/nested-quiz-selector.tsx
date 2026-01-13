import {
	Badge,
	Button,
	Card,
	Group,
	Progress,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { IconCheck, IconClock, IconLock } from "@tabler/icons-react";
import type {
	NestedQuizConfig,
	QuizConfig,
} from "server/json/raw-quiz-config/v2";
import { StartNestedQuizButton } from "./start-nested-quiz-button";

interface NestedQuizSelectorProps {
	quizConfig: QuizConfig;
	completedQuizIds: Set<string>;
	onStartQuiz: (quizId: string) => void;
	canAccessQuiz: (quiz: NestedQuizConfig) => boolean;
	isQuizCompleted: (quizId: string) => boolean;
	completionProgress: number;
	isParentTimerExpired?: boolean;
	submissionId: number;
	moduleLinkId: number;
}

export function NestedQuizSelector({
	quizConfig,
	completedQuizIds,
	onStartQuiz,
	canAccessQuiz,
	completionProgress,
	isParentTimerExpired = false,
	submissionId,
	moduleLinkId,
}: NestedQuizSelectorProps) {
	const nestedQuizzes =
		quizConfig.type === "container" ? (quizConfig.nestedQuizzes ?? []) : [];

	if (nestedQuizzes.length === 0) {
		return (
			<Card withBorder p="xl" radius="md">
				<Text c="dimmed">No nested quizzes available.</Text>
			</Card>
		);
	}

	const completedCount = completedQuizIds.size;
	const totalCount = nestedQuizzes.length;
	const allCompleted = completedCount === totalCount;

	return (
		<Stack gap="lg">
			{/* Header with progress */}
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

			{/* Quiz list */}
			{nestedQuizzes.map((quiz, index) => {
				const isCompleted = completedQuizIds.has(quiz.id);
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
										{isCompleted ? (
											<Badge
												color="green"
												leftSection={<IconCheck size={14} />}
											>
												Completed
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

							{isParentTimerExpired ? (
								<Button disabled fullWidth variant="light">
									Time Expired
								</Button>
							) : isCompleted ? (
								<Button
									fullWidth
									variant="light"
									onClick={() => onStartQuiz(quiz.id)}
								>
									View Submission
								</Button>
							) : isLocked ? (
								<Button disabled fullWidth variant="light">
									Complete Previous Quizzes
								</Button>
							) : (
								<StartNestedQuizButton
									submissionId={submissionId}
									nestedQuizId={quiz.id}
									moduleLinkId={moduleLinkId}
								/>
							)}
						</Stack>
					</Card>
				);
			})}
		</Stack>
	);
}
