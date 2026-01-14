import {
	Button,
	Code,
	Group,
	Modal,
	ScrollArea,
	Stack,
	Text,
} from "@mantine/core";
import { forwardRef, useImperativeHandle, useState } from "react";
import type { QuizAnswers } from "server/json/raw-quiz-config/v2";
import { useMarkQuizAttemptAsComplete } from "../../route";
import { useLoaderData } from "react-router";
import type { Route } from "../../route";
import { useRegularQuizAttemptContext } from "./quiz-attempt-component";
import { CodeHighlight } from "@mantine/code-highlight";

export interface QuizSubmissionModalHandle {
	open: () => void;
}

type QuizSubmissionModalProps = {
	submissionId: number;
	answers?: QuizAnswers;
};

export const QuizSubmissionModal = forwardRef<
	QuizSubmissionModalHandle,
	QuizSubmissionModalProps
>(({ submissionId, answers }, ref) => {
	const [opened, setOpened] = useState(false);
	const {
		submit: markQuizAttemptAsComplete,
		isLoading: isMarkingQuizAttemptAsComplete,
	} = useMarkQuizAttemptAsComplete();
	const loaderData = useLoaderData<Route.ComponentProps["loaderData"]>();
	const moduleLinkId = loaderData.params.moduleLinkId;
	const { questionMap } = useRegularQuizAttemptContext();

	useImperativeHandle(ref, () => ({
		open: () => {
			setOpened(true);
		},
	}));

	// Transform answers to use question numbers and prompts as keys
	const readableAnswers: Record<string, unknown> = {};
	if (answers) {
		questionMap.forEach((item) => {
			const answer = answers[item.questionId];
			if (answer !== undefined) {
				const key = `Q${item.questionNumber}: ${item.prompt}`;
				readableAnswers[key] = answer;
			}
		});
	}

	return (
		<Modal
			opened={opened}
			onClose={() => setOpened(false)}
			title="Review Your Answers"
			size="lg"
		>
			<Stack gap="md">
				<Text>Please review your answers before submitting the quiz.</Text>

				<Text size="sm" fw={500}>
					Your Answers ({Object.keys(readableAnswers).length}):
				</Text>

				<ScrollArea h={400}>
					<CodeHighlight withCopyButton language="json" code={JSON.stringify(readableAnswers, null, 2)} />
				</ScrollArea>

				<Group justify="flex-end" gap="sm">
					<Button variant="default" onClick={() => setOpened(false)}>
						Cancel
					</Button>
					<Button
						onClick={async () => {
							await markQuizAttemptAsComplete({
								values: {
									submissionId: submissionId,
								},
								params: {
									moduleLinkId,
								},
							});
							setOpened(false);
						}}
						loading={isMarkingQuizAttemptAsComplete}
					>
						Confirm Submission
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
});

QuizSubmissionModal.displayName = "QuizSubmissionModal";
