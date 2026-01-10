import {
	ActionIcon,
	Badge,
	Group,
	Paper,
	Stack,
	Text,
	Tooltip,
} from "@mantine/core";
import {
	IconFlag,
	IconFlagFilled,
	IconInfoCircle,
	IconX,
} from "@tabler/icons-react";
import type {
	GradingConfig,
	Question,
	QuestionAnswer,
	QuizAnswers,
} from "server/json/raw-quiz-config/v2";
import {
	getQuestionPoints,
	getScoringDescription,
} from "server/json/raw-quiz-config/v2";
import { QuestionRenderer } from "app/components/question-renderer";
import {
	useFlagQuizQuestion,
	useUnflagQuizQuestion,
	useAnswerQuizQuestion,
	useUnanswerQuizQuestion,
} from "../route";
import type { TypedQuestionAnswer } from "server/json/raw-quiz-config/v2";
import { useRef, useEffect } from "react";

interface FlagButtonProps {
	questionId: string;
	moduleLinkId: number;
	submissionId: number;
	isDisabled: boolean;
}

function FlagButton({
	questionId,
	moduleLinkId,
	submissionId,
	isDisabled,
}: FlagButtonProps) {
	const { submit: flagQuestion, isLoading: isFlagging } = useFlagQuizQuestion();

	const handleFlag = () => {
		flagQuestion({
			params: { moduleLinkId },
			values: {
				submissionId,
				questionId,
			},
		});
	};

	return (
		<Tooltip label="Flag for review" position="top">
			<ActionIcon
				variant="light"
				color="gray"
				onClick={handleFlag}
				disabled={isDisabled || isFlagging}
				loading={isFlagging}
			>
				<IconFlag size={18} />
			</ActionIcon>
		</Tooltip>
	);
}

interface UnflagButtonProps {
	questionId: string;
	moduleLinkId: number;
	submissionId: number;
	isDisabled: boolean;
}

function UnflagButton({
	questionId,
	moduleLinkId,
	submissionId,
	isDisabled,
}: UnflagButtonProps) {
	const { submit: unflagQuestion, isLoading: isUnflagging } =
		useUnflagQuizQuestion();

	const handleUnflag = () => {
		unflagQuestion({
			params: { moduleLinkId },
			values: {
				submissionId,
				questionId,
			},
		});
	};

	return (
		<Tooltip label="Remove flag" position="top">
			<ActionIcon
				variant="filled"
				color="red"
				onClick={handleUnflag}
				disabled={isDisabled || isUnflagging}
				loading={isUnflagging}
			>
				<IconFlagFilled size={18} />
			</ActionIcon>
		</Tooltip>
	);
}

interface SavedAnswerBadgeProps {
	questionId: string;
	moduleLinkId?: number;
	submissionId?: number;
	readonly: boolean;
	isDisabled: boolean;
}

function SavedAnswerBadge({
	questionId,
	moduleLinkId,
	submissionId,
	readonly,
	isDisabled,
}: SavedAnswerBadgeProps) {
	const { submit: unanswerQuestion, isLoading: isUnanswering } =
		useUnanswerQuizQuestion();

	const handleRemove = async () => {
		if (!moduleLinkId || !submissionId || readonly || isDisabled) return;

		await unanswerQuestion({
			params: { moduleLinkId },
			values: {
				submissionId,
				questionId,
			},
		});
	};

	const showRemoveButton =
		!readonly && Boolean(moduleLinkId) && Boolean(submissionId);

	return (
		<Tooltip label="Answer saved to database" position="top">
			<Badge
				size="lg"
				variant="light"
				color="green"
				rightSection={
					showRemoveButton ? (
						<ActionIcon
							size="xs"
							color="green"
							radius="xl"
							variant="transparent"
							onClick={async (e) => {
								e.stopPropagation();
								await handleRemove();
							}}
							disabled={isDisabled || isUnanswering}
							loading={isUnanswering}
							style={{ cursor: "pointer" }}
						>
							<IconX size={12} />
						</ActionIcon>
					) : undefined
				}
			>
				Saved
			</Badge>
		</Tooltip>
	);
}

