import { Button } from "@mantine/core";
import { useAddNestedQuiz } from "app/routes/user/module/edit-setting/route";
import { IconPlus } from "@tabler/icons-react";
interface AddNestedQuizButtonProps {
	moduleId: number;
}

export function AddNestedQuizButton({ moduleId }: AddNestedQuizButtonProps) {
	const { submit: addNestedQuiz, isLoading } = useAddNestedQuiz();

	return (
		<Button
			loading={isLoading}
			onClick={() => {
				addNestedQuiz({
					params: { moduleId },
					values: {},
				});
			}}
			leftSection={<IconPlus size={16} />}
			variant="subtle"
		>
			Add Quiz
		</Button>
	);
}
