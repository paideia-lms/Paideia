import {
	Alert,
	Button,
	Group,
	Paper,
	Stack,
	Text,
	Title,
	Typography,
} from "@mantine/core";
import { Dropzone, MIME_TYPES } from "@mantine/dropzone";
import {
	IconAlertCircle,
	IconAlertTriangle,
	IconCloudUpload,
	IconFileUpload,
	IconInfoCircle,
	IconPlus,
	IconX,
} from "@tabler/icons-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";

interface AssignmentPreviewProps {
	assignment: {
		id: number;
		instructions: string | null;
		dueDate: string | null;
		maxAttempts: number | null;
		allowLateSubmissions: boolean | null;
		requireTextSubmission: boolean | null;
		requireFileSubmission: boolean | null;
		maxFileSize?: number | null;
		maxFiles?: number | null;
		allowedFileTypes?: Array<{
			extension: string;
			mimeType: string;
		}> | null;
	} | null;
}

interface FileWithId {
	id: string;
	file: File;
}

export function AssignmentPreview({ assignment }: AssignmentPreviewProps) {
	const [action, setAction] = useQueryState("action");
	const [textContent, setTextContent] = useState("");
	const [files, setFiles] = useState<FileWithId[]>([]);

	const showSubmissionForm = action === "editsubmission";

	const handleCloseForm = () => {
		setAction(null);
		setTextContent("");
		setFiles([]);
	};

	const handleSubmit = () => {
		// TODO: Implement actual submission logic
		const fileData = files.map((f) => f.file);
		console.log("Submitting:", { textContent, files: fileData });
		handleCloseForm();
	};

	if (!assignment) {
		return (
			<Paper withBorder p="xl" radius="md">
				<Stack gap="md">
					<Title order={3}>Assignment Preview</Title>
					<Text c="dimmed">No assignment data available.</Text>
				</Stack>
			</Paper>
		);
	}

	const hasSubmissionTypes =
		assignment.requireTextSubmission || assignment.requireFileSubmission;


	// Show submission form when in edit mode
	if (showSubmissionForm) {
		return (
			<Paper withBorder p="xl" radius="md">
				<Stack gap="lg">
					<Group justify="space-between" align="flex-start">
						<Title order={3}>Submit Assignment</Title>
						<Button variant="default" onClick={handleCloseForm}>
							Cancel
						</Button>
					</Group>

					{!hasSubmissionTypes &&
						<Stack gap="md">
							<Title order={3}>Assignment</Title>
							<Alert
								icon={<IconAlertTriangle size={16} />}
								title="No Submission Required"
								color="yellow"
							>
								This assignment does not require any submissions. Please check the
								instructions or contact your instructor.
							</Alert>
						</Stack>
					}

					{assignment.requireTextSubmission && (
						<div>
							<Text size="sm" fw={500} mb="xs">
								Text Submission
							</Text>
							<SimpleRichTextEditor
								content={textContent}
								onChange={setTextContent}
								placeholder="Enter your submission text..."
							/>
						</div>
					)}

					{assignment.requireFileSubmission && (
						<div>
							<Text size="sm" fw={500} mb="xs">
								File Submission
							</Text>
							<Dropzone
								onDrop={(acceptedFiles) => {
									const newFiles = acceptedFiles.map((file) => ({
										id: `${file.name}-${Date.now()}-${Math.random()}`,
										file,
									}));
									setFiles([...files, ...newFiles]);
								}}
								maxSize={assignment.maxFileSize || 5 * 1024 * 1024} // Default 5MB
								maxFiles={assignment.maxFiles || 10}
								accept={
									assignment.allowedFileTypes?.length
										? assignment.allowedFileTypes.map((type) => type.mimeType)
										: [MIME_TYPES.pdf, MIME_TYPES.docx, MIME_TYPES.png, MIME_TYPES.jpeg]
								}
							>
								<Group
									justify="center"
									gap="xl"
									style={{ minHeight: 120, pointerEvents: "none" }}
								>
									<Dropzone.Accept>
										<IconFileUpload size={52} stroke={1.5} />
									</Dropzone.Accept>
									<Dropzone.Reject>
										<IconX size={52} stroke={1.5} />
									</Dropzone.Reject>
									<Dropzone.Idle>
										<IconCloudUpload size={52} stroke={1.5} />
									</Dropzone.Idle>

									<div>
										<Text size="xl" inline>
											Drag files here or click to select
										</Text>
										<Text size="sm" c="dimmed" inline mt={7}>
											{assignment.maxFiles
												? `Maximum ${assignment.maxFiles} files`
												: "Attach your files"}
										</Text>
									</div>
								</Group>
							</Dropzone>

							{files.length > 0 && (
								<Stack gap="xs" mt="sm">
									{files.map((fileWithId) => (
										<Paper key={fileWithId.id} withBorder p="xs">
											<Group justify="space-between">
												<Text size="sm">{fileWithId.file.name}</Text>
												<Button
													size="xs"
													variant="subtle"
													color="red"
													onClick={() =>
														setFiles(files.filter((f) => f.id !== fileWithId.id))
													}
												>
													Remove
												</Button>
											</Group>
										</Paper>
									))}
								</Stack>
							)}
						</div>
					)}

					{hasSubmissionTypes && <Group justify="flex-end" mt="md">
						<Button onClick={handleSubmit}>Submit</Button>
					</Group>}
				</Stack>
			</Paper>
		);
	}

	// Show instructions view with "Add Submission" button
	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="lg">
				<Group justify="space-between" align="flex-start">
					<Title order={3}>Assignment Instructions</Title>
					<Button
						leftSection={<IconPlus size={16} />}
						onClick={() => setAction("editsubmission")}
					>
						Add Submission
					</Button>
				</Group>

				{assignment.instructions && (
					<Typography
						className="tiptap"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
						dangerouslySetInnerHTML={{ __html: assignment.instructions }}
						style={{
							minHeight: "100px",
							lineHeight: "1.6",
						}}
					/>
				)}

				{!assignment.instructions && (
					<Text c="dimmed">No instructions provided.</Text>
				)}
			</Stack>
		</Paper>
	);
}
