import {
	ActionIcon,
	Avatar,
	Badge,
	Box,
	Button,
	Collapse,
	Divider,
	Group,
	Input,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	Title,
	Tooltip,
	Typography,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import {
	IconArrowBack,
	IconArrowBigUp,
	IconArrowBigUpFilled,
	IconChevronDown,
	IconChevronUp,
	IconMessage,
	IconPin,
	IconPlus,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import type { useFetcher } from "react-router";
import { href, Link } from "react-router";
import { DiscussionActions } from "app/routes/course/module.$id/route";
import { SimpleRichTextEditor } from "../rich-text/simple-rich-text-editor";

type FetcherType = ReturnType<typeof useFetcher>;

dayjs.extend(relativeTime);

// Constants
const NESTED_REPLY_INDENT = 12; // pixels

// Helper component for author info with link
interface AuthorInfoProps {
	author: string;
	authorAvatar: string;
	authorId?: number | null;
	courseId?: number | null;
	size?: "sm" | "md";
}

function AuthorInfo({
	author,
	authorAvatar,
	authorId,
	courseId,
	size = "sm",
}: AuthorInfoProps) {
	const avatarSize = size === "md" ? "md" : "sm";

	// For user module preview (fake data) or when courseId/authorId is missing, use #
	const profileHref =
		typeof courseId === "number" && typeof authorId === "number"
			? href("/course/:courseId/participants/profile", {
				courseId: String(courseId),
			}) + `?userId=${authorId}`
			: "#";

	return (
		<Link to={profileHref} style={{ textDecoration: "none", color: "inherit" }}>
			<Group gap="xs">
				<Avatar size={avatarSize} radius="xl">
					{authorAvatar}
				</Avatar>
				<Stack gap={0}>
					<Text size="sm" fw={500} style={{ cursor: "pointer" }}>
						{author}
					</Text>
				</Stack>
			</Group>
		</Link>
	);
}

// Export types for composability
export interface DiscussionThread {
	id: string;
	title: string;
	content: string;
	author: string;
	authorAvatar: string;
	authorId?: number | null; // User ID for linking to profile
	publishedAt: string;
	upvotes: number;
	replyCount: number;
	isPinned: boolean;
	isUpvoted: boolean;
}

export interface DiscussionReply {
	id: string;
	content: string;
	author: string;
	authorAvatar: string;
	authorId?: number | null; // User ID for linking to profile
	publishedAt: string;
	upvotes: number;
	parentId: string | null;
	isUpvoted: boolean;
	replies?: DiscussionReply[];
}

export interface DiscussionData {
	id: number;
	instructions: string | null;
	requireThread: boolean | null;
	requireReplies: boolean | null;
	minReplies: number | null;
}

// Export individual components for composability
export interface ThreadCardProps {
	thread: DiscussionThread;
	onClick: () => void;
	allowUpvotes: boolean;
	onUpvote?: (submissionId: number) => void;
	onRemoveUpvote?: (submissionId: number) => void;
}

export function ThreadCard({
	thread,
	onClick,
	allowUpvotes,
	onUpvote,
	onRemoveUpvote,
}: ThreadCardProps) {
	const handleUpvote = (e: React.MouseEvent) => {
		e.stopPropagation();
		const submissionId = Number.parseInt(thread.id, 10);
		if (Number.isNaN(submissionId)) return;

		if (thread.isUpvoted) {
			if (onRemoveUpvote) {
				onRemoveUpvote(submissionId);
			}
		} else {
			if (onUpvote) {
				onUpvote(submissionId);
			}
		}
	};

	return (
		<Paper
			withBorder
			p="md"
			radius="sm"
			style={{ cursor: "pointer" }}
			onClick={onClick}
		>
			<Group align="flex-start" gap="md" wrap="nowrap">
				{/* Upvote Section */}
				{allowUpvotes && (
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
				)}

				{/* Thread Content */}
				<Stack gap="xs" style={{ flex: 1 }}>
					<Group gap="sm">
						{thread.isPinned && (
							<Badge
								size="sm"
								color="yellow"
								leftSection={<IconPin size={12} />}
							>
								Pinned
							</Badge>
						)}
						<Title order={4}>{thread.title}</Title>
					</Group>

					<Typography
						className="tiptap"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
						dangerouslySetInnerHTML={{ __html: thread.content }}
						style={{
							fontSize: "0.875rem",
							color: "var(--mantine-color-dimmed)",
							display: "-webkit-box",
							WebkitLineClamp: 2,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
						}}
					/>

					<Group gap="md">
						<Group gap="xs">
							<Avatar size="sm" radius="xl">
								{thread.authorAvatar}
							</Avatar>
							<Text size="sm">{thread.author}</Text>
						</Group>
						<Text size="sm" c="dimmed">
							{dayjs(thread.publishedAt).fromNow()}
						</Text>
						<Group gap="xs">
							<IconMessage size={16} />
							<Text size="sm">{thread.replyCount} replies</Text>
						</Group>
					</Group>
				</Stack>
			</Group>
		</Paper>
	);
}

export interface CreateThreadFormProps {
	onSubmit: (title: string, content: string) => void;
	onCancel: () => void;
	isSubmitting?: boolean;
	fetcher?: FetcherType;
}

export function CreateThreadForm({
	onSubmit,
	onCancel,
	isSubmitting = false,
}: CreateThreadFormProps) {
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			title: "",
			content: "",
		},
	});

	const handleSubmit = (values: { title: string; content: string }) => {
		const title = values.title?.trim() || "";
		const content = values.content?.trim() || "";

		onSubmit(title, content);
	};

	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="lg">
				<Group justify="space-between">
					<Title order={3}>Create New Thread</Title>
					<Button variant="default" onClick={onCancel} disabled={isSubmitting}>
						Cancel
					</Button>
				</Group>

				<form method="POST" onSubmit={form.onSubmit(handleSubmit)}>
					<Stack gap="lg">
						<Textarea
							{...form.getInputProps("title")}
							key={form.key("title")}
							label="Thread Title"
							placeholder="Enter a descriptive title..."
							required
							disabled={isSubmitting}
						/>

						<Input.Wrapper label="Content" required>
							<SimpleRichTextEditor
								readonly={isSubmitting}
								content={form.getValues().content || ""}
								onChange={(value) => form.setFieldValue("content", value)}
								placeholder="Write your thread content..."
							/>
						</Input.Wrapper>

						<Group justify="flex-end">
							<Button type="submit" loading={isSubmitting}>
								Post Thread
							</Button>
						</Group>
					</Stack>
				</form>
			</Stack>
		</Paper>
	);
}

