import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { SimpleRichTextEditor } from "~/components/simple-rich-text-editor";
import { useCreateReply } from "../route";

interface ReplyFormWrapperProps {
	moduleLinkId: number;
	threadId: string;
	replyTo?: string | null;
	onCancel: () => void;
}

export function ReplyFormWrapper({
	moduleLinkId,
	threadId,
	replyTo: _replyTo,
	onCancel,
}: ReplyFormWrapperProps) {
	const [replyContent, setReplyContent] = useState("");
	const { submit: createReply, isLoading: isSubmitting } = useCreateReply();

	const handleSubmit = () => {
		if (replyContent.trim()) {
			const threadIdNum = Number.parseInt(threadId, 10);
			if (!Number.isNaN(threadIdNum)) {
				// For thread-level replies, pass null/undefined to use "thread" as default
				// For comment replies, pass the comment ID
				createReply({
					params: { moduleLinkId },
					searchParams: {
						replyTo: _replyTo ? Number(_replyTo) : "thread",
					},
					values: {
						content: replyContent.trim(),
						parentThread: threadIdNum,
					},
				});
				setReplyContent("");
			}
		}
	};

	return (
		<Paper withBorder p="md" radius="sm" bg="gray.0">
			<Stack gap="md">
				<Text size="sm" fw={500}>
					Write a reply
				</Text>
				<SimpleRichTextEditor
					content={replyContent}
					onChange={setReplyContent}
					placeholder="Write your reply..."
				/>
				<Group justify="flex-end">
					<Button variant="default" onClick={onCancel} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} loading={isSubmitting}>
						Post Reply
					</Button>
				</Group>
			</Stack>
		</Paper>
	);
}
