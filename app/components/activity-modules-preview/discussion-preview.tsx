import {
	ActionIcon,
	Avatar,
	Badge,
	Box,
	Button,
	Collapse,
	Divider,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	Title,
	Tooltip,
	Typography,
} from "@mantine/core";
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
import { useDisclosure } from "@mantine/hooks";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";

dayjs.extend(relativeTime);

// Constants
const NESTED_REPLY_INDENT = 12; // pixels

interface DiscussionThread {
	id: string;
	title: string;
	content: string;
	author: string;
	authorAvatar: string;
	publishedAt: string;
	upvotes: number;
	replyCount: number;
	isPinned: boolean;
	isUpvoted: boolean;
}

interface DiscussionReply {
	id: string;
	content: string;
	author: string;
	authorAvatar: string;
	publishedAt: string;
	upvotes: number;
	parentId: string | null;
	isUpvoted: boolean;
	replies?: DiscussionReply[];
}

interface DiscussionPreviewProps {
	discussion: {
		id: number;
		instructions: string | null;
		requireThread: boolean | null;
		requireReplies: boolean | null;
		minReplies: number | null;
	} | null;
}

// Mock data
const mockThreads: DiscussionThread[] = [
	{
		id: "1",
		title: "What are the main differences between TCP and UDP?",
		content:
			"<p>I'm studying network protocols and I'm confused about when to use TCP vs UDP. Can someone explain the key differences and use cases?</p>",
		author: "Alice Johnson",
		authorAvatar: "AJ",
		publishedAt: "2025-10-27T10:00:00Z",
		upvotes: 15,
		replyCount: 8,
		isPinned: true,
		isUpvoted: false,
	},
	{
		id: "2",
		title: "How does the three-way handshake work?",
		content:
			"<p>I understand TCP uses a three-way handshake, but I'm not clear on the exact steps. Could someone break it down?</p>",
		author: "Bob Smith",
		authorAvatar: "BS",
		publishedAt: "2025-10-26T14:30:00Z",
		upvotes: 12,
		replyCount: 5,
		isPinned: false,
		isUpvoted: true,
	},
	{
		id: "3",
		title: "Best practices for socket programming",
		content:
			"<p>What are some best practices when implementing socket programming in Python? Any common pitfalls to avoid?</p>",
		author: "Charlie Brown",
		authorAvatar: "CB",
		publishedAt: "2025-10-25T09:15:00Z",
		upvotes: 8,
		replyCount: 12,
		isPinned: false,
		isUpvoted: false,
	},
	{
		id: "4",
		title: "Understanding OSI model layers",
		content:
			"<p>Can someone help me understand the practical differences between the layers in the OSI model? The textbook explanations are too abstract.</p>",
		author: "Diana Prince",
		authorAvatar: "DP",
		publishedAt: "2025-10-24T16:45:00Z",
		upvotes: 6,
		replyCount: 3,
		isPinned: false,
		isUpvoted: false,
	},
];

