import {
	ActionIcon,
	Badge,
	Group,
	Menu,
	Paper,
	Stack,
	Text,
} from "@mantine/core";
import { IconDots, IconPencil, IconTrash } from "@tabler/icons-react";
import { Link } from "react-router";
import { View } from "app/routes/course/module.$id.submissions/route";
import { getRouteUrl } from "~/utils/search-params-utils";
import type { AssignmentSubmissionData } from "app/routes/course/module.$id/components/assignment/assignment-submission-item";
import {
	Anchor,
	Box,
	ScrollArea,
	Tooltip,
	Typography,
} from "@mantine/core";
import { href } from "react-router";
import {
	formatFileSize,
	getFileIcon,
	getFileType,
	getFileTypeLabel,
} from "~/utils/file-types";

// ============================================================================
// Shared Components
// ============================================================================

export function SubmissionAttachments({
	attachments,
}: {
	attachments: Array<{
		file:
		| number
		| {
			id: number;
			filename?: string | null;
			mimeType?: string | null;
			filesize?: number | null;
		};
		description?: string;
	}>;
}) {
	return (
		<Stack gap="xs">
			<Text size="sm" fw={500}>
				Attachments ({attachments.length}):
			</Text>
			{attachments.map((attachment) => {
				const file = attachment.file;
				const fileId = typeof file === "object" ? file.id : file;
				const filename =
					typeof file === "object"
						? file.filename || `File ${fileId}`
						: `File ${fileId}`;
				const mimeType = typeof file === "object" ? file.mimeType : null;
				const filesize = typeof file === "object" ? file.filesize : null;
				const fileType = getFileType(filename, mimeType);
				const FileIcon = getFileIcon(fileType);

				return (
					<Paper key={fileId} withBorder p="xs">
						<Group gap="xs" wrap="nowrap">
							<Tooltip label={getFileTypeLabel(fileType)}>
								<Box>
									<FileIcon size={16} />
								</Box>
							</Tooltip>
							<Box style={{ flex: 1, minWidth: 0 }}>
								<Anchor
									href={href("/api/media/file/:mediaId", {
										mediaId: fileId.toString(),
									})}
									target="_blank"
									size="sm"
									style={{
										display: "block",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{filename}
								</Anchor>
								<Group gap="xs">
									{filesize && (
										<Text size="xs" c="dimmed">
											{formatFileSize(filesize)}
										</Text>
									)}
									{attachment.description && (
										<Text size="xs" c="dimmed">
											• {attachment.description}
										</Text>
									)}
								</Group>
							</Box>
						</Group>
					</Paper>
				);
			})}
		</Stack>
	);
}

export function SubmissionContentPreview({ content }: { content: string }) {
	return (
		<Box>
			<Text size="sm" fw={500} mb="xs">
				Submission Content:
			</Text>
			<Paper withBorder p="md">
				<ScrollArea.Autosize mah={400}>
					<Typography
						className="tiptap"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from user submission
						dangerouslySetInnerHTML={{ __html: content }}
						style={{ fontSize: "0.875rem" }}
					/>
				</ScrollArea.Autosize>
			</Paper>
		</Box>
	);
}



// ============================================================================
// Components
// ============================================================================

export function AssignmentSubmissionItemInTable({
	attemptNumber,
	submission,
	showDelete = false,
	onDelete,
	showGrade = false,
	moduleLinkId,
}: {
	attemptNumber: number;
	submission: AssignmentSubmissionData;
	showDelete?: boolean;
	onDelete?: (submissionId: number) => void;
	showGrade?: boolean;
	moduleLinkId?: number;
}) {
	const content = submission.content || null;
	const attachments =
		submission.attachments && Array.isArray(submission.attachments)
			? submission.attachments
			: null;

	return (
		<Paper withBorder p="md" radius="sm">
			<Stack gap="md">
				<Group justify="space-between">
					<Group gap="sm">
						<Badge size="sm" variant="light">
							Attempt {attemptNumber}
						</Badge>
						<Badge
							color={
								submission.status === "graded"
									? "green"
									: submission.status === "submitted"
										? "blue"
										: submission.status === "returned"
											? "orange"
											: "gray"
							}
							variant="light"
						>
							{submission.status}
						</Badge>
						{submission.status === "graded" &&
							submission.grade?.baseGrade !== null &&
							submission.grade?.baseGrade !== undefined && (
								<Badge color="green" variant="filled">
									{submission.grade.maxGrade !== null &&
										submission.grade.maxGrade !== undefined
										? `${submission.grade.baseGrade}/${submission.grade.maxGrade}`
										: submission.grade.baseGrade}
								</Badge>
							)}
						<Text size="xs" c="dimmed">
							ID: {submission.id}
						</Text>
					</Group>
					<Group gap="sm">
						{submission.startedAt && (
							<Text size="sm" c="dimmed">
								Started: {new Date(submission.startedAt).toLocaleString()}
							</Text>
						)}
						{submission.submittedAt && (
							<Text size="sm" c="dimmed">
								{submission.startedAt ? "• " : ""}
								Submitted: {new Date(submission.submittedAt).toLocaleString()}
							</Text>
						)}
						{submission.status === "graded" && submission.grade?.gradedAt && (
							<Text size="sm" c="dimmed">
								{submission.startedAt || submission.submittedAt ? "• " : ""}
								Graded: {new Date(submission.grade.gradedAt).toLocaleString()}
							</Text>
						)}
						{(showDelete || showGrade) && (
							<Menu position="bottom-end" shadow="md">
								<Menu.Target>
									<ActionIcon variant="light" aria-label="Actions">
										<IconDots size={16} />
									</ActionIcon>
								</Menu.Target>
								<Menu.Dropdown>
									{showGrade && moduleLinkId && (
										<Menu.Item
											component={Link}
											to={getRouteUrl(
												"/course/module/:moduleLinkId/submissions",
												{
													params: { moduleLinkId: moduleLinkId.toString() },
													searchParams: {
														action: null,
														view: View.GRADING,
														submissionId: submission.id,
													},
												},
											)}
											leftSection={<IconPencil size={16} />}
										>
											Grade
										</Menu.Item>
									)}
									{showDelete && onDelete && (
										<Menu.Item
											color="red"
											leftSection={<IconTrash size={16} />}
											onClick={() => onDelete(submission.id)}
										>
											Delete
										</Menu.Item>
									)}
								</Menu.Dropdown>
							</Menu>
						)}
					</Group>
				</Group>

				{content && <SubmissionContentPreview content={content} />}

				{attachments && attachments.length > 0 && (
					<SubmissionAttachments attachments={attachments} />
				)}
			</Stack>
		</Paper>
	);
}
