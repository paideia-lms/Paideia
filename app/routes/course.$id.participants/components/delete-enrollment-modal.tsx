import { ActionIcon } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useDeleteEnrollment } from "../route";

interface DeleteEnrollmentButtonProps {
	enrollmentId: number;
	courseId: number;
}

export function DeleteEnrollmentButton({
	enrollmentId,
	courseId,
}: DeleteEnrollmentButtonProps) {
	const { submit: deleteEnrollment, isLoading: isDeleting } =
		useDeleteEnrollment();

	const handleDelete = async () => {
		const confirmed = window.confirm(
			"Are you sure you want to delete this enrollment? This action cannot be undone.",
		);
		if (!confirmed) return;

		await deleteEnrollment({
			values: {
				enrollmentId: enrollmentId,
			},
			params: { courseId: courseId },
		});
	};

	return (
		<ActionIcon
			variant="light"
			color="red"
			size="md"
			aria-label="Delete enrollment"
			onClick={handleDelete}
			loading={isDeleting}
		>
			<IconTrash size={16} />
		</ActionIcon>
	);
}
