import { Container, Paper, Text, Title } from "@mantine/core";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.backup";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		throw new ForbiddenResponse("Invalid course ID");
	}

	// TODO: Add course access check and fetch backup data
	return {
		courseId,
		backups: [], // Placeholder data
	};
};

export default function CourseBackupPage() {
	return (
		<Container size="lg" py="xl">
			<title>Course Reuse | Course | Paideia LMS</title>
			<meta name="description" content="Course reuse and backup management" />
			<meta property="og:title" content="Course Reuse | Course | Paideia LMS" />
			<meta
				property="og:description"
				content="Course reuse and backup management"
			/>

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="md">
					Course Reuse
				</Title>
				<Text c="dimmed">
					This page will contain course backup and reuse functionality.
				</Text>
			</Paper>
		</Container>
	);
}
