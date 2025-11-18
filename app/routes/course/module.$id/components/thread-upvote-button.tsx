import { ActionIcon, Stack, Text, Tooltip } from "@mantine/core";
import { IconArrowBigUp, IconArrowBigUpFilled } from "@tabler/icons-react";
import type { DiscussionThread } from "~/components/activity-modules-preview/discussion-preview";
import { useRemoveUpvoteThread, useUpvoteThread } from "../route";

interface ThreadUpvoteButtonProps {
	thread: DiscussionThread;
	moduleLinkId: number;
	threadId?: string;
}

export function ThreadUpvoteButton({
	thread,
	moduleLinkId,
	threadId,
}: ThreadUpvoteButtonProps) {
	const { upvoteThread } = useUpvoteThread(moduleLinkId);
	const { removeUpvoteThread } = useRemoveUpvoteThread(moduleLinkId);

	const handleUpvote = (e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation();
		}
		const submissionId = Number.parseInt(thread.id, 10);
		if (Number.isNaN(submissionId)) return;

		if (thread.isUpvoted) {
			removeUpvoteThread(submissionId, threadId);
		} else {
			upvoteThread(submissionId, threadId);
		}
	};

	return (
		<Stack gap="xs" align="center" style={{ minWidth: 50 }}>
			<Tooltip label={thread.isUpvoted ? "Remove upvote" : "Upvote"}>
				<ActionIcon
					variant={thread.isUpvoted ? "filled" : "subtle"}
					color={thread.isUpvoted ? "blue" : "gray"}
					onClick={handleUpvote}
				>
					{thread.isUpvoted ? (
						<IconArrowBigUpFilled size={20} />
					) : (
						<IconArrowBigUp size={20} />
					)}
				</ActionIcon>
			</Tooltip>
			<Text size="sm" fw={500}>
				{thread.upvotes}
			</Text>
		</Stack>
	);
}
