import type { Question } from "./types";
import { MultipleChoiceOptionsForm } from "./multiple-choice-options-form";
import { ChoiceOptionsForm } from "./choice-options-form";
import { ShortAnswerOptionsForm } from "./short-answer-options-form";
import { LongAnswerOptionsForm } from "./long-answer-options-form";
import { FillInTheBlankOptionsForm } from "./fill-in-the-blank-options-form";
import { RankingOptionsForm } from "./ranking-options-form";
import { SingleSelectionMatrixOptionsForm } from "./single-selection-matrix-options-form";
import { MultipleSelectionMatrixOptionsForm } from "./multiple-selection-matrix-options-form";

interface QuestionOptionsFormProps {
	moduleId: number;
	question: Question;
	nestedQuizId?: string;
}

export function QuestionOptionsForm({
	moduleId,
	question,
	nestedQuizId,
}: QuestionOptionsFormProps) {
	switch (question.type) {
		case "multiple-choice":
			return (
				<MultipleChoiceOptionsForm
					moduleId={moduleId}
					question={question}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "choice":
			return (
				<ChoiceOptionsForm
					moduleId={moduleId}
					question={question}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "short-answer":
			return (
				<ShortAnswerOptionsForm
					moduleId={moduleId}
					question={question}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "long-answer":
			return (
				<LongAnswerOptionsForm
					moduleId={moduleId}
					question={question}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "fill-in-the-blank":
			return (
				<FillInTheBlankOptionsForm
					moduleId={moduleId}
					question={question}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "ranking":
			return (
				<RankingOptionsForm
					moduleId={moduleId}
					question={question}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "single-selection-matrix":
			return (
				<SingleSelectionMatrixOptionsForm
					moduleId={moduleId}
					question={question}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "multiple-selection-matrix":
			return (
				<MultipleSelectionMatrixOptionsForm
					moduleId={moduleId}
					question={question}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "article":
		case "whiteboard":
			// Article and Whiteboard don't need options
			return null;
		default:
			return null;
	}
}
