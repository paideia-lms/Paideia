import {
	Alert,
	Button,
	Group,
	Input,
	Modal,
	Paper,
	Stack,
	Text,
	Title,
	Typography,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import {
	IconAlertTriangle,
	IconCloudUpload,
	IconFileUpload,
	IconInfoCircle,
	IconPlus,
	IconX,
} from "@tabler/icons-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { getMimeTypesArray } from "~/utils/file-types";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { AssignmentActions } from "~/utils/module-actions";
import { isHtmlEmpty } from "../rich-text-editor";
import { SimpleRichTextEditor } from "../simple-rich-text-editor";
import type { SubmissionData } from "../submission-history";

// ============================================================================
// Types
// ============================================================================

interface AssignmentData {
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
}

interface AssignmentPreviewProps {
	assignment: AssignmentData | null;
	submission?: {
		id: number;
		status: "draft" | "submitted" | "graded" | "returned";
		content?: string | null;
		attachments?: Array<{
			file: number;
			description?: string;
		}> | null;
		submittedAt?: string | null;
		attemptNumber?: number;
	} | null;
	allSubmissions?: SubmissionData[];
	onSubmit?: (data: {
		textContent: string;
		files: File[];
	}) => void | Promise<void>;
	isSubmitting?: boolean;
	canSubmit?: boolean;
}

interface FileWithId {
	id: string;
	file: File;
}

// ============================================================================
// Sub-components
// ============================================================================

function FileUploadZone({
	assignment,
	files,
	onFilesChange,
}: {
	assignment: AssignmentData;
	files: FileWithId[];
	onFilesChange: (files: FileWithId[]) => void;
}) {
	const handleDrop = (acceptedFiles: File[]) => {
		const newFiles = acceptedFiles.map((file) => ({
			id: `${file.name}-${Date.now()}-${Math.random()}`,
			file,
		}));
		onFilesChange([...files, ...newFiles]);
	};

	const handleRemoveFile = (fileId: string) => {
		onFilesChange(files.filter((f) => f.id !== fileId));
	};

	// Convert maxFileSize from MB to bytes
	const maxFileSizeBytes = (assignment.maxFileSize ?? 10) * 1024 * 1024;
	const maxFiles = assignment.maxFiles ?? 5;
	const acceptedMimeTypes = getMimeTypesArray(
		assignment.allowedFileTypes ?? null,
	);

	// Get list of allowed extensions for display
	const allowedExtensions = assignment.allowedFileTypes?.length
		? assignment.allowedFileTypes.map((ft) => ft.extension).join(", ")
		: ".pdf, .docx, .png, .jpeg";

	return (
		<div>
			<Text size="sm" fw={500} mb="xs">
				File Submission
			</Text>
			<Dropzone
				onDrop={handleDrop}
				maxSize={maxFileSizeBytes}
				maxFiles={maxFiles}
				accept={acceptedMimeTypes}
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
							Max {maxFiles} file{maxFiles !== 1 ? "s" : ""}, up to{" "}
							{assignment.maxFileSize ?? 10}MB each
						</Text>
						<Text size="xs" c="dimmed" mt={4}>
							Allowed types: {allowedExtensions}
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
									onClick={() => handleRemoveFile(fileWithId.id)}
								>
									Remove
								</Button>
							</Group>
						</Paper>
					))}
				</Stack>
			)}
		</div>
	);
}

