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
import { useState } from "react";
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
	id: number;
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
	id: number;
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
