import {
	ActionIcon,
	Avatar,
	Badge,
	Button,
	Divider,
	Group,
	Paper,
	Stack,
	Text,
	Title,
	Typography,
} from "@mantine/core";
import { IconArrowBack, IconMessage, IconPin } from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useQueryState } from "nuqs";
import { href, Link } from "react-router";
import type {
	DiscussionData,
	DiscussionReply,
	DiscussionThread,
} from "~/components/activity-modules-preview/discussion-preview";
import { ReplyCardWithUpvote } from "./reply-card";
import { ReplyFormWrapper } from "./reply-form-wrapper";
import { ThreadUpvoteButton } from "./thread-upvote-button";

dayjs.extend(relativeTime);

interface DiscussionThreadDetailViewProps {
	thread: DiscussionThread;
	replies: DiscussionReply[];
	discussion: DiscussionData;
	moduleLinkId: number;
	threadId: string;
	courseId: number;
	onBack: () => void;
}

export function DiscussionThreadDetailView({
	thread,
	replies,
	discussion: _discussion,
	moduleLinkId,
	threadId,
	courseId,
	onBack,
}: DiscussionThreadDetailViewProps) {
	const [replyTo, setReplyTo] = useQueryState("replyTo");

	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="lg">
				{/* Header */}
				<Group>
					<ActionIcon variant="subtle" onClick={onBack}>
						<IconArrowBack size={20} />
					</ActionIcon>
					<Text size="sm" c="dimmed">
						Back to threads
					</Text>
				</Group>

				{/* Thread Content */}
				<Stack gap="md">
					{thread.isPinned && (
						<Badge size="lg" color="yellow" leftSection={<IconPin size={14} />}>
							Pinned Thread
						</Badge>
					)}
					<Title order={2}>{thread.title}</Title>

					<Group gap="md" justify="space-between">
						<Group gap="xs">
							<Link
								to={
									courseId && thread.authorId
										? href("/course/:courseId/participants/profile", {
												courseId: String(courseId),
											}) + `?userId=${thread.authorId}`
										: "#"
								}
								style={{ textDecoration: "none", color: "inherit" }}
							>
								<Group gap="xs">
									<Avatar size="md" radius="xl">
										{thread.authorAvatar}
									</Avatar>
									<Stack gap={0}>
										<Text size="sm" fw={500} style={{ cursor: "pointer" }}>
											{thread.author}
										</Text>
									</Stack>
								</Group>
							</Link>
							<Text size="xs" c="dimmed">
								{dayjs(thread.publishedAt).fromNow()}
							</Text>
						</Group>
						<ThreadUpvoteButton
							thread={thread}
							moduleLinkId={moduleLinkId}
							threadId={threadId}
						/>
					</Group>

					<Typography
						className="tiptap"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
						dangerouslySetInnerHTML={{ __html: thread.content }}
						style={{ lineHeight: "1.6" }}
					/>

					<Group>
						<Button
							variant="light"
							leftSection={<IconMessage size={16} />}
							onClick={() => setReplyTo("thread")}
						>
							Reply
						</Button>
					</Group>
				</Stack>

				<Divider />

				{/* Reply Form - Only show when replying to thread (replyTo=thread) */}
				{replyTo === "thread" && (
					<ReplyFormWrapper
						moduleLinkId={moduleLinkId}
						threadId={threadId}
						replyTo={null}
						onCancel={() => {
							setReplyTo(null);
						}}
					/>
				)}

				{/* Replies */}
				<Stack>
					<Title order={4}>
						{thread.replyCount} {thread.replyCount === 1 ? "Reply" : "Replies"}
					</Title>
					{replies.map((reply) => (
						<ReplyCardWithUpvote
							key={reply.id}
							reply={reply}
							allReplies={replies}
							moduleLinkId={moduleLinkId}
							threadId={threadId}
							courseId={courseId}
							onReply={(id) => {
								setReplyTo(id);
							}}
							level={0}
							replyTo={replyTo}
							onCancelReply={() => {
								setReplyTo(null);
							}}
						/>
					))}
				</Stack>
			</Stack>
		</Paper>
	);
}
