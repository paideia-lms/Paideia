import { Button } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useMarkNestedQuizAsComplete } from "../../route";
import { useNestedQuizContext } from "./nested-quiz-context";

interface MarkNestedQuizCompleteButtonProps {
	submissionId: number;
	nestedQuizId: string;
	disabled?: boolean;
}

export function MarkNestedQuizCompleteButton({
	submissionId,
	nestedQuizId,
	disabled = false,
}: MarkNestedQuizCompleteButtonProps) {
	const { moduleLinkId } = useNestedQuizContext();
	const { submit: markNestedQuizAsComplete, isLoading } =
		useMarkNestedQuizAsComplete();
	return (
		<Button
			leftSection={<IconCheck size={16} />}
			onClick={async () => {
				await markNestedQuizAsComplete({
					values: {
						submissionId,
						nestedQuizId,
					},
					params: {
						moduleLinkId,
					},
				});
			}}
			loading={isLoading}
			disabled={disabled}
		>
			Mark as Complete
		</Button>
	);
}
