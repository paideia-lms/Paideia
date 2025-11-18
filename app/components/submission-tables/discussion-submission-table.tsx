import { Group, Paper, Text, Title } from "@mantine/core";

export function DiscussionSubmissionTable() {
	return (
		<Paper withBorder shadow="sm" p="xl" radius="md">
			<Group justify="center" align="center" style={{ minHeight: 200 }}>
				<div style={{ textAlign: "center" }}>
					<Title order={3} c="dimmed" mb="md">
						Discussion Submissions
					</Title>
					<Text c="dimmed">Discussion submissions view coming soon...</Text>
				</div>
			</Group>
		</Paper>
	);
}