// Keep old ThreadListView for backward compatibility (used by StatefulDiscussionPreview)
export interface ThreadListViewProps {
	threads: DiscussionThread[];
	discussion: DiscussionData;
	sortBy: string;
	setSortBy: (value: string) => void;
	onThreadClick: (id: string) => void;
	onCreateThread: () => void;
	action: string | null;
	setAction: (value: string | null) => void;
	onCreateThreadSubmit?: (title: string, content: string) => void;
	isCreatingThread?: boolean;
	onUpvoteThread?: (submissionId: number) => void;
	onRemoveUpvoteThread?: (submissionId: number) => void;
	createThreadFetcher?: FetcherType;
}

export function ThreadListView({
	threads,
	discussion,
	sortBy,
	setSortBy,
	onThreadClick,
	onCreateThread,
	action,
	setAction,
	onCreateThreadSubmit,
	isCreatingThread = false,
	onUpvoteThread,
	onRemoveUpvoteThread,
	createThreadFetcher,
}: ThreadListViewProps) {
	const sortedThreads = [...threads].sort((a, b) => {
		switch (sortBy) {
			case "upvoted":
				return b.upvotes - a.upvotes;
			case "active":
				return b.replyCount - a.replyCount;
			default:
				return (
					new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
				);
		}
	});

	if (action === DiscussionActions.CREATE_THREAD) {
		return (
			<CreateThreadForm
				onSubmit={(title, content) => {
					if (onCreateThreadSubmit) {
						onCreateThreadSubmit(title, content);
					} else {
						// Fallback for preview mode
						console.log("Creating thread:", { title, content });
						setAction(null);
					}
				}}
				onCancel={() => setAction(null)}
				isSubmitting={isCreatingThread}
				fetcher={createThreadFetcher}
			/>
		);
	}

	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="lg">
				{/* Header */}
				<Group justify="space-between" align="flex-start">
					<div>
						<Title order={3} mb="xs">
							Discussion Board
						</Title>
						{discussion.instructions && (
							<Typography
								className="tiptap"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
								dangerouslySetInnerHTML={{ __html: discussion.instructions }}
								style={{
									fontSize: "0.875rem",
									color: "var(--mantine-color-dimmed)",
								}}
							/>
						)}
					</div>
					<Button leftSection={<IconPlus size={16} />} onClick={onCreateThread}>
						New Thread
					</Button>
				</Group>

				{/* Sorting */}
				<Group justify="space-between">
					<Text size="sm" c="dimmed">
						{threads.length} {threads.length === 1 ? "thread" : "threads"}
					</Text>
					<Select
						size="sm"
						value={sortBy}
						onChange={(value) => setSortBy(value || "recent")}
						data={[
							{ value: "recent", label: "Most Recent" },
							{ value: "upvoted", label: "Most Upvoted" },
							{ value: "active", label: "Most Active" },
						]}
						style={{ width: 180 }}
					/>
				</Group>

				<Divider />

				{/* Thread List */}
				<Stack gap="md">
					{sortedThreads.map((thread) => (
						<ThreadCard
							key={thread.id}
							thread={thread}
							onClick={() => onThreadClick(thread.id)}
							allowUpvotes={true}
							onUpvote={onUpvoteThread}
							onRemoveUpvote={onRemoveUpvoteThread}
						/>
					))}
				</Stack>
			</Stack>
		</Paper>
	);
}

