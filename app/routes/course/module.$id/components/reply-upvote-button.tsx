import { ActionIcon, Group, Text } from "@mantine/core";
import { IconArrowBigUp, IconArrowBigUpFilled } from "@tabler/icons-react";
import type { DiscussionReply } from "~/components/activity-modules-preview/discussion-preview";
import { useRemoveUpvoteReply, useUpvoteReply } from "../route";

interface ReplyUpvoteButtonProps {
	reply: DiscussionReply;
	moduleLinkId: number;
	threadId: string;
}

export function ReplyUpvoteButton({
	reply,
	moduleLinkId,
	threadId,
}: ReplyUpvoteButtonProps) {
	const { submit: upvoteReply } = useUpvoteReply();
	const { submit: removeUpvoteReply } = useRemoveUpvoteReply();

	const handleUpvote = () => {
		const submissionId = Number.parseInt(reply.id, 10);
		if (Number.isNaN(submissionId)) return;

		if (reply.isUpvoted) {
			removeUpvoteReply({
				params: { moduleLinkId },
				values: {
					submissionId,
				},
			});
		} else {
			upvoteReply({
				params: { moduleLinkId },
				values: {
					submissionId,
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
