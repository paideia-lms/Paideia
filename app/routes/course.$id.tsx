import {
	Badge,
	Button,
	Container,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { CourseInfo } from "~/components/course-info";
import {
	getStatusBadgeColor,
	getStatusLabel,
} from "~/components/course-view-utils";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);

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

	// Get instructors and TAs from course context enrollments
	const instructors = courseContext.course.enrollments
		.filter(
			(enrollment) => enrollment.role === "teacher" || enrollment.role === "ta",
		)
		.filter((enrollment) => enrollment.status === "active")
		.map((enrollment) => ({
			id: enrollment.userId,
			name: enrollment.name,
			email: enrollment.email,
			role: enrollment.role as "teacher" | "ta",
			avatar: enrollment.avatar,
		}));

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		instructors,
		currentUser: currentUser,
	};
};

export default function CourseViewPage({ loaderData }: Route.ComponentProps) {
	const { course, instructors, currentUser } = loaderData;

	const canEdit =
		currentUser.role === "admin" ||
		currentUser.role === "content-manager" ||
		course.enrollments.some(
			(enrollment) => enrollment.userId === currentUser.id,
		);

	return (
		<Container size="lg" py="xl">
			<title>{`${course.title} | Paideia LMS`}</title>
			<meta name="description" content={course.description} />
			<meta property="og:title" content={`${course.title} | Paideia LMS`} />
			<meta property="og:description" content={course.description} />

			<Stack gap="lg">
				<Group justify="space-between">
					<div>
						<Group gap="sm" mb="xs">
							<Title order={1}>{course.title}</Title>
							<Badge color={getStatusBadgeColor(course.status)} size="lg">
								{getStatusLabel(course.status)}
							</Badge>
						</Group>
						<Text c="dimmed" size="sm">
							{course.slug}
						</Text>
					</div>
					{canEdit && (
						<Button
							component={Link}
							to={`/course/${course.id}/settings`}
							leftSection={<IconEdit size={16} />}
						>
							Edit Course
						</Button>
					)}
				</Group>

				<CourseInfo
					course={{
						id: course.id,
						title: course.title,
						slug: course.slug,
						description: course.description,
						status: course.status,
						instructors,
						createdAt: course.createdAt,
						updatedAt: course.updatedAt,
						enrollmentCount: course.enrollments.length,
					}}
				/>
			</Stack>
		</Container>
	);
}
