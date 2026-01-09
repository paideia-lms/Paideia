import { Button } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import {
	useRemoveQuizResource,
} from "app/routes/user/module/edit-setting/route";

interface RemoveQuizResourceButtonProps {
	moduleId: number;
	resourceId: string;
	nestedQuizId?: string;
}

export function RemoveQuizResourceButton({
	moduleId,
	resourceId,
	nestedQuizId,
}: RemoveQuizResourceButtonProps) {
	const { submit: removeQuizResource, isLoading } =
		useRemoveQuizResource();

	return (
		<Button
			color="red"
			variant="subtle"
			leftSection={<IconTrash size={16} />}
			onClick={() => {
				removeQuizResource({
					params: { moduleId },
					values: {
						resourceId,
						nestedQuizId,
					},
				});
			}}
			loading={isLoading}
		>
			Remove
		</Button>
	);
}
