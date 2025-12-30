import { Anchor, Group, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { href } from "react-router";
import {
	formatFileSize,
	getFileIcon,
	getFileType,
	getFileTypeLabel,
} from "~/utils/file-types";

interface FilePreviewProps {
	files: Array<
		| number
		| {
				id: number;
				filename?: string | null;
				mimeType?: string | null;
				filesize?: number | null;
		  }
	>;
}

export function FilePreview({ files }: FilePreviewProps) {
	if (!files || files.length === 0) {
		return (
			<Paper withBorder p="md" radius="md">
				<Text c="dimmed" size="sm">
					No files available.
				</Text>
			</Paper>
		);
	}

	return (
		<Stack gap="md">
			<Text size="sm" fw={500}>
				Files ({files.length}):
			</Text>
			<Stack gap="xs">
				{files.map((file) => {
					const fileId = typeof file === "object" ? file.id : file;
					const filename =
						typeof file === "object"
							? file.filename || `File ${fileId}`
							: `File ${fileId}`;
					const mimeType = typeof file === "object" ? file.mimeType : null;
					const filesize = typeof file === "object" ? file.filesize : null;
					const fileType = getFileType(filename, mimeType);
					const FileIcon = getFileIcon(fileType, filename, mimeType);

					return (
						<Paper key={fileId} withBorder p="xs">
							<Group gap="xs" wrap="nowrap">
								<Tooltip label={getFileTypeLabel(fileType)}>
									<div>
										<FileIcon size={20} />
									</div>
								</Tooltip>
								<div style={{ flex: 1, minWidth: 0 }}>
									<Anchor
										href={href("/api/media/file/:mediaId", {
											mediaId: fileId.toString(),
										})}
										target="_blank"
										rel="noreferrer"
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
									{filesize && (
										<Text size="xs" c="dimmed">
											{formatFileSize(filesize)}
										</Text>
									)}
								</div>
							</Group>
						</Paper>
					);
				})}
			</Stack>
		</Stack>
	);
}
