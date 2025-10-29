import {
	ActionIcon,
	Anchor,
	Badge,
	Box,
	Group,
	Menu,
	Paper,
	ScrollArea,
	Stack,
	Text,
	Typography,
} from "@mantine/core";
import { IconDots, IconFile, IconPencil, IconTrash } from "@tabler/icons-react";
import { href, Link } from "react-router";

// ============================================================================
// Types
// ============================================================================

export interface SubmissionData {
	id: number;
	status: "draft" | "submitted" | "graded" | "returned";
	content?: string | null;
	submittedAt?: string | null;
	attemptNumber: number;
	attachments?: Array<{
		file: number | { id: number; filename: string };
		description?: string;
	}> | null;
}

// ============================================================================
// Sub-components
// ============================================================================

function SubmissionAttachments({
	attachments,
}: {
	attachments: Array<{
		file: number | { id: number; filename: string };
		description?: string;
	}>;
}) {
	return (
		<Stack gap="xs">
			<Text size="sm" fw={500}>
				Attachments ({attachments.length}):
			</Text>
			{attachments.map((attachment) => {
				const fileId =
					typeof attachment.file === "object"
						? attachment.file.id
						: attachment.file;
				const filename =
					typeof attachment.file === "object"
						? attachment.file.filename
						: `File ${fileId}`;

				return (
					<Paper key={fileId} withBorder p="xs" >
						<Group gap="xs">
							<IconFile size={16} />
							<Anchor
								href={href("/api/media/file/:filenameOrId", {
									filenameOrId: fileId.toString(),
								})}
								target="_blank"
								size="sm"
							>
								{filename}
							</Anchor>
							{attachment.description && (
								<Text size="xs" c="dimmed">
									- {attachment.description}
								</Text>
							)}
						</Group>
					</Paper>
				);
			})}
		</Stack>
	);
}

function SubmissionContentPreview({ content }: { content: string }) {
	return (
		<Box>
			<Text size="sm" fw={500} mb="xs">
				Submission Content:
			</Text>
			<Paper withBorder p="md" >
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

export function SubmissionHistoryItem({
	attemptNumber,
	submission,
	variant = "default",
	showDelete = false,
	onDelete,
	showGrade = false,
	moduleLinkId,
}: {

	attemptNumber: number;
	submission: SubmissionData;
	variant?: "default" | "compact";
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

	if (variant === "compact") {
		// Compact variant for assignment preview (student view)
		return (
			<Paper withBorder p="md" >
				<Stack gap="sm">
					<Group justify="space-between">
						<Group gap="xs">
							<Text size="sm" fw={600}>
								Attempt {attemptNumber}
							</Text>
							{submission.status === "draft" && (
								<Badge color="gray" size="sm">
									Draft
								</Badge>
							)}
							{submission.status === "submitted" && (
								<Badge color="blue" size="sm">
									Submitted
								</Badge>
							)}
							{submission.status === "graded" && (
								<Badge color="green" size="sm">
									Graded
								</Badge>
							)}
							{submission.status === "returned" && (
								<Badge color="orange" size="sm">
									Returned
								</Badge>
							)}
						</Group>
						{submission.submittedAt && (
							<Text size="xs" c="dimmed">
								{new Date(submission.submittedAt).toLocaleString()}
							</Text>
						)}
					</Group>
					{content && (
						<div>
							<Text size="xs" fw={500} c="dimmed" mb="xs">
								Text Submission:
							</Text>
							<Typography
								className="tiptap"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from user submission
								dangerouslySetInnerHTML={{ __html: content }}
								style={{
									fontSize: "0.9em",
									maxHeight: "200px",
									overflowY: "auto",
								}}
							/>
						</div>
					)}
					{attachments && attachments.length > 0 && (
						<div>
							<Text size="xs" fw={500} c="dimmed" mb="xs">
								Attached Files ({attachments.length}):
							</Text>
							<Stack gap="xs">
								{attachments.map((attachment) => {
									const fileId =
										typeof attachment.file === "object"
											? attachment.file.id
											: attachment.file;
									const filename =
										typeof attachment.file === "object"
											? attachment.file.filename
											: `File ${fileId}`;

									return (
										<Paper key={fileId} withBorder p="xs" >
											<Group gap="xs">
												<IconFile size={16} />
												<Anchor
													href={href("/api/media/file/:filenameOrId", {
														filenameOrId: fileId.toString(),
													})}
													target="_blank"
													size="sm"
												>
													{filename}
												</Anchor>
												{attachment.description && (
													<Text size="xs" c="dimmed">
														- {attachment.description}
													</Text>
												)}
											</Group>
										</Paper>
									);
								})}
							</Stack>
						</div>
					)}
				</Stack>
			</Paper>
		);
	}

	// Default variant for submissions page (instructor view)
	return (
		<Paper withBorder p="md" radius="sm" >
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
						<Text size="xs" c="dimmed">
							ID: {submission.id}
						</Text>
					</Group>
					<Group gap="sm">
						{submission.submittedAt && (
							<Text size="sm" c="dimmed">
								{new Date(submission.submittedAt).toLocaleString()}
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
											to={
												href("/course/module/:id/grading", {
													id: moduleLinkId.toString(),
												}) + `?submissionId=${submission.id}`
											}
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

export function SubmissionHistory({
	submissions,
	variant = "default",
	title = "Submission History",
	showDelete = false,
	onDelete,
	showGrade = false,
	moduleLinkId,
}: {
	submissions: SubmissionData[];
	variant?: "default" | "compact";
	title?: string;
	showDelete?: boolean;
	onDelete?: (submissionId: number) => void;
	showGrade?: boolean;
	moduleLinkId?: number;
}) {
	if (submissions.length === 0) {
		return null;
	}

	const sortedSubmissions = [...submissions].sort(
		(a, b) => b.attemptNumber - a.attemptNumber,
	);

	return (
		<Stack gap="md">
			<Text size="lg" fw={600}>
				{title}
			</Text>
			{/* sort by submittedAt descending */}
			{sortedSubmissions.sort((a, b) => {
				const dateA = a.submittedAt ? new Date(a.submittedAt) : new Date(0);
				const dateB = b.submittedAt ? new Date(b.submittedAt) : new Date(0);
				return dateB.getTime() - dateA.getTime();
			}).map((sub, index) => (
				<SubmissionHistoryItem
					key={sub.id}
					attemptNumber={sortedSubmissions.length - index}
					submission={sub}
					variant={variant}
					showDelete={showDelete}
					onDelete={onDelete}
					showGrade={showGrade}
					moduleLinkId={moduleLinkId}
				/>
			))}
		</Stack>
	);
}

