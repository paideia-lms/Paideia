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
import {
    IconFile,
    IconFileText,
    IconFileTypePdf,
    IconPhoto,
    IconAlertCircle,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { href } from "react-router";

// ============================================================================
// Constants
// ============================================================================

const MAX_PREVIEW_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_PREVIEW_SIZE = 1 * 1024 * 1024; // 1MB for text files

// ============================================================================
// Types
// ============================================================================

type FileType = "image" | "pdf" | "text" | "other";

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
// Utility Functions
// ============================================================================

function getFileExtension(filename: string): string {
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function getFileType(filename?: string | null, mimeType?: string | null): FileType {
    // Check MIME type first
    if (mimeType) {
        if (mimeType.startsWith("image/")) return "image";
        if (mimeType === "application/pdf") return "pdf";
        if (
            mimeType.startsWith("text/") ||
            mimeType === "application/json" ||
            mimeType === "application/xml"
        ) {
            return "text";
        }
    }

    // Fallback to extension
    if (filename) {
        const ext = getFileExtension(filename);
        if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) {
            return "image";
        }
        if (ext === "pdf") return "pdf";
        if (
            ["txt", "md", "json", "xml", "csv", "log", "yml", "yaml", "ini"].includes(
                ext,
            )
        ) {
            return "text";
        }
    }

    return "other";
}

function getFileIcon(fileType: FileType) {
    switch (fileType) {
        case "image":
            return IconPhoto;
        case "pdf":
            return IconFileTypePdf;
        case "text":
            return IconFileText;
        default:
            return IconFile;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Sub-components
// ============================================================================

function ImagePreview({
    fileUrl,
    filename,
}: { fileUrl: string; filename: string }) {
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

function PdfPreview({ fileUrl, filename }: { fileUrl: string; filename: string }) {
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
    fileType: FileType;
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
    const fileUrl = href("/api/media/file/:filenameOrId", {
        filenameOrId: id.toString(),
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
                <Text size="sm" fw={500}>
                    {displayName}
                </Text>
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

