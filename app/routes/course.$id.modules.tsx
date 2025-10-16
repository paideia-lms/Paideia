import { Container, Paper, Text, Title } from "@mantine/core";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.modules";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		throw new ForbiddenResponse("Invalid course ID");
	}

	// TODO: Add course access check and fetch modules data
	return {
		courseId,
		modules: [], // Placeholder data
	};
};

export default function CourseModulesPage() {
	return (
		<Container size="lg" py="xl">
			<title>Modules | Course | Paideia LMS</title>
			<meta name="description" content="Course modules management" />
			<meta property="og:title" content="Modules | Course | Paideia LMS" />
			<meta property="og:description" content="Course modules management" />

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="md">
					Course Modules
				</Title>
				<Text c="dimmed">
					This page will contain module management functionality.
				</Text>
			</Paper>
		</Container>
	);
}
