import { Button } from "@mantine/core";
import {
	useAddPage,
} from "app/routes/user/module/edit-setting/route";
import { IconPlus } from "@tabler/icons-react";

interface AddPageButtonProps {
	moduleId: number;
	nestedQuizId?: string;
}

export function AddPageButton({
	moduleId,
	nestedQuizId,
}: AddPageButtonProps) {
	const { submit: addPage, isLoading } = useAddPage();

	return (

		<Button loading={isLoading} onClick={() => {
			addPage({
				params: { moduleId },
				values: {
					nestedQuizId,
				},
			});
		}}
			leftSection={<IconPlus size={16} />}
			variant="subtle"
		>
			Add Page
		</Button>
	);
}
