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
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import { tryFindCourseActivityModuleLinkById } from "server/internal/course-activity-module-link-management";
import { AssignmentPreview } from "~/components/activity-modules-preview/assignment-preview";
import { DiscussionPreview } from "~/components/activity-modules-preview/discussion-preview";
import { PagePreview } from "~/components/activity-modules-preview/page-preview";
import { QuizPreview, sampleQuizConfig } from "~/components/activity-modules-preview/quiz-preview";
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
	const payload = context.get(globalContextKey).payload;

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

	// Fetch the module link with depth to get the activity module
	const moduleLinkResult = await tryFindCourseActivityModuleLinkById(
		payload,
		moduleLinkId,
	);

	if (!moduleLinkResult.ok) {
		throw new ForbiddenResponse("Module not found or access denied");
	}

	const moduleLink = moduleLinkResult.value;

	// Ensure the module link belongs to the current course
	if (
		typeof moduleLink.course === "object" &&
		moduleLink.course.id !== courseContext.course.id
	) {
		throw new ForbiddenResponse("Module does not belong to this course");
	}

	// Fetch the full activity module with all relationships
	const activityModuleId =
		typeof moduleLink.activityModule === "number"
			? moduleLink.activityModule
			: moduleLink.activityModule.id;

	const activityModule = await payload.findByID({
		collection: "activity-modules",
		id: activityModuleId,
		depth: 2, // Ensure we get the page/whiteboard/etc content
	});

	return {
		moduleLink: {
			...moduleLink,
			activityModule,
		},
		course: courseContext.course,
	};
};

export default function ModulePage({ loaderData }: Route.ComponentProps) {
	const { moduleLink, course } = loaderData;
	const activityModule = moduleLink.activityModule;

	// Handle different module types
	const renderModuleContent = () => {
		switch (activityModule.type) {
			case "page": {
				const pageContent =
					typeof activityModule.page === "object" && activityModule.page
						? activityModule.page.content
						: null;
				return (
					<PagePreview content={pageContent || "<p>No content available</p>"} />
				);
			}
			case "assignment":
				return <AssignmentPreview />;
			case "quiz":
				return <QuizPreview quizConfig={sampleQuizConfig} />;
			case "discussion":
				return <DiscussionPreview />;
			case "whiteboard": {
				const whiteboardContent =
					typeof activityModule.whiteboard === "object" &&
						activityModule.whiteboard
						? activityModule.whiteboard.content
						: null;
				return <WhiteboardPreview content={whiteboardContent || "{}"} />;
			}
			default:
				return <Text c="red">Unknown module type: {activityModule.type}</Text>;
		}
	};

	const title = `${activityModule.title} | ${course.title} | Paideia LMS`;

	return (
		<Container size="xl" py="xl">
			<title>
				{title}
			</title>
			<meta
				name="description"
				content={`View ${activityModule.title} in ${course.title}`}
			/>
			<meta property="og:title" content={title} />
			<meta property="og:description" content={`View ${activityModule.title} in ${course.title}`} />

			<Stack gap="xl">
				<Group justify="space-between" align="flex-start">
					<div>
						<Title order={1} mb="xs">
							{activityModule.title}
						</Title>
						<Group gap="sm">
							<Badge
								color={getStatusBadgeColor(activityModule.status)}
								variant="light"
							>
								{getStatusLabel(activityModule.status)}
							</Badge>
							<Text size="sm" c="dimmed">
								{activityModule.type.charAt(0).toUpperCase() +
									activityModule.type.slice(1)}{" "}
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
