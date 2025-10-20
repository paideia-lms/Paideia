import { Container, Paper, Text, Title } from "@mantine/core";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { canSeeCourseGrades } from "server/utils/permissions";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id.grades";

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

	// Check if user can see course grades
	const canSeeGrades = canSeeCourseGrades(
		{
			id: currentUser.id,
			role: currentUser.role ?? "student",
		},
		enrolmentContext?.enrolment
			? {
					id: enrolmentContext.enrolment.id,
					userId: enrolmentContext.enrolment.userId,
					role: enrolmentContext.enrolment.role,
				}
			: undefined,
	);

	if (!canSeeGrades) {
		throw new ForbiddenResponse(
			"You don't have permission to view course grades",
		);
	}

	// TODO: Fetch grades data
	return {
		courseId,
		grades: [], // Placeholder data
	};
};

export default function CourseGradesPage() {
	return (
		<Container size="lg" py="xl">
			<title>Grades | Course | Paideia LMS</title>
			<meta name="description" content="Course grades management" />
			<meta property="og:title" content="Grades | Course | Paideia LMS" />
			<meta property="og:description" content="Course grades management" />

			<Paper withBorder shadow="md" p="xl" radius="md">
				<Title order={2} mb="md">
					Course Grades
				</Title>
				<Text c="dimmed">
					This page will contain grade management functionality.
				</Text>
			</Paper>
		</Container>
	);
}