export interface ReplyCardProps {
	reply: DiscussionReply;
	allReplies: DiscussionReply[];
	onReply: (id: string) => void;
	allowUpvotes: boolean;
	level: number;
	onUpvote?: (submissionId: number) => void;
	onRemoveUpvote?: (submissionId: number) => void;
	replyTo?: string | null;
	onReplySubmit?: (content: string, replyToId?: string | null) => void;
	isSubmittingReply?: boolean;
	onCancelReply?: () => void;
	courseId?: number | null; // Course ID for linking to user profile
}

export function ReplyCard({
	reply,
	allReplies,
	onReply: _onReply,
	allowUpvotes,
	level,
	onUpvote,
	onRemoveUpvote,
	replyTo,
	onReplySubmit,
	isSubmittingReply = false,
	onCancelReply,
	courseId,
}: ReplyCardProps) {
	const onReply = _onReply;
	const [opened, { toggle }] = useDisclosure(false); // false = collapsed by default
	const [replyContent, setReplyContent] = useState("");

	const handleUpvote = () => {
		const submissionId = Number.parseInt(reply.id, 10);
		if (Number.isNaN(submissionId)) return;

		if (reply.isUpvoted) {
			if (onRemoveUpvote) {
				onRemoveUpvote(submissionId);
			}
		} else {
			if (onUpvote) {
				onUpvote(submissionId);
			}
		}
	};

	const handleReplySubmit = () => {
		if (replyContent.trim() && onReplySubmit) {
			onReplySubmit(replyContent.trim(), reply.id);
			setReplyContent("");
			if (onCancelReply) {
				onCancelReply();
			}
		}
	};

	const nestedReplies = allReplies.filter((r) => r.parentId === reply.id);

	// Count total nested replies recursively
	const countNestedReplies = (replyId: string): number => {
		const directReplies = allReplies.filter((r) => r.parentId === replyId);
		return directReplies.reduce(
			(count, r) => count + 1 + countNestedReplies(r.id),
			0,
		);
	};

	const totalNestedCount = countNestedReplies(reply.id);
	const isReplyingToThis = replyTo === reply.id;

	return (
		<Box
			style={{
				marginLeft: level > 0 ? NESTED_REPLY_INDENT / 2 : 0,
				borderLeft:
					level > 0 ? "2px solid var(--mantine-color-gray-3)" : undefined,
				paddingLeft: level > 0 ? NESTED_REPLY_INDENT : 0,
			}}
		>
			<Paper withBorder p="md" radius="sm">
				<Stack gap="sm">
					<Group justify="space-between" align="flex-start">
						<Group gap="xs">
							<AuthorInfo
								author={reply.author}
								authorAvatar={reply.authorAvatar}
								authorId={reply.authorId}
								courseId={courseId}
								size="sm"
							/>
							<Text size="xs" c="dimmed">
								{dayjs(reply.publishedAt).fromNow()}
							</Text>
						</Group>

						{allowUpvotes && (
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
						)}
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
							onClick={() => onReply(reply.id)}
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
			{isReplyingToThis && onReplySubmit && (
				<Paper withBorder p="md" radius="sm" bg="gray.0" mt="sm">
					<Stack gap="md">
						<Text size="sm" fw={500}>
							Replying to {reply.author}...
						</Text>
						<SimpleRichTextEditor
							content={replyContent}
							onChange={setReplyContent}
							placeholder="Write your reply..."
							readonly={isSubmittingReply}
						/>
						<Group justify="flex-end">
							<Button
								variant="default"
								onClick={() => {
									setReplyContent("");
									if (onCancelReply) {
										onCancelReply();
									}
								}}
								disabled={isSubmittingReply}
							>
								Cancel
							</Button>
							<Button onClick={handleReplySubmit} loading={isSubmittingReply}>
								Post Reply
							</Button>
						</Group>
					</Stack>
				</Paper>
			)}

			{/* Nested Replies */}
			{nestedReplies.length > 0 && (
				<Collapse in={opened}>
					<Stack gap="sm" mt="sm">
						{nestedReplies.map((nestedReply) => (
							<ReplyCard
								key={nestedReply.id}
								reply={nestedReply}
								allReplies={allReplies}
								onReply={onReply}
								allowUpvotes={allowUpvotes}
								level={level + 1}
								onUpvote={onUpvote}
								onRemoveUpvote={onRemoveUpvote}
								replyTo={replyTo}
								onReplySubmit={onReplySubmit}
								isSubmittingReply={isSubmittingReply}
								onCancelReply={onCancelReply}
								courseId={courseId}
							/>
						))}
					</Stack>
				</Collapse>
			)}
		</Box>
	);
}

