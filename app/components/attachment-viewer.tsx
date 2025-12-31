import {
	Anchor,
	Box,
	Code,
	Group,
	Image,
	Loader,
	Modal,
	Paper,
	ScrollArea,
	Stack,
	Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertCircle } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { href } from "react-router";
import {
	type FileTypeCategory,
	formatFileSize,
	getFileIcon,
	getFileType,
} from "~/utils/file-types";

// ============================================================================
// Constants
// ============================================================================

const MAX_PREVIEW_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_PREVIEW_SIZE = 1 * 1024 * 1024; // 1MB for text files

// ============================================================================
// Types
// ============================================================================

export interface AttachmentViewerProps {
	file: {
		id: number;
		filename?: string | null;
		mimeType?: string | null;
		filesize?: number | null;
		url?: string | null;
	};
	description?: string | null;
	compact?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

function ImagePreview({
	fileUrl,
	filename,
}: {
	fileUrl: string;
	filename: string;
}) {
	const [opened, { open, close }] = useDisclosure(false);

	return (
		<>
			<Box style={{ cursor: "pointer" }} onClick={open}>
				<Image
					src={fileUrl}
					alt={filename}
					fit="contain"
					h={300}
					radius="md"
					fallbackSrc="/placeholder-image.png"
				/>
			</Box>
			<Modal
				opened={opened}
				onClose={close}
				size="xl"
				title={filename}
				centered
			>
				<Image src={fileUrl} alt={filename} fit="contain" />
			</Modal>
		</>
	);
}

function PdfPreview({
	fileUrl,
	filename,
}: {
	fileUrl: string;
	filename: string;
}) {
	return (
		<Box>
			<iframe
				src={fileUrl}
				title={filename}
				style={{
					width: "100%",
					height: "600px",
					border: "1px solid var(--mantine-color-default-border)",
					borderRadius: "var(--mantine-radius-md)",
				}}
			/>
		</Box>
	);
}

function TextPreview({ fileUrl }: { fileUrl: string; filename: string }) {
	const [content, setContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch text content
	useEffect(() => {
		fetch(fileUrl)
			.then((response) => {
				if (!response.ok) throw new Error("Failed to fetch file");
				return response.text();
			})
			.then((text) => {
				setContent(text);
				setLoading(false);
			})
			.catch((err: unknown) => {
				const message = err instanceof Error ? err.message : "Unknown error";
				setError(message);
				setLoading(false);
			});
	}, [fileUrl]);

	if (loading) {
		return (
			<Box p="md" style={{ textAlign: "center" }}>
				<Loader size="sm" />
				<Text size="sm" c="dimmed" mt="xs">
					Loading file content...
				</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box p="md">
				<Group gap="xs">
					<IconAlertCircle size={16} color="var(--mantine-color-red-6)" />
					<Text size="sm" c="red">
						Failed to load file: {error}
					</Text>
				</Group>
			</Box>
		);
	}

	return (
		<ScrollArea h={400}>
			<Code block p="md">
				{content}
			</Code>
		</ScrollArea>
	);
}

function FileDownloadLink({
	fileUrl,
	filename,
	fileType,
	filesize,
}: {
	fileUrl: string;
	filename: string;
	fileType: FileTypeCategory;
	filesize?: number | null;
}) {
	const FileIcon = getFileIcon(fileType);

	return (
		<Paper withBorder p="xs">
			<Group gap="xs">
				<FileIcon size={16} />
				<Anchor href={fileUrl} target="_blank" rel="noreferrer" size="sm">
					{filename}
				</Anchor>
				{filesize && (
					<Text size="xs" c="dimmed">
						({formatFileSize(filesize)})
					</Text>
				)}
			</Group>
		</Paper>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function AttachmentViewer({
	file,
	description,
	compact = false,
}: AttachmentViewerProps) {
	const { id, filename, mimeType, filesize } = file;
	const fileUrl = href("/api/media/file/:mediaId", {
		mediaId: id.toString(),
	});
	const displayName = filename || `File ${id}`;
	const fileType = getFileType(filename, mimeType);
	const isLargeFile = filesize && filesize > MAX_PREVIEW_SIZE;
	const isLargeTextFile = filesize && filesize > MAX_TEXT_PREVIEW_SIZE;

	// For compact mode or large files, just show download link
	if (compact || isLargeFile) {
		return (
			<Stack gap="xs">
				<FileDownloadLink
					fileUrl={fileUrl}
					filename={displayName}
					fileType={fileType}
					filesize={filesize}
				/>
				{isLargeFile && (
					<Text size="xs" c="orange">
						File is too large for preview. Click to download.
					</Text>
				)}
				{description && (
					<Text size="xs" c="dimmed">
						{description}
					</Text>
				)}
			</Stack>
		);
	}

	// Render preview based on file type
	const renderPreview = () => {
		switch (fileType) {
			case "image":
				return <ImagePreview fileUrl={fileUrl} filename={displayName} />;
			case "pdf":
				return <PdfPreview fileUrl={fileUrl} filename={displayName} />;
			case "text":
				if (isLargeTextFile) {
					return (
						<FileDownloadLink
							fileUrl={fileUrl}
							filename={displayName}
							fileType={fileType}
							filesize={filesize}
						/>
					);
				}
				return <TextPreview fileUrl={fileUrl} filename={displayName} />;
			default:
				return (
					<FileDownloadLink
						fileUrl={fileUrl}
						filename={displayName}
						fileType={fileType}
						filesize={filesize}
					/>
				);
		}
	};

	return (
		<Stack gap="xs">
			<Group justify="space-between">
				{filesize && (
					<Text size="xs" c="dimmed">
						{formatFileSize(filesize)}
					</Text>
				)}
			</Group>
			{renderPreview()}
			{description && (
				<Text size="xs" c="dimmed">
					{description}
				</Text>
			)}
		</Stack>
	);
}
