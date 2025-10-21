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
import { IconClock, IconFlag, IconFlagFilled } from "@tabler/icons-react";
import { memo, useState } from "react";
import { RichTextRenderer } from "../rich-text-renderer";
import { QuestionRenderer } from "./question-renderer";
import type {
	Question,
	QuestionAnswer,
	QuizAnswers,
	QuizConfig,
	QuizResource,
	NestedQuizConfig,
} from "./quiz-config.types";
import { isContainerQuiz, isRegularQuiz } from "./quiz-config.types";
import { NestedQuizSelector } from "./nested-quiz-selector";
import { useQuizForm } from "./use-quiz-form";
import { useQuizTimer } from "./use-quiz-timer";
import { useNestedQuizState } from "./use-nested-quiz-state";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

/**
 * Helper function to check if a question is truly answered
 * For whiteboard questions, checks if elements array is non-empty
 */
function isQuestionAnswered(question: Question, value: QuestionAnswer | undefined): boolean {
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
			return Array.isArray(data.elements) && data.elements.length > 0 && data.elements.filter((element) => !element.isDeleted).length > 0;
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
const TimerDisplay = memo(({
	initialTime,
	onExpire,
}: {
	initialTime?: number;
	onExpire: () => void;
}) => {
	const timer = useQuizTimer({ initialTime, onExpire });

	if (!initialTime) return null;

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
			color={getTimerColor(timer.timeLeft, initialTime)}
			leftSection={<IconClock size={16} />}
		>
			{timer.formattedTime}
		</Badge>
	);
});

TimerDisplay.displayName = "TimerDisplay";

interface SingleQuizPreviewProps {
	quizConfig?: QuizConfig | NestedQuizConfig;
	readonly?: boolean;
	initialAnswers?: QuizAnswers;
	onSubmit?: (answers: QuizAnswers) => void;
	onExit?: () => void;
	disableInteraction?: boolean;
}