const mockReplies: Record<string, DiscussionReply[]> = {
	"1": [
		{
			id: "r1",
			content:
				"<p>TCP is connection-oriented and guarantees delivery, while UDP is connectionless and faster but doesn't guarantee delivery. TCP is like a phone call, UDP is like sending a postcard.</p>",
			author: "Professor Lee",
			authorAvatar: "PL",
			publishedAt: "2025-10-27T10:30:00Z",
			upvotes: 20,
			parentId: null,
			isUpvoted: true,
		},
		{
			id: "r2",
			content:
				"<p>Great analogy! To add to that, TCP maintains order of packets while UDP doesn't. That's why video streaming can use UDP - a few lost frames won't matter much.</p>",
			author: "Sarah Connor",
			authorAvatar: "SC",
			publishedAt: "2025-10-27T11:00:00Z",
			upvotes: 8,
			parentId: "r1",
			isUpvoted: false,
		},
		{
			id: "r2a",
			content:
				"<p>Exactly! And that's why online games prefer UDP - latency is more important than perfect delivery.</p>",
			author: "Gaming Dev",
			authorAvatar: "GD",
			publishedAt: "2025-10-27T11:30:00Z",
			upvotes: 3,
			parentId: "r2",
			isUpvoted: false,
		},
		{
			id: "r2b",
			content:
				"<p>But some games use a hybrid approach - TCP for critical game state and UDP for position updates.</p>",
			author: "Network Architect",
			authorAvatar: "NA",
			publishedAt: "2025-10-27T11:45:00Z",
			upvotes: 5,
			parentId: "r2a",
			isUpvoted: false,
		},
		{
			id: "r3",
			content:
				"<p>TCP also has error checking and flow control. Use TCP for file transfers, web pages, emails. Use UDP for gaming, live streaming, VoIP where speed matters more than reliability.</p>",
			author: "John Doe",
			authorAvatar: "JD",
			publishedAt: "2025-10-27T12:15:00Z",
			upvotes: 5,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r4",
			content:
				"<p>Don't forget about congestion control! TCP actively tries to avoid network congestion, while UDP doesn't care.</p>",
			author: "Network Admin",
			authorAvatar: "NA",
			publishedAt: "2025-10-27T13:00:00Z",
			upvotes: 7,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r5",
			content:
				"<p>One more thing: TCP has a larger header (20 bytes minimum) compared to UDP (8 bytes). This overhead matters for small packets.</p>",
			author: "Protocol Expert",
			authorAvatar: "PE",
			publishedAt: "2025-10-27T14:00:00Z",
			upvotes: 4,
			parentId: "r4",
			isUpvoted: false,
		},
		{
			id: "r6",
			content:
				"<p>Thanks everyone! This really clarifies when to use each protocol. I'm working on a chat app and think TCP is the right choice.</p>",
			author: "Alice Johnson",
			authorAvatar: "AJ",
			publishedAt: "2025-10-27T15:00:00Z",
			upvotes: 2,
			parentId: null,
			isUpvoted: false,
		},
	],
	"2": [
		{
			id: "r2-1",
			content:
				"<p>The three steps are: 1) SYN - client sends synchronize, 2) SYN-ACK - server acknowledges and sends its own synchronize, 3) ACK - client acknowledges the server's synchronize.</p>",
			author: "Network Expert",
			authorAvatar: "NE",
			publishedAt: "2025-10-26T15:00:00Z",
			upvotes: 15,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r2-2",
			content:
				"<p>To visualize: Client sends SYN(seq=x) → Server responds SYN-ACK(seq=y, ack=x+1) → Client responds ACK(seq=x+1, ack=y+1)</p>",
			author: "Visual Learner",
			authorAvatar: "VL",
			publishedAt: "2025-10-26T15:30:00Z",
			upvotes: 10,
			parentId: "r2-1",
			isUpvoted: false,
		},
		{
			id: "r2-3",
			content:
				"<p>This is also known as the connection establishment phase. It ensures both sides are ready to communicate.</p>",
			author: "TCP Guru",
			authorAvatar: "TG",
			publishedAt: "2025-10-26T16:00:00Z",
			upvotes: 6,
			parentId: "r2-2",
			isUpvoted: false,
		},
		{
			id: "r2-4",
			content:
				"<p>What happens if the third ACK is lost? Does the connection fail?</p>",
			author: "Curious Student",
			authorAvatar: "CS",
			publishedAt: "2025-10-26T16:30:00Z",
			upvotes: 3,
			parentId: "r2-3",
			isUpvoted: false,
		},
		{
			id: "r2-5",
			content:
				"<p>Good question! If the third ACK is lost, the server will retransmit the SYN-ACK after a timeout. The connection can still be established.</p>",
			author: "Professor Lee",
			authorAvatar: "PL",
			publishedAt: "2025-10-26T17:00:00Z",
			upvotes: 12,
			parentId: "r2-4",
			isUpvoted: true,
		},
	],
	"3": [
		{
			id: "r3-1",
			content:
				"<p>Always use context managers (with statements) to ensure sockets are properly closed, even if an error occurs.</p>",
			author: "Python Expert",
			authorAvatar: "PE",
			publishedAt: "2025-10-25T09:30:00Z",
			upvotes: 18,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r3-2",
			content:
				"<p>Set appropriate timeouts! The default is to wait forever, which can hang your application.</p>",
			author: "System Engineer",
			authorAvatar: "SE",
			publishedAt: "2025-10-25T10:00:00Z",
			upvotes: 15,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r3-3",
			content:
				"<p>What's a good timeout value? I've been using 30 seconds but not sure if that's appropriate.</p>",
			author: "Developer Mike",
			authorAvatar: "DM",
			publishedAt: "2025-10-25T10:30:00Z",
			upvotes: 4,
			parentId: "r3-2",
			isUpvoted: false,
		},
		{
			id: "r3-4",
			content:
				"<p>It depends on your use case. For HTTP requests, 30s is reasonable. For real-time apps, maybe 5-10s. For local network, 1-2s might be enough.</p>",
			author: "System Engineer",
			authorAvatar: "SE",
			publishedAt: "2025-10-25T11:00:00Z",
			upvotes: 8,
			parentId: "r3-3",
			isUpvoted: false,
		},
		{
			id: "r3-5",
			content:
				"<p>Handle SIGPIPE signals properly when the remote end closes the connection unexpectedly.</p>",
			author: "Unix Admin",
			authorAvatar: "UA",
			publishedAt: "2025-10-25T11:30:00Z",
			upvotes: 6,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r3-6",
			content:
				"<p>Use SO_REUSEADDR socket option to avoid 'Address already in use' errors during development.</p>",
			author: "Debug Master",
			authorAvatar: "DM",
			publishedAt: "2025-10-25T12:00:00Z",
			upvotes: 10,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r3-7",
			content:
				"<p>Is SO_REUSEADDR safe for production? I've heard mixed opinions.</p>",
			author: "Junior Dev",
			authorAvatar: "JD",
			publishedAt: "2025-10-25T12:30:00Z",
			upvotes: 2,
			parentId: "r3-6",
			isUpvoted: false,
		},
		{
			id: "r3-8",
			content:
				"<p>Yes, it's safe and commonly used. It allows rapid restart of services. Just understand what it does - it allows binding to a port in TIME_WAIT state.</p>",
			author: "Senior Dev",
			authorAvatar: "SD",
			publishedAt: "2025-10-25T13:00:00Z",
			upvotes: 7,
			parentId: "r3-7",
			isUpvoted: false,
		},
		{
			id: "r3-9",
			content:
				"<p>Don't forget to handle partial sends and receives! socket.send() might not send all your data at once.</p>",
			author: "Network Programmer",
			authorAvatar: "NP",
			publishedAt: "2025-10-25T13:30:00Z",
			upvotes: 12,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r3-10",
			content:
				"<p>Use sendall() instead of send() to ensure all data is transmitted.</p>",
			author: "Python Ninja",
			authorAvatar: "PN",
			publishedAt: "2025-10-25T14:00:00Z",
			upvotes: 9,
			parentId: "r3-9",
			isUpvoted: false,
		},
		{
			id: "r3-11",
			content:
				"<p>For production, consider using asyncio for better performance with many concurrent connections.</p>",
			author: "Performance Expert",
			authorAvatar: "PE",
			publishedAt: "2025-10-25T14:30:00Z",
			upvotes: 11,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r3-12",
			content:
				"<p>All great advice! I'm bookmarking this thread. Thanks everyone!</p>",
			author: "Charlie Brown",
			authorAvatar: "CB",
			publishedAt: "2025-10-25T15:00:00Z",
			upvotes: 3,
			parentId: null,
			isUpvoted: false,
		},
	],
	"4": [
		{
			id: "r4-1",
			content:
				"<p>Think of Layer 7 (Application) as what the user sees - HTTP, FTP, email. Layer 4 (Transport) is TCP/UDP managing the data flow. Layer 3 (Network) is IP routing packets. Layer 2 (Data Link) is Ethernet frames. Layer 1 (Physical) is the actual cables and signals.</p>",
			author: "Network Teacher",
			authorAvatar: "NT",
			publishedAt: "2025-10-24T17:00:00Z",
			upvotes: 14,
			parentId: null,
			isUpvoted: false,
		},
		{
			id: "r4-2",
			content:
				"<p>A helpful mnemonic: Please Do Not Throw Sausage Pizza Away (Physical, Data Link, Network, Transport, Session, Presentation, Application)</p>",
			author: "Study Buddy",
			authorAvatar: "SB",
			publishedAt: "2025-10-24T17:30:00Z",
			upvotes: 8,
			parentId: "r4-1",
			isUpvoted: false,
		},
		{
			id: "r4-3",
			content:
				"<p>In practice, you mostly work with Layers 3, 4, and 7. Understanding how they interact is more important than memorizing all seven layers.</p>",
			author: "Practical Engineer",
			authorAvatar: "PE",
			publishedAt: "2025-10-24T18:00:00Z",
			upvotes: 10,
			parentId: null,
			isUpvoted: false,
		},
	],
};

