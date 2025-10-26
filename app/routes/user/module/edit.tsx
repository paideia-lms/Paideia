import { Container, Paper, Stack, Text } from "@mantine/core";
import { useLoaderData } from "react-router";
import { userModuleContextKey } from "server/contexts/user-module-context";
import {
	AssignmentPreview,
	DiscussionPreview,
	PagePreview,
	QuizPreview,
	WhiteboardPreview,
} from "~/components/activity-modules-preview/index";
import { NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/edit";

export const loader = async ({ context }: Route.LoaderArgs) => {
	const userModuleContext = context.get(userModuleContextKey);

	if (!userModuleContext) {
		throw new NotFoundResponse("Module context not found");
	}

	return {
		module: userModuleContext.module,
	};
};

export default function EditModulePage() {
	const { module } = useLoaderData<typeof loader>();

	const title = `${module.title} | Paideia LMS`;
	return (
		<Container size="lg" py="xl">
			<title>{title}</title>
			<meta name="description" content={`Preview of ${module.title}`} />
			<meta property="og:title" content={title} />
			<meta property="og:description" content={`Preview of ${module.title}`} />

			{module.type === "page" && module.page && (
				<PagePreview content={module.page.content || ""} />
			)}

			{module.type === "whiteboard" && module.whiteboard && (
				<WhiteboardPreview content={module.whiteboard.content || ""} />
			)}

			{module.type === "assignment" && <AssignmentPreview />}

			{module.type === "quiz" && module.quiz && (
				<>
					{module.quiz.rawQuizConfig ? (
						<QuizPreview quizConfig={module.quiz.rawQuizConfig} />
					) : (
						<Paper withBorder p="xl" radius="md">
							<Stack align="center" gap="md">
								<Text size="lg" fw={500}>
									No Quiz Configuration
								</Text>
								<Text c="dimmed">
									This quiz has not been configured yet.
								</Text>
							</Stack>
						</Paper>
					)}
				</>
			)}

			{module.type === "discussion" && <DiscussionPreview />}
		</Container>
	);
}