// Keep old ThreadDetailView for backward compatibility (used by StatefulDiscussionPreview)
export interface ThreadDetailViewProps {
	thread: DiscussionThread;
	replies: DiscussionReply[];
	discussion: DiscussionData;
	onBack: () => void;
	action: string | null;
	setAction: (value: string | null) => void;
	replyTo: string | null;
	setReplyTo: (value: string | null) => void;
	onReplySubmit?: (content: string, replyToId?: string | null) => void;
	isSubmittingReply?: boolean;
	onUpvoteThread?: (submissionId: number) => void;
	onRemoveUpvoteThread?: (submissionId: number) => void;
	onUpvoteReply?: (submissionId: number) => void;
	onRemoveUpvoteReply?: (submissionId: number) => void;
	courseId?: number | null; // Course ID for linking to user profile
}

export function ThreadDetailView({
	thread,
	replies,
	discussion: _discussion,
	onBack,
	action: _action,
	setAction: _setAction,
	replyTo,
	setReplyTo,
	onReplySubmit,
	isSubmittingReply = false,
	onUpvoteThread: _onUpvoteThread,
	onRemoveUpvoteThread: _onRemoveUpvoteThread,
	onUpvoteReply: _onUpvoteReply,
	onRemoveUpvoteReply: _onRemoveUpvoteReply,
	courseId,
}: ThreadDetailViewProps) {
	const onUpvoteThread = _onUpvoteThread;
	const onRemoveUpvoteThread = _onRemoveUpvoteThread;
	const onUpvoteReply = _onUpvoteReply;
	const onRemoveUpvoteReply = _onRemoveUpvoteReply;
	const [replyContent, setReplyContent] = useState("");

	const handleReply = () => {
		if (replyContent.trim()) {
			if (onReplySubmit) {
				// If replyTo is "thread", we're replying to the thread
				// Otherwise, we're replying to a comment (handled inline in ReplyCard)
				onReplySubmit(
					replyContent.trim(),
					replyTo === "thread" ? null : replyTo,
				);
			} else {
				// Fallback for preview mode
				console.log("Replying:", { replyTo, content: replyContent });
			}
			setReplyContent("");
			setReplyTo(null);
		}
	};

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
							<AuthorInfo
								author={thread.author}
								authorAvatar={thread.authorAvatar}
								authorId={thread.authorId}
								courseId={courseId}
								size="md"
							/>
							<Text size="xs" c="dimmed">
								{dayjs(thread.publishedAt).fromNow()}
							</Text>
						</Group>
						{onUpvoteThread && onRemoveUpvoteThread && (
							<Group gap="xs">
								<ActionIcon
									variant={thread.isUpvoted ? "filled" : "subtle"}
									color={thread.isUpvoted ? "blue" : "gray"}
									onClick={() => {
										const submissionId = Number.parseInt(thread.id, 10);
										if (!Number.isNaN(submissionId)) {
											if (thread.isUpvoted) {
												onRemoveUpvoteThread(submissionId);
											} else {
												onUpvoteThread(submissionId);
											}
										}
									}}
								>
									{thread.isUpvoted ? (
										<IconArrowBigUpFilled size={20} />
									) : (
										<IconArrowBigUp size={20} />
									)}
								</ActionIcon>
								<Text size="sm" fw={500}>
									{thread.upvotes}
								</Text>
							</Group>
						)}
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
								<Button
									variant="default"
									onClick={() => {
										setReplyTo(null);
									}}
									disabled={isSubmittingReply}
								>
									Cancel
								</Button>
								<Button onClick={handleReply} loading={isSubmittingReply}>
									Post Reply
								</Button>
							</Group>
						</Stack>
					</Paper>
				)}

				{/* Replies */}
				<Stack gap="md">
					<Title order={4}>
						{replies.length} {replies.length === 1 ? "Reply" : "Replies"}
					</Title>
					{replies
						.filter((r) => r.parentId === null)
						.map((reply) => (
							<ReplyCard
								key={reply.id}
								reply={reply}
								allReplies={replies}
								onReply={(id) => {
									setReplyTo(id);
								}}
								allowUpvotes={true}
								level={0}
								onUpvote={onUpvoteReply}
								onRemoveUpvote={onRemoveUpvoteReply}
								replyTo={replyTo}
								onReplySubmit={onReplySubmit}
								isSubmittingReply={isSubmittingReply}
								onCancelReply={() => {
									setReplyTo(null);
								}}
								courseId={courseId}
							/>
						))}
				</Stack>
			</Stack>
		</Paper>
	);
}

