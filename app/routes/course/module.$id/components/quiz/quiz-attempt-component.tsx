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
	QuizResource,
} from "server/json/raw-quiz-config/v2";
import { calculateTotalPoints } from "server/json/raw-quiz-config/v2";
import { RichTextRenderer } from "app/components/rich-text/rich-text-renderer";
import { QuestionCard } from "./question-card";
import { QuizNavigation, QuizNavigationButtons } from "./quiz-navigation";
import { ContainerQuizAttemptComponent } from "./container-quiz-attempt-component";
import { TimerDisplay } from "app/components/timer-display";
import type { Route } from "../../route";
import { constate } from "app/utils/constate";
import { QuestionContextProvider } from "./question-context";
import { useLoaderData } from "react-router";
import { keyBy, mapValues } from "es-toolkit";
import type { QuizAnswers } from "server/json/raw-quiz-config/v2";

interface QuizHeaderProps {
	remainingTime?: number;
	progressValue: number;
}

function QuizHeader({
	remainingTime,
	progressValue,
}: QuizHeaderProps) {
	const { quizConfig, quizPageIndex, readonly } = useRegularQuizAttemptContext();
	const grading = "grading" in quizConfig ? quizConfig.grading : undefined;
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
						onExpire={() => { }}
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

interface RegularQuizAttemptComponentProps {
	grading?: GradingConfig;
}

export function RegularQuizAttemptComponent({
	grading,
}: RegularQuizAttemptComponentProps) {
	// Get all data from context
	const {
		quizConfig,
		submission,
		remainingTime,
		quizPageIndex,
		readonly,
		answers,
		nestedQuizId,
	} = useRegularQuizAttemptContext();

	// TODO: Implement actual timer expiration check
	const isGlobalTimerExpired = false;

	// Guard against undefined config (after all hooks are called)
	if (quizConfig.pages.length === 0) {
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

	const currentQuestionStartNumber =
		quizConfig.pages
			.slice(0, quizPageIndex)
			.reduce((sum: number, page) => sum + page.questions.length, 0) + 1;

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

				<QuizNavigation />

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
							// Construct full questionId: for nested quizzes, use "nestedQuizId:questionId" format
							// For regular quizzes, just use question.id
							const fullQuestionId = nestedQuizId
								? `${nestedQuizId}:${question.id}`
								: question.id;
							const isFlagged = (submission.flaggedQuestions ?? []).some(
								(f) => f.questionId === fullQuestionId,
							);
							const answerValue = answers[fullQuestionId];

							return (
								<QuestionContextProvider
									key={question.id}
									question={question}
									questionNumber={questionNumber}
									grading={grading}
									isFlagged={isFlagged}
									answer={answerValue}
									submissionId={submission.id}
								>
									<QuestionCard />
								</QuestionContextProvider>
							);
						})}
					</Stack>
				</div>

				<QuizNavigationButtons
					isGlobalTimerExpired={isGlobalTimerExpired}
				/>
			</Stack>
		</Paper>
	);
}

// // Main QuizPreview component - handles both regular and nested quizzes
// interface CompletedNestedQuiz {
// 	id: string;
// 	startedAt?: string | null;
// 	completedAt?: string | null;
// }

type QuizLoaderData = Extract<Route.ComponentProps["loaderData"], { type: "quiz" }>;
type RegularQuizConfig = Extract<QuizLoaderData['quiz']['rawQuizConfig'], { type: "regular" }>
type ContainerQuizConfig = Extract<QuizLoaderData['quiz']['rawQuizConfig'], { type: "container" }>;
type Submission = NonNullable<Extract<QuizLoaderData, { type: "quiz" }>['viewedSubmission']>;

interface QuizAttemptComponentProps {
	quizConfig: RegularQuizConfig | ContainerQuizConfig;
	submission: Submission;
	remainingTime?: number;
}