export function SingleQuizPreview({
	quizConfig,
	readonly = false,
	initialAnswers,
	onSubmit,
	onExit,
	disableInteraction = false,
}: SingleQuizPreviewProps) {
	const [showResults, setShowResults] = useState(false);
	const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, unknown> | null>(null);
	const [isGlobalTimerExpired, setIsGlobalTimerExpired] = useState(false);

	// Always call hooks - no conditional hook calls
	// Provide a default empty config to avoid hook issues
	const defaultConfig: QuizConfig = {
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
		const answers = quiz.form.getValues().answers;
		setSubmittedAnswers(answers);
		setShowResults(true);

		// Call onSubmit callback if provided (for nested quiz wrapper)
		if (onSubmit) {
			onSubmit(answers);
		}
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
					<Code
						block
					>{JSON.stringify(quizConfig, null, 2)}</Code>
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
					<Text c="dimmed">
						Invalid page index. Please restart the quiz.
					</Text>
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
							You are viewing a previously submitted quiz. No changes can be made.
						</Alert>
					)}

					{/* Header */}
					<Group justify="space-between" align="flex-start">
						<div>
							<Title order={2}>{quizConfig.title}</Title>
							<Text size="sm" c="dimmed" mt="xs">
								Page {quiz.currentPageIndex + 1} of {quizConfig.pages.length}
							</Text>
						</div>
						{quizConfig.globalTimer && !readonly && (
							<TimerDisplay
								initialTime={quizConfig.globalTimer}
								onExpire={handleGlobalTimerExpire}
							/>
						)}
					</Group>

					{/* Progress Bar */}
					<Progress value={progressValue} size="sm" />

					{/* Timer Expired Warning */}
					{isGlobalTimerExpired && !readonly && (
						<Paper withBorder p="md" radius="sm" bg="red.0" style={{ borderColor: "var(--mantine-color-red-6)" }}>
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
									const isAnswered = isQuestionAnswered(item.question, answerValue);
									const isFlagged = quiz.isFlagged(item.questionId);
									const isCurrent =
										quiz.currentPageIndex === item.pageIndex;

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
													variant={isCurrent ? "filled" : isAnswered ? "light" : "default"}
													color={isCurrent ? "blue" : isAnswered ? "green" : "gray"}
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
						{"resources" in quizConfig && quizConfig.resources && quizConfig.resources.length > 0 && (
							<Stack gap="md" mb="xl">
								{quizConfig.resources
									.filter((resource: QuizResource) => resource.pages.includes(currentPage.id))
									.map((resource: QuizResource) => (
										<Paper key={resource.id} withBorder p="md" radius="sm" bg="blue.0">
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
							{currentPage.questions.map((question: Question, questionIndex: number) => {
								const questionNumber = currentQuestionStartNumber + questionIndex;

								return (
									<Paper key={question.id} withBorder p="md" radius="sm">
										<Stack gap="md">
											{/* Question Header */}
											<Group justify="space-between" align="flex-start">
												<Group gap="sm" align="flex-start" style={{ flex: 1 }}>
													<Badge size="lg" variant="outline">
														Q{questionNumber}
													</Badge>
													<Text fw={500} style={{ flex: 1 }}>
														{question.prompt}
													</Text>
												</Group>
												{!readonly && (
													<Group gap="xs">
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
																	quiz.isFlagged(question.id) ? "filled" : "light"
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
													</Group>
												)}
											</Group>

											{/* Question Renderer */}
											<QuestionRenderer
												question={question}
												value={quiz.getAnswer(question.id) as unknown}
												onChange={(value) => quiz.setAnswer(question.id, value as QuestionAnswer)}
												disabled={isDisabled}
											/>
										</Stack>
									</Paper>
								);
							})}
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
}

export function QuizPreview({ quizConfig }: QuizPreviewProps) {
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
		return <SingleQuizPreview quizConfig={quizConfig} />;
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
							initialTime={quizConfig.globalTimer}
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
			{nestedQuizState.activeNestedQuiz?.globalTimer && !isViewingCompletedQuiz && (
				<Paper withBorder p="md" radius="sm" bg="blue.0">
					<Group justify="space-between">
						<Text size="sm" fw={500}>
							Current Quiz Time
						</Text>
						<TimerDisplay
							initialTime={nestedQuizState.activeNestedQuiz.globalTimer}
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
							? nestedQuizState.submittedAnswers[nestedQuizState.currentNestedQuizId]
							: undefined
					}
					onSubmit={(answers: QuizAnswers) => {
						if (nestedQuizState.currentNestedQuizId) {
							nestedQuizState.completeNestedQuiz(
								nestedQuizState.currentNestedQuizId,
								answers
							);
						}
					}}
					onExit={nestedQuizState.exitToContainer}
					disableInteraction={isParentTimerExpired}
				/>
			) : null}
		</Stack>
	);
}

// Sample Quiz Config for testing
export const sampleQuizConfig: QuizConfig = {
	id: "sample-quiz-1",
	title: "Sample Quiz: All Question Types",
	globalTimer: 600, // 10 minutes
	resources: [
		{
			id: "resource-1",
			title: "Reference Material: Web Technologies",
			content: `
				<h3>Common Web Technologies</h3>
				<p>Here are some commonly used web technologies:</p>
				<ul>
					<li><strong>HTML</strong> - Markup language for structuring web content</li>
					<li><strong>CSS</strong> - Styling language for presentation</li>
					<li><strong>JavaScript</strong> - Programming language for interactivity</li>
					<li><strong>Python</strong> - General-purpose programming language</li>
					<li><strong>Java</strong> - Object-oriented programming language</li>
				</ul>
				<p>Note: HTML and CSS are not considered programming languages.</p>
			`,
			pages: ["page-1", "page-2"], // Appears on first two pages
		},
		{
			id: "resource-2",
			title: "Quick Reference: Programming Paradigms",
			content: `
				<h3>Popular Programming Paradigms</h3>
				<ol>
					<li><strong>Object-Oriented Programming (OOP)</strong> - Most widely used</li>
					<li><strong>Functional Programming (FP)</strong> - Growing in popularity</li>
					<li><strong>Procedural Programming</strong> - Traditional approach</li>
					<li><strong>Logic Programming</strong> - Specialized use cases</li>
				</ol>
			`,
			pages: ["page-3"], // Only appears on third page
		},
		{
			id: "resource-3",
			title: "連続絞殺事件「折鶴の男」の謎",
			content: `
				<p>岐阜県警は本日、過去5年間に渡り全国で発生した未解決連続絞殺事件「折鶴事件」の犯行声明文を公開した。被害者は全て40代男性で、首に金属製ワイヤーを巻かれた状態で発見され、ポケットには赤い折り紙の鶴が残されていた。犯人は現場の監視カメラに毎回「能面のような無表情の仮面」を被った姿を映しており、逃走時にはわざと靴音を響かせていたという。</p>
				<p>心理分析によれば、犯行は全て満月の深夜帯に集中し、被害者の自宅玄関に「悔い改め」と墨書した和紙が貼られていた。特筆すべきは、犯人が幼少期に虐待を受けた孤児院「暁光園」の元職員をターゲットにしていると推定される点だ。しかし同施設は20年前に閉鎖され、関係者の証言からは「折鶴」との関連性は見出せていない。</p>
				<p>驚くべきことに、先月行われた精神鑑定では「完全な理性のもと計画性を持って行動し、反社会性パーソナリティ障害の特徴は認められない」との結果が示された。現在も犯人は「次なる審判の時」を予告する暗号文をSNSで発信し続けており、警察は「文学作品『罪と炎』（1923年絶版）の引用パターン」を手掛かりに捜査を進めている。</p>
			`,
			pages: ["page-4"], // Japanese reading comprehension quiz
		},
	],
	pages: [
		{
			id: "page-1",
			title: "Multiple Choice and Text Questions",
			questions: [
				{
					id: "q1",
					type: "multiple-choice",
					prompt: "What is the capital of France?",
					options: {
						a: "London",
						b: "Berlin",
						c: "Paris",
						d: "Madrid",
					},
					correctAnswer: "c",
					feedback: "Paris is the capital and largest city of France.",
				},
				{
					id: "q2",
					type: "short-answer",
					prompt: "What is 2 + 2?",
					correctAnswer: "4",
				},
				{
					id: "q3",
					type: "long-answer",
					prompt: "Describe your favorite programming language and why you like it.",
				},
			],
		},
		{
			id: "page-2",
			title: "Advanced Question Types",
			questions: [
				{
					id: "q4",
					type: "article",
					prompt: "Write a short article about web development trends in 2025.",
				},
				{
					id: "q5",
					type: "fill-in-the-blank",
					prompt:
						"The capital of France is {{blank}} and the largest city is {{blank}}.",
					correctAnswers: ["Paris", "Paris"],
				},
				{
					id: "q6",
					type: "choice",
					prompt: "Which of the following are programming languages? (Select all that apply)",
					options: {
						python: "Python",
						html: "HTML",
						javascript: "JavaScript",
						css: "CSS",
						java: "Java",
					},
					correctAnswers: ["python", "javascript", "java"],
				},
			],
		},
		{
			id: "page-3",
			title: "Interactive Questions",
			questions: [
				{
					id: "q7",
					type: "ranking",
					prompt: "Rank these programming paradigms from most to least popular:",
					items: {
						oop: "Object-Oriented",
						fp: "Functional",
						procedural: "Procedural",
						logic: "Logic",
					},
					correctOrder: ["oop", "fp", "procedural", "logic"],
				},
				{
					id: "q10",
					type: "whiteboard",
					prompt: "Draw a diagram showing the relationship between the frontend, backend, and database in a web application:",
				},
				{
					id: "q8",
					type: "single-selection-matrix",
					prompt: "Rate your experience with these technologies:",
					rows: {
						react: "React",
						vue: "Vue",
						angular: "Angular",
						svelte: "Svelte",
					},
					columns: {
						beginner: "Beginner",
						intermediate: "Intermediate",
						advanced: "Advanced",
						expert: "Expert",
					},
				},
				{
					id: "324okp",
					type: "multiple-selection-matrix",
					prompt: "Select your preferred framework for each use case:",
					rows: {
						simple: "Building a simple website",
						spa: "Creating a complex SPA",
						mobile: "Developing a mobile app",
					},
					columns: {
						react: "React",
						vue: "Vue",
						angular: "Angular",
						svelte: "Svelte",
						nextjs: "Next.js",
					},
				},
			],
		},
		{
			id: "page-4",
			title: "日本語読解テスト - Japanese Reading Comprehension",
			questions: [
				{
					id: "jp-q1",
					type: "multiple-choice",
					prompt: "犯人が被害者に残すものは何か？",
					options: {
						a: "青い折り紙の船",
						b: "赤い折り紙の鶴",
						c: "白い和紙の短冊",
						d: "黒い金属の指輪",
					},
					correctAnswer: "b",
				},
				{
					id: "jp-q2",
					type: "multiple-choice",
					prompt: "犯行が行われる時間帯の特徴は？",
					options: {
						a: "早朝のラッシュ時",
						b: "満月の深夜帯",
						c: "雨の夕暮れ時",
						d: "平日の昼下がり",
					},
					correctAnswer: "b",
				},
				{
					id: "jp-q3",
					type: "multiple-choice",
					prompt: "被害者に共通する職業は？",
					options: {
						a: "飲食店経営者",
						b: "元孤児院職員",
						c: "IT技術者",
						d: "公務員",
					},
					correctAnswer: "b",
				},
				{
					id: "jp-q4",
					type: "multiple-choice",
					prompt: "警察が注目する文学作品は？",
					options: {
						a: "「罪と炎」",
						b: "「月と影」",
						c: "「孤児の祈り」",
						d: "「仮面の告白」",
					},
					correctAnswer: "a",
				},
				{
					id: "jp-q5",
					type: "multiple-choice",
					prompt: "精神鑑定で「認められない」とされたのは？",
					options: {
						a: "計画性",
						b: "理性的思考",
						c: "反社会性パーソナリティ障害",
						d: "トラウマ反応",
					},
					correctAnswer: "c",
				},
				{
					id: "jp-q6",
					type: "multiple-choice",
					prompt: "犯人が現場で意図的に行っていた行動は？",
					options: {
						a: "照明を消す",
						b: "靴音を響かせる",
						c: "窓を破壊する",
						d: "被害者を縛る",
					},
					correctAnswer: "b",
				},
				{
					id: "jp-q7",
					type: "multiple-choice",
					prompt: "事件のキーワード「悔い改め」が確認された場所は？",
					options: {
						a: "被害者の携帯",
						b: "玄関に貼られた和紙",
						c: "SNSのプロフィール",
						d: "犯行声明文の末尾",
					},
					correctAnswer: "b",
				},
				{
					id: "jp-q8",
					type: "multiple-choice",
					prompt: "監視カメラに映らない犯人の特徴は？",
					options: {
						a: "左利きである",
						b: "能面のような仮面",
						c: "足のサイズ",
						d: "声の高さ",
					},
					correctAnswer: "a",
					feedback: "監視カメラには「能面のような無表情の仮面」を被った姿が映っています。左利きかどうかは記事に記載されていません。",
				},
				{
					id: "jp-q9",
					type: "multiple-choice",
					prompt: "捜査の矛盾点として正しいのは？",
					options: {
						a: "孤児院は10年前に閉鎖",
						b: "被害者は全員50代",
						c: "折鶴と施設の関連不明",
						d: "金属ワイヤーの材質不一致",
					},
					correctAnswer: "c",
					feedback: "記事によると、孤児院「暁光園」は20年前に閉鎖され、関係者の証言からは「折鶴」との関連性は見出せていません。",
				},
				{
					id: "jp-q10",
					type: "multiple-choice",
					prompt: "犯人がSNSで使用する暗号の元ネタは？",
					options: {
						a: "2020年代の流行歌",
						b: "インターネットスラング",
						c: "絶版書籍の引用",
						d: "映画の台詞",
					},
					correctAnswer: "c",
					feedback: "警察は「文学作品『罪と炎』（1923年絶版）の引用パターン」を手掛かりに捜査を進めています。",
				},
			],
		},
	],
};

// Sample Nested Quiz Config for testing
export const sampleNestedQuizConfig: QuizConfig = {
	id: "sample-nested-quiz",
	title: "Multi-Section Exam",
	globalTimer: 30, // 30 seconds total for all quizzes
	sequentialOrder: false, // Must complete quizzes in order
	nestedQuizzes: [
		{
			id: "section-1",
			title: "Section 1: Basic Concepts",
			description: "Fundamental programming concepts and syntax",
			globalTimer: 10, // 10 seconds for testing
			pages: [
				{
					id: "s1-page-1",
					title: "Variables and Data Types",
					questions: [
						{
							id: "s1-q1",
							type: "multiple-choice",
							prompt: "Which of the following is NOT a primitive data type in JavaScript?",
							options: {
								a: "String",
								b: "Number",
								c: "Array",
								d: "Boolean",
							},
							correctAnswer: "c",
						},
						{
							id: "s1-q2",
							type: "short-answer",
							prompt: "What keyword is used to declare a constant in JavaScript?",
							correctAnswer: "const",
						},
					],
				},
			],
		},
		{
			id: "section-2",
			title: "Section 2: Intermediate Topics",
			description: "Functions, loops, and control structures",
			globalTimer: 10, // 10 seconds for testing
			pages: [
				{
					id: "s2-page-1",
					title: "Functions",
					questions: [
						{
							id: "s2-q1",
							type: "choice",
							prompt: "Which of the following are valid ways to define a function in JavaScript?",
							options: {
								func: "function myFunc() {}",
								arrow: "const myFunc = () => {}",
								method: "myFunc: function() {}",
								class: "class MyFunc {}",
							},
							correctAnswers: ["func", "arrow", "method"],
						},
						{
							id: "s2-q2",
							type: "long-answer",
							prompt: "Explain the difference between function declarations and arrow functions.",
						},
					],
				},
				{
					id: "s2-page-2",
					title: "Loops and Iteration",
					questions: [
						{
							id: "s2-q3",
							type: "ranking",
							prompt: "Rank these loop types by their typical performance (fastest to slowest):",
							items: {
								forloop: "for loop",
								foreach: "forEach",
								map: "map",
								reduce: "reduce",
							},
						},
					],
				},
			],
		},
		{
			id: "section-3",
			title: "Section 3: Advanced Concepts",
			description: "Async programming, closures, and design patterns",
			globalTimer: 10, // 10 seconds for testing
			pages: [
				{
					id: "s3-page-1",
					title: "Async Programming",
					questions: [
						{
							id: "s3-q1",
							type: "fill-in-the-blank",
							prompt: "To handle asynchronous operations in JavaScript, you can use {{blank}}, {{blank}}, or {{blank}}.",
							correctAnswers: ["callbacks", "promises", "async/await"],
						},
						{
							id: "s3-q2",
							type: "article",
							prompt: "Write a short explanation of how the JavaScript event loop works.",
						},
					],
				},
				{
					id: "s3-page-2",
					title: "Practical Application",
					questions: [
						{
							id: "s3-q3",
							type: "whiteboard",
							prompt: "Draw a diagram showing the architecture of a typical React application with state management:",
						},
						{
							id: "s3-q4",
							type: "single-selection-matrix",
							prompt: "Match each design pattern to its primary use case:",
							rows: {
								singleton: "Singleton",
								factory: "Factory",
								observer: "Observer",
								strategy: "Strategy",
							},
							columns: {
								creation: "Object Creation",
								behavior: "Behavior Variation",
								state: "State Management",
								notification: "Event Notification",
							},
						},
					],
				},
			],
		},
	],
};
