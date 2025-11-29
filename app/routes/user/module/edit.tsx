import { Container, Paper, Stack, Text } from "@mantine/core";
import { useQueryState } from "nuqs";
import { useLoaderData } from "react-router";
import { userModuleContextKey } from "server/contexts/user-module-context";
import { NotFoundResponse } from "~/utils/responses";
import type { Route } from "./+types/edit";

// Mock data for preview mode in edit.tsx
// const mockThreads: DiscussionThread[] = [
// 	{
// 		id: "1",
// 		title: "What are the main differences between TCP and UDP?",
// 		content:
// 			"<p>I'm studying network protocols and I'm confused about when to use TCP vs UDP. Can someone explain the key differences and use cases?</p>",
// 		author: "Alice Johnson",
// 		authorAvatar: "AJ",
// 		publishedAt: "2025-10-27T10:00:00Z",
// 		upvotes: 15,
// 		replyCount: 8,
// 		isPinned: true,
// 		isUpvoted: false,
// 	},
// 	{
// 		id: "2",
// 		title: "How does the three-way handshake work?",
// 		content:
// 			"<p>I understand TCP uses a three-way handshake, but I'm not clear on the exact steps. Could someone break it down?</p>",
// 		author: "Bob Smith",
// 		authorAvatar: "BS",
// 		publishedAt: "2025-10-26T14:30:00Z",
// 		upvotes: 12,
// 		replyCount: 5,
// 		isPinned: false,
// 		isUpvoted: true,
// 	},
// 	{
// 		id: "3",
// 		title: "Best practices for socket programming",
// 		content:
// 			"<p>What are some best practices when implementing socket programming in Python? Any common pitfalls to avoid?</p>",
// 		author: "Charlie Brown",
// 		authorAvatar: "CB",
// 		publishedAt: "2025-10-25T09:15:00Z",
// 		upvotes: 8,
// 		replyCount: 12,
// 		isPinned: false,
// 		isUpvoted: false,
// 	},
// ];

// const mockReplies: DiscussionReply[] = [
// 	{
// 		id: "r1",
// 		content:
// 			"<p>TCP is connection-oriented and guarantees delivery, while UDP is connectionless and faster but doesn't guarantee delivery. TCP is like a phone call, UDP is like sending a postcard.</p>",
// 		author: "Professor Lee",
// 		authorAvatar: "PL",
// 		publishedAt: "2025-10-27T10:30:00Z",
// 		upvotes: 20,
// 		parentId: null,
// 		isUpvoted: true,
// 	},
// 	{
// 		id: "r2",
// 		content:
// 			"<p>Great analogy! To add to that, TCP maintains order of packets while UDP doesn't. That's why video streaming can use UDP - a few lost frames won't matter much.</p>",
// 		author: "Sarah Connor",
// 		authorAvatar: "SC",
// 		publishedAt: "2025-10-27T11:00:00Z",
// 		upvotes: 8,
// 		parentId: "r1",
// 		isUpvoted: false,
// 	},
// 	{
// 		id: "r3",
// 		content:
// 			"<p>TCP also has error checking and flow control. Use TCP for file transfers, web pages, emails. Use UDP for gaming, live streaming, VoIP where speed matters more than reliability.</p>",
// 		author: "John Doe",
// 		authorAvatar: "JD",
// 		publishedAt: "2025-10-27T12:15:00Z",
// 		upvotes: 5,
// 		parentId: null,
// 		isUpvoted: false,
// 	},
// ];

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
	const [threadId] = useQueryState("threadId", { shallow: false });

	// Find the selected thread from mock data when threadId is set
	// const selectedThread =
	// 	threadId && module.type === "discussion"
	// 		? mockThreads.find((t) => t.id === threadId) || null
	// 		: null;

	const title = `${module.title} | Paideia LMS`;
	return (
		<Container size="lg" py="xl">
			<title>{title}</title>
			<meta name="description" content={`Preview of ${module.title}`} />
			<meta property="og:title" content={title} />
			<meta property="og:description" content={`Preview of ${module.title}`} />

			{/* {module.type === "page" && module.page && (
				<PagePreview content={module.page.content || ""} />
			)}

			{module.type === "whiteboard" && module.whiteboard && (
				<WhiteboardPreview content={module.whiteboard.content || ""} />
			)}

			{module.type === "assignment" && (
				<AssignmentPreview assignment={module.assignment || null} />
			)}

			{module.type === "quiz" &&
				module.quiz &&
				(module.quiz.rawQuizConfig ? (
					<QuizPreview quizConfig={module.quiz.rawQuizConfig} />
				) : (
					<Paper withBorder p="xl" radius="md">
						<Stack align="center" gap="md">
							<Text size="lg" fw={500}>
								No Quiz Configuration
							</Text>
							<Text c="dimmed">This quiz has not been configured yet.</Text>
						</Stack>
					</Paper>
				))}

			{module.type === "discussion" && (
				<StatefulDiscussionPreview
					discussion={module.discussion || null}
					threads={mockThreads}
					thread={selectedThread}
					replies={mockReplies}
					courseId={null}
				/>
			)}

			{module.type === "file" && (
				<FileModulePreview fileModule={module.file} />
			)} */}
			{/* preview not implemented yet */}
			<Paper withBorder p="xl" radius="md">
				<Stack align="center" gap="md">
					<Text size="lg" fw={500}>
						Preview not implemented yet
					</Text>
				</Stack>
			</Paper>
		</Container>
	);
}
