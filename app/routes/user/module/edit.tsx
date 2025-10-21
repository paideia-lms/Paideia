import { Container, Paper, Stack, Text, Title } from "@mantine/core";
import { useLoaderData } from "react-router";
import { userModuleContextKey } from "server/contexts/user-module-context";
import {
	AssignmentPreview,
	DiscussionPreview,
	PagePreview,
	QuizPreview,
	sampleNestedQuizConfig,
	WhiteboardPreview,
} from "~/components/activity-module-forms";
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

			{module.type === "quiz" && <QuizPreview quizConfig={sampleNestedQuizConfig} />}

			{module.type === "discussion" && <DiscussionPreview />}
		</Container>
	);
}
