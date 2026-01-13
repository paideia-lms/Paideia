import { Button } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useStartNestedQuiz } from "../../route";
import type { Route } from "../../route";
import { createRouteComponent } from "~/utils/create-route-component";
import type { Jsonify } from "type-fest";
interface StartNestedQuizButtonProps {
	submissionId: number;
	nestedQuizId: string;
	disabled?: boolean;
	moduleLinkId: number;
}

export const StartNestedQuizButton = createRouteComponent<
	Route.ComponentProps,
	Jsonify<StartNestedQuizButtonProps>
>(({ submissionId, nestedQuizId, disabled = false }, { loaderData }) => {
	const {
		params: { moduleLinkId },
	} = loaderData;
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
});
