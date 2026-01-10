import {
	Avatar,
	Badge,
	Button,
	Divider,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Title,
	Typography,
} from "@mantine/core";
import { IconMessage, IconPin, IconPlus } from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { href, Link } from "react-router";
import type {
	DiscussionData,
	DiscussionThread,
} from "~/components/activity-modules-preview/discussion-preview";
import { DiscussionActions } from "../route";
import { CreateThreadFormWrapper } from "./create-thread-form-wrapper";
import { ThreadUpvoteDownVoteButton } from "./thread-upvote-button";
import { useNuqsSearchParams } from "app/utils/search-params-utils";
import { loaderSearchParams } from "../route";
import type { inferParserType } from "nuqs";

dayjs.extend(relativeTime);

interface DiscussionThreadListViewProps {
	threads: DiscussionThread[];
	discussion: DiscussionData;
	moduleLinkId: number;
	courseId: number;
	view: inferParserType<typeof loaderSearchParams>["view"];
	sortBy: inferParserType<typeof loaderSearchParams>["sortBy"];
}

export function DiscussionThreadListView({
	threads,
	discussion,
	moduleLinkId,
	courseId,
	view,
	sortBy,
}: DiscussionThreadListViewProps) {
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);

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

	if (view === DiscussionActions.CREATE_THREAD) {
		return (
			<CreateThreadFormWrapper
				moduleLinkId={moduleLinkId}
				onCancel={() => setQueryParams({ view: null })}
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
					<Button
						leftSection={<IconPlus size={16} />}
						onClick={() =>
							setQueryParams({ view: DiscussionActions.CREATE_THREAD })
						}
					>
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
						onChange={(value) => {
							if (
								value === "recent" ||
								value === "upvoted" ||
								value === "active"
							) {
								setQueryParams({ sortBy: value });
							} else {
								setQueryParams({ sortBy: "recent" });
							}
						}}
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
						<Paper
							key={thread.id}
							withBorder
							p="md"
							radius="sm"
							style={{ cursor: "pointer" }}
							onClick={() => setQueryParams({ threadId: Number(thread.id) })}
						>
							<Group align="flex-start" gap="md" wrap="nowrap">
								{/* Upvote Section */}
								<ThreadUpvoteDownVoteButton
									thread={thread}
									moduleLinkId={moduleLinkId}
								/>

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
										<Link
											to={
												courseId && thread.authorId
													? href("/course/:courseId/participants/profile", {
															courseId: String(courseId),
														}) + `?userId=${thread.authorId}`
													: "#"
											}
											style={{ textDecoration: "none", color: "inherit" }}
											onClick={(e) => e.stopPropagation()}
										>
											<Group gap="xs">
												<Avatar size="sm" radius="xl">
													{thread.authorAvatar}
												</Avatar>
												<Text size="sm" style={{ cursor: "pointer" }}>
													{thread.author}
												</Text>
											</Group>
										</Link>
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
					))}
				</Stack>
			</Stack>
		</Paper>
	);
}
