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
import { IconFile, IconUpload, IconX } from "@tabler/icons-react";
import prettyBytes from "pretty-bytes";
import type { ComponentProps } from "react";
import { useEffectEvent, useState } from "react";
import { href } from "react-router";
import {
	formatFileSize,
	getFileIcon,
	getFileType,
	getFileTypeLabel,
} from "~/utils/file-types";

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

	// Initialize uncontrolled state with defaultValue
	const [uncontrolledValue, setUncontrolledValue] = useState<FileUploaderValue>(
		defaultValue || { files: [], mediaIds: [] },
	);

	// Use controlled value if provided, otherwise use uncontrolled state
	const currentValue = isControlled ? value : uncontrolledValue;
	const files = currentValue.files;
	const mediaIds = currentValue.mediaIds;

	// Use useEffectEvent to create a stable onChange handler
	const stableOnChange = useEffectEvent(onChange);

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

		// Create updated value
		const updatedValue: FileUploaderValue = {
			files: [...files, ...validFiles],
			mediaIds,
		};

		// Update state (uncontrolled) or call onChange (controlled)
		if (isControlled) {
			stableOnChange(updatedValue);
		} else {
			setUncontrolledValue(updatedValue);
			stableOnChange(updatedValue);
		}
	};

	const handleRemoveNewFile = (index: number) => {
		// Create updated value
		const updatedValue: FileUploaderValue = {
			files: files.filter((_, i) => i !== index),
			mediaIds,
		};

		// Update state (uncontrolled) or call onChange (controlled)
		if (isControlled) {
			stableOnChange(updatedValue);
		} else {
			setUncontrolledValue(updatedValue);
			stableOnChange(updatedValue);
		}
	};

	const handleRemoveExistingMedia = (mediaId: number) => {
		// Create updated value
		const updatedValue: FileUploaderValue = {
			files,
			mediaIds: mediaIds.filter((id) => id !== mediaId),
		};

		// Update state (uncontrolled) or call onChange (controlled)
		if (isControlled) {
			stableOnChange(updatedValue);
		} else {
			setUncontrolledValue(updatedValue);
			stableOnChange(updatedValue);
		}
	};

	// Filter existing media to only show those still in mediaIds
	const displayedExistingMedia = existingMedia.filter((media) =>
		mediaIds.includes(media.id),
	);

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

			{(displayedExistingMedia.length > 0 || files.length > 0) && (
				<Stack gap="xs" mt="md">
					{/* Display existing media */}
					{displayedExistingMedia.map((media) => {
						const fileType = getFileType(media.filename, media.mimeType);
						const FileIcon = getFileIcon(fileType);
						const displayName = media.filename || `File ${media.id}`;

						return (
							<Group
								key={`existing-${media.id}`}
								justify="space-between"
								p="xs"
								style={{
									border: "1px solid var(--mantine-color-gray-3)",
									borderRadius: "var(--mantine-radius-sm)",
								}}
							>
								<Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
									<Tooltip label={getFileTypeLabel(fileType)}>
										<div>
											<FileIcon size={16} />
										</div>
									</Tooltip>
									<Anchor
										href={href("/api/media/file/:mediaId", {
											mediaId: media.id.toString(),
										})}
										target="_blank"
										rel="noreferrer"
										size="sm"
										style={{
											flex: 1,
											minWidth: 0,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{displayName}
									</Anchor>
									<Badge size="sm" variant="light" color="green">
										Uploaded
									</Badge>
									{media.filesize && (
										<Text size="xs" c="dimmed">
											{formatFileSize(media.filesize)}
										</Text>
									)}
								</Group>
								{allowDeleteUploaded && (
									<ActionIcon
										variant="subtle"
										color="red"
										onClick={() => handleRemoveExistingMedia(media.id)}
									>
										<IconX size={16} />
									</ActionIcon>
								)}
							</Group>
						);
					})}

					{/* Display new files to upload */}
					{files.map((file, index) => (
						<Group
							key={`new-${file.name}-${file.size}-${file.lastModified}`}
							justify="space-between"
							p="xs"
							style={{
								border: "1px solid var(--mantine-color-gray-3)",
								borderRadius: "var(--mantine-radius-sm)",
							}}
						>
							<Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
								<IconFile size={20} />
								<Text
									size="sm"
									style={{
										flex: 1,
										minWidth: 0,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{file.name}
								</Text>
								<Text size="xs" c="dimmed">
									{prettyBytes(file.size)}
								</Text>
							</Group>
							<ActionIcon
								variant="subtle"
								color="red"
								onClick={() => handleRemoveNewFile(index)}
							>
								<IconX size={16} />
							</ActionIcon>
						</Group>
					))}
				</Stack>
			)}
		</div>
	);
}
