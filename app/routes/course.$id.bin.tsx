import { Container, Paper, Text, Title } from "@mantine/core";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { canSeeCourseBin } from "server/utils/permissions";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.bin";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		throw new BadRequestResponse("Invalid course ID");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	// Check if user can see course bin
	const canSeeBin = canSeeCourseBin(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrolmentContext?.enrolment
			? {
					role: enrolmentContext.enrolment.role,
				}
			: undefined,
	);

	if (!canSeeBin) {
		throw new ForbiddenResponse(
			"You don't have permission to view course recycle bin",
		);
	}

	// TODO: Fetch deleted items data
	return {
		courseId,
		deletedItems: [], // Placeholder data
	};
};

export default function CourseBinPage() {
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
