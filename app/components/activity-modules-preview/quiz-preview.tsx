import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import {
	ActionIcon,
	Alert,
	Badge,
	Box,
	Button,
	Code,
	Group,
	Indicator,
	Modal,
	Paper,
	Progress,
	ScrollArea,
	Stack,
	Text,
	Title,
	Tooltip,
} from "@mantine/core";
import {
	IconClock,
	IconFlag,
	IconFlagFilled,
	IconInfoCircle,
} from "@tabler/icons-react";
import { memo, useState } from "react";
import type {
	GradingConfig,
	NestedQuizConfig,
	Question,
	QuestionAnswer,
	QuizAnswers,
	QuizConfig,
	QuizResource,
	RegularQuizConfig,
} from "server/json/raw-quiz-config/v2";
import {
	calculateTotalPoints,
	getQuestionPoints,
	getScoringDescription,
	isContainerQuiz,
	isRegularQuiz,
} from "server/json/raw-quiz-config/v2";
import { RichTextRenderer } from "../rich-text/rich-text-renderer";
import { NestedQuizSelector } from "./nested-quiz-selector";
import { QuestionRenderer } from "./question-renderer";
import { useNestedQuizState } from "./use-nested-quiz-state";
import { useQuizForm } from "./use-quiz-form";
import { useQuizTimer } from "./use-quiz-timer";

/**
 * Helper function to check if a question is truly answered
 * For whiteboard questions, checks if elements array is non-empty
 */
function isQuestionAnswered(
	question: Question,
	value: QuestionAnswer | undefined,
): boolean {
	if (value === undefined || value === null) {
		return false;
	}

	// For whiteboard questions, check if elements array is non-empty
	if (question.type === "whiteboard") {
		if (typeof value !== "string" || value.trim() === "") {
			return false;
		}
		try {
			const data = JSON.parse(value) as ExcalidrawInitialDataState;
			return (
				Array.isArray(data.elements) &&
				data.elements.length > 0 &&
				data.elements.filter((element) => !element.isDeleted).length > 0
			);
		} catch {
			return false;
		}
	}

	// For string values
	if (typeof value === "string") {
		return value.trim().length > 0;
	}

	// For array values (fill-in-the-blank, choice, ranking)
	if (Array.isArray(value)) {
		return value.length > 0 && value.some((v) => v && v.trim().length > 0);
	}

	// For object values (matrix questions)
	if (typeof value === "object") {
		return Object.keys(value).length > 0;
	}

	return true;
}

// Memoized timer display component to prevent unnecessary re-renders
// Key prop should be used to remount when remainingTime changes
const TimerDisplay = memo(
	({
		initialTime,
		remainingTime,
		onExpire,
	}: {
		initialTime?: number;
		remainingTime?: number;
		onExpire: () => void;
	}) => {
		const timer = useQuizTimer({ initialTime, remainingTime, onExpire });

		// Use remainingTime if provided, otherwise use initialTime
		const effectiveInitialTime =
			remainingTime !== undefined ? remainingTime : initialTime;
		if (!effectiveInitialTime) return null;

		const getTimerColor = (timeLeft: number | null, initial?: number) => {
			if (timeLeft === null || !initial) return "blue";
			const percentage = (timeLeft / initial) * 100;
			if (percentage > 50) return "green";
			if (percentage > 20) return "yellow";
			return "red";
		};

		return (
			<Badge
				size="lg"
				color={getTimerColor(timer.timeLeft, effectiveInitialTime)}
				leftSection={<IconClock size={16} />}
			>
				{timer.formattedTime}
			</Badge>
		);
	},
);

TimerDisplay.displayName = "TimerDisplay";

interface SingleQuizPreviewProps {
	quizConfig?: RegularQuizConfig | NestedQuizConfig;
	readonly?: boolean;
	initialAnswers?: QuizAnswers;
	onSubmit?: (answers: QuizAnswers) => void;
	onExit?: () => void;
	disableInteraction?: boolean;
	remainingTime?: number; // Remaining time in seconds for resumed quizzes
	grading?: GradingConfig; // Grading config from parent quiz
}

