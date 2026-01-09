import { Button } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import {
	useRemoveNestedQuiz,
} from "app/routes/user/module/edit-setting/route";

interface RemoveNestedQuizButtonProps {
	moduleId: number;
	nestedQuizId: string;
	disabled?: boolean;
}

export function RemoveNestedQuizButton({
	moduleId,
	nestedQuizId,
	disabled,
}: RemoveNestedQuizButtonProps) {
	const { submit: removeNestedQuiz, isLoading } = useRemoveNestedQuiz();

	return (
		<Button
			color="red"
			variant="subtle"
			leftSection={<IconTrash size={16} />}
			onClick={() => {
				removeNestedQuiz({
					params: { moduleId },
					values: { nestedQuizId },
				});
			}}
			disabled={disabled}
			loading={isLoading}
		>
			Remove
		</Button>
	);
}
