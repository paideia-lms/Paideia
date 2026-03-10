import {
	Group,
	Image,
	Modal,
	NavLink,
	Progress,
	SimpleGrid,
	Stack,
	Text,
} from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import {
	IconCloudUpload,
	IconFolder,
	IconLayoutGrid,
	IconPhoto,
	IconX,
} from "@tabler/icons-react";
import prettyBytes from "pretty-bytes";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { href, useFetcher } from "react-router";
import { StatusCode } from "app/utils/router/responses";
import { useUploadMedia } from "~/routes/user/media";
import { PRESET_FILE_TYPE_OPTIONS } from "~/utils/file-types";
import { isImage } from "~/utils/media-helpers";

export interface MediaPickerModalHandle {
	open: () => void;
}

type MediaPickerTab = "private" | "upload";

interface MediaPickerModalProps {
	userId: number;
	onSelect: (mediaId: number) => void;
	/** When true, only show and accept image files (e.g. for avatar selection) */
	imagesOnly?: boolean;
	/** Optional: override accepted MIME types. When set, imagesOnly is ignored for accept. */
	accept?: string[];
}

export const MediaPickerModal = forwardRef<
	MediaPickerModalHandle,
	MediaPickerModalProps
>(({ userId, onSelect, imagesOnly = false, accept: acceptProp }, ref) => {
	const [opened, setOpened] = useState(false);
	const [activeTab, setActiveTab] = useState<MediaPickerTab>("private");

	const fetcher = useFetcher();
	const {
		uploadMedia,
		isLoading: isUploading,
		fetcher: uploadFetcher,
	} = useUploadMedia(userId);

	useImperativeHandle(ref, () => ({
		open: () => {
			setOpened(true);
			fetcher.load(`/api/media-picker/${userId}`);
		},
	}));

	// Refetch when modal opens
	useEffect(() => {
		if (opened && userId) {
			fetcher.load(`/api/media-picker/${userId}`);
		}
	}, [opened, userId, fetcher]);

	// On upload success: close modal and set value
	useEffect(() => {
		const uploadData = uploadFetcher.data;
		if (
			uploadData?.status === StatusCode.Ok &&
			"mediaId" in uploadData &&
			typeof uploadData.mediaId === "number"
		) {
			onSelect(uploadData.mediaId);
			setOpened(false);
		}
	}, [uploadFetcher.data, onSelect]);

	const media =
		fetcher.data?.status === StatusCode.Ok ? fetcher.data.media : [];
	const stats =
		fetcher.data?.status === StatusCode.Ok ? fetcher.data.stats : null;
	const storageLimit =
		fetcher.data?.status === StatusCode.Ok ? fetcher.data.storageLimit : null;
	const uploadLimit =
		fetcher.data?.status === StatusCode.Ok
			? fetcher.data.uploadLimit
			: undefined;

	const isLoading = fetcher.state !== "idle";

	const filteredMedia = imagesOnly
		? media.filter((m: { mimeType?: string | null }) =>
				m.mimeType?.startsWith("image/"),
			)
		: media;

	// Accepted MIME types: accept prop > imagesOnly (IMAGE_MIME_TYPE) > all preset + text
	const acceptedMimeTypes =
		acceptProp ??
		(imagesOnly
			? IMAGE_MIME_TYPE
			: [
					...new Set([
						...PRESET_FILE_TYPE_OPTIONS.map((o) => o.mimeType),
						"text/plain",
						"text/markdown",
						"text/yaml",
						"application/json",
						"application/xml",
						"text/xml",
						"text/html",
						"text/css",
						"text/javascript",
						"application/javascript",
					]),
				]);

	const handleDrop = (files: File[]) => {
		const file = files[0];
		if (!file) return;

		if (uploadLimit !== undefined && file.size > uploadLimit) {
			notifications.show({
				title: "Upload failed",
				message: `File size exceeds maximum of ${prettyBytes(uploadLimit)}`,
				color: "red",
			});
			return;
		}

		uploadMedia(file);
		setActiveTab("private");
	};

	const handleReject = () => {
		notifications.show({
			title: "Upload failed",
			message: "File type not supported",
			color: "red",
		});
	};

	const storageUsed = stats?.totalSize ?? 0;
	const storagePercent =
		storageLimit != null && storageLimit > 0
			? Math.min(100, (storageUsed / storageLimit) * 100)
			: 0;

	return (
		<Modal
			opened={opened}
			onClose={() => setOpened(false)}
			title="File picker"
			size="xl"
			centered
			styles={{
				body: {
					minHeight: "500px",
				},
			}}
		>
			<Group align="flex-start" gap="md" wrap="nowrap">
				{/* Left sidebar */}
				<Stack gap="xs" w={200} style={{ flexShrink: 0 }}>
					<NavLink
						label="Private files"
						leftSection={<IconFolder size={18} />}
						active={activeTab === "private"}
						onClick={() => setActiveTab("private")}
					/>
					<NavLink
						label="Upload a file"
						leftSection={<IconCloudUpload size={18} />}
						active={activeTab === "upload"}
						onClick={() => setActiveTab("upload")}
					/>

					{/* Storage usage stat */}
					<Stack gap={4} mt="md" p="xs" style={{ flex: 1 }}>
						<Text size="xs" fw={500} c="dimmed">
							Storage
						</Text>
						<Text size="sm" fw={600}>
							{prettyBytes(storageUsed)}
							{storageLimit != null ? ` / ${prettyBytes(storageLimit)}` : ""}
						</Text>
						{storageLimit != null && (
							<Progress value={storagePercent} size="sm" color="blue" />
						)}
					</Stack>
				</Stack>

				{/* Main content */}
				<Stack gap="md" style={{ flex: 1, minWidth: 0 }}>
					{activeTab === "private" && (
						<>
							<Group justify="space-between">
								<Text fw={500}>Private files</Text>
								<IconLayoutGrid size={18} />
							</Group>
							{isLoading && !fetcher.data ? (
								<Text c="dimmed" size="sm">
									Loading...
								</Text>
							) : filteredMedia.length === 0 ? (
								<Text c="dimmed" size="sm">
									{imagesOnly
										? "No images in your drive. Upload one first."
										: "No files in your drive. Upload one first."}
								</Text>
							) : (
								<SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
									{filteredMedia.map(
										(file: {
											id: number;
											mimeType?: string | null;
											filename?: string | null;
											alt?: string | null;
										}) => {
											const mediaUrl = file.id
												? href("/api/media/file/:mediaId", {
														mediaId: file.id.toString(),
													})
												: undefined;
											return (
												<Stack
													key={file.id}
													gap="xs"
													style={{
														cursor: "pointer",
														borderRadius: "var(--mantine-radius-sm)",
														padding: "var(--mantine-spacing-xs)",
														border:
															"1px solid var(--mantine-color-default-border)",
													}}
													onClick={() => {
														onSelect(file.id);
														setOpened(false);
													}}
												>
													<Group
														justify="center"
														style={{
															height: 80,
															overflow: "hidden",
															backgroundColor: "var(--mantine-color-gray-0)",
														}}
													>
														{file.mimeType &&
														isImage(file.mimeType) &&
														mediaUrl ? (
															<Image
																src={mediaUrl}
																alt={file.alt ?? file.filename ?? ""}
																fit="contain"
																h={80}
															/>
														) : (
															<IconPhoto size={32} />
														)}
													</Group>
													<Text
														size="xs"
														lineClamp={2}
														style={{ wordBreak: "break-word" }}
													>
														{file.filename ?? "Untitled"}
													</Text>
												</Stack>
											);
										},
									)}
								</SimpleGrid>
							)}
						</>
					)}

					{activeTab === "upload" && (
						<>
							<Text fw={500}>Upload a file</Text>
							<Stack gap="md">
								<Dropzone
									onDrop={handleDrop}
									onReject={handleReject}
									accept={acceptedMimeTypes}
									maxSize={uploadLimit}
									multiple={false}
									disabled={isUploading}
								>
									<Group
										justify="center"
										gap="xl"
										mih={180}
										style={{ pointerEvents: "none" }}
									>
										<Dropzone.Accept>
											<IconCloudUpload
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
											<IconCloudUpload
												size={52}
												color="var(--mantine-color-dimmed)"
												stroke={1.5}
											/>
										</Dropzone.Idle>
										<div>
											<Text size="xl" inline>
												Drag file here or click to select
											</Text>
											<Text size="sm" c="dimmed" inline mt={7}>
												{imagesOnly
													? "Images only"
													: "All supported file types"}
												{uploadLimit
													? ` • Max ${prettyBytes(uploadLimit)}`
													: ""}
											</Text>
										</div>
									</Group>
								</Dropzone>
							</Stack>
						</>
					)}
				</Stack>
			</Group>
		</Modal>
	);
});

MediaPickerModal.displayName = "MediaPickerModal";