export function SingleQuizPreview({
	quizConfig,
	readonly = false,
	initialAnswers,
	onSubmit,
	onExit,
	disableInteraction = false,
	remainingTime,
	grading,
}: SingleQuizPreviewProps) {
	const [showResults, setShowResults] = useState(false);
	const [submittedAnswers, setSubmittedAnswers] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [isGlobalTimerExpired, setIsGlobalTimerExpired] = useState(false);

	// Always call hooks - no conditional hook calls
	// Provide a default empty config to avoid hook issues
	const defaultConfig: QuizConfig = {
		version: "v2",
		type: "regular",
		id: "empty",
		title: "Empty Quiz",
		pages: [],
	};

	const quiz = useQuizForm({
		quizConfig: quizConfig || defaultConfig,
		readonly,
		initialAnswers,
	});

	const handleSubmit = () => {
		if (!quizConfig) return;
		const answers = quiz.answers;

		// Call onSubmit callback if provided (for real submission)
		if (onSubmit) {
			onSubmit(answers);
			// Don't show results modal for real submission - redirect will happen
			return;
		}

		// Only show mock results modal if no onSubmit callback (for testing/preview)
		setSubmittedAnswers(answers);
		setShowResults(true);
	};

	const handleGlobalTimerExpire = () => {
		setIsGlobalTimerExpired(true);
		if (!readonly) {
			handleSubmit();
		}
	};

	const handleExit = () => {
		if (onExit) {
			onExit();
		}
	};

	// Guard against undefined config (after all hooks are called)
	if (!quizConfig || !quizConfig.pages || quizConfig.pages.length === 0) {
		return (
			<Paper withBorder p="xl" radius="md">
				<Stack gap="md">
					<Title order={3}>Quiz Configuration Error</Title>
					<Text c="dimmed">
						No quiz configuration provided or quiz has no pages.
					</Text>
					<Code block>{JSON.stringify(quizConfig, null, 2)}</Code>
				</Stack>
			</Paper>
		);
	}

	const currentPage = quizConfig.pages[quiz.currentPageIndex];

	// Guard against invalid page index
	if (!currentPage) {
		return (
			<Paper withBorder p="xl" radius="md">
				<Stack gap="md">
					<Title order={3}>Quiz Error</Title>
					<Text c="dimmed">Invalid page index. Please restart the quiz.</Text>
				</Stack>
			</Paper>
		);
	}

	const progressValue =
		quizConfig.pages.length > 0
			? ((quiz.currentPageIndex + 1) / quizConfig.pages.length) * 100
			: 0;

	// Build question map for navigation
	const questionMap: Array<{
		questionId: string;
		questionNumber: number;
		pageIndex: number;
		questionIndex: number;
		prompt: string;
		question: Question;
	}> = [];

	let globalQuestionNumber = 1;
	for (const [pageIndex, page] of quizConfig.pages.entries()) {
		for (const [questionIndex, question] of page.questions.entries()) {
			questionMap.push({
				questionId: question.id,
				questionNumber: globalQuestionNumber,
				pageIndex,
				questionIndex,
				prompt: question.prompt,
				question,
			});
			globalQuestionNumber++;
		}
	}

	const currentQuestionStartNumber =
		quizConfig.pages
			.slice(0, quiz.currentPageIndex)
			.reduce((sum: number, page) => sum + page.questions.length, 0) + 1;

	const isDisabled = readonly || isGlobalTimerExpired || disableInteraction;

	return (
		<>
			<Paper withBorder p="xl" radius="md">
				<Stack gap="lg">
					{/* Readonly Banner */}
					{readonly && (
						<Alert color="blue" title="Read-only Mode">
							You are viewing a previously submitted quiz. No changes can be
							made.
						</Alert>
					)}

					{/* Header */}
					<Group justify="space-between" align="flex-start">
						<div>
							<Group gap="md" align="center">
								<Title order={2}>{quizConfig.title}</Title>
								{grading?.enabled && (
									<Tooltip
										label={`Total: ${calculateTotalPoints(quizConfig)} points${grading.passingScore ? ` • Passing: ${grading.passingScore}%` : ""}`}
										position="bottom"
										multiline
										w={250}
									>
										<Badge size="lg" variant="light" color="grape">
											Total: {calculateTotalPoints(quizConfig)} points
										</Badge>
									</Tooltip>
								)}
							</Group>
							<Text size="sm" c="dimmed" mt="xs">
								Page {quiz.currentPageIndex + 1} of {quizConfig.pages.length}
							</Text>
						</div>
						{quizConfig.globalTimer && !readonly && (
							<TimerDisplay
								key={`timer-${remainingTime ?? quizConfig.globalTimer}`}
								initialTime={quizConfig.globalTimer}
								remainingTime={remainingTime}
								onExpire={handleGlobalTimerExpire}
							/>
						)}
					</Group>

					{/* Progress Bar */}
					<Progress value={progressValue} size="sm" />

					{/* Timer Expired Warning */}
					{isGlobalTimerExpired && !readonly && (
						<Paper
							withBorder
							p="md"
							radius="sm"
							bg="red.0"
							style={{ borderColor: "var(--mantine-color-red-6)" }}
						>
							<Group gap="sm">
								<IconClock size={20} color="var(--mantine-color-red-6)" />
								<Text size="sm" c="red" fw={500}>
									Time has expired! The quiz has been automatically submitted.
								</Text>
							</Group>
						</Paper>
					)}

					{/* Quiz Navigation */}
					<Paper withBorder p="md" radius="sm">
						<Stack gap="sm">
							<Text size="sm" fw={500}>
								Question Navigation
							</Text>
							<Group gap="xs">
								{questionMap.map((item) => {
									const answerValue = quiz.getAnswer(item.questionId);
									const isAnswered = isQuestionAnswered(
										item.question,
										answerValue,
									);
									const isFlagged = quiz.isFlagged(item.questionId);
									const isCurrent = quiz.currentPageIndex === item.pageIndex;

									return (
										<Tooltip
											key={item.questionId}
											label={`Q${item.questionNumber}: ${item.prompt.slice(0, 50)}...`}
										>
											<Indicator
												inline
												label={<IconFlag size={10} />}
												size={16}
												disabled={!isFlagged}
												color="red"
												offset={3}
											>
												<Button
													size="compact-sm"
													variant={
														isCurrent
															? "filled"
															: isAnswered
																? "light"
																: "default"
													}
													color={
														isCurrent ? "blue" : isAnswered ? "green" : "gray"
													}
													onClick={() => quiz.goToPage(item.pageIndex)}
													disabled={isDisabled}
												>
													{item.questionNumber}
												</Button>
											</Indicator>
										</Tooltip>
									);
								})}
							</Group>
							<Group gap="md">
								<Group gap="xs">
									<Box
										w={20}
										h={20}
										style={{
											backgroundColor: "var(--mantine-color-blue-filled)",
											borderRadius: "var(--mantine-radius-sm)",
										}}
									/>
									<Text size="xs" c="dimmed">
										Current
									</Text>
								</Group>
								<Group gap="xs">
									<Box
										w={20}
										h={20}
										style={{
											backgroundColor: "var(--mantine-color-green-light)",
											borderRadius: "var(--mantine-radius-sm)",
										}}
									/>
									<Text size="xs" c="dimmed">
										Answered
									</Text>
								</Group>
								<Group gap="xs">
									<IconFlag size={16} color="var(--mantine-color-red-6)" />
									<Text size="xs" c="dimmed">
										Flagged
									</Text>
								</Group>
							</Group>
						</Stack>
					</Paper>

					{/* Current Page */}
					<div>
						<Title order={3} mb="md">
							{currentPage.title}
						</Title>

						{/* Resources for current page */}
						{"resources" in quizConfig &&
							quizConfig.resources &&
							quizConfig.resources.length > 0 && (
								<Stack gap="md" mb="xl">
									{quizConfig.resources
										.filter((resource: QuizResource) =>
											resource.pages.includes(currentPage.id),
										)
										.map((resource: QuizResource) => (
											<Paper
												key={resource.id}
												withBorder
												p="md"
												radius="sm"
												bg="blue.0"
											>
												{resource.title && (
													<Title order={4} mb="sm">
														{resource.title}
													</Title>
												)}
												<ScrollArea mah={400}>
													<RichTextRenderer content={resource.content} />
												</ScrollArea>
											</Paper>
										))}
								</Stack>
							)}

						<Stack gap="xl">
							{currentPage.questions.map(
								(question: Question, questionIndex: number) => {
									const questionNumber =
										currentQuestionStartNumber + questionIndex;

									return (
										<Paper key={question.id} withBorder p="md" radius="sm">
											<Stack gap="md">
												{/* Question Header */}
												<Group justify="space-between" align="flex-start">
													<Group
														gap="sm"
														align="flex-start"
														style={{ flex: 1 }}
													>
														<Badge size="lg" variant="outline">
															Q{questionNumber}
														</Badge>
														{grading?.enabled && (
															<Tooltip
																label={getScoringDescription(question.scoring)}
																position="top"
																multiline
																w={300}
															>
																<Badge
																	size="lg"
																	variant="light"
																	color="blue"
																	leftSection={<IconInfoCircle size={14} />}
																>
																	{getQuestionPoints(question)} pt
																	{getQuestionPoints(question) !== 1 ? "s" : ""}
																</Badge>
															</Tooltip>
														)}
														<Text fw={500} style={{ flex: 1 }}>
															{question.prompt}
														</Text>
													</Group>
													<Group gap="xs">
														{!readonly && (
															<Tooltip
																label={
																	isDisabled
																		? "Interaction disabled"
																		: quiz.isFlagged(question.id)
																			? "Remove flag"
																			: "Flag for review"
																}
															>
																<ActionIcon
																	variant={
																		quiz.isFlagged(question.id)
																			? "filled"
																			: "light"
																	}
																	color={
																		quiz.isFlagged(question.id) ? "red" : "gray"
																	}
																	onClick={() => quiz.toggleFlag(question.id)}
																	disabled={isDisabled}
																>
																	{quiz.isFlagged(question.id) ? (
																		<IconFlagFilled size={18} />
																	) : (
																		<IconFlag size={18} />
																	)}
																</ActionIcon>
															</Tooltip>
														)}
													</Group>
												</Group>

												{/* Question Renderer */}
												<QuestionRenderer
													question={question}
													value={quiz.getAnswer(question.id) as unknown}
													onChange={(value) =>
														quiz.setAnswer(question.id, value as QuestionAnswer)
													}
													disabled={isDisabled}
												/>
											</Stack>
										</Paper>
									);
								},
							)}
						</Stack>
					</div>

					{/* Navigation */}
					<Group justify="space-between" mt="md">
						{readonly ? (
							<>
								{onExit && (
									<Button variant="default" onClick={handleExit}>
										Exit
									</Button>
								)}
								<div style={{ flex: 1 }} />
								<Group gap="sm">
									<Button
										variant="default"
										onClick={quiz.goToPreviousPage}
										disabled={quiz.isFirstPage}
									>
										Previous
									</Button>
									<Button
										onClick={quiz.goToNextPage}
										disabled={quiz.isLastPage}
									>
										Next
									</Button>
								</Group>
							</>
						) : (
							<>
								<Button
									variant="default"
									onClick={quiz.goToPreviousPage}
									disabled={quiz.isFirstPage || isDisabled}
								>
									Previous
								</Button>

								{quiz.isLastPage ? (
									<Button onClick={handleSubmit} disabled={isDisabled}>
										{isGlobalTimerExpired ? "View Results" : "Submit Quiz"}
									</Button>
								) : (
									<Button onClick={quiz.goToNextPage} disabled={isDisabled}>
										Next
									</Button>
								)}
							</>
						)}
					</Group>
				</Stack>
			</Paper>

			{/* Results Modal */}
			<Modal
				opened={showResults}
				onClose={() => setShowResults(false)}
				title="Quiz Submitted"
				size="lg"
			>
				<Stack gap="md">
					<Text>Your answers have been submitted successfully!</Text>

					<Text size="sm" fw={500}>
						Results:
					</Text>

					<ScrollArea h={400}>
						<Code block>{JSON.stringify(submittedAnswers, null, 2)}</Code>
					</ScrollArea>

					<Button onClick={() => setShowResults(false)} fullWidth>
						Close
					</Button>
				</Stack>
			</Modal>
		</>
	);
}

