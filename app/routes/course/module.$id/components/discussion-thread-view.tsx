import { Paper, Stack, Text, Title } from "@mantine/core";
import { useQueryState, parseAsString } from "nuqs";
import type {
    DiscussionData,
    DiscussionReply,
    DiscussionThread,
} from "~/components/activity-modules-preview/discussion-preview";
import { DiscussionThreadListView } from "./discussion-thread-list-view";
import { DiscussionThreadDetailView } from "./discussion-thread-detail-view";

interface DiscussionThreadViewProps {
    discussion: DiscussionData | null;
    threads: DiscussionThread[];
    thread: DiscussionThread | null;
    replies: DiscussionReply[];
    moduleLinkId: number;
    courseId: number;
}

export function DiscussionThreadView({
    discussion,
    threads,
    thread,
    replies,
    moduleLinkId,
    courseId,
}: DiscussionThreadViewProps) {
    const [threadId, setThreadId] = useQueryState(
        "threadId",
        parseAsString.withOptions({ shallow: false }),
    );
    const [, setReplyTo] = useQueryState("replyTo");

    // Fallback: if threadId is set but thread is not provided, try to find it from threads list
    const selectedThread =
        thread ||
        (threadId ? threads.find((t) => t.id === threadId) || null : null);

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
    if (threadId && selectedThread) {
        return (
            <DiscussionThreadDetailView
                thread={selectedThread}
                replies={replies}
                discussion={discussion}
                moduleLinkId={moduleLinkId}
                threadId={threadId}
                courseId={courseId}
                onBack={() => {
                    setThreadId(null);
                    setReplyTo(null);
                }}
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
            onThreadClick={(id) => setThreadId(id)}
        />
    );
}

