import {
	ActionIcon,
	Anchor,
	Badge,
	Group,
	Stack,
	Text,
	Tooltip,
} from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import { IconFile, IconUpload, IconX, IconRestore } from "@tabler/icons-react";
import prettyBytes from "pretty-bytes";
import type { ComponentProps } from "react";
// biome-ignore lint/style/noRestrictedImports: We need to use useEffect to sync the filesWithStatus when value or existingMedia changes
import { useEffect, useEffectEvent, useState } from "react";
// import { href } from "react-router";
import {
	formatFileSize,
	getFileIcon,
	getFileType,
	getFileTypeLabel,
} from "~/utils/file-types";

type FileStatus = "uploaded" | "will-be-deleted" | "will-be-uploaded";

interface FileWithStatus {
	file?: File;
	mediaId?: number;
	status: FileStatus;
	filename?: string;
	mimeType?: string;
	filesize?: number;
	previewUrl?: string | null;
}

interface FileUploaderValue {
	files: File[];
	mediaIds: number[];
}

type DropzoneProps = Omit<
	ComponentProps<typeof Dropzone>,
	"onDrop" | "children" | "defaultValue" | "value" | "onChange"
>;

interface FileUploaderProps extends DropzoneProps {
	existingMedia?: Array<{
		id: number;
		filename?: string | null;
		mimeType?: string | null;
		filesize?: number | null;
		previewUrl?: string | null;
	}>;
	uploadLimit?: number;
	allowDeleteUploaded?: boolean;
	onChange: (value: FileUploaderValue) => void;
	value?: FileUploaderValue;
	defaultValue?: FileUploaderValue;
}

