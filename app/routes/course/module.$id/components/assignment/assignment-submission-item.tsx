import {
	Anchor,
	Badge,
	Box,
	Group,
	Paper,
	Stack,
	Text,
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
// Types
// ============================================================================

export interface AssignmentSubmissionData {
	id: number;
	status: "draft" | "submitted" | "graded" | "returned";
	content?: string | null;
	submittedAt?: string | null;
	startedAt?: string | null;
	attemptNumber: number;
	attachments?: Array<{
		file:
			| number
			| {
					id: number;
					filename?: string | null;
					mimeType?: string | null;
					filesize?: number | null;
			  };
		description?: string;
	}> | null;
	grade?: {
		baseGrade: number | null;
		maxGrade: number | null;
		gradedAt?: string | null;
	} | null;
}

// ============================================================================
// Components
// ============================================================================

export function AssignmentSubmissionItem({
	attemptNumber,
	submission,
}: {
	attemptNumber: number;
	submission: AssignmentSubmissionData;
}) {
	const content = submission.content || null;
	const attachments =
		submission.attachments && Array.isArray(submission.attachments)
			? submission.attachments
			: null;

	return (
		<Paper withBorder p="md">
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
						{submission.status === "graded" &&
							submission.grade?.baseGrade !== null &&
							submission.grade?.baseGrade !== undefined && (
								<Badge color="green" size="sm" variant="filled">
									{submission.grade.maxGrade !== null &&
									submission.grade.maxGrade !== undefined
										? `${submission.grade.baseGrade}/${submission.grade.maxGrade}`
										: submission.grade.baseGrade}
								</Badge>
							)}
					</Group>
					<Group gap="xs">
						{submission.startedAt && (
							<Text size="xs" c="dimmed">
								Started: {new Date(submission.startedAt).toLocaleString()}
							</Text>
						)}
						{submission.submittedAt && (
							<Text size="xs" c="dimmed">
								{submission.startedAt ? "• " : ""}
								Submitted: {new Date(submission.submittedAt).toLocaleString()}
							</Text>
						)}
						{submission.status === "graded" && submission.grade?.gradedAt && (
							<Text size="xs" c="dimmed">
								{submission.startedAt || submission.submittedAt ? "• " : ""}
								Graded: {new Date(submission.grade.gradedAt).toLocaleString()}
							</Text>
						)}
					</Group>
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
								const file = attachment.file;
								const fileId = typeof file === "object" ? file.id : file;
								const filename =
									typeof file === "object"
										? file.filename || `File ${fileId}`
										: `File ${fileId}`;
								const mimeType =
									typeof file === "object" ? file.mimeType : null;
								const filesize =
									typeof file === "object" ? file.filesize : null;
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
					</div>
				)}
			</Stack>
		</Paper>
	);
}
