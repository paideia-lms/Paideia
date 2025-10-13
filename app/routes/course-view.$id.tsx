import {
	Badge,
	Box,
	Button,
	Card,
	Container,
	Group,
	Paper,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { Link } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { tryFindCourseById } from "server/internal/course-management";
import type { Course } from "server/payload-types";
import { badRequest, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/course-view.$id";

export const loader = async ({
	request,
	context,
	params,
}: Route.LoaderArgs) => {
	const payload = context.get(globalContextKey).payload;
	const { user: currentUser } = await payload.auth({
		headers: request.headers,
		canSetHeaders: true,
	});

	if (!currentUser) {
		throw new ForbiddenResponse("Unauthorized");
	}

	if (currentUser.role !== "admin" && currentUser.role !== "content-manager") {
		throw new ForbiddenResponse(
			"Only admins and content managers can view courses",
		);
	}

	const courseId = Number.parseInt(params.id, 10);
	if (Number.isNaN(courseId)) {
		return badRequest({
			error: "Invalid course ID",
		});
	}

	const courseResult = await tryFindCourseById(payload, courseId);

	if (!courseResult.ok) {
		return badRequest({
			error: courseResult.error.message,
		});
	}

	const course = courseResult.value;
	const createdByName = course.createdBy
		? `${course.createdBy.firstName || ""} ${course.createdBy.lastName || ""}`.trim() ||
			course.createdBy.email
		: "Unknown";

	return {
		course: {
			id: course.id,
			title: course.title,
			slug: course.slug,
			description: course.description,
			status: course.status,
			createdBy: createdByName,
			createdById: course.createdBy.id,
			createdAt: course.createdAt,
			updatedAt: course.updatedAt,
			structure: course.structure,
			enrollmentCount: course.enrollments?.length || 0,
		},
		currentUser: {
			id: currentUser.id,
			role: currentUser.role,
		},
	};
};

export default function CourseViewPage({ loaderData }: Route.ComponentProps) {
	if ("error" in loaderData) {
		return (
			<Container size="lg" py="xl">
				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Text c="red">{loaderData.error}</Text>
				</Paper>
			</Container>
		);
	}

	const { course, currentUser } = loaderData;

	const getStatusBadgeColor = (status: Course["status"]) => {
		switch (status) {
			case "published":
				return "green";
			case "draft":
				return "yellow";
			case "archived":
				return "gray";
			default:
				return "gray";
		}
	};

	const getStatusLabel = (status: Course["status"]) => {
		switch (status) {
			case "published":
				return "Published";
			case "draft":
				return "Draft";
			case "archived":
				return "Archived";
			default:
				return status;
		}
	};

	const canEdit =
		currentUser.role === "admin" || currentUser.id === course.createdById;

	return (
		<Container size="lg" py="xl">
			<title>{course.title} | Paideia LMS</title>
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
							to={`/course/edit/${course.id}`}
							leftSection={<IconEdit size={16} />}
						>
							Edit Course
						</Button>
					)}
				</Group>

				<Paper withBorder shadow="sm" p="xl" radius="md">
					<Stack gap="xl">
						<div>
							<Text fw={600} size="sm" c="dimmed" mb="xs">
								Description
							</Text>
							<Text>{course.description}</Text>
						</div>

						<Group grow>
							<Card withBorder>
								<Text fw={600} size="sm" c="dimmed" mb="xs">
									Created By
								</Text>
								<Text>{course.createdBy}</Text>
							</Card>

							<Card withBorder>
								<Text fw={600} size="sm" c="dimmed" mb="xs">
									Enrollments
								</Text>
								<Text>{course.enrollmentCount}</Text>
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

						<div>
							<Text fw={600} size="sm" c="dimmed" mb="xs">
								Course Structure
							</Text>
							<Box
								p="md"
								style={{
									backgroundColor: "var(--mantine-color-gray-0)",
									borderRadius: "var(--mantine-radius-sm)",
								}}
							>
								<pre style={{ margin: 0, overflow: "auto" }}>
									{JSON.stringify(course.structure, null, 2)}
								</pre>
							</Box>
						</div>
					</Stack>
				</Paper>
			</Stack>
		</Container>
	);
}
