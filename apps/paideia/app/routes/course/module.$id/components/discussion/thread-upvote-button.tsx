import { ActionIcon, Stack, Text, Tooltip } from "@mantine/core";
import { IconArrowBigUp, IconArrowBigUpFilled } from "@tabler/icons-react";
import type { DiscussionThread } from "app/routes/course/module.$id/components/discussion/discussion-preview";
import { useRemoveUpvoteThread, useUpvoteThread } from "../../route";

interface ThreadUpvoteDownButtonProps {
	thread: DiscussionThread;
	moduleLinkId: number;
}

export function ThreadUpvoteDownVoteButton({
	thread,
	moduleLinkId,
}: ThreadUpvoteDownButtonProps) {
	const { submit: upvoteThread, isLoading: isUpvotingThread } =
		useUpvoteThread();
	const { submit: removeUpvoteThread, isLoading: isRemovingUpvoteThread } =
		useRemoveUpvoteThread();

	const handleUpvote = (e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation();
		}

		if (thread.isUpvoted) {
			removeUpvoteThread({
				params: { moduleLinkId },
				values: {
					submissionId: thread.id,
				},
			});
		} else {
			upvoteThread({
				params: { moduleLinkId },
				values: {
					submissionId: thread.id,
				},
			});
		}
	};

	return (
		<Stack gap="xs" align="center" style={{ minWidth: 50 }}>
			<Tooltip label={thread.isUpvoted ? "Remove upvote" : "Upvote"}>
				<ActionIcon
					variant={thread.isUpvoted ? "filled" : "subtle"}
					color={thread.isUpvoted ? "blue" : "gray"}
					onClick={handleUpvote}
					loading={isRemovingUpvoteThread || isUpvotingThread}
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
