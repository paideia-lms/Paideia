import { Button } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useRemovePage } from "app/routes/user/module/edit-setting/route";

interface RemovePageButtonProps {
	moduleId: number;
	pageId: string;
	nestedQuizId?: string;
	disabled?: boolean;
}

export function RemovePageButton({
	moduleId,
	pageId,
	nestedQuizId,
	disabled,
}: RemovePageButtonProps) {
	const { submit: removePage, isLoading } = useRemovePage();

	return (
		<Button
			color="red"
			variant="subtle"
			leftSection={<IconTrash size={16} />}
			onClick={() => {
				removePage({
					params: { moduleId },
					values: {
						pageId,
						nestedQuizId,
					},
				});
			}}
			loading={isLoading}
			disabled={disabled}
		>
			Remove
		</Button>
	);
}
