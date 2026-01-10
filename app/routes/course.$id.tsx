import {
	Avatar,
	Badge,
	Button,
	Card,
	Container,
	Group,
	Image,
	Paper,
	Stack,
	Text,
	Title,
	Tooltip,
	Typography,
} from "@mantine/core";
import { IconEdit, IconFolder, IconPlus } from "@tabler/icons-react";
import { href, Link } from "react-router";
import { typeCreateLoader } from "app/utils/loader-utils";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { userContextKey } from "server/contexts/user-context";
import {
	getStatusBadgeColor,
	getStatusLabel,
} from "app/utils/course-view-utils";
import { ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course.$id";
import { getRouteUrl } from "app/utils/search-params-utils";
import { parseAsBoolean } from "nuqs";

export const loaderSearchParams = {
	reload: parseAsBoolean.withDefault(false),
};

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({
	searchParams: loaderSearchParams,
})(async ({ context, searchParams }) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course view data using the course context
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	return {
		...courseContext,
		enrolment: enrolmentContext?.enrolment,
		canEdit: courseContext.permissions.canEdit.allowed,
		searchParams,
	};
});

type CourseInfoProps = {
	course: Route.ComponentProps["loaderData"]["course"];
};
function CourseInfo({ course }: CourseInfoProps) {
	const instructors = course.enrollments.filter(
		(enrollment) =>
			(enrollment.role === "teacher" || enrollment.role === "ta") &&
			enrollment.status === "active",
	);
	return (
		<Paper withBorder shadow="sm" p="xl" radius="md">
			<Stack gap="xl">
				{course.thumbnail && (
					<Image
						src={getRouteUrl("/api/media/file/:mediaId", {
							params: {
								mediaId: course.thumbnail.id.toString(),
							},
							searchParams: {},
						})}
						alt={course.title}
						radius="md"
						h={200}
						fit="cover"
					/>
				)}

				<div>
					<Text fw={600} size="sm" c="dimmed" mb="xs">
						Description
					</Text>
					<Typography
						classNames={{
							root: "tiptap",
						}}
						// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML content from rich text editor
						dangerouslySetInnerHTML={{ __html: course.description }}
					/>
				</div>

				<Group grow>
					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Instructors
						</Text>
						{course.enrollments.length > 0 ? (
							<Avatar.Group>
								{instructors.map((instructor) => (
									<Tooltip
										key={instructor.id}
										label={
											<div>
												<Text size="sm" fw={500}>
													{instructor.user.firstName} {instructor.user.lastName}
												</Text>
												<Text size="xs" c="dimmed">
													{instructor.role === "teacher"
														? "Teacher"
														: "Teaching Assistant"}
												</Text>
											</div>
										}
										withArrow
									>
										<Avatar
											component={Link}
											to={href("/user/profile/:id?", {
												id: String(instructor.id),
											})}
											src={
												instructor.user.avatar
													? getRouteUrl("/api/user/:id/avatar", {
															params: {
																id: instructor.user.id.toString(),
															},
														})
													: undefined
											}
											name={
												instructor.user.firstName +
												" " +
												instructor.user.lastName
											}
											style={{ cursor: "pointer" }}
										/>
									</Tooltip>
								))}
							</Avatar.Group>
						) : (
							<Text size="sm" c="dimmed">
								No instructors assigned
							</Text>
						)}
					</Card>

					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Enrollments
						</Text>
						<Text>{course.enrollments.length}</Text>
					</Card>

					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Created
						</Text>
						<Text>{new Date(course.createdAt).toLocaleDateString()}</Text>
					</Card>

					<Card withBorder>
						<Text fw={600} size="sm" c="dimmed" mb="xs">
							Updated
						</Text>
						<Text>{new Date(course.updatedAt).toLocaleDateString()}</Text>
					</Card>
				</Group>
			</Stack>
		</Paper>
	);
}

export default function CourseViewPage({ loaderData }: Route.ComponentProps) {
	const { course, courseStructure, canEdit } = loaderData;

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

				<CourseInfo course={course} />

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
