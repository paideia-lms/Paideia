import {
	Badge,
	Button,
	Container,
	Group,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { Link } from "react-router";
import { courseContextKey } from "server/contexts/course-context";
import { courseModuleContextKey } from "server/contexts/course-module-context";
import { userContextKey } from "server/contexts/user-context";
import { AssignmentPreview } from "~/components/activity-modules-preview/assignment-preview";
import { DiscussionPreview } from "~/components/activity-modules-preview/discussion-preview";
import { PagePreview } from "~/components/activity-modules-preview/page-preview";
import { QuizPreview } from "~/components/activity-modules-preview/quiz-preview";
import { WhiteboardPreview } from "~/components/activity-modules-preview/whiteboard-preview";
import {
	getStatusBadgeColor,
	getStatusLabel,
} from "~/components/course-view-utils";
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

	return {
		module: courseModuleContext.module,
		course: courseContext.course,
		previousModuleLinkId: courseModuleContext.previousModuleLinkId,
		nextModuleLinkId: courseModuleContext.nextModuleLinkId,
	};
};

export default function ModulePage({ loaderData }: Route.ComponentProps) {
	const { module, course } = loaderData;

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
				return <AssignmentPreview />;
			case "quiz": {
				const quizConfig = module.quiz?.rawQuizConfig || null;
				if (!quizConfig) {
					return <Text c="red">No quiz configuration available</Text>;
				}
				return <QuizPreview quizConfig={quizConfig} />;
			}
			case "discussion":
				return <DiscussionPreview />;
			case "whiteboard": {
				const whiteboardContent = module.whiteboard?.content || null;
				return <WhiteboardPreview content={whiteboardContent || "{}"} />;
			}
			default:
				return <Text c="red">Unknown module type: {module.type}</Text>;
		}
	};

	const title = `${module.title} | ${course.title} | Paideia LMS`;

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
				<Group justify="space-between" align="flex-start">
					<div>
						<Title order={1} mb="xs">
							{module.title}
						</Title>
						<Group gap="sm">
							<Badge
								color={getStatusBadgeColor(module.status)}
								variant="light"
							>
								{getStatusLabel(module.status)}
							</Badge>
							<Text size="sm" c="dimmed">
								{module.type.charAt(0).toUpperCase() + module.type.slice(1)}{" "}
								Module
							</Text>
						</Group>
					</div>
					<Button component={Link} to={`/course/${course.id}`} variant="light">
						Back to Course
					</Button>
				</Group>

				{renderModuleContent()}
			</Stack>
		</Container>
	);
}
