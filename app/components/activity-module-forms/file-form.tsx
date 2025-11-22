import {
	ActionIcon,
	Anchor,
	Button,
	Group,
	Stack,
	Text,
	Textarea,
	Title,
	Tooltip,
} from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import { IconFile, IconUpload, IconX } from "@tabler/icons-react";
import prettyBytes from "pretty-bytes";
import { href } from "react-router";
import {
	formatFileSize,
	getFileIcon,
	getFileType,
	getFileTypeLabel,
} from "~/routes/course/module.$id/utils";
import type {
	ActivityModuleFormValues,
	FileModuleFormValues,
} from "~/utils/activity-module-schema";
import { useFormWatchForceUpdate } from "~/utils/form-utils";
import { CommonFields } from "./common-fields";

interface FileFormProps {
	initialValues?: Partial<FileModuleFormValues>;
	onSubmit: (values: FileModuleFormValues) => void;
	uploadLimit?: number;
	existingMedia?: Array<{
		id: number;
		filename?: string | null;
		mimeType?: string | null;
		filesize?: number | null;
	}>;
	isLoading?: boolean;
}

export function FileForm({
	initialValues,
	onSubmit,
	uploadLimit,
	existingMedia = [],
	isLoading,
}: FileFormProps) {
	const form = useForm<FileModuleFormValues>({
		mode: "uncontrolled",
		cascadeUpdates: true,
		initialValues: {
			title: initialValues?.title || "",
			description: initialValues?.description || "",
			type: "file" as const,
			status: initialValues?.status || "draft",
			fileMedia: initialValues?.fileMedia || [],
			fileFiles: initialValues?.fileFiles || [],
		},
		validate: {
			title: (value) =>
				value.trim().length === 0 ? "Title is required" : null,
		},
	});

	// Watch fileFiles and fileMedia fields to ensure component re-renders when they change
	const files = useFormWatchForceUpdate(form, "fileFiles") || [];
	const mediaIds = useFormWatchForceUpdate(form, "fileMedia") || [];

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

		// Update form state with new files
		const updatedFiles = [...files, ...validFiles];
		form.setFieldValue("fileFiles", updatedFiles);
	};

	const handleRemoveNewFile = (index: number) => {
		const updatedFiles = files.filter((_, i) => i !== index);
		form.setFieldValue("fileFiles", updatedFiles);
	};

	const handleRemoveExistingMedia = (mediaId: number) => {
		const updatedMediaIds = mediaIds.filter((id) => id !== mediaId);
		form.setFieldValue("fileMedia", updatedMediaIds);
	};

	// Filter existing media to only show those still in fileMedia
	const displayedExistingMedia = existingMedia.filter((media) =>
		mediaIds.includes(media.id),
	);

	return (
		<form onSubmit={form.onSubmit(onSubmit)}>
			<Stack gap="md">
				<CommonFields
					form={form as UseFormReturnType<ActivityModuleFormValues>}
				/>

				<Textarea
					{...form.getInputProps("description")}
					key={form.key("description")}
					label="Description"
					placeholder="Enter module description"
					minRows={3}
				/>

				<div>
					<Title order={5} mb="xs">
						Files
					</Title>
					<Dropzone
						onDrop={handleDrop}
						onReject={() => {
							// Handle rejected files (e.g., show notification)
						}}
						maxSize={uploadLimit}
						multiple
						disabled={false}
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
								<IconX
									size={52}
									color="var(--mantine-color-red-6)"
									stroke={1.5}
								/>
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
												href={href("/api/media/file/:filenameOrId", {
													filenameOrId: media.id.toString(),
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
											{media.filesize && (
												<Text size="xs" c="dimmed">
													{formatFileSize(media.filesize)}
												</Text>
											)}
										</Group>
										<ActionIcon
											variant="subtle"
											color="red"
											onClick={() => handleRemoveExistingMedia(media.id)}
										>
											<IconX size={16} />
										</ActionIcon>
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

				<Button type="submit" size="lg" mt="lg" loading={isLoading}>
					Save
				</Button>
			</Stack>
		</form>
	);
}
