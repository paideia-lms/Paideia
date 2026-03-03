import { Button } from "@mantine/core";
import { useAddQuizResource } from "app/routes/user/module/edit-setting/route";
import { IconPlus } from "@tabler/icons-react";
interface AddQuizResourceButtonProps {
	moduleId: number;
	nestedQuizId?: string;
}

export function AddQuizResourceButton({
	moduleId,
	nestedQuizId,
}: AddQuizResourceButtonProps) {
	const { submit: addQuizResource, isLoading } = useAddQuizResource();

	return (
		<Button
			loading={isLoading}
			onClick={() => {
				addQuizResource({
					params: { moduleId },
					values: {
						nestedQuizId,
					},
				});
			}}
			leftSection={<IconPlus size={16} />}
			variant="subtle"
		>
			Add Resource
		</Button>
	);
}
