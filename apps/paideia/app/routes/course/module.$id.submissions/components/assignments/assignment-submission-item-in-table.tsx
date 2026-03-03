import {
	ActionIcon,
	Badge,
	Group,
	Menu,
	Paper,
	Stack,
	Text,
} from "@mantine/core";
import { IconDots, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import {
	Link,
	useLoaderData,
	useMatches,
	useRouteLoaderData,
} from "react-router";
import type { Route } from "app/routes/course/module.$id.submissions/route";
import { useRemoveGrade } from "app/routes/course/module.$id.submissions/route";
import { Anchor, Box, ScrollArea, Tooltip, Typography } from "@mantine/core";
import { getRouteUrl } from "app/utils/router/search-params-utils";
import {
	formatFileSize,
	getFileIcon,
	getFileType,
	getFileTypeLabel,
} from "~/utils/file-types";

// ============================================================================
// Types
// ============================================================================

type AssignmentListLoaderData = Extract<
	Route.ComponentProps["loaderData"],
	{ mode: "list"; moduleType: "assignment" }
>;

type AssignmentSubmissionData = NonNullable<
	AssignmentListLoaderData["submissions"]
>[number];

type AttachmentItem = {
	file:
		| number
		| {
				id: number;
				filename?: string | null;
				mimeType?: string | null;
				filesize?: number | null;
				url?: string | null;
		  };
	description?: string | null;
	id?: string | null;
};

// ============================================================================
// Shared Components
// ============================================================================

function SubmissionAttachments({
	attachments,
}: {
	attachments: Array<AttachmentItem>;
}) {
	const matches = useMatches() as Route.ComponentProps["matches"];
	const {
		loaderData: { enableDebugLogs },
	} = matches[0];
	const loaderData = useLoaderData<Route.ComponentProps["loaderData"]>();

	return (
		<Stack gap="xs">
			<Text size="sm" fw={500}>
				Attachments ({attachments.length}):
			</Text>
			{/* Debug view */}
			{enableDebugLogs && (
				<Paper withBorder p="xs" style={{ backgroundColor: "#f8f9fa" }}>
					<Text size="xs" c="dimmed" fw={500} mb="xs">
						Debug Info:
					</Text>
					<Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
						Loader Mode: {loaderData.mode}
						<br />
						Module Type:{" "}
						{"moduleType" in loaderData ? loaderData.moduleType : "N/A"}
						<br />
						Attachments Type: {typeof attachments}
						<br />
						Attachments Length: {attachments.length}
					</Text>
				</Paper>
			)}
			{attachments.map((attachment) => {
				const file = attachment.file;
				const fileId = typeof file === "object" ? file.id : file;
				const filename =
					typeof file === "object"
						? (file.filename ?? `File ${fileId}`)
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
									href={getRouteUrl("/api/media/file/:mediaId", {
										params: { mediaId: fileId.toString() },
										searchParams: {},
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
	const { submit: removeGrade, isLoading: isRemovingGrade } = useRemoveGrade();

	const content = submission.content || null;
	const attachments =
		submission.attachments && Array.isArray(submission.attachments)
			? submission.attachments
			: null;

	const startedAt =
		"startedAt" in submission &&
		submission.startedAt &&
		typeof submission.startedAt === "string"
			? submission.startedAt
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
						{startedAt && (
							<Text size="sm" c="dimmed">
								Started: {new Date(startedAt).toLocaleString()}
							</Text>
						)}
						{submission.submittedAt && (
							<Text size="sm" c="dimmed">
								{startedAt ? "• " : ""}
								Submitted: {new Date(submission.submittedAt).toLocaleString()}
							</Text>
						)}
						{submission.status === "graded" && submission.grade?.gradedAt && (
							<Text size="sm" c="dimmed">
								{startedAt || submission.submittedAt ? "• " : ""}
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
												"/course/module/:moduleLinkId/submissions/:submissionId",
												{
													params: {
														moduleLinkId: moduleLinkId.toString(),
														submissionId: submission.id.toString(),
													},
												},
											)}
											leftSection={<IconPencil size={16} />}
										>
											Grade
										</Menu.Item>
									)}
									{showGrade &&
										moduleLinkId &&
										submission.status === "graded" &&
										submission.grade?.baseGrade !== null &&
										submission.grade?.baseGrade !== undefined && (
											<Menu.Item
												color="red"
												leftSection={<IconX size={16} />}
												disabled={isRemovingGrade}
												onClick={async () => {
													if (
														!window.confirm(
															"Are you sure you want to unset the grade? This action cannot be undone.",
														)
													)
														return;
													await removeGrade({
														params: {
															moduleLinkId,
														},
														values: {
															submissionId: submission.id,
														},
													});
												}}
											>
												Unset Grade
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
