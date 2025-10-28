import {
	Button,
	Container,
	Group,
	Stack,
	Text,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { href, Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { userContextKey } from "server/contexts/user-context";
import { flattenCourseStructureWithModuleInfo } from "server/utils/course-structure-utils";
import { AssignmentPreview } from "~/components/activity-modules-preview/assignment-preview";
import { DiscussionPreview } from "~/components/activity-modules-preview/discussion-preview";
import { PagePreview } from "~/components/activity-modules-preview/page-preview";
import { QuizPreview } from "~/components/activity-modules-preview/quiz-preview";
import { WhiteboardPreview } from "~/components/activity-modules-preview/whiteboard-preview";
import { BadRequestResponse, ForbiddenResponse } from "~/utils/responses";
import type { Route } from "./+types/module.$id";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const userSession = context.get(userContextKey);
	const courseContext = context.get(courseContextKey);
	const courseModuleContext = context.get(courseModuleContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const moduleLinkId = Number.parseInt(params.id, 10);
	if (Number.isNaN(moduleLinkId)) {
		throw new BadRequestResponse("Invalid module link ID");
	}

	// Get course context to ensure user has access to this course
	if (!courseContext) {
		throw new ForbiddenResponse("Course not found or access denied");
	}

	// Get course module context
	if (!courseModuleContext) {
		throw new ForbiddenResponse("Module not found or access denied");
	}

	// Get flattened list of modules from course structure
	const flattenedModules = flattenCourseStructureWithModuleInfo(
		courseContext.courseStructure,
	);

	// Find current module index
	const currentIndex = flattenedModules.findIndex(
		(m) => m.moduleLinkId === moduleLinkId,
	);

	// Get previous and next modules
	const previousModule =
		currentIndex > 0
			? {
				id: flattenedModules[currentIndex - 1].moduleLinkId,
				title: flattenedModules[currentIndex - 1].title,
				type: flattenedModules[currentIndex - 1].type,
			}
			: null;

	const nextModule =
		currentIndex < flattenedModules.length - 1 && currentIndex !== -1
			? {
				id: flattenedModules[currentIndex + 1].moduleLinkId,
				title: flattenedModules[currentIndex + 1].title,
				type: flattenedModules[currentIndex + 1].type,
			}
			: null;

	return {
		module: courseModuleContext.module,
		moduleSettings: courseModuleContext.moduleLinkSettings,
		course: courseContext.course,
		previousModule,
		nextModule,
	};
};

export default function ModulePage({ loaderData }: Route.ComponentProps) {
	const { module, moduleSettings, course, previousModule, nextModule } = loaderData;

	// Handle different module types
	const renderModuleContent = () => {
		switch (module.type) {
			case "page": {
				const pageContent = module.page?.content || null;
				return (
					<PagePreview content={pageContent || "<p>No content available</p>"} />
				);
			}
			case "assignment":
				return <AssignmentPreview assignment={module.assignment || null} />;
			case "quiz": {
				const quizConfig = module.quiz?.rawQuizConfig || null;
				if (!quizConfig) {
					return <Text c="red">No quiz configuration available</Text>;
				}
				return <QuizPreview quizConfig={quizConfig} />;
			}
			case "discussion":
				return <DiscussionPreview discussion={module.discussion || null} />;
			case "whiteboard": {
				const whiteboardContent = module.whiteboard?.content || null;
				return <WhiteboardPreview content={whiteboardContent || "{}"} />;
			}
			default:
				return <Text c="red">Unknown module type: {module.type}</Text>;
		}
	};

	const title = `${moduleSettings?.settings.name ?? module.title} | ${course.title} | Paideia LMS`;

	return (
		<Container size="xl" py="xl">
			<title>{title}</title>
			<meta
				name="description"
				content={`View ${module.title} in ${course.title}`}
			/>
			<meta property="og:title" content={title} />
			<meta
				property="og:description"
				content={`View ${module.title} in ${course.title}`}
			/>

			<Stack gap="xl">
				{renderModuleContent()}

				{/* Navigation buttons */}
				<Group justify="space-between">
					{previousModule ? (
						<Button
							component={Link}
							to={href("/course/module/:id", {
								id: previousModule.id.toString(),
							})}
							leftSection={<IconChevronLeft size={16} />}
							variant="light"
						>
							Previous: {previousModule.title}
						</Button>
					) : (
						<div />
					)}
					{nextModule ? (
						<Button
							component={Link}
							to={href("/course/module/:id", {
								id: nextModule.id.toString(),
							})}
							rightSection={<IconChevronRight size={16} />}
							variant="light"
						>
							Next: {nextModule.title}
						</Button>
					) : (
						<div />
					)}
				</Group>
			</Stack>
		</Container>
	);
}
