import { Paper, Stack, Text, Title } from "@mantine/core";

export function DiscussionPreview() {
	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="md">
				<Title order={3}>Discussion Preview</Title>
				<Text c="dimmed">
					Discussion preview is not yet implemented. This module allows students
					to participate in threaded discussions.
				</Text>
			</Stack>
		</Paper>
	);
}
