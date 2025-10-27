import {
	Badge,
	Button,
	Card,
	Container,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import {
	IconFolder,
	IconPencil,
	IconPlus,
	IconTrash,
	IconWriting,
} from "@tabler/icons-react";
import { useState } from "react";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { globalContextKey } from "server/contexts/global-context";
import { userAccessContextKey } from "server/contexts/user-access-context";
import { userContextKey } from "server/contexts/user-context";
import type {
	CourseStructureItem,
	CourseStructureSection,
} from "server/internal/course-section-management";
import { tryFindSectionById } from "server/internal/course-section-management";
import { useDeleteCourseSection } from "~/routes/api/section-delete";
import { useCreateModuleLink } from "~/routes/course.$id.modules";
import { getModuleColor, getModuleIcon } from "~/utils/module-helper";
import { BadRequestResponse, ForbiddenResponse, ok } from "~/utils/responses";
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
	const userAccessContext = context.get(userAccessContextKey);
	const payload = context.get(globalContextKey).payload;

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	const sectionId = Number.parseInt(params.id, 10);
	if (Number.isNaN(sectionId)) {
		throw new BadRequestResponse("Invalid section ID");
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

	// Get available modules from user access context
	const availableModules =
		userAccessContext?.activityModules.map((module) => ({
			id: module.id,
			title: module.title,
			description: module.description,
			type: module.type,
			status: module.status,
		})) ?? [];

	return ok({
		section,
		course: courseContext.course,
		subsections,
		modules,
		availableModules,
	});
};

export default function SectionPage({ loaderData }: Route.ComponentProps) {
	const { deleteSection, isLoading: isDeleting } = useDeleteCourseSection();
	const { createModuleLink, state: createState } = useCreateModuleLink();
	const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

	const { section, course, subsections, modules, availableModules } =
		loaderData;

	// Check if user can edit
	const canEdit = true; // User must have access if they can view the section

	const handleDelete = () => {
		modals.openConfirmModal({
			title: "Delete Section",
			children: (
				<Text size="sm">
					Are you sure you want to delete this section? This action cannot be
					undone. The section must not have any subsections or activity modules.
				</Text>
			),
			labels: { confirm: "Delete", cancel: "Cancel" },
			confirmProps: { color: "red" },
			onConfirm: () => {
				deleteSection({ sectionId: section.id, courseId: course.id });
			},
		});
	};

	const handleLinkModule = () => {
		if (selectedModuleId) {
			createModuleLink(
				Number.parseInt(selectedModuleId, 10),
				course.id,
				section.id,
			);
			setSelectedModuleId(null);
		}
	};

	const title = `${section.title} | ${course.title} | Paideia LMS`;

	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content={`View ${section.title} section in ${course.title}`}
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
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
					<Group>
						{canEdit && (
							<>
								<Button
									component={Link}
									to={href("/course/section/:id/edit", {
										id: section.id.toString(),
									})}
									leftSection={<IconPencil size={16} />}
									variant="light"
								>
									Edit Section
								</Button>
								<Button
									component={Link}
									to={href("/course/:id/section/new", {
										id: course.id.toString(),
									})}
									leftSection={<IconPlus size={16} />}
									variant="light"
								>
									Add Subsection
								</Button>
								<Button
									color="red"
									onClick={handleDelete}
									leftSection={<IconTrash size={16} />}
									variant="light"
									loading={isDeleting}
								>
									Delete Section
								</Button>
							</>
						)}
						<Button
							component={Link}
							to={`/course/${course.id}`}
							variant="light"
						>
							Back to Course
						</Button>
					</Group>
				</Group>

				<Paper withBorder shadow="sm" p="xl">
					<Title order={3} mb="md">
						Section Overview
					</Title>
					{section.description && <Text mb="md">{section.description}</Text>}
				</Paper>

				{/* Link Activity Module */}
				{canEdit && availableModules.length > 0 && (
					<Paper withBorder shadow="sm" p="md">
						<Stack gap="md">
							<Title order={3}>Link Activity Module</Title>
							<Group align="flex-end">
								<Select
									placeholder="Select a module to link"
									data={availableModules.map((module) => ({
										value: module.id.toString(),
										label: `${module.title} (${module.type})`,
									}))}
									value={selectedModuleId}
									onChange={setSelectedModuleId}
									style={{ flex: 1 }}
									searchable
								/>
								<Button
									onClick={handleLinkModule}
									disabled={!selectedModuleId}
									loading={createState !== "idle"}
									leftSection={<IconPlus size={16} />}
								>
									Link Module
								</Button>
							</Group>
						</Stack>
					</Paper>
				)}

				{/* Subsections */}
				<Paper shadow="sm" p="md" withBorder>
					<Stack gap="md">
						<Group>
							<IconFolder size={24} />
							<Title order={2}>Subsections</Title>
							<Badge variant="light">{subsections.length}</Badge>
						</Group>

						{subsections.length > 0 ? (
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
						) : (
							<Stack gap="md" align="center" py="xl">
								<Text c="dimmed" ta="center">
									No subsections yet. Create one to organize your content.
								</Text>
								{canEdit && (
									<Button
										component={Link}
										to={href("/course/:id/section/new", {
											id: course.id.toString(),
										})}
										leftSection={<IconPlus size={16} />}
									>
										Create Subsection
									</Button>
								)}
							</Stack>
						)}
					</Stack>
				</Paper>

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
									<Card
										key={item.id}
										shadow="xs"
										padding="md"
										withBorder
										component={Link}
										to={href("/course/module/:id", { id: item.id.toString() })}
									>
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
