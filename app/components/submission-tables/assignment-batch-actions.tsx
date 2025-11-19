import {
	ActionIcon,
	Badge,
	Button,
	Group,
	Menu,
	Paper,
	Text,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconDots, IconMail, IconTrash } from "@tabler/icons-react";

export function AssignmentBatchActions({
	selectedCount,
	selectedEnrollments,
	onClearSelection,
}: {
	selectedCount: number;
	selectedEnrollments: Array<{ email?: string | null }>;
	onClearSelection: () => void;
}) {
	const clipboard = useClipboard({ timeout: 2000 });

	const handleBatchEmailCopy = () => {
		const emailAddresses = selectedEnrollments
			.map((e) => e.email)
			.filter((email): email is string => email !== null && email !== undefined)
			.join(", ");

		if (emailAddresses) {
			clipboard.copy(emailAddresses);
			notifications.show({
				title: "Copied",
				message: `Copied ${selectedEnrollments.length} email address${selectedEnrollments.length !== 1 ? "es" : ""} to clipboard`,
				color: "green",
			});
		}
	};

	if (selectedCount === 0) {
		return null;
	}

	return (
		<Paper withBorder p="md">
			<Group justify="space-between">
				<Group gap="md">
					<Badge size="lg" variant="filled">
						{selectedCount} selected
					</Badge>
					<Text size="sm" c="dimmed">
						Batch actions available
					</Text>
				</Group>
				<Group gap="xs">
					<Button
						variant="light"
						color={clipboard.copied ? "teal" : "blue"}
						leftSection={<IconMail size={16} />}
						onClick={handleBatchEmailCopy}
						size="sm"
					>
						{clipboard.copied ? "Copied!" : "Copy Emails"}
					</Button>
					<Menu position="bottom-end">
						<Menu.Target>
							<ActionIcon variant="light" size="lg">
								<IconDots size={18} />
							</ActionIcon>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Item
								color="red"
								leftSection={<IconTrash size={16} />}
								onClick={onClearSelection}
							>
								Clear Selection
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Group>
			</Group>
		</Paper>
	);
}
