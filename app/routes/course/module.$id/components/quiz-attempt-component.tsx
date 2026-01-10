import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import {
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
	isContainerQuiz,
	isRegularQuiz,
} from "server/json/raw-quiz-config/v2";
import { RichTextRenderer } from "../../../../components/rich-text/rich-text-renderer";
import { NestedQuizSelector } from "../../../../components/activity-modules-preview/nested-quiz-selector";
import { useNestedQuizState } from "./use-nested-quiz-state";
import { useQuizForm } from "./use-quiz-form";
import { useQuizTimer } from "./use-quiz-timer";
import { QuestionCard } from "./question-card";

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

interface QuizNavigationProps {
	questionMap: Array<{
		questionId: string;
		questionNumber: number;
		pageIndex: number;
		questionIndex: number;
		prompt: string;
		question: Question;
	}>;
	answers: QuizAnswers;
	isFlagged: (questionId: string) => boolean;
	currentPageIndex: number;
	goToPage: (pageIndex: number) => void;
	isDisabled: boolean;
}

function QuizNavigation({
	questionMap,
	answers,
	isFlagged,
	currentPageIndex,
	goToPage,
	isDisabled,
}: QuizNavigationProps) {
	return (
		<Paper withBorder p="md" radius="sm">
			<Stack gap="sm">
				<Text size="sm" fw={500}>
					Question Navigation
				</Text>
				<Group gap="xs">
					{questionMap.map((item) => {
						const answerValue = answers[item.questionId];
						const isAnswered = isQuestionAnswered(item.question, answerValue);
						const isFlaggedValue = isFlagged(item.questionId);
						const isCurrent = currentPageIndex === item.pageIndex;

						return (
							<Tooltip
								key={item.questionId}
								label={`Q${item.questionNumber}: ${item.prompt.slice(0, 50)}...`}
							>
								<Indicator
									inline
									label={<IconFlag size={10} />}
									size={16}
									disabled={!isFlaggedValue}
									color="red"
									offset={3}
								>
									<Button
										size="compact-sm"
										variant={isAnswered ? "light" : "default"}
										color={isAnswered ? "green" : "gray"}
										onClick={() => goToPage(item.pageIndex)}
										disabled={isDisabled}
										style={
											isCurrent
												? {
													borderWidth: 3,
													borderStyle: "solid",
													borderColor: "var(--mantine-color-blue-6)",
												}
												: undefined
										}
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
								borderWidth: 3,
								borderStyle: "solid",
								borderColor: "var(--mantine-color-blue-6)",
								borderRadius: "var(--mantine-radius-sm)",
								backgroundColor: "transparent",
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
	);
}

interface QuizNavigationButtonsProps {
	readonly?: boolean;
	onExit?: () => void;
	isFirstPage: boolean;
	isLastPage: boolean;
	goToPreviousPage: () => void;
	goToNextPage: () => void;
	isDisabled: boolean;
	onSubmit: () => void;
	isGlobalTimerExpired: boolean;
}

function QuizNavigationButtons({
	readonly = false,
	onExit,
	isFirstPage,
	isLastPage,
	goToPreviousPage,
	goToNextPage,
	isDisabled,
	onSubmit,
	isGlobalTimerExpired,
}: QuizNavigationButtonsProps) {
	return (
		<Group justify="space-between" mt="md">
			{readonly ? (
				<>
					{onExit && (
						<Button variant="default" onClick={onExit}>
							Exit
						</Button>
					)}
					<div style={{ flex: 1 }} />
					<Group gap="sm">
						<Button
							variant="default"
							onClick={goToPreviousPage}
							disabled={isFirstPage}
						>
							Previous
						</Button>
						<Button onClick={goToNextPage} disabled={isLastPage}>
							Next
						</Button>
					</Group>
				</>
			) : (
				<>
					<Button
						variant="default"
						onClick={goToPreviousPage}
						disabled={isFirstPage || isDisabled}
					>
						Previous
					</Button>

					{isLastPage ? (
						<Button onClick={onSubmit} disabled={isDisabled}>
							{isGlobalTimerExpired ? "View Results" : "Submit Quiz"}
						</Button>
					) : (
						<Button onClick={goToNextPage} disabled={isDisabled}>
							Next
						</Button>
					)}
				</>
			)}
		</Group>
	);
}

interface QuizHeaderProps {
	quizConfig: RegularQuizConfig | NestedQuizConfig;
	grading?: GradingConfig;
	currentPageIndex: number;
	readonly?: boolean;
	remainingTime?: number;
	onGlobalTimerExpire: () => void;
	progressValue: number;
}

function QuizHeader({
	quizConfig,
	grading,
	currentPageIndex,
	readonly = false,
	remainingTime,
	onGlobalTimerExpire,
	progressValue,
}: QuizHeaderProps) {
	return (
		<>
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
						Page {currentPageIndex + 1} of {quizConfig.pages.length}
					</Text>
				</div>
				{quizConfig.globalTimer && !readonly && (
					<TimerDisplay
						key={`timer-${remainingTime ?? quizConfig.globalTimer}`}
						initialTime={quizConfig.globalTimer}
						remainingTime={remainingTime}
						onExpire={onGlobalTimerExpire}
					/>
				)}
			</Group>

			{/* Progress Bar with Tooltip */}
			<Tooltip
				label={`Progress: ${progressValue?.toFixed?.(0) ?? 0}% complete`}
				position="bottom"
			>
				<Progress value={progressValue} size="sm" />
			</Tooltip>
		</>
	);
}

interface SingleQuizPreviewProps {
	quizConfig?: RegularQuizConfig | NestedQuizConfig;
	readonly?: boolean;
	/**
	 * Initial answers from the submission.
	 * if user has already answered some questions, they will be loaded here.
	 */
	initialAnswers?: QuizAnswers;
	onSubmit?: () => void; // Simplified - just marks complete
	onExit?: () => void;
	disableInteraction?: boolean;
	remainingTime?: number; // Remaining time in seconds for resumed quizzes
	grading?: GradingConfig; // Grading config from parent quiz
	submissionId?: number; // Required for saving answers
	currentPageIndex: number | undefined;
	moduleLinkId?: number; // Required for flag/unflag actions
	flaggedQuestions?: Array<{ questionId: string }>; // Flagged questions from server
}

export function SingleQuizPreview({
	quizConfig,
	readonly = false,
	initialAnswers,
	onSubmit,
	onExit,
	disableInteraction = false,
	currentPageIndex,
	remainingTime,
	grading,
	submissionId,
	moduleLinkId,
	flaggedQuestions = [],
}: SingleQuizPreviewProps) {
	// Create a Set for efficient lookup of flagged question IDs
	const flaggedQuestionIds = new Set(
		flaggedQuestions.map((f) => f.questionId),
	);

	// Helper function to check if a question is flagged
	const isQuestionFlagged = (questionId: string): boolean => {
		return flaggedQuestionIds.has(questionId);
	};
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
		currentPageIndex,
		readonly,
		initialAnswers,
	});

	const handleSubmit = () => {
		if (!quizConfig) return;

		// Call onSubmit callback if provided (for real submission - just marks complete)
		if (onSubmit) {
			onSubmit();
			// Don't show results modal for real submission - redirect will happen
			return;
		}

		// Only show mock results modal if no onSubmit callback (for testing/preview)
		setSubmittedAnswers(quiz.answers);
		setShowResults(true);
	};

	const handleGlobalTimerExpire = () => {
		setIsGlobalTimerExpired(true);
		if (!readonly) {
			handleSubmit();
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

					<QuizHeader
						quizConfig={quizConfig}
						grading={grading}
						currentPageIndex={quiz.currentPageIndex}
						readonly={readonly}
						remainingTime={remainingTime}
						onGlobalTimerExpire={handleGlobalTimerExpire}
						progressValue={progressValue}
					/>

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

					<QuizNavigation
						questionMap={questionMap}
						answers={quiz.answers}
						isFlagged={isQuestionFlagged}
						currentPageIndex={quiz.currentPageIndex}
						goToPage={quiz.goToPage}
						isDisabled={isDisabled}
					/>

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
										<QuestionCard
											key={question.id}
											question={question}
											questionNumber={questionNumber}
											grading={grading}
											initialAnswers={initialAnswers}
											readonly={readonly}
											isDisabled={isDisabled}
											isFlagged={isQuestionFlagged(question.id)}
											answer={quiz.answers[question.id]}
											moduleLinkId={moduleLinkId}
											submissionId={submissionId}
										/>
									);
								},
							)}
						</Stack>
					</div>

					<QuizNavigationButtons
						readonly={readonly}
						onExit={onExit}
						isFirstPage={quiz.isFirstPage}
						isLastPage={quiz.isLastPage}
						goToPreviousPage={quiz.goToPreviousPage}
						goToNextPage={quiz.goToNextPage}
						isDisabled={isDisabled}
						onSubmit={handleSubmit}
						isGlobalTimerExpired={isGlobalTimerExpired}
					/>
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
interface QuizAttemptComponentProps {
	quizConfig: QuizConfig;
	submissionId: number; // Required for saving answers
	onSubmit?: () => void; // Simplified - just marks complete
	remainingTime?: number; // Remaining time in seconds for resumed quizzes
	initialAnswers?: QuizAnswers; // Loaded answers from submission
	currentPageIndex: number | undefined;
	moduleLinkId?: number; // Required for flag/unflag actions
	flaggedQuestions?: Array<{ questionId: string }>; // Flagged questions from server
}

export function QuizAttemptComponent({
	quizConfig,
	submissionId,
	onSubmit,
	remainingTime,
	initialAnswers,
	currentPageIndex,
	moduleLinkId,
	flaggedQuestions = [],
}: QuizAttemptComponentProps) {
	const [isParentTimerExpired, setIsParentTimerExpired] = useState(false);

	// For container quizzes, use nested quiz state
	const nestedQuizState = useNestedQuizState({
		quizConfig,
		initialAnswers,
	});

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
				initialAnswers={initialAnswers}
				submissionId={submissionId}
				currentPageIndex={currentPageIndex}
				moduleLinkId={moduleLinkId}
				flaggedQuestions={flaggedQuestions}
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
					moduleLinkId={moduleLinkId}
					initialAnswers={
						isViewingCompletedQuiz && initialAnswers
							? (() => {
								// Extract answers for this specific nested quiz from initialAnswers
								const nestedQuizAnswers: QuizAnswers = {};
								const activeQuiz = nestedQuizState.activeNestedQuiz;
								if (activeQuiz?.pages) {
									for (const page of activeQuiz.pages) {
										for (const question of page.questions) {
											const answer = initialAnswers[question.id];
											if (answer !== undefined && answer !== null) {
												nestedQuizAnswers[question.id] = answer;
											}
										}
									}
								}
								return nestedQuizAnswers;
							})()
							: undefined
					}
					onSubmit={() => {
						if (nestedQuizState.currentNestedQuizId) {
							// For nested quizzes, we still need to handle completion differently
							// This is a simplified version - nested quiz handling may need more work
							if (onSubmit) {
								onSubmit();
							}
						}
					}}
					submissionId={submissionId}
					onExit={nestedQuizState.exitToContainer}
					disableInteraction={isParentTimerExpired}
					remainingTime={remainingTime}
					grading={quizConfig.grading}
					currentPageIndex={currentPageIndex}
				/>
			) : null}
		</Stack>
	);
}