// Main component - smart wrapper that uses hooks
interface DiscussionPreviewProps {
	discussion: DiscussionData | null;
	threads?: DiscussionThread[];
	thread?: DiscussionThread | null;
	replies?: DiscussionReply[];
	moduleLinkId?: number;
	courseId?: number | null; // Course ID for linking to user profile
	onCreateThread?: (title: string, content: string) => void;
	isCreatingThread?: boolean;
	onReplySubmit?: (content: string, replyToId?: string | null) => void;
	isSubmittingReply?: boolean;
	onUpvoteThread?: (submissionId: number) => void;
	onRemoveUpvoteThread?: (submissionId: number) => void;
	onUpvoteReply?: (submissionId: number) => void;
	onRemoveUpvoteReply?: (submissionId: number) => void;
	createThreadFetcher?: FetcherType;
}

export function DiscussionPreview({
	discussion,
	threads = [],
	thread = null,
	replies = [],
	moduleLinkId: _moduleLinkId,
	courseId,
	onCreateThread,
	isCreatingThread = false,
	onReplySubmit,
	isSubmittingReply = false,
	onUpvoteThread,
	onRemoveUpvoteThread,
	onUpvoteReply,
	onRemoveUpvoteReply,
	createThreadFetcher,
}: DiscussionPreviewProps) {
	// Use shallow: false to ensure navigation triggers loader re-run
	const [threadId, setThreadId] = useQueryState(
		"threadId",
		parseAsString.withOptions({ shallow: false }),
	);
	const [action, setAction] = useQueryState("action");
	const [replyTo, setReplyTo] = useQueryState("replyTo");
	const [sortBy, setSortBy] = useState<string>("recent");

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
			<ThreadDetailView
				thread={selectedThread}
				replies={replies}
				discussion={discussion}
				onBack={() => {
					setThreadId(null);
					setReplyTo(null);
				}}
				action={action}
				setAction={setAction}
				replyTo={replyTo}
				setReplyTo={setReplyTo}
				onReplySubmit={onReplySubmit}
				isSubmittingReply={isSubmittingReply}
				onUpvoteThread={onUpvoteThread}
				onRemoveUpvoteThread={onRemoveUpvoteThread}
				onUpvoteReply={onUpvoteReply}
				onRemoveUpvoteReply={onRemoveUpvoteReply}
				courseId={courseId}
			/>
		);
	}

	// Show thread list view
	return (
		<ThreadListView
			threads={threads}
			discussion={discussion}
			sortBy={sortBy}
			setSortBy={setSortBy}
			onThreadClick={(id) => setThreadId(id)}
			onCreateThread={() => setAction(DiscussionActions.CREATE_THREAD)}
			action={action}
			setAction={setAction}
			onCreateThreadSubmit={onCreateThread}
			isCreatingThread={isCreatingThread}
			onUpvoteThread={onUpvoteThread}
			onRemoveUpvoteThread={onRemoveUpvoteThread}
			createThreadFetcher={createThreadFetcher}
		/>
	);
}

