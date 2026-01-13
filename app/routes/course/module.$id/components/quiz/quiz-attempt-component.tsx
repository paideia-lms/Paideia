import {
	Alert,
	Badge,
	Code,
	Group,
	Paper,
	Progress,
	ScrollArea,
	Stack,
	Text,
	Title,
	Tooltip,
} from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import type {
	GradingConfig,
	NestedQuizConfig,
	Question,
	QuizAnswers,
	QuizConfig,
	QuizResource,
	RegularQuizConfig,
} from "server/json/raw-quiz-config/v2";
import { calculateTotalPoints } from "server/json/raw-quiz-config/v2";
import { RichTextRenderer } from "app/components/rich-text/rich-text-renderer";
import { QuestionCard } from "./question-card";
import { QuizNavigation, QuizNavigationButtons } from "./quiz-navigation";
import { ContainerQuizAttemptComponent } from "./container-quiz-attempt-component";
import { TimerDisplay } from "app/components/timer-display";
import { createRouteComponent } from "app/utils/create-route-component";
import type { Jsonify } from "type-fest";
import type { Route } from "../../route";

interface QuizHeaderProps {
	quizConfig: RegularQuizConfig | NestedQuizConfig;
	grading?: GradingConfig;
	// currentPageIndex: number;
	readonly?: boolean;
	remainingTime?: number;
	// onGlobalTimerExpire: () => void;
	progressValue: number;
}

const QuizHeader = createRouteComponent<
	Route.ComponentProps,
	Jsonify<QuizHeaderProps>