export function DiscussionPreview({ discussion }: DiscussionPreviewProps) {
	const [threadId, setThreadId] = useQueryState("threadId");
	const [action, setAction] = useQueryState("action");
	const [replyTo, setReplyTo] = useQueryState("replyTo");
	const [sortBy, setSortBy] = useState<string>("recent");

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
	if (threadId) {
		const thread = mockThreads.find((t) => t.id === threadId);
		if (!thread) {
			return (
				<Paper withBorder p="xl" radius="md">
					<Text c="red">Thread not found</Text>
				</Paper>
			);
		}

		return (
			<ThreadDetailView
				thread={thread}
				replies={mockReplies[threadId] || []}
				discussion={discussion}
				onBack={() => setThreadId(null)}
				action={action}
				setAction={setAction}
				replyTo={replyTo}
				setReplyTo={setReplyTo}
			/>
		);
	}

	// Show thread list view
	return (
		<ThreadListView
			threads={mockThreads}
			discussion={discussion}
			sortBy={sortBy}
			setSortBy={setSortBy}
			onThreadClick={(id) => setThreadId(id)}
			onCreateThread={() => setAction("createthread")}
			action={action}
			setAction={setAction}
		/>
	);
}

interface ThreadListViewProps {
	threads: DiscussionThread[];
	discussion: {
		id: number;
		instructions: string | null;
		requireThread: boolean | null;
		requireReplies: boolean | null;
		minReplies: number | null;
	};
	sortBy: string;
	setSortBy: (value: string) => void;
	onThreadClick: (id: string) => void;
	onCreateThread: () => void;
	action: string | null;
	setAction: (value: string | null) => void;
}