// Stateful wrapper components for preview mode (edit.tsx)
// These components add local state management for interactive previews

export function StatefulThreadCard(props: ThreadCardProps) {
	const [isUpvoted, setIsUpvoted] = useState(props.thread.isUpvoted);
	const [upvoteCount, setUpvoteCount] = useState(props.thread.upvotes);

	const threadWithState = useMemo(
		() => ({
			...props.thread,
			isUpvoted,
			upvotes: upvoteCount,
		}),
		[props.thread, isUpvoted, upvoteCount],
	);

	const handleUpvote = (_submissionId: number) => {
		if (isUpvoted) {
			setUpvoteCount(upvoteCount - 1);
			setIsUpvoted(false);
		} else {
			setUpvoteCount(upvoteCount + 1);
			setIsUpvoted(true);
		}
	};

	const handleRemoveUpvote = (_submissionId: number) => {
		if (isUpvoted) {
			setUpvoteCount(upvoteCount - 1);
			setIsUpvoted(false);
		}
	};

	return (
		<ThreadCard
			{...props}
			thread={threadWithState}
			onUpvote={props.onUpvote || handleUpvote}
			onRemoveUpvote={props.onRemoveUpvote || handleRemoveUpvote}
		/>
	);
}

export function StatefulReplyCard(props: ReplyCardProps) {
	const [isUpvoted, setIsUpvoted] = useState(props.reply.isUpvoted);
	const [upvoteCount, setUpvoteCount] = useState(props.reply.upvotes);

	const replyWithState = useMemo(
		() => ({
			...props.reply,
			isUpvoted,
			upvotes: upvoteCount,
		}),
		[props.reply, isUpvoted, upvoteCount],
	);

	const handleUpvote = (_submissionId: number) => {
		if (isUpvoted) {
			setUpvoteCount(upvoteCount - 1);
			setIsUpvoted(false);
		} else {
			setUpvoteCount(upvoteCount + 1);
			setIsUpvoted(true);
		}
	};

	const handleRemoveUpvote = (_submissionId: number) => {
		if (isUpvoted) {
			setUpvoteCount(upvoteCount - 1);
			setIsUpvoted(false);
		}
	};

	return (
		<ReplyCard
			{...props}
			reply={replyWithState}
			onUpvote={props.onUpvote || handleUpvote}
			onRemoveUpvote={props.onRemoveUpvote || handleRemoveUpvote}
		/>
	);
}