interface QuestionCardProps {
	question: Question;
	questionNumber: number;
	grading?: GradingConfig;
	initialAnswers?: QuizAnswers;
	readonly: boolean;
	isDisabled: boolean;
	isFlagged: boolean;
	answer: QuestionAnswer | undefined;
	moduleLinkId?: number;
	submissionId?: number;
}

/**
 * Helper function to convert QuestionAnswer to TypedQuestionAnswer
 */
function convertToTypedAnswer(
	question: Question,
	answer: QuestionAnswer,
): TypedQuestionAnswer {
	// Determine type based on question type and answer structure
	if (typeof answer === "string") {
		return {
			type: question.type as
				| "multiple-choice"
				| "short-answer"
				| "long-answer"
				| "article"
				| "whiteboard",
			value: answer,
		} as TypedQuestionAnswer;
	}
	if (Array.isArray(answer)) {
		return {
			type: question.type as "choice" | "ranking",
			value: answer,
		} as TypedQuestionAnswer;
	}
	if (typeof answer === "object") {
		return {
			type: question.type as
				| "fill-in-the-blank"
				| "single-selection-matrix"
				| "multiple-selection-matrix",
			value: answer,
		} as TypedQuestionAnswer;
	}
	// Fallback (should not happen)
	return { type: "short-answer", value: String(answer) };
}

export function QuestionCard({
	question,
	questionNumber,
	grading,
	initialAnswers,
	readonly,
	isDisabled,
	isFlagged,
	answer,
	moduleLinkId,
	submissionId,
}: QuestionCardProps) {
	const { submit: answerQuizQuestion, isLoading: isAnswering } =
		useAnswerQuizQuestion();

	// Debounce timer ref for answer saving
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}
		};
	}, []);

	const handleAnswerChange = (value: unknown) => {
		// Save to server if conditions are met
		if (!readonly && moduleLinkId && submissionId) {
			// Convert to TypedQuestionAnswer
			const typedAnswer = convertToTypedAnswer(
				question,
				value as QuestionAnswer,
			);

			// Clear existing timer
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}

			// Debounce the save (500ms delay)
			saveTimerRef.current = setTimeout(() => {
				answerQuizQuestion({
					params: { moduleLinkId },
					values: {
						submissionId,
						questionId: question.id,
						answerType: typedAnswer.type,
						answerValue: JSON.stringify(typedAnswer.value),
					},
				});
			}, 500);
		}
	};

	return (
		<Paper withBorder p="md" radius="sm">
			<Stack gap="md">
				{/* Question Header */}
				<Group justify="space-between" align="flex-start">
					<Group gap="sm" align="flex-start" style={{ flex: 1 }}>
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
						{isAnswering ? (
							<Badge size="lg" variant="light" color="blue">
								Saving...
							</Badge>
						) : (
							initialAnswers &&
							initialAnswers[question.id] !== undefined &&
							initialAnswers[question.id] !== null && (
								<SavedAnswerBadge
									questionId={question.id}
									moduleLinkId={moduleLinkId}
									submissionId={submissionId}
									readonly={readonly}
									isDisabled={isDisabled}
								/>
							)
						)}
						<Text fw={500} style={{ flex: 1 }}>
							{question.prompt}
						</Text>
					</Group>
					<Group gap="xs">
						{!readonly &&
							moduleLinkId &&
							submissionId &&
							(isFlagged ? (
								<UnflagButton
									questionId={question.id}
									moduleLinkId={moduleLinkId}
									submissionId={submissionId}
									isDisabled={isDisabled}
								/>
							) : (
								<FlagButton
									questionId={question.id}
									moduleLinkId={moduleLinkId}
									submissionId={submissionId}
									isDisabled={isDisabled}
								/>
							))}
					</Group>
				</Group>

				{/* Question Renderer */}
				<QuestionRenderer
					question={question}
					value={answer as unknown}
					onChange={handleAnswerChange}
					disabled={isDisabled}
				/>
			</Stack>
		</Paper>
	);
}