function ThreadListView({
	threads,
	discussion,
	sortBy,
	setSortBy,
	onThreadClick,
	onCreateThread,
	action,
	setAction,
}: ThreadListViewProps) {
	const [newThreadTitle, setNewThreadTitle] = useState("");
	const [newThreadContent, setNewThreadContent] = useState("");

	const handleCreateThread = () => {
		// TODO: Implement actual thread creation
		console.log("Creating thread:", { newThreadTitle, newThreadContent });
		setNewThreadTitle("");
		setNewThreadContent("");
		setAction(null);
	};

	const sortedThreads = [...threads].sort((a, b) => {
		switch (sortBy) {
			case "upvoted":
				return b.upvotes - a.upvotes;
			case "active":
				return b.replyCount - a.replyCount;
			case "recent":
			default:
				return (
					new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
				);
		}
	});

	if (action === "createthread") {
		return (
			<Paper withBorder p="xl" radius="md">
				<Stack gap="lg">
					<Group justify="space-between">
						<Title order={3}>Create New Thread</Title>
						<Button variant="default" onClick={() => setAction(null)}>
							Cancel
						</Button>
					</Group>

					<Textarea
						label="Thread Title"
						placeholder="Enter a descriptive title..."
						value={newThreadTitle}
						onChange={(e) => setNewThreadTitle(e.currentTarget.value)}
						required
					/>

					<Box>
						<Text size="sm" fw={500} mb="xs">
							Content
						</Text>
						<SimpleRichTextEditor
							content={newThreadContent}
							onChange={setNewThreadContent}
							placeholder="Write your thread content..."
						/>
					</Box>

					<Group justify="flex-end">
						<Button onClick={handleCreateThread}>Post Thread</Button>
					</Group>
				</Stack>
			</Paper>
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
								style={{ fontSize: "0.875rem", color: "var(--mantine-color-dimmed)" }}
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
						/>
					))}
				</Stack>
			</Stack>
		</Paper>
	);
}

interface ThreadCardProps {
	thread: DiscussionThread;
	onClick: () => void;
	allowUpvotes: boolean;
}

function ThreadCard({ thread, onClick, allowUpvotes }: ThreadCardProps) {
	const [isUpvoted, setIsUpvoted] = useState(thread.isUpvoted);
	const [upvoteCount, setUpvoteCount] = useState(thread.upvotes);

	const handleUpvote = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isUpvoted) {
			setUpvoteCount(upvoteCount - 1);
		} else {
			setUpvoteCount(upvoteCount + 1);
		}
		setIsUpvoted(!isUpvoted);
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
						<Tooltip label={isUpvoted ? "Remove upvote" : "Upvote"}>
							<ActionIcon
								variant={isUpvoted ? "filled" : "subtle"}
								color={isUpvoted ? "blue" : "gray"}
								onClick={handleUpvote}
							>
								{isUpvoted ? (
									<IconArrowBigUpFilled size={20} />
								) : (
									<IconArrowBigUp size={20} />
								)}
							</ActionIcon>
						</Tooltip>
						<Text size="sm" fw={500}>
							{upvoteCount}
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

