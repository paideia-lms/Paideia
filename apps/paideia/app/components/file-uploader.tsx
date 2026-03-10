import {
	ActionIcon,
	Anchor,
	Button,
	Group,
	Stack,
	Text,
	Tooltip,
} from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useRef } from "react";
import { getRouteUrl } from "app/utils/router/search-params-utils";
import {
	MediaPickerModal,
	type MediaPickerModalHandle,
} from "~/components/media-picker";
import {
	formatFileSize,
	getFileIcon,
	getFileType,
	getFileTypeLabel,
} from "~/utils/file-types";

export interface FileUploaderValue {
	mediaIds: number[];
}

interface FileUploaderProps {
	userId: number;
	existingMedia?: Array<{
		id: number;
		filename?: string | null;
		mimeType?: string | null;
		filesize?: number | null;
	}>;
	allowDeleteUploaded?: boolean;
	onChange: (value: FileUploaderValue) => void;
	value?: FileUploaderValue;
	defaultValue?: FileUploaderValue;
	disabled?: boolean;
}

export function FileUploader({
	userId,
	existingMedia = [],
	allowDeleteUploaded = true,
	onChange,
	value,
	defaultValue,
	disabled = false,
}: FileUploaderProps) {
	const mediaPickerRef = useRef<MediaPickerModalHandle>(null);
	const isControlled = value !== undefined;
	const currentValue = isControlled ? value : defaultValue;
	const mediaIds = currentValue?.mediaIds ?? [];

	const handleAdd = (mediaId: number) => {
		if (mediaIds.includes(mediaId)) return;
		const nextMediaIds = [...mediaIds, mediaId];
		onChange({ mediaIds: nextMediaIds });
	};

	const handleRemove = (mediaId: number) => {
		const nextMediaIds = mediaIds.filter((id) => id !== mediaId);
		onChange({ mediaIds: nextMediaIds });
	};

	const mediaById = new Map(existingMedia.map((m) => [m.id, m]));

	return (
		<div>
			<Button
				variant="light"
				leftSection={<IconPlus size={16} />}
				onClick={() => mediaPickerRef.current?.open()}
				disabled={disabled}
			>
				Add files
			</Button>

			<MediaPickerModal
				ref={mediaPickerRef}
				userId={userId}
				onSelect={handleAdd}
			/>

			{mediaIds.length > 0 && (
				<Stack gap="xs" mt="md">
					{mediaIds.map((mediaId) => {
						const media = mediaById.get(mediaId);
						const displayName = media?.filename ?? `File ${mediaId}`;
						const fileType = getFileType(
							media?.filename ?? undefined,
							media?.mimeType ?? undefined,
						);
						const FileIcon = getFileIcon(fileType);
						const previewUrl = getRouteUrl("/api/media/file/:mediaId", {
							params: { mediaId: mediaId.toString() },
							searchParams: {},
						});

						return (
							<Group
								key={`media-${mediaId}`}
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
										href={previewUrl}
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
									{media?.filesize != null && (
										<Text size="xs" c="dimmed">
											{formatFileSize(media.filesize)}
										</Text>
									)}
								</Group>
								{allowDeleteUploaded && (
									<ActionIcon
										variant="subtle"
										color="red"
										onClick={() => handleRemove(mediaId)}
										disabled={disabled}
									>
										<IconX size={16} />
									</ActionIcon>
								)}
							</Group>
						);
					})}
				</Stack>
			)}
		</div>
	);
}
