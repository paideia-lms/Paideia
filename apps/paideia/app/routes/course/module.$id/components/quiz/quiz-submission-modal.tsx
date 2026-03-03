import {
	Button,
	Group,
	Modal,
	ScrollArea,
	Stack,
	Text,
	Tooltip,
} from "@mantine/core";
import { forwardRef, useImperativeHandle, useState } from "react";
import type { QuizAnswers } from "@paideia/paideia-backend";
import {
	useMarkQuizAttemptAsComplete,
	useMarkNestedQuizAsComplete,
} from "../../route";
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

/**
 * this modal handle the submission of a quiz or a nested quiz. when it is a regular quiz, it use markQuizAttemptAsComplete. if it is a nested quiz, it use markNestedQuizAsComplete.
 * when it is in a nested quiz, it should mark the nested quiz as complete.
 */
export const QuizSubmissionModal = forwardRef<
	QuizSubmissionModalHandle,
	QuizSubmissionModalProps
>(({ submissionId, answers }, ref) => {
	const [opened, setOpened] = useState(false);
	const {
		submit: markQuizAttemptAsComplete,
		isLoading: isMarkingQuizAttemptAsComplete,
	} = useMarkQuizAttemptAsComplete();
	const {
		submit: markNestedQuizAsComplete,
		isLoading: isMarkingNestedQuizAsComplete,
	} = useMarkNestedQuizAsComplete();
	const loaderData = useLoaderData<Route.ComponentProps["loaderData"]>();
	const moduleLinkId = loaderData.params.moduleLinkId;
	const { questionMap, nestedQuizId, submission } =
		useRegularQuizAttemptContext();

	// Check if we're in a nested quiz
	const isInNestedQuiz = nestedQuizId !== null;

	// Check if this is a preview attempt - previews cannot be submitted
	const isPreview = submission.isPreview === true;

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
					<CodeHighlight
						withCopyButton
						language="json"
						code={JSON.stringify(readableAnswers, null, 2)}
					/>
				</ScrollArea>

				<Group justify="flex-end" gap="sm">
					<Button variant="default" onClick={() => setOpened(false)}>
						Cancel
					</Button>
					<Tooltip
						label="Preview attempts cannot be submitted"
						disabled={!isPreview}
					>
						<Button
							onClick={async () => {
								if (isInNestedQuiz && nestedQuizId) {
									await markNestedQuizAsComplete({
										values: {
											submissionId,
											nestedQuizId,
										},
										params: {
											moduleLinkId,
										},
									});
									setOpened(false);
								} else {
									await markQuizAttemptAsComplete({
										values: {
											submissionId: submissionId,
										},
										params: {
											moduleLinkId,
										},
									});
									setOpened(false);
								}
							}}
							disabled={isPreview}
							loading={
								isInNestedQuiz
									? isMarkingNestedQuizAsComplete
									: isMarkingQuizAttemptAsComplete
							}
						>
							{isInNestedQuiz ? "Mark as Complete" : "Confirm Submission"}
						</Button>
					</Tooltip>
				</Group>
			</Stack>
		</Modal>
	);
});

QuizSubmissionModal.displayName = "QuizSubmissionModal";
