import { Paper, Stack, Text, Title } from "@mantine/core";
import type {
	DiscussionData,
	DiscussionReply,
	DiscussionThread,
} from "app/routes/course/module.$id/components/discussion/discussion-preview";
import { DiscussionThreadDetailView } from "./discussion-thread-detail-view";
import { DiscussionThreadListView } from "./discussion-thread-list-view";
import type { inferParserType } from "nuqs";
import type { loaderSearchParams } from "../../route";

interface DiscussionThreadViewProps {
	discussion: DiscussionData | null;
	threads: DiscussionThread[];
	thread: DiscussionThread | null;
	replies: DiscussionReply[];
	moduleLinkId: number;
	courseId: number;
	view: inferParserType<typeof loaderSearchParams>["view"];
	replyTo: inferParserType<typeof loaderSearchParams>["replyTo"];
	sortBy: inferParserType<typeof loaderSearchParams>["sortBy"];
}

export function DiscussionThreadView({
	discussion,
	threads,
	thread,
	replies,
	moduleLinkId,
	courseId,
	view,
	replyTo,
	sortBy,
}: DiscussionThreadViewProps) {
	if (!discussion) {
		return (
			<Paper withBorder p="xl" radius="md">
				<Stack gap="md">
					<Title order={3}>Discussion Preview</Title>
					<Text c="dimmed">No discussion data available.</Text>
				</Stack>
			</Paper>
		);
	}

	// Show thread detail view
	if (thread) {
		return (
			<DiscussionThreadDetailView
				thread={thread}
				replies={replies}
				discussion={discussion}
				moduleLinkId={moduleLinkId}
				threadId={thread.id}
				courseId={courseId}
				replyTo={replyTo}
			/>
		);
	}

	// Show thread list view
	return (
		<DiscussionThreadListView
			threads={threads}
			discussion={discussion}
			moduleLinkId={moduleLinkId}
			courseId={courseId}
			view={view}
			sortBy={sortBy}
		/>
	);
}
