import { Container, Paper, Text, Title } from "@mantine/core";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { canSeeCourseBackup } from "server/utils/permissions";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.backup";

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

	// Check if user can see course backup
	const canSeeBackup = canSeeCourseBackup(
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

	if (!canSeeBackup) {
		throw new ForbiddenResponse(
			"You don't have permission to view course backups",
		);
	}

	// TODO: Fetch backup data
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
