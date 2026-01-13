import { Button } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useMarkNestedQuizAsComplete, type Route } from "../../route";
import { createRouteComponent } from "~/utils/create-route-component";
import type { Jsonify } from "type-fest";

interface MarkNestedQuizCompleteButtonProps {
	submissionId: number;
	nestedQuizId: string;
	disabled?: boolean;
}

export const MarkNestedQuizCompleteButton = createRouteComponent<
	Route.ComponentProps,
	Jsonify<MarkNestedQuizCompleteButtonProps>
>(({ submissionId, nestedQuizId, disabled = false }, { loaderData }) => {
	const {
		params: { moduleLinkId },
	} = loaderData;
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
});
