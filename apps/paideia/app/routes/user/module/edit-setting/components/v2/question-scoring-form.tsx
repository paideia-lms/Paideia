import type { Question } from "./types";
import { SimpleScoringForm } from "./simple-scoring-form";
import { ManualScoringForm } from "./manual-scoring-form";
import { WeightedScoringForm } from "./weighted-scoring-form";
import { RankingScoringForm } from "./ranking-scoring-form";
import { MatrixScoringForm } from "./matrix-scoring-form";

interface QuestionScoringFormProps {
	moduleId: number;
	question: Question;
	nestedQuizId?: string;
}

export function QuestionScoringForm({
	moduleId,
	question,
	nestedQuizId,
}: QuestionScoringFormProps) {
	const scoring = question.scoring;

	if (!scoring) {
		return null;
	}

	switch (scoring.type) {
		case "simple":
			return (
				<SimpleScoringForm
					moduleId={moduleId}
					question={question}
					scoring={scoring}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "manual":
			return (
				<ManualScoringForm
					moduleId={moduleId}
					question={question}
					scoring={scoring}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "weighted":
			return (
				<WeightedScoringForm
					moduleId={moduleId}
					question={question}
					scoring={scoring}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "ranking":
			return (
				<RankingScoringForm
					moduleId={moduleId}
					question={question}
					scoring={scoring}
					nestedQuizId={nestedQuizId}
				/>
			);
		case "matrix":
			return (
				<MatrixScoringForm
					moduleId={moduleId}
					question={question}
					scoring={scoring}
					nestedQuizId={nestedQuizId}
				/>
			);
		default:
			return null;
	}
}
