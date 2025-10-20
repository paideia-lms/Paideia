import { Paper, Stack, Text, Title } from "@mantine/core";

export function QuizPreview() {
	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="md">
				<Title order={3}>Quiz Preview</Title>
				<Text c="dimmed">
					Quiz preview is not yet implemented. This module allows students to
					answer questions and receive grades.
				</Text>
			</Stack>
		</Paper>
	);
}
