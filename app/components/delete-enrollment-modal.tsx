import { Button, Group, Modal, Stack, Text } from "@mantine/core";

interface DeleteEnrollmentModalProps {
	opened: boolean;
	onClose: () => void;
	fetcherState: string;
	onConfirmDelete: () => void;
}

export function DeleteEnrollmentModal({
	opened,
	onClose,
	fetcherState,
	onConfirmDelete,
}: DeleteEnrollmentModalProps) {
	return (
		<Modal opened={opened} onClose={onClose} title="Delete Enrollment" centered>
			<Stack gap="md">
				<Text>
					Are you sure you want to delete this enrollment? This action cannot be
					undone.
				</Text>
				<Group justify="flex-end" gap="sm">
					<Button variant="default" onClick={onClose}>
						Cancel
					</Button>
					<Button
						color="red"
						onClick={onConfirmDelete}
						loading={fetcherState === "submitting"}
					>
						Delete
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
