import {
	Button,
	Code,
	Group,
	Modal,
	ScrollArea,
	Stack,
	Text,
} from "@mantine/core";
import { useImperativeHandle, useState } from "react";
import type { QuizAnswers } from "server/json/raw-quiz-config/v2";
import { useMarkQuizAttemptAsComplete, type Route } from "../../route";
import { createRouteComponent } from "~/utils/create-route-component";

export interface QuizSubmissionModalHandle {
	open: () => void;
}

type QuizSubmissionModalProps = {
	submissionId: number;
	answers?: QuizAnswers;
};

export const QuizSubmissionModal = createRouteComponent<
	Route.ComponentProps,
	QuizSubmissionModalProps,
	QuizSubmissionModalHandle
>(({ submissionId, answers }, { loaderData }, ref) => {
	const [opened, setOpened] = useState(false);
	const {
		submit: markQuizAttemptAsComplete,
		isLoading: isMarkingQuizAttemptAsComplete,
	} = useMarkQuizAttemptAsComplete();
	const {
		params: { moduleLinkId },
	} = loaderData;

	useImperativeHandle(ref, () => ({
		open: () => {
			setOpened(true);
		},
	}));

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
					Your Answers:
				</Text>

				<ScrollArea h={400}>
					<Code block>{JSON.stringify(answers, null, 2)}</Code>
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