>(
	(
		{ quizConfig, grading, readonly, remainingTime, progressValue },
		{ loaderData },
	) => {
		const {
			params: { moduleLinkId },
			searchParams: { quizPageIndex },
		} = loaderData;
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
							Page {quizPageIndex + 1} of {quizConfig.pages.length}
						</Text>
					</div>
					{quizConfig.globalTimer && !readonly && (
						<TimerDisplay
							key={`timer-${remainingTime ?? quizConfig.globalTimer}`}
							initialTime={quizConfig.globalTimer}
							remainingTime={remainingTime}
							onExpire={() => {}}
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
	},
);

interface RegularQuizAttemptComponentProps {
	quizConfig: RegularQuizConfig | NestedQuizConfig;
	readonly?: boolean;
	/**
	 * Initial answers from the submission.
	 * if user has already answered some questions, they will be loaded here.
	 */
	initialAnswers?: QuizAnswers;
	// onSubmit?: () => void; // Simplified - just marks complete
	// onExit?: () => void;
	disableInteraction?: boolean;
	remainingTime?: number; // Remaining time in seconds for resumed quizzes
	grading?: GradingConfig; // Grading config from parent quiz
	submissionId: number; // Required for saving answers
	flaggedQuestions?: Array<{ id: string }>; // Flagged questions from server
}

export const RegularQuizAttemptComponent = createRouteComponent<
	Route.ComponentProps,
	Jsonify<RegularQuizAttemptComponentProps>
>(
	(
		{
			quizConfig,
			readonly = false,
			initialAnswers,
			// onSubmit,
			// onExit,
			disableInteraction = false,
			remainingTime,
			grading,
			submissionId,
			flaggedQuestions = [],
		},
		{ loaderData },
	) => {
		const {
			params: { moduleLinkId },
			searchParams: { quizPageIndex },
		} = loaderData;
		// Create a Set for efficient lookup of flagged question IDs
		// const flaggedQuestionIds = new Set(flaggedQuestions.map((f) => f.id));

		// Helper function to check if a question is flagged
		// const isQuestionFlagged = (questionId: string): boolean => {
		// 	return flaggedQuestionIds.has(questionId);
		// };
		// const [isGlobalTimerExpired, setIsGlobalTimerExpired] = useState(false);
		// TODO: MOCK
		const isGlobalTimerExpired = false;
		const answers = initialAnswers || {};
		const isFirstPage = quizPageIndex === 0;
		const isLastPage = quizConfig?.pages
			? quizPageIndex === quizConfig.pages.length - 1
			: false;

		// const handleGlobalTimerExpire = () => {
		// 	setIsGlobalTimerExpired(true);
		// 	// if (!readonly) {
		// 	// 	handleSubmit();
		// 	// }
		// };

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

		const currentPage = quizConfig.pages[quizPageIndex];

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
				? ((quizPageIndex + 1) / quizConfig.pages.length) * 100
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
				.slice(0, quizPageIndex)
				.reduce((sum: number, page) => sum + page.questions.length, 0) + 1;

		const isDisabled = readonly || isGlobalTimerExpired || disableInteraction;

		return (
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
						readonly={readonly}
						remainingTime={remainingTime}
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
						answers={answers}
						flaggedQuestions={flaggedQuestions}
						currentPageIndex={quizPageIndex}
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
							{currentPage.questions.map((question, questionIndex) => {
								const questionNumber =
									currentQuestionStartNumber + questionIndex;
								const isFlagged = flaggedQuestions.some(
									(f) => f.id === question.id,
								);
								const answer = answers[question.id];

								return (
									<QuestionCard
										key={question.id}
										question={question}
										questionNumber={questionNumber}
										grading={grading}
										initialAnswers={initialAnswers}
										readonly={readonly}
										isDisabled={isDisabled}
										isFlagged={isFlagged}
										answer={answer}
										moduleLinkId={moduleLinkId}
										submissionId={submissionId}
									/>
								);
							})}
						</Stack>
					</div>

					<QuizNavigationButtons
						readonly={readonly}
						// onExit={onExit}
						isFirstPage={isFirstPage}
						isLastPage={isLastPage}
						currentPageIndex={quizPageIndex}
						isDisabled={isDisabled}
						// onSubmit={handleSubmit}
						isGlobalTimerExpired={isGlobalTimerExpired}
						submissionId={submissionId}
						moduleLinkId={moduleLinkId}
						answers={answers}
					/>
				</Stack>
			</Paper>
		);
	},
);

// Main QuizPreview component - handles both regular and nested quizzes
interface CompletedNestedQuiz {
	id: string;
	startedAt?: string | null;
	completedAt?: string | null;
}

interface QuizAttemptComponentProps {
	quizConfig: QuizConfig;
	submissionId: number; // Required for saving answers
	// onSubmit?: () => void; // Simplified - just marks complete
	remainingTime?: number; // Remaining time in seconds for resumed quizzes
	initialAnswers?: QuizAnswers; // Loaded answers from submission
	flaggedQuestions?: Array<{ id: string }>; // Flagged questions from server
	readonly?: boolean; // Whether the quiz is in readonly mode (for viewing completed submissions)
	completedNestedQuizzes?: CompletedNestedQuiz[] | null; // Completed nested quizzes from server
}

export const QuizAttemptComponent = createRouteComponent<
	Route.ComponentProps,
	Jsonify<QuizAttemptComponentProps>
>(
	(
		{
			quizConfig,
			submissionId,
			// onSubmit,
			remainingTime,
			initialAnswers,
			flaggedQuestions = [],
			readonly = false,
			completedNestedQuizzes,
		},
		{ loaderData },
	) => {
		// Route to appropriate component based on quiz type
		if (quizConfig.type === "regular") {
			return (
				<RegularQuizAttemptComponent
					quizConfig={quizConfig}
					submissionId={submissionId}
					// onSubmit={onSubmit}
					remainingTime={remainingTime}
					initialAnswers={initialAnswers}
					flaggedQuestions={flaggedQuestions}
					readonly={readonly}
				/>
			);
		}

		// Container quiz
		return (
			<ContainerQuizAttemptComponent
				quizConfig={quizConfig}
				submissionId={submissionId}
				// onSubmit={onSubmit}
				remainingTime={remainingTime}
				initialAnswers={initialAnswers}
				flaggedQuestions={flaggedQuestions}
				readonly={readonly}
				completedNestedQuizzes={completedNestedQuizzes}
			/>
		);
	},
);