export function FileUploader({
	existingMedia = [],
	uploadLimit,
	allowDeleteUploaded = false,
	onChange,
	value,
	defaultValue,
	onReject,
	maxSize,
	multiple = true,
	disabled = false,
	...dropzoneProps
}: FileUploaderProps) {
	// Determine if component is controlled
	const isControlled = value !== undefined;

	// Helper to convert FileUploaderValue to FileWithStatus[]
	// Status is determined by comparing value with existingMedia:
	// - Uploaded: exists in both existingMedia and value.mediaIds
	// - Will be deleted: exists in existingMedia but NOT in value.mediaIds
	// - Will be uploaded: exists in value.files (new files not yet on server)
	const valueToFilesWithStatus = (
		val: FileUploaderValue | undefined,
		existing: typeof existingMedia,
	): FileWithStatus[] => {
		const result: FileWithStatus[] = [];

		// First, process all existingMedia to determine their status
		for (const media of existing) {
			const isInValue = val?.mediaIds.includes(media.id) ?? false;
			result.push({
				mediaId: media.id,
				status: isInValue ? "uploaded" : "will-be-deleted",
				filename: media.filename || undefined,
				mimeType: media.mimeType || undefined,
				filesize: media.filesize || undefined,
			});
		}

		// Then, add all new files (will be uploaded)
		if (val?.files) {
			for (const file of val.files) {
				result.push({
					file,
					status: "will-be-uploaded",
					filename: file.name,
					filesize: file.size,
				});
			}
		}

		return result;
	};

	// Initialize state with FileWithStatus[]
	const [filesWithStatus, setFilesWithStatus] = useState<FileWithStatus[]>(() => {
		const initialValue = isControlled ? value : defaultValue;
		return valueToFilesWithStatus(initialValue, existingMedia);
	});

	// Use useEffectEvent to create a stable onChange handler
	const stableOnChange = useEffectEvent(onChange);

	// Sync filesWithStatus when value changes from parent
	// biome-ignore lint/correctness/useExhaustiveDependencies: We need to sync when value or existingMedia changes
	useEffect(() => {
		if (isControlled && value) {
			setFilesWithStatus(valueToFilesWithStatus(value, existingMedia));
		}
	}, [isControlled, value, existingMedia]);

	// Helper to convert FileWithStatus[] back to FileUploaderValue
	const filesWithStatusToValue = (files: FileWithStatus[]): FileUploaderValue => {
		const mediaIds: number[] = [];
		const fileObjects: File[] = [];

		for (const item of files) {
			if (item.status === "will-be-deleted") {
				// Skip items marked for deletion
				continue;
			}
			if (item.mediaId !== undefined) {
				mediaIds.push(item.mediaId);
			}
			if (item.file) {
				fileObjects.push(item.file);
			}
		}

		return { files: fileObjects, mediaIds };
	};

	const handleDrop = (newFiles: FileWithPath[]) => {
		// Filter out files that exceed the size limit
		const validFiles = newFiles.filter((file) => {
			if (uploadLimit !== undefined && file.size > uploadLimit) {
				return false;
			}
			return true;
		});

		if (validFiles.length < newFiles.length) {
			// Some files were rejected due to size
			// You might want to show a notification here
		}

		// Remove items marked for deletion, then add new files
		const filteredFiles = filesWithStatus.filter((item) => item.status !== "will-be-deleted");
		const newFilesWithStatus: FileWithStatus[] = validFiles.map((file) => ({
			file,
			status: "will-be-uploaded",
			filename: file.name,
			filesize: file.size,
		}));

		const updatedFiles = [...filteredFiles, ...newFilesWithStatus];
		setFilesWithStatus(updatedFiles);

		// Notify parent with filtered value
		const updatedValue = filesWithStatusToValue(updatedFiles);
		if (isControlled) {
			stableOnChange(updatedValue);
		} else {
			stableOnChange(updatedValue);
		}
	};

	const handleMarkForDeletion = (index: number) => {
		const updated = [...filesWithStatus];
		const item = updated[index];
		if (!item) return;

		if (item.status === "uploaded") {
			updated[index] = { ...item, status: "will-be-deleted" };
		} else if (item.status === "will-be-uploaded") {
			// simply remove the file from the list
			updated.splice(index, 1);
		}
		setFilesWithStatus(updated);

		// Notify parent with filtered value
		const updatedValue = filesWithStatusToValue(updated);
		stableOnChange(updatedValue);
	};

	const handleRevertDeletion = (index: number) => {
		const updated = [...filesWithStatus];
		const item = updated[index];
		if (!item) return;

		if (item.mediaId !== undefined) {
			// It was an uploaded file, restore to uploaded
			updated[index] = { ...item, status: "uploaded" };
		} else if (item.file) {
			// It was a new file, restore to will-be-uploaded
			updated[index] = { ...item, status: "will-be-uploaded" };
		}
		setFilesWithStatus(updated);

		// Notify parent with filtered value
		const updatedValue = filesWithStatusToValue(updated);
		stableOnChange(updatedValue);
	};

	return (
		<div>
			<Dropzone
				onDrop={handleDrop}
				onReject={onReject}
				maxSize={maxSize ?? uploadLimit}
				multiple={multiple}
				disabled={disabled}
				{...dropzoneProps}
			>
				<Group
					justify="center"
					gap="xl"
					mih={220}
					style={{ pointerEvents: "none" }}
				>
					<Dropzone.Accept>
						<IconUpload
							size={52}
							color="var(--mantine-color-blue-6)"
							stroke={1.5}
						/>
					</Dropzone.Accept>
					<Dropzone.Reject>
						<IconX size={52} color="var(--mantine-color-red-6)" stroke={1.5} />
					</Dropzone.Reject>
					<Dropzone.Idle>
						<IconFile
							size={52}
							color="var(--mantine-color-dimmed)"
							stroke={1.5}
						/>
					</Dropzone.Idle>

					<div>
						<Text size="xl" inline>
							Drag files here or click to select files
						</Text>
						<Text size="sm" c="dimmed" inline mt={7}>
							{uploadLimit
								? `Attach as many files as you like, each file should not exceed ${prettyBytes(uploadLimit)}`
								: "Attach as many files as you like"}
						</Text>
					</div>
				</Group>
			</Dropzone>

			{filesWithStatus.length > 0 && (
				<Stack gap="xs" mt="md">
					{filesWithStatus.map((item, index) => {
						if (!item) return null;

						const isMarkedForDeletion = item.status === "will-be-deleted";
						const isUploaded = item.status === "uploaded";
						const isWillBeUploaded = item.status === "will-be-uploaded";

						// Get display info
						const displayName = item.filename || (item.mediaId ? `File ${item.mediaId}` : "Unknown");
						const fileType = item.mediaId
							? getFileType(item.filename, item.mimeType)
							: getFileType(item.file?.name, undefined);
						const FileIcon = item.mediaId ? getFileIcon(fileType) : IconFile;

						const key = item.mediaId
							? `media-${item.mediaId}`
							: `file-${item.file?.name || index}-${item.file?.size || 0}-${item.file?.lastModified || 0}`;

						return (
							<Group
								key={key}
								justify="space-between"
								p="xs"
								style={{
									border: `1px solid ${isMarkedForDeletion ? "var(--mantine-color-red-6)" : "var(--mantine-color-gray-3)"}`,
									borderRadius: "var(--mantine-radius-sm)",
									opacity: isMarkedForDeletion ? 0.6 : 1,
									backgroundColor: isMarkedForDeletion ? "var(--mantine-color-red-0)" : undefined,
								}}
							>
								<Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
									{item.mediaId ? (
										<Tooltip label={getFileTypeLabel(fileType)}>
											<div>
												<FileIcon size={16} />
											</div>
										</Tooltip>
									) : (
										<FileIcon size={20} />
									)}
									{item.mediaId ? (
										<Anchor
											href={item.previewUrl ?? "#"}
											target="_blank"
											rel="noreferrer"
											size="sm"
											style={{
												flex: 1,
												minWidth: 0,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
												textDecoration: isMarkedForDeletion ? "line-through" : undefined,
											}}
										>
											{displayName}
										</Anchor>
									) : (
										<Text
											size="sm"
											style={{
												flex: 1,
												minWidth: 0,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
												textDecoration: isMarkedForDeletion ? "line-through" : undefined,
											}}
										>
											{displayName}
										</Text>
									)}
									{isMarkedForDeletion ? (
										<Badge size="sm" variant="light" color="red">
											Will be deleted
										</Badge>
									) : isUploaded ? (
										<Badge size="sm" variant="light" color="green">
											Uploaded
										</Badge>
									) : (
										<Badge size="sm" variant="light" color="blue">
											Will be uploaded
										</Badge>
									)}
									{item.filesize && (
										<Text size="xs" c="dimmed">
											{item.mediaId ? formatFileSize(item.filesize) : prettyBytes(item.filesize)}
										</Text>
									)}
								</Group>
								{isMarkedForDeletion ? (
									<ActionIcon
										variant="subtle"
										color="blue"
										onClick={() => handleRevertDeletion(index)}
									>
										<IconRestore size={16} />
									</ActionIcon>
								) : ((isUploaded && allowDeleteUploaded) || isWillBeUploaded) ? (
									<ActionIcon
										variant="subtle"
										color="red"
										onClick={() => handleMarkForDeletion(index)}
									>
										<IconX size={16} />
									</ActionIcon>
								) : null}
							</Group>
						);
					})}
				</Stack>
			)}
		</div>
	);
}