interface ThreadDetailViewProps {
	thread: DiscussionThread;
	replies: DiscussionReply[];
	discussion: {
		id: number;
		instructions: string | null;
		requireThread: boolean | null;
		requireReplies: boolean | null;
		minReplies: number | null;
	};
	onBack: () => void;
	action: string | null;
	setAction: (value: string | null) => void;
	replyTo: string | null;
	setReplyTo: (value: string | null) => void;
}

function ThreadDetailView({
	thread,
	replies,
	onBack,
	action,
	setAction,
	replyTo,
	setReplyTo,
}: ThreadDetailViewProps) {
	const [replyContent, setReplyContent] = useState("");

	const handleReply = () => {
		// TODO: Implement actual reply
		console.log("Replying:", { replyTo, content: replyContent });
		setReplyContent("");
		setAction(null);
		setReplyTo(null);
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
						<Badge
							size="lg"
							color="yellow"
							leftSection={<IconPin size={14} />}
						>
							Pinned Thread
						</Badge>
					)}
					<Title order={2}>{thread.title}</Title>

					<Group gap="md">
						<Group gap="xs">
							<Avatar size="md" radius="xl">
								{thread.authorAvatar}
							</Avatar>
							<Stack gap={0}>
								<Text size="sm" fw={500}>
									{thread.author}
								</Text>
								<Text size="xs" c="dimmed">
									{dayjs(thread.publishedAt).fromNow()}
								</Text>
							</Stack>
						</Group>
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
							onClick={() => setAction("reply")}
						>
							Reply
						</Button>
					</Group>
				</Stack>

				<Divider />

				{/* Reply Form */}
				{action === "reply" && (
					<Paper withBorder p="md" radius="sm" bg="gray.0">
						<Stack gap="md">
							<Text size="sm" fw={500}>
								{replyTo ? "Replying to comment..." : "Write a reply"}
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
										setAction(null);
										setReplyTo(null);
									}}
								>
									Cancel
								</Button>
								<Button onClick={handleReply}>Post Reply</Button>
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
									setAction("reply");
								}}
								allowUpvotes={true}
								level={0}
							/>
						))}
				</Stack>
			</Stack>
		</Paper>
	);
}

interface ReplyCardProps {
	reply: DiscussionReply;
	allReplies: DiscussionReply[];
	onReply: (id: string) => void;
	allowUpvotes: boolean;
	level: number;
}

function ReplyCard({
	reply,
	allReplies,
	onReply,
	allowUpvotes,
	level,
}: ReplyCardProps) {
	const [isUpvoted, setIsUpvoted] = useState(reply.isUpvoted);
	const [upvoteCount, setUpvoteCount] = useState(reply.upvotes);
	const [opened, { toggle }] = useDisclosure(false); // false = collapsed by default

	const handleUpvote = () => {
		if (isUpvoted) {
			setUpvoteCount(upvoteCount - 1);
		} else {
			setUpvoteCount(upvoteCount + 1);
		}
		setIsUpvoted(!isUpvoted);
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
							<Avatar size="sm" radius="xl">
								{reply.authorAvatar}
							</Avatar>
							<Stack gap={0}>
								<Text size="sm" fw={500}>
									{reply.author}
								</Text>
								<Text size="xs" c="dimmed">
									{dayjs(reply.publishedAt).fromNow()}
								</Text>
							</Stack>
						</Group>

						{allowUpvotes && (
							<Group gap="xs">
								<ActionIcon
									variant={isUpvoted ? "filled" : "subtle"}
									color={isUpvoted ? "blue" : "gray"}
									size="sm"
									onClick={handleUpvote}
								>
									{isUpvoted ? (
										<IconArrowBigUpFilled size={16} />
									) : (
										<IconArrowBigUp size={16} />
									)}
								</ActionIcon>
								<Text size="sm">{upvoteCount}</Text>
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
							/>
						))}
					</Stack>
				</Collapse>
			)}
		</Box>
	);
}
