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
import {
	IconBook,
	IconClipboardList,
	IconFolder,
	IconMessage,
	IconPencil,
	IconPresentation,
	IconWriting,
} from "@tabler/icons-react";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import type {
	CourseStructureItem,
	CourseStructureSection,
} from "server/internal/course-section-management";
import { tryFindSectionById } from "server/internal/course-section-management";
import { badRequest, ForbiddenResponse, ok } from "~/utils/responses";
import type { Route } from "./+types/section.$id";

// Helper function to recursively find a section in the course structure
function findSectionInStructure(
	sections: CourseStructureSection[],
	sectionId: number,
): CourseStructureSection | null {
	for (const section of sections) {
		if (section.id === sectionId) {
			return section;
		}
		// Search in nested sections
		const subsections = section.content.filter(
			(item): item is CourseStructureSection => item.type === "section",
		);
		const found = findSectionInStructure(subsections, sectionId);
		if (found) {
			return found;
		}
	}
	return null;
}

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
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

	// Find the section in the course structure to get its content
	const structureSection = findSectionInStructure(
		courseContext.courseStructure.sections,
		sectionId,
	);

	// Extract subsections and modules from the structure section
	const subsections: CourseStructureSection[] = structureSection
		? structureSection.content.filter(
			(item): item is CourseStructureSection => item.type === "section",
		)
		: [];

	const modules: CourseStructureItem[] = structureSection
		? structureSection.content.filter(
			(item): item is CourseStructureItem => item.type === "activity-module",
		)
		: [];

	return ok({
		section,
		course: courseContext.course,
		subsections,
		modules,
	});
};

// Helper function to get icon for module type
function getModuleIcon(
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion",
) {
	switch (type) {
		case "page":
			return <IconBook size={20} />;
		case "whiteboard":
			return <IconPresentation size={20} />;
		case "assignment":
			return <IconPencil size={20} />;
		case "quiz":
			return <IconClipboardList size={20} />;
		case "discussion":
			return <IconMessage size={20} />;
		default:
			return <IconWriting size={20} />;
	}
}

// Helper function to get badge color for module type
function getModuleColor(
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion",
) {
	switch (type) {
		case "page":
			return "blue";
		case "whiteboard":
			return "purple";
		case "assignment":
			return "orange";
		case "quiz":
			return "green";
		case "discussion":
			return "cyan";
		default:
			return "gray";
	}
}

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

	const { section, course, subsections, modules } = loaderData;

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
				</Paper>

				{/* Subsections */}
				{subsections.length > 0 && (
					<Paper shadow="sm" p="md" withBorder>
						<Stack gap="md">
							<Group>
								<IconFolder size={24} />
								<Title order={2}>Subsections</Title>
								<Badge variant="light">{subsections.length}</Badge>
							</Group>

							<Stack gap="sm">
								{subsections.map((subsection) => (
									<Card
										key={subsection.id}
										shadow="xs"
										padding="md"
										withBorder
										component={Link}
										to={href("/course/section/:id", {
											id: subsection.id.toString(),
										})}
										style={{ cursor: "pointer" }}
									>
										<Stack gap="xs">
											<Group justify="space-between">
												<Group>
													<IconFolder size={20} />
													<Title order={4}>{subsection.title}</Title>
												</Group>
												<Badge variant="light">
													{subsection.content.length} item
													{subsection.content.length !== 1 ? "s" : ""}
												</Badge>
											</Group>
											<Text size="sm" c="dimmed">
												{subsection.description}
											</Text>
										</Stack>
									</Card>
								))}
							</Stack>
						</Stack>
					</Paper>
				)}

				{/* Activity Modules */}
				{modules.length > 0 && (
					<Paper shadow="sm" p="md" withBorder>
						<Stack gap="md">
							<Group>
								<IconWriting size={24} />
								<Title order={2}>Activity Modules</Title>
								<Badge variant="light">{modules.length}</Badge>
							</Group>

							<Stack gap="sm">
								{modules.map((item) => (
									<Card key={item.id} shadow="xs" padding="md" withBorder component={Link} to={href("/course/module/:id", { id: item.id.toString() })}>
										<Group justify="space-between">
											<Group>
												{getModuleIcon(item.module.type)}
												<Title order={4}>{item.module.title}</Title>
											</Group>
											<Badge
												color={getModuleColor(item.module.type)}
												variant="light"
											>
												{item.module.type}
											</Badge>
										</Group>
									</Card>
								))}
							</Stack>
						</Stack>
					</Paper>
				)}

				{/* Empty state */}
				{subsections.length === 0 && modules.length === 0 && (
					<Paper withBorder shadow="sm" p="xl">
						<Text c="dimmed" ta="center">
							This section is empty. Add subsections or activity modules to get
							started.
						</Text>
					</Paper>
				)}
			</Stack>
		</Container>
	);
}
