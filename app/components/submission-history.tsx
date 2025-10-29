import {
	Anchor,
	Badge,
	Box,
	Group,
	Paper,
	ScrollArea,
	Stack,
	Text,
	Typography,
} from "@mantine/core";
import { IconFile } from "@tabler/icons-react";
import { href } from "react-router";

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
					<Paper key={fileId} withBorder p="xs" bg="white">
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
			<Paper withBorder p="md" bg="white">
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
	submission,
	variant = "default",
}: {
	submission: SubmissionData;
	variant?: "default" | "compact";
}) {
	const content = submission.content || null;
	const attachments =
		submission.attachments && Array.isArray(submission.attachments)
			? submission.attachments
			: null;

	if (variant === "compact") {
		// Compact variant for assignment preview (student view)
		return (
			<Paper withBorder p="md" bg="gray.0">
				<Stack gap="sm">
					<Group justify="space-between">
						<Group gap="xs">
							<Text size="sm" fw={600}>
								Attempt {submission.attemptNumber}
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
										<Paper key={fileId} withBorder p="xs" bg="white">
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
		<Paper withBorder p="md" radius="sm" bg="gray.1">
			<Stack gap="md">
				<Group justify="space-between">
					<Group gap="sm">
						<Badge size="sm" variant="light">
							Attempt {submission.attemptNumber}
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
					</Group>
					{submission.submittedAt && (
						<Text size="sm" c="dimmed">
							{new Date(submission.submittedAt).toLocaleString()}
						</Text>
					)}
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
}: {
	submissions: SubmissionData[];
	variant?: "default" | "compact";
	title?: string;
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
			{sortedSubmissions.map((sub) => (
				<SubmissionHistoryItem key={sub.id} submission={sub} variant={variant} />
			))}
		</Stack>
	);
}