// Main QuizPreview component - handles both regular and nested quizzes
interface QuizPreviewProps {
	quizConfig: QuizConfig;
	submissionId?: number;
	onSubmit?: (answers: QuizAnswers) => void;
	remainingTime?: number; // Remaining time in seconds for resumed quizzes
}

export function QuizPreview({
	quizConfig,
	onSubmit,
	remainingTime,
}: QuizPreviewProps) {
	const [isParentTimerExpired, setIsParentTimerExpired] = useState(false);

	// For container quizzes, use nested quiz state
	const nestedQuizState = useNestedQuizState({ quizConfig });

	const handleParentTimerExpire = () => {
		setIsParentTimerExpired(true);
		// If in a nested quiz when parent expires, force exit
		if (nestedQuizState.currentNestedQuizId) {
			nestedQuizState.exitToContainer();
		}
	};

	// Regular quiz - just render SingleQuizPreview directly
	if (isRegularQuiz(quizConfig)) {
		return (
			<SingleQuizPreview
				quizConfig={quizConfig}
				onSubmit={onSubmit}
				remainingTime={remainingTime}
				grading={quizConfig.grading}
			/>
		);
	}

	// Container quiz logic
	if (!isContainerQuiz(quizConfig)) {
		return (
			<Paper withBorder p="xl" radius="md">
				<Text c="dimmed">
					Invalid quiz configuration: Must have either pages or nested quizzes.
				</Text>
			</Paper>
		);
	}

	// Check if viewing a completed nested quiz (readonly mode)
	const isViewingCompletedQuiz =
		nestedQuizState.currentNestedQuizId !== null &&
		nestedQuizState.isQuizCompleted(nestedQuizState.currentNestedQuizId);

	return (
		<Stack gap="md">
			{/* Parent Timer (always visible if exists) */}
			{quizConfig.globalTimer && (
				<Paper withBorder p="md" radius="sm">
					<Group justify="space-between">
						<Text size="sm" fw={500}>
							Overall Time Limit
						</Text>
						<TimerDisplay
							key={`parent-timer-${remainingTime ?? quizConfig.globalTimer}`}
							initialTime={quizConfig.globalTimer}
							remainingTime={remainingTime}
							onExpire={handleParentTimerExpire}
						/>
					</Group>
				</Paper>
			)}

			{/* Parent Timer Expired Warning */}
			{isParentTimerExpired && (
				<Alert color="red" title="Time Expired" icon={<IconClock size={20} />}>
					The overall time limit has expired. All quizzes are now locked.
				</Alert>
			)}

			{/* Nested Quiz Timer (only when inside a nested quiz) */}
			{nestedQuizState.activeNestedQuiz?.globalTimer &&
				!isViewingCompletedQuiz && (
					<Paper withBorder p="md" radius="sm" bg="blue.0">
						<Group justify="space-between">
							<Text size="sm" fw={500}>
								Current Quiz Time
							</Text>
							<TimerDisplay
								key={`nested-timer-${remainingTime ?? nestedQuizState.activeNestedQuiz.globalTimer}`}
								initialTime={nestedQuizState.activeNestedQuiz.globalTimer}
								remainingTime={remainingTime}
								onExpire={() => {
									// Nested timer expired - this will be handled by SingleQuizPreview
								}}
							/>
						</Group>
					</Paper>
				)}

			{/* Content: Either selector or nested quiz */}
			{nestedQuizState.currentNestedQuizId === null ? (
				<NestedQuizSelector
					quizConfig={quizConfig}
					completedQuizIds={nestedQuizState.completedQuizIds}
					onStartQuiz={nestedQuizState.startNestedQuiz}
					canAccessQuiz={nestedQuizState.canAccessQuiz}
					isQuizCompleted={nestedQuizState.isQuizCompleted}
					completionProgress={nestedQuizState.completionProgress}
					isParentTimerExpired={isParentTimerExpired}
				/>
			) : nestedQuizState.activeNestedQuiz ? (
				<SingleQuizPreview
					quizConfig={nestedQuizState.activeNestedQuiz}
					readonly={isViewingCompletedQuiz}
					initialAnswers={
						isViewingCompletedQuiz
							? nestedQuizState.submittedAnswers[
							nestedQuizState.currentNestedQuizId
							]
							: undefined
					}
					onSubmit={(answers: QuizAnswers) => {
						if (nestedQuizState.currentNestedQuizId) {
							nestedQuizState.completeNestedQuiz(
								nestedQuizState.currentNestedQuizId,
								answers,
							);
						}
					}}
					onExit={nestedQuizState.exitToContainer}
					disableInteraction={isParentTimerExpired}
					remainingTime={remainingTime}
					grading={quizConfig.grading}
				/>
			) : null}
		</Stack>
	);
}

