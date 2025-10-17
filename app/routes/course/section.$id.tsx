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
import { Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { enrolmentContextKey } from "server/contexts/enrolment-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindSectionById } from "server/internal/course-section-management";
import {
	getStatusBadgeColor,
	getStatusLabel,
} from "~/components/course-view-utils";
import { badRequest, ForbiddenResponse, ok } from "~/utils/responses";
import type { Route } from "./+types/section.$id";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const enrolmentContext = context.get(enrolmentContextKey);
	const courseContext = context.get(courseContextKey);
	const payload = context.get(globalContextKey).payload;

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const sectionId = Number.parseInt(params.id, 10);
	if (Number.isNaN(sectionId)) {
		return badRequest({
			error: "Invalid section ID",
		});
	}

	// Get course context to ensure user has access to this course
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	// Fetch the section with depth to get related data
	const sectionResult = await tryFindSectionById({
		payload,
		sectionId,
		user: {
			...currentUser,
			avatar: currentUser.avatar?.id,
		},
	});

	if (!sectionResult.ok) {
		throw new ForbiddenResponse("Section not found or access denied");
	}

	const section = sectionResult.value;

	// Ensure the section belongs to the current course
	if (section.course !== courseContext.course.id) {
		throw new ForbiddenResponse("Section does not belong to this course");
	}

	return ok({
		section,
		course: courseContext.course,
	});
};

export default function SectionPage({ loaderData }: Route.ComponentProps) {
	if ("error" in loaderData) {
		return (
			<Container size="md" py="xl">
				<Paper withBorder shadow="md" p="xl" radius="md">
					<Title order={2} mb="md" c="red">
						Error
					</Title>
					<Text>{loaderData.error}</Text>
				</Paper>
			</Container>
		);
	}

	const { section, course } = loaderData;

	return (
		<Container size="xl" py="xl">
			<title>
				{section.title} | {course.title} | Paideia LMS
			</title>
			<meta
				name="description"
				content={`View ${section.title} section in ${course.title}`}
			/>

			<Stack gap="xl">
				<Group justify="space-between" align="flex-start">
					<div>
						<Title order={1} mb="xs">
							{section.title}
						</Title>
						<Text size="sm" c="dimmed">
							Course Section
						</Text>
					</div>
					<Button component={Link} to={`/course/${course.id}`} variant="light">
						Back to Course
					</Button>
				</Group>

				<Paper withBorder shadow="sm" p="xl">
					<Title order={3} mb="md">
						Section Overview
					</Title>
					{section.description && <Text mb="md">{section.description}</Text>}
					<Text>
						This section is part of the course structure. Use the course
						structure tree to manage modules and subsections within this
						section.
					</Text>

					<Group mt="md">
						<Button
							component={Link}
							to={`/course/${course.id}`}
							variant="light"
						>
							View Course Structure
						</Button>
					</Group>
				</Paper>
			</Stack>
		</Container>
	);
}
