import { Button } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useStartNestedQuiz } from "../../route";
import { useNestedQuizContext } from "./nested-quiz-context";

interface StartNestedQuizButtonProps {
	submissionId: number;
	nestedQuizId: string;
	disabled?: boolean;
}

export function StartNestedQuizButton({
	submissionId,
	nestedQuizId,
	disabled = false,
}: StartNestedQuizButtonProps) {
	const { moduleLinkId } = useNestedQuizContext();
	const { submit: startNestedQuiz, isLoading } = useStartNestedQuiz();

	const handleStart = async () => {
		await startNestedQuiz({
			values: {
				submissionId,
				nestedQuizId,
			},
			params: {
				moduleLinkId,
			},
		});
	};

	return (
		<Button
			leftSection={<IconPlayerPlay size={16} />}
			onClick={handleStart}
			loading={isLoading}
			disabled={disabled || isLoading}
		>
			Start Quiz
		</Button>
	);
}