const [RegularQuizAttemptContextProvider, useRegularQuizAttemptContext] = constate((props: {
	/** 
	 * The quiz config for the attempt.
	 * Can be RegularQuizConfig or NestedQuizConfig (for nested quizzes in containers).
	 */
	quizConfig: RegularQuizConfig | NestedQuizConfig;
	/** 
	 * the current submission for the attempt
	 */
	submission: Submission;
	/** 
	 * Time remaining in seconds for the quiz attempt.
	 */
	remainingTime?: number;
	/**
	 * Whether interactions should be disabled (e.g., parent timer expired)
	 */
	disableInteraction?: boolean;
}) => {
	// Get route params from loader data
	const loaderData = useLoaderData<Route.ComponentProps["loaderData"]>();
	const moduleLinkId = Number(loaderData.params.moduleLinkId);
	const quizPageIndex = loaderData.searchParams.quizPageIndex;
	const nestedQuizId = loaderData.searchParams.nestedQuizId;

	// Check if the current nested quiz is completed
	// A nested quiz is completed if it has a completedAt value
	const isNestedQuizCompleted =
		nestedQuizId !== null &&
		props.submission.completedNestedQuizzes?.some(
			(q) =>
				q.nestedQuizId === nestedQuizId &&
				q.completedAt !== null &&
				q.completedAt !== undefined,
		);

	// Compute readonly from submission status or nested quiz completion
	const readonly =
		props.submission.status !== "in_progress" || isNestedQuizCompleted;

	// TODO: Implement actual timer expiration check
	const isGlobalTimerExpired = false;

	// Compute isDisabled from readonly, timer, and disableInteraction
	const isDisabled = readonly || isGlobalTimerExpired || (props.disableInteraction ?? false);

	// Compute page navigation states
	const isFirstPage = quizPageIndex === 0;
	const isLastPage = props.quizConfig.pages
		? quizPageIndex === props.quizConfig.pages.length - 1
		: false;

	// Convert submission answers array to QuizAnswers object
	// This is used by multiple components (QuizNavigation, QuizNavigationButtons, etc.)
	const answers = mapValues(
		keyBy(
			(props.submission.answers ?? []).filter(
				(answer) => answer.selectedAnswer !== null && answer.selectedAnswer !== undefined,
			),
			(answer) => answer.questionId,
		),
		(answer) => answer.selectedAnswer,
	) as QuizAnswers;

	// Build question map for navigation
	// For nested quizzes, questionId should include the nestedQuizId prefix
	const questionMap = props.quizConfig.pages.reduce<Array<{
		questionId: string;
		questionNumber: number;
		pageIndex: number;
		questionIndex: number;
		prompt: string;
		question: Question;
	}>>((acc, page, pageIndex) => {
		const mappedQuestions = page.questions.map((question, questionIndex) => {
			// Construct full questionId: for nested quizzes, use "nestedQuizId:questionId" format
			const fullQuestionId = nestedQuizId
				? `${nestedQuizId}:${question.id}`
				: question.id;
			return {
				questionId: fullQuestionId,
				questionNumber: acc.length + questionIndex + 1, // running global number
				pageIndex,
				questionIndex,
				prompt: question.prompt,
				question,
			};
		});
		acc.push(...mappedQuestions);
		return acc;
	}, []);

	return {
		...props,
		moduleLinkId,
		quizPageIndex,
		nestedQuizId,
		readonly,
		isDisabled,
		isFirstPage,
		isLastPage,
		answers,
		questionMap,
	};
})

const [ContainerQuizAttemptContextProvider, useContainerQuizAttemptContext] = constate((props: {
	/** 
	 * The quiz config for the attempt.
	 */
	quizConfig: ContainerQuizConfig;
	/** 
	 * the current submission for the attempt
	 */
	submission: Submission;
	/** 
	 * Time remaining in seconds for the quiz attempt.
	 */
	remainingTime?: number;
	/**
	 * Whether interactions should be disabled (e.g., parent timer expired)
	 */
	disableInteraction?: boolean;
}) => {
	// Get route params from loader data
	const loaderData = useLoaderData<Route.ComponentProps["loaderData"]>();
	const moduleLinkId = loaderData.params.moduleLinkId;
	const quizPageIndex = loaderData.searchParams.quizPageIndex;
	const nestedQuizId = loaderData.searchParams.nestedQuizId;

	// Compute readonly from submission status
	const readonly = props.submission.status !== "in_progress";

	// Compute isDisabled from readonly and disableInteraction
	const isDisabled = readonly || (props.disableInteraction ?? false);

	// Get completedNestedQuizzes directly from submission to ensure fresh data after revalidation
	const completedNestedQuizzes = props.submission.completedNestedQuizzes ?? [];

	return {
		...props,
		moduleLinkId,
		quizPageIndex,
		nestedQuizId,
		readonly,
		isDisabled,
		completedNestedQuizzes,
	};
})

export {
	useRegularQuizAttemptContext,
	useContainerQuizAttemptContext,
	RegularQuizAttemptContextProvider,
};

export function QuizAttemptComponent({
	quizConfig,
	submission,
	remainingTime,
}: QuizAttemptComponentProps) {
	return quizConfig.type === "regular" ? (
		<RegularQuizAttemptContextProvider
			quizConfig={quizConfig}
			submission={submission}
			remainingTime={remainingTime}
		>
			<RegularQuizAttemptComponent />
		</RegularQuizAttemptContextProvider>
	) : (
		<ContainerQuizAttemptContextProvider
			quizConfig={quizConfig}
			submission={submission}
			remainingTime={remainingTime}
		>
			<ContainerQuizAttemptComponent />
		</ContainerQuizAttemptContextProvider>
	);
}