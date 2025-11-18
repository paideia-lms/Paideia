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
import { IconFolder, IconPlus, IconWriting } from "@tabler/icons-react";
import { useState } from "react";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseSectionContextKey } from "server/contexts/course-section-context";
import { userAccessContextKey } from "server/contexts/user-access-context";
import { userContextKey } from "server/contexts/user-context";
import type {
	CourseStructureItem,
	CourseStructureSection,
} from "server/internal/course-section-management";
import { useCreateModuleLink } from "~/routes/course.$id.modules";
import { getModuleColor, getModuleIcon } from "~/utils/module-helper";
import { ForbiddenResponse, ok } from "~/utils/responses";
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

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseSectionContext = context.get(courseSectionContextKey);
	const userAccessContext = context.get(userAccessContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	// Get course context to ensure user has access to this course
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	// Get section context from layout
	if (!courseSectionContext) {
		throw new ForbiddenResponse("Section not found or access denied");
	}

	const section = courseSectionContext.section;

	// Find the section in the course structure to get its content
	const structureSection = findSectionInStructure(
		courseContext.courseStructure.sections,
		section.id,
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
	const { createModuleLink, state: createState } = useCreateModuleLink();
	const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

	const { section, course, subsections, modules, availableModules } =
		loaderData;

	// Check if user can edit
	const canEdit = true; // User must have access if they can view the section

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
				{/* <Paper withBorder shadow="sm" p="xl">
					<Title order={3} mb="md">
						Section Overview
					</Title>
					{section.description && <Text mb="md">{section.description}</Text>}
				</Paper> */}

				{/* Subsections */}
				<Paper shadow="sm" p="md" withBorder>
					<Stack gap="md">
						<Group justify="space-between">
							<Group>
								<IconFolder size={24} />
								<Title order={2}>Subsections</Title>
								<Badge variant="light">{subsections.length}</Badge>
							</Group>
							{canEdit && (
								<Button
									variant="subtle"
									component={Link}
									to={`${href("/course/:courseId/section/new", {
										courseId: course.id.toString(),
									})}?parentSection=${section.id}`}
									leftSection={<IconPlus size={16} />}
									size="sm"
								>
									Create Subsection
								</Button>
							)}
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
										to={href("/course/section/:sectionId", {
											sectionId: subsection.id.toString(),
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
							<Text c="dimmed" ta="center" py="md">
								No subsections yet. Create one to organize your content.
							</Text>
						)}
					</Stack>
				</Paper>

				{/* Activity Modules */}
				<Paper shadow="sm" p="md" withBorder>
					<Stack gap="md">
						<Group>
							<IconWriting size={24} />
							<Title order={2}>Activity Modules</Title>
							<Badge variant="light">{modules.length}</Badge>
						</Group>

						{/* Link Activity Module */}
						{canEdit && (
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
									disabled={availableModules.length === 0}
								/>
								<Button
									onClick={handleLinkModule}
									disabled={!selectedModuleId || availableModules.length === 0}
									loading={createState !== "idle"}
									leftSection={<IconPlus size={16} />}
								>
									Link Module
								</Button>
							</Group>
						)}

						{modules.length > 0 ? (
							<Stack gap="sm">
								{modules.map((item) => (
									<Card
										key={item.id}
										shadow="xs"
										padding="md"
										withBorder
										component={Link}
										to={href("/course/module/:moduleLinkId", {
											moduleLinkId: String(item.id),
										})}
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
						) : (
							<Text c="dimmed" ta="center" py="md">
								No activity modules yet.
								{canEdit
									? availableModules.length > 0
										? " Link a module to get started."
										: " Create activity modules first to link them here."
									: ""}
							</Text>
						)}
					</Stack>
				</Paper>
			</Stack>
		</Container>
	);
}
