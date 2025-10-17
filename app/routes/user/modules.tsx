import { Container, Paper, Stack, Text, Title } from "@mantine/core";

export default function ModulesPage() {
	return (
		<Container size="md" py="xl">
			<title>Activity Modules | Paideia LMS</title>
			<meta name="description" content="Manage your activity modules" />
			<meta property="og:title" content="Activity Modules | Paideia LMS" />
			<meta property="og:description" content="Manage your activity modules" />

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Stack gap="md" align="center" py="xl">
					<Title order={2}>Activity Modules</Title>
					<Text size="lg" c="dimmed" ta="center">
						Select a module from the list on the left to view or edit it.
					</Text>
					<Text size="sm" c="dimmed" ta="center">
						You can also create a new module by clicking the + button.
					</Text>
				</Stack>
			</Paper>
		</Container>
	);
}
