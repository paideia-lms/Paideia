import { ActionIcon, Group, Text } from "@mantine/core";
import { IconArrowBigUp, IconArrowBigUpFilled } from "@tabler/icons-react";
import type { DiscussionReply } from "~/components/activity-modules-preview/discussion-preview";
import { useRemoveUpvoteReply, useUpvoteReply } from "../route";

interface ReplyUpvoteButtonProps {
	reply: DiscussionReply;
	moduleLinkId: number;
	threadId: number;
}

export function ReplyUpvoteButton({
	reply,
	moduleLinkId,
}: ReplyUpvoteButtonProps) {
	const { submit: upvoteReply, isLoading: isUpvotingReply } = useUpvoteReply();
	const { submit: removeUpvoteReply, isLoading: isRemovingUpvoteReply } =
		useRemoveUpvoteReply();

	const handleUpvote = (e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation();
		}

		if (reply.isUpvoted) {
			removeUpvoteReply({
				params: { moduleLinkId },
				values: {
					submissionId: reply.id,
				},
			});
		} else {
			upvoteReply({
				params: { moduleLinkId },
				values: {
					submissionId: reply.id,
				},
			});
		}
	};

	return (
		<Group gap="xs">
			<ActionIcon
				variant={reply.isUpvoted ? "filled" : "subtle"}
				color={reply.isUpvoted ? "blue" : "gray"}
				size="sm"
				onClick={handleUpvote}
				loading={isRemovingUpvoteReply || isUpvotingReply}
			>
				{reply.isUpvoted ? (
					<IconArrowBigUpFilled size={16} />
				) : (
					<IconArrowBigUp size={16} />
				)}
			</ActionIcon>
			<Text size="sm">{reply.upvotes}</Text>
		</Group>
	);
}