function SubmissionConfirmModal({
	opened,
	assignment,
	textContent,
	files,
	isSubmitting,
	onConfirm,
	onCancel,
}: {
	opened: boolean;
	assignment: AssignmentData;
	textContent: string;
	files: FileWithId[];
	isSubmitting: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<Modal
			opened={opened}
			onClose={onCancel}
			title="Confirm Submission"
			size="lg"
		>
			<Stack gap="lg">
				<Text>Please review your submission before confirming:</Text>

				{assignment.requireTextSubmission && textContent && (
					<div>
						<Text size="sm" fw={500} mb="xs">
							Text Submission:
						</Text>
						<Paper withBorder p="md" bg="gray.0">
							<Typography
								className="tiptap"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from user input
								dangerouslySetInnerHTML={{ __html: textContent }}
								style={{
									maxHeight: "300px",
									overflowY: "auto",
								}}
							/>
						</Paper>
					</div>
				)}

				{assignment.requireFileSubmission && files.length > 0 && (
					<div>
						<Text size="sm" fw={500} mb="xs">
							Files ({files.length}):
						</Text>
						<Stack gap="xs">
							{files.map((fileWithId) => (
								<Paper key={fileWithId.id} withBorder p="xs">
									<Text size="sm">
										{fileWithId.file.name} (
										{(fileWithId.file.size / 1024).toFixed(2)} KB)
									</Text>
								</Paper>
							))}
						</Stack>
					</div>
				)}

				<Group justify="flex-end" mt="md">
					<Button variant="default" onClick={onCancel} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button onClick={onConfirm} loading={isSubmitting}>
						Confirm & Submit
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

interface SubmissionFormValues {
	textContent: string;
}

function TextSubmissionField({
	form,
}: {
	form: ReturnType<typeof useForm<SubmissionFormValues>>;
}) {
	const textContent = useFormWatchForceUpdate(form, "textContent");

	return (
		<Input.Wrapper label="Text Submission">
			<SimpleRichTextEditor
				content={textContent || ""}
				onChange={(html) => {
					form.setFieldValue("textContent", html);
				}}
				placeholder="Enter your submission text..."
				showStatus
			/>
		</Input.Wrapper>
	);
}

function SubmissionForm({
	assignment,
	isSubmitting,
	onClose,
	onSubmit,
}: {
	assignment: AssignmentData;
	isSubmitting: boolean;
	onClose: () => void;
	onSubmit: (data: {
		textContent: string;
		files: File[];
	}) => void | Promise<void>;
}) {
	const form = useForm<SubmissionFormValues>({
		mode: "uncontrolled",
		initialValues: {
			textContent: "",
		},
	});

	const [confirmModalOpened, setConfirmModalOpened] = useState(false);
	const [files, setFiles] = useState<FileWithId[]>([]);

	const hasSubmissionTypes =
		assignment.requireTextSubmission || assignment.requireFileSubmission;

	const handleShowConfirmModal = () => {
		const textContent = form.getValues().textContent;
		const hasText = !isHtmlEmpty(textContent);
		const hasFiles = files.length > 0;

		if (!hasText && !hasFiles) {
			return;
		}

		setConfirmModalOpened(true);
	};

	const handleConfirmSubmit = async () => {
		const textContent = form.getValues().textContent;
		const fileData = files.map((f) => f.file);
		await onSubmit({ textContent, files: fileData });
		setConfirmModalOpened(false);
		onClose();
	};

	return (
		<>
			<Paper withBorder p="xl" radius="md">
				<Stack gap="lg">
					<Group justify="space-between" align="flex-start">
						<Title order={3}>Submit Assignment</Title>
						<Button variant="default" onClick={onClose}>
							Cancel
						</Button>
					</Group>

					{!hasSubmissionTypes && (
						<Alert
							icon={<IconAlertTriangle size={16} />}
							title="No Submission Required"
							color="yellow"
						>
							This assignment does not require any submissions. Please check the
							instructions or contact your instructor.
						</Alert>
					)}

					{assignment.requireTextSubmission && (
						<TextSubmissionField form={form} />
					)}

					{assignment.requireFileSubmission && (
						<FileUploadZone
							assignment={assignment}
							files={files}
							onFilesChange={setFiles}
						/>
					)}

					{hasSubmissionTypes && (
						<Group justify="flex-end" mt="md">
							<Button
								onClick={handleShowConfirmModal}
								loading={isSubmitting}
								disabled={
									isHtmlEmpty(form.getValues().textContent) &&
									files.length === 0
								}
							>
								Submit
							</Button>
						</Group>
					)}
				</Stack>
			</Paper>

			<SubmissionConfirmModal
				opened={confirmModalOpened}
				assignment={assignment}
				textContent={form.getValues().textContent}
				files={files}
				isSubmitting={isSubmitting}
				onConfirm={handleConfirmSubmit}
				onCancel={() => setConfirmModalOpened(false)}
			/>
		</>
	);
}

function InstructionsView({
	assignment,
	allSubmissions,
	submission,
	onAddSubmission,
	canSubmit = true,
}: {
	assignment: AssignmentData;
	allSubmissions: SubmissionData[];
	submission?: { status: "draft" | "submitted" | "graded" | "returned" } | null;
	onAddSubmission: () => void;
	canSubmit?: boolean;
}) {
	const submittedCount = allSubmissions.filter(
		(s) =>
			s.status === "submitted" ||
			s.status === "graded" ||
			s.status === "returned",
	).length;
	const maxAttempts = assignment.maxAttempts || null;
	const canSubmitMore = maxAttempts === null || submittedCount < maxAttempts;
	const hasUnsubmittedDraft = submission?.status === "draft";

	return (
		<Paper withBorder p="xl" radius="md">
			<Stack gap="lg">
				<Group justify="space-between" align="flex-start">
					<Title order={3}>Assignment Instructions</Title>
					{canSubmit && canSubmitMore && (
						<Button
							leftSection={<IconPlus size={16} />}
							onClick={onAddSubmission}
						>
							{hasUnsubmittedDraft
								? "Edit Draft"
								: submittedCount > 0
									? "Add New Submission"
									: "Add Submission"}
						</Button>
					)}
				</Group>

				{canSubmit && maxAttempts && (
					<Alert
						color={canSubmitMore ? "blue" : "yellow"}
						icon={<IconInfoCircle size={16} />}
					>
						{submittedCount} of {maxAttempts} attempt
						{maxAttempts !== 1 ? "s" : ""} used
						{!canSubmitMore && " - Maximum attempts reached"}
					</Alert>
				)}

				{assignment.instructions ? (
					<Typography
						className="tiptap"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content is from trusted CMS source
						dangerouslySetInnerHTML={{ __html: assignment.instructions }}
						style={{
							minHeight: "100px",
							lineHeight: "1.6",
						}}
					/>
				) : (
					<Text c="dimmed">No instructions provided.</Text>
				)}
			</Stack>
		</Paper>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function AssignmentPreview({
	assignment,
	submission,
	allSubmissions = [],
	onSubmit,
	isSubmitting = false,
	canSubmit = true,
}: AssignmentPreviewProps) {
	const [action, setAction] = useQueryState("action");

	const handleCloseForm = () => {
		setAction(null);
	};

	const handleSubmit = async (data: { textContent: string; files: File[] }) => {
		if (onSubmit) {
			await onSubmit(data);
		}
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

	// Don't allow non-students to access the submission form
	if (action === AssignmentActions.EDIT_SUBMISSION && !canSubmit) {
		setAction(null);
	}

	if (action === AssignmentActions.EDIT_SUBMISSION && canSubmit) {
		return (
			<SubmissionForm
				assignment={assignment}
				isSubmitting={isSubmitting}
				onClose={handleCloseForm}
				onSubmit={handleSubmit}
			/>
		);
	}

	return (
		<InstructionsView
			assignment={assignment}
			allSubmissions={allSubmissions}
			submission={submission}
			onAddSubmission={() => setAction(AssignmentActions.EDIT_SUBMISSION)}
			canSubmit={canSubmit}
		/>
	);
}