// Stateful wrapper for DiscussionPreview used in edit.tsx
export function StatefulDiscussionPreview(props: DiscussionPreviewProps) {
	const [threadsState, setThreadsState] = useState(props.threads || []);
	const [repliesState, setRepliesState] = useState(props.replies || []);
	const [threadState, setThreadState] = useState(props.thread);

	// Update state when props change
	useMemo(() => {
		if (props.threads) {
			setThreadsState(props.threads);
		}
	}, [props.threads]);

	useMemo(() => {
		if (props.replies) {
			setRepliesState(props.replies);
		}
	}, [props.replies]);

	useMemo(() => {
		setThreadState(props.thread);
	}, [props.thread]);

	const handleUpvoteThread = (submissionId: number) => {
		setThreadsState((prev) =>
			prev.map((t) => {
				if (String(t.id) === String(submissionId)) {
					return {
						...t,
						isUpvoted: !t.isUpvoted,
						upvotes: t.isUpvoted ? t.upvotes - 1 : t.upvotes + 1,
					};
				}
				return t;
			}),
		);
		if (threadState && String(threadState.id) === String(submissionId)) {
			setThreadState((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					isUpvoted: !prev.isUpvoted,
					upvotes: prev.isUpvoted ? prev.upvotes - 1 : prev.upvotes + 1,
				};
			});
		}
	};

	const handleRemoveUpvoteThread = (submissionId: number) => {
		setThreadsState((prev) =>
			prev.map((t) => {
				if (String(t.id) === String(submissionId)) {
					return {
						...t,
						isUpvoted: false,
						upvotes: Math.max(0, t.upvotes - 1),
					};
				}
				return t;
			}),
		);
		if (threadState && String(threadState.id) === String(submissionId)) {
			setThreadState((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					isUpvoted: false,
					upvotes: Math.max(0, prev.upvotes - 1),
				};
			});
		}
	};

	const handleUpvoteReply = (submissionId: number) => {
		setRepliesState((prev) =>
			prev.map((r) => {
				if (String(r.id) === String(submissionId)) {
					return {
						...r,
						isUpvoted: !r.isUpvoted,
						upvotes: r.isUpvoted ? r.upvotes - 1 : r.upvotes + 1,
					};
				}
				// Also update nested replies
				if (r.replies) {
					return {
						...r,
						replies: r.replies.map((nr) => {
							if (String(nr.id) === String(submissionId)) {
								return {
									...nr,
									isUpvoted: !nr.isUpvoted,
									upvotes: nr.isUpvoted ? nr.upvotes - 1 : nr.upvotes + 1,
								};
							}
							return nr;
						}),
					};
				}
				return r;
			}),
		);
	};

	const handleRemoveUpvoteReply = (submissionId: number) => {
		setRepliesState((prev) =>
			prev.map((r) => {
				if (String(r.id) === String(submissionId)) {
					return {
						...r,
						isUpvoted: false,
						upvotes: Math.max(0, r.upvotes - 1),
					};
				}
				// Also update nested replies
				if (r.replies) {
					return {
						...r,
						replies: r.replies.map((nr) => {
							if (String(nr.id) === String(submissionId)) {
								return {
									...nr,
									isUpvoted: false,
									upvotes: Math.max(0, nr.upvotes - 1),
								};
							}
							return nr;
						}),
					};
				}
				return r;
			}),
		);
	};

	const handleCreateThread = (title: string, content: string) => {
		// Create a new thread with mock data for preview mode
		const newThread: DiscussionThread = {
			id: String(Date.now()), // Use timestamp as ID for preview
			title,
			content,
			author: "Preview User",
			authorAvatar: "PU",
			publishedAt: new Date().toISOString(),
			upvotes: 0,
			replyCount: 0,
			isPinned: false,
			isUpvoted: false,
		};
		setThreadsState((prev) => [newThread, ...prev]);
	};

	const handleReplySubmit = (content: string, replyToId?: string | null) => {
		// Create a new reply with mock data for preview mode
		const newReply: DiscussionReply = {
			id: `r${Date.now()}`,
			content,
			author: "Preview User",
			authorAvatar: "PU",
			publishedAt: new Date().toISOString(),
			upvotes: 0,
			parentId: replyToId || null,
			isUpvoted: false,
		};
		setRepliesState((prev) => [newReply, ...prev]);

		// Update thread reply count if we have a thread
		if (threadState) {
			setThreadState({
				...threadState,
				replyCount: threadState.replyCount + 1,
			});
		}
	};

	return (
		<DiscussionPreview
			{...props}
			threads={threadsState}
			replies={repliesState}
			thread={threadState}
			onCreateThread={props.onCreateThread || handleCreateThread}
			onUpvoteThread={props.onUpvoteThread || handleUpvoteThread}
			onRemoveUpvoteThread={
				props.onRemoveUpvoteThread || handleRemoveUpvoteThread
			}
			onUpvoteReply={props.onUpvoteReply || handleUpvoteReply}
			onRemoveUpvoteReply={props.onRemoveUpvoteReply || handleRemoveUpvoteReply}
			onReplySubmit={props.onReplySubmit || handleReplySubmit}
		/>
	);
}
