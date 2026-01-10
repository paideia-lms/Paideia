import {
	Avatar,
	Box,
	Button,
	Collapse,
	Group,
	Paper,
	Stack,
	Text,
	Typography,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Link } from "react-router";
import type { DiscussionReply } from "~/components/activity-modules-preview/discussion-preview";
import { FormableSimpleRichTextEditor } from "app/components/form-components/formable-simple-rich-text-editor";
import { useCreateReply } from "../route";
import { ReplyUpvoteButton } from "./reply-upvote-button";
import { getRouteUrl, useNuqsSearchParams } from "app/utils/search-params-utils";
import type { inferParserType } from "nuqs";
import { loaderSearchParams } from "../route";
import { useForm } from "@mantine/form";
import { useFormWithSyncedInitialValues } from "app/utils/form-utils";

dayjs.extend(relativeTime);

interface ReplyCardWithUpvoteProps {
	reply: DiscussionReply;
	allReplies: DiscussionReply[];
	moduleLinkId: number;
	threadId: number;
	courseId: number;
	level: number;
	replyTo?: inferParserType<typeof loaderSearchParams>["replyTo"];
}

export function ReplyCardWithUpvote({
	reply,
	allReplies: _allReplies,
	moduleLinkId,
	threadId,
	courseId,
	level,
	replyTo,
}: ReplyCardWithUpvoteProps) {
	const [opened, { toggle }] = useDisclosure(true); // Open by default to show nested replies
	const initialValues = {
		content: "",
	};
	const form = useForm({ initialValues });
	useFormWithSyncedInitialValues(form, initialValues);
	const { submit: createReply, isLoading: isSubmitting } = useCreateReply();
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);

	// Use nested replies from the reply object itself (nested structure)
	const nestedReplies = reply.replies || [];

	// Count total nested replies recursively
	const countNestedReplies = (replies: DiscussionReply[]): number => {
		return replies.reduce(
			(count, r) => count + 1 + countNestedReplies(r.replies || []),
			0,
		);
	};

	const totalNestedCount = countNestedReplies(nestedReplies);
	const isReplyingToThis = replyTo === reply.id;

	return (
		<Box>
			<Paper withBorder p="md" radius="sm">
				<Stack>
					<Group justify="space-between" align="flex-start">
						<Group gap="xs">
							<Link
								to={
									courseId && reply.authorId
										? getRouteUrl("/course/:courseId/participants/profile", {
											params: {
												courseId: courseId.toString(),
											}, searchParams: {
												userId: reply.authorId,
											}
										})
										: "#"
								}
								style={{ textDecoration: "none", color: "inherit" }}
							>
								<Group gap="xs">
									<Avatar size="sm" radius="xl">
										{reply.authorAvatar}
									</Avatar>
									<Text size="sm" fw={500} style={{ cursor: "pointer" }}>
										{reply.author}
									</Text>
								</Group>
							</Link>
							<Text size="xs" c="dimmed">
								{dayjs(reply.publishedAt).fromNow()}
							</Text>
						</Group>

						<ReplyUpvoteButton
							reply={reply}
							moduleLinkId={moduleLinkId}
							threadId={threadId}
						/>
					</Group>

					<Typography
						className="tiptap"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
						dangerouslySetInnerHTML={{ __html: reply.content }}
						style={{ fontSize: "0.875rem", lineHeight: "1.6" }}
					/>

					<Group>
						<Button
							variant="subtle"
							size="xs"
							onClick={() => setQueryParams({ replyTo: reply.id })}
						>
							Reply
						</Button>
						{totalNestedCount > 0 && (
							<Button
								variant="subtle"
								size="xs"
								onClick={toggle}
								leftSection={
									opened ? (
										<IconChevronUp size={14} />
									) : (
										<IconChevronDown size={14} />
									)
								}
							>
								{opened
									? "Hide replies"
									: `Show ${totalNestedCount} ${totalNestedCount === 1 ? "reply" : "replies"}`}
							</Button>
						)}
					</Group>
				</Stack>
			</Paper>

			{/* Inline Reply Form */}
			{isReplyingToThis && (
				<Paper withBorder p="md" radius="sm" bg="gray.0" mt="sm">
					<form onSubmit={form.onSubmit(async ({ content }) => {
						await createReply({
							params: { moduleLinkId },
							values: {
								content: content.trim(),
								parentThread: threadId,
							},
							searchParams: {
								replyTo: Number(reply.id),
							},
						});
						setQueryParams({ replyTo: null });
					})}>
						<Stack gap="md">
							<Text size="sm" fw={500}>
								Replying to {reply.author}...
							</Text>
							<FormableSimpleRichTextEditor
								form={form}
								formKey="content"
								key={form.key("content")}
								label="Reply"
								placeholder="Write your reply..."
							/>
							<Group justify="flex-end">
								<Button
									variant="default"
									onClick={() => {
										setQueryParams({ replyTo: null });
									}}
									disabled={isSubmitting}
								>
									Cancel
								</Button>
								<Button type="submit" loading={isSubmitting}>
									Post Reply
								</Button>
							</Group>
						</Stack>
					</form>
				</Paper>
			)}

			{/* Nested Replies */}
			{nestedReplies.length > 0 && (
				<Box mt="sm">
					<Collapse in={opened}>
						<Box
							style={{
								marginLeft: 6,
								paddingLeft: 12,
								borderLeft: "2px solid var(--mantine-color-gray-3)",
							}}
						>
							<Stack gap={0}>
								<Stack>
									{nestedReplies.map((nestedReply) => (
										<ReplyCardWithUpvote
											key={nestedReply.id}
											reply={nestedReply}
											allReplies={_allReplies}
											moduleLinkId={moduleLinkId}
											threadId={threadId}
											courseId={courseId}
											level={level + 1}
											replyTo={replyTo}
										/>
									))}
								</Stack>
							</Stack>
						</Box>
					</Collapse>
				</Box>
			)}
		</Box>
	);
}
