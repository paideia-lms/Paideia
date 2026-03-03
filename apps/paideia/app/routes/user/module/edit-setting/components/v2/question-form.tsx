import {
	ActionIcon,
	Collapse,
	Group,
	Modal,
	Paper,
	Stack,
	Text,
} from "@mantine/core";
import {
	IconChevronDown,
	IconChevronUp,
	IconEye,
	IconGripVertical,
} from "@tabler/icons-react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { useState } from "react";
import { QuestionRenderer } from "app/components/question-renderer";
import type { Question, QuizConfig } from "./types";
import { QuestionOptionsForm } from "./question-options-form";
import { QuestionScoringForm } from "./question-scoring-form";
import { RemoveQuestionButton } from "./remove-question-button";
import { UpdateQuestionForm } from "./update-question-form";

interface QuestionFormProps {
	moduleId: number;
	question: Question;
	questionIndex: number;
	quizConfig: QuizConfig;
	nestedQuizId?: string;
	sortableAttributes?: DraggableAttributes;
	sortableListeners?: SyntheticListenerMap;
	isDragging?: boolean;
}

const QuestionTypeLabels: Record<Question["type"], string> = {
	"multiple-choice": "Multiple Choice",
	"short-answer": "Short Answer",
	"long-answer": "Long Answer",
	article: "Article",
	"fill-in-the-blank": "Fill in the Blank",
	choice: "Choice (Multiple Selection)",
	ranking: "Ranking",
	"single-selection-matrix": "Single Selection Matrix",
	"multiple-selection-matrix": "Multiple Selection Matrix",
	whiteboard: "Whiteboard",
};

export function QuestionForm({
	moduleId,
	question,
	questionIndex,
	quizConfig,
	nestedQuizId,
	sortableAttributes,
	sortableListeners,
	isDragging,
}: QuestionFormProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);

	return (
		<>
			<Paper withBorder p="md" radius="md">
				<Stack gap="md">
					<Group justify="space-between" wrap="nowrap">
						<Group gap="xs" style={{ flex: 1 }}>
							{sortableAttributes && sortableListeners && (
								<ActionIcon
									{...sortableAttributes}
									{...sortableListeners}
									variant="subtle"
									style={{
										cursor: isDragging ? "grabbing" : "grab",
									}}
								>
									<IconGripVertical size={16} />
								</ActionIcon>
							)}
							<Text fw={500} size="sm">
								Question {questionIndex + 1}:{" "}
								{QuestionTypeLabels[question.type]}
							</Text>
							{!isExpanded && question.prompt && (
								<Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
									{question.prompt}
								</Text>
							)}
						</Group>
						<Group gap="xs">
							<ActionIcon
								variant="subtle"
								onClick={() => setIsPreviewOpen(true)}
								title="Preview question"
							>
								<IconEye size={16} />
							</ActionIcon>
							<ActionIcon
								variant="subtle"
								onClick={() => setIsExpanded(!isExpanded)}
							>
								{isExpanded ? (
									<IconChevronUp size={16} />
								) : (
									<IconChevronDown size={16} />
								)}
							</ActionIcon>
							<RemoveQuestionButton
								moduleId={moduleId}
								questionId={question.id}
								nestedQuizId={nestedQuizId}
							/>
						</Group>
					</Group>

					<Collapse in={isExpanded}>
						<Stack gap="md">
							<UpdateQuestionForm
								moduleId={moduleId}
								question={question}
								nestedQuizId={nestedQuizId}
							/>

							<QuestionOptionsForm
								moduleId={moduleId}
								question={question}
								nestedQuizId={nestedQuizId}
							/>

							{quizConfig.grading?.enabled && (
								<QuestionScoringForm
									moduleId={moduleId}
									question={question}
									nestedQuizId={nestedQuizId}
								/>
							)}
						</Stack>
					</Collapse>
				</Stack>
			</Paper>

			<Modal
				opened={isPreviewOpen}
				onClose={() => {
					setIsPreviewOpen(false);
				}}
				title={`Preivew Question ${questionIndex + 1}: ${QuestionTypeLabels[question.type]}`}
				size="lg"
			>
				<Stack gap="md">
					{question.prompt && <Text fw={500}>{question.prompt}</Text>}
					<QuestionRenderer
						question={question}
						showFeedback={false}
						disabled={false}
					/>
				</Stack>
			</Modal>
		</>
	);
}
