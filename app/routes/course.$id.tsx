import {
	Badge,
	Button,
	Card,
	Container,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { IconEdit, IconFolder, IconPlus } from "@tabler/icons-react";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import { canEditCourse } from "server/utils/permissions";
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
	const { courseId } = params;

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

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
			id: enrollment.user.id,
			name: enrollment.user.firstName + " " + enrollment.user.lastName,
			email: enrollment.user.email,
			role: enrollment.role as "teacher" | "ta",
			avatar: enrollment.user.avatar,
		}));

	// Check if user can edit the course
	const canEdit = canEditCourse(
		currentUser,
		courseContext.course.enrollments.map((e) => ({
			userId: e.user.id,
			role: e.role,
		})),
	).allowed;

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		instructors,
		currentUser: currentUser,
		canEdit,
	};
};

export default function CourseViewPage({ loaderData }: Route.ComponentProps) {
	const { course, instructors, courseStructure, canEdit } = loaderData;

	const directSections = courseStructure.sections;

	return (
		<Container size="xl" py="sm">
			<title>{`${course.title} | Paideia LMS`}</title>
			<meta name="description" content={course.description} />
			<meta property="og:title" content={`${course.title} | Paideia LMS`} />
			<meta property="og:description" content={course.description} />

			<Stack gap="lg">
				<Group justify="space-between">
					<div>
						<Group gap="sm" mb="xs">
							<Title order={1}>{course.title}</Title>
							{canEdit && (
								<Badge color={getStatusBadgeColor(course.status)} size="lg">
									{getStatusLabel(course.status)}
								</Badge>
							)}
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
						thumbnail: course.thumbnail,
						instructors,
						createdAt: course.createdAt,
						updatedAt: course.updatedAt,
						enrollmentCount: course.enrollments.length,
					}}
				/>

				<Paper shadow="sm" p="md" withBorder>
					<Stack gap="md">
						<Group justify="space-between">
							<Group>
								<IconFolder size={24} />
								<Title order={2}>Course Sections</Title>
							</Group>
							{canEdit && (
								<Button
									component={Link}
									to={href("/course/:courseId/section/new", {
										courseId: String(course.id),
									})}
									leftSection={<IconPlus size={16} />}
									size="sm"
								>
									Add Section
								</Button>
							)}
						</Group>

						{directSections.length === 0 ? (
							<Text c="dimmed">No sections available</Text>
						) : (
							<Stack gap="sm">
								{directSections.map((section) => (
									<Card
										key={section.id}
										shadow="xs"
										padding="md"
										withBorder
										component={Link}
										to={href("/course/section/:sectionId", {
											sectionId: String(section.id),
										})}
									>
										<Stack gap="xs">
											<Group justify="space-between">
												<Title order={3}>{section.title}</Title>
												<Badge variant="light">
													{section.content.length} item
													{section.content.length !== 1 ? "s" : ""}
												</Badge>
											</Group>
											<Text size="sm" c="dimmed">
												{section.description}
											</Text>
										</Stack>
									</Card>
								))}
							</Stack>
						)}
					</Stack>
				</Paper>
			</Stack>
		</Container>
	);
}
