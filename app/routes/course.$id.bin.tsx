import { Container, Paper, Text, Title } from "@mantine/core";
import { href } from "react-router";
import { typeCreateLoader } from "app/utils/loader-utils";
import { courseContextKey } from "server/contexts/course-context";
import { userContextKey } from "server/contexts/user-context";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.bin";

export function getRouteUrl(courseId: number) {
	return href("/course/:courseId/bin", {
		courseId: courseId.toString(),
	});
}

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context, params }) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	// Check if user can see course bin (permission is already calculated in course context)
	if (!courseContext.permissions.canSeeBin.allowed) {
		throw new ForbiddenResponse(
			"You don't have permission to view course recycle bin",
		);
	}


	// TODO: Fetch deleted items data
	return {
		deletedItems: [], // Placeholder data
		params
	};
});

export default function CourseBinPage({ loaderData }: Route.ComponentProps) {
	return (
		<Container size="lg" py="xl">
			<title>Recycle Bin | Course | Paideia LMS</title>
			<meta name="description" content="Course recycle bin" />
			<meta property="og:title" content="Recycle Bin | Course | Paideia LMS" />
			<meta property="og:description" content="Course recycle bin" />

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="md">
					Recycle Bin
				</Title>
				<Text c="dimmed">
					This page will contain deleted items that can be restored.
				</Text>
			</Paper>
		</Container>
	);
}
