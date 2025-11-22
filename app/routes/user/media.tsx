import { DonutChart, PieChart } from "@mantine/charts";
import {
	ActionIcon,
	Button,
	Card,
	Checkbox,
	Container,
	Grid,
	Group,
	Image,
	Menu,
	Modal,
	Pagination,
	SegmentedControl,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { usePrevious } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
	FileUpload,
	FileUploadHandler,
} from "@remix-run/form-data-parser";
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
} from "@remix-run/form-data-parser";
import {
	IconDots,
	IconDownload,
	IconEye,
	IconFile,
	IconInfoCircle,
	IconLayoutGrid,
	IconList,
	IconPencil,
	IconPhoto,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import dayjs from "dayjs";
import { DataTable } from "mantine-datatable";
import prettyBytes from "pretty-bytes";
import { useEffect, useId, useRef, useState } from "react";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userAccessContextKey } from "server/contexts/user-access-context";
import { userContextKey } from "server/contexts/user-context";
import {
	convertUserAccessContextToUserProfileContext,
	getUserProfileContext,
	type UserProfileContext,
} from "server/contexts/user-profile-context";
import {
	tryCreateMedia,
	tryDeleteMedia,
	tryFindMediaByUser,
	tryGetUserMediaStats,
	tryRenameMedia,
} from "server/internal/media-management";
import type { Media } from "server/payload-types";
import { canDeleteMedia } from "server/utils/permissions";
import { useMediaUsageData } from "~/routes/api/media-usage";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { PRESET_FILE_TYPE_OPTIONS } from "~/utils/file-types";
import { ContentType } from "~/utils/get-content-type";
import {
	canPreview,
	getFileIcon,
	getTypeColor,
	isAudio,
	isImage,
	isPdf,
	isVideo,
} from "~/utils/media-helpers";
import { parseFormDataWithFallback } from "~/utils/parse-form-data-with-fallback";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/media";

export const loader = async ({ context, params }: Route.LoaderArgs) => {
	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	// Get user ID from route params, or use current user
	const userId = params.id ? Number(params.id) : currentUser.id;

	// Check if user can access this data
	if (userId !== currentUser.id && currentUser.role !== "admin") {
		throw new ForbiddenResponse("You can only view your own media");
	}

	// Get storage limit from system globals
	const storageLimit = systemGlobals.sitePolicies.userMediaStorageTotal;
	const uploadLimit = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	// Get user profile context
	let userProfileContext: UserProfileContext | null = null;
	if (userId === currentUser.id) {
		// If viewing own profile, use userAccessContext if available
		const userAccessContext = context.get(userAccessContextKey);
		if (userAccessContext) {
			userProfileContext = convertUserAccessContextToUserProfileContext(
				userAccessContext,
				currentUser,
			);
		} else {
			// Fallback to fetching directly
			userProfileContext = await getUserProfileContext(
				payload,
				userId,
				currentUser,
			);
		}
	} else {
		// Viewing another user's profile
		userProfileContext = await getUserProfileContext(
			payload,
			userId,
			currentUser,
		);
	}

	if (!userProfileContext) {
		throw new NotFoundResponse("User not found");
	}

	// Fetch media for the user
	const mediaResult = await tryFindMediaByUser({
		payload,
		userId,
		limit: 20,
		page: 1,
		depth: 0,
		user: currentUser,
		overrideAccess: false,
	});

	if (!mediaResult.ok) {
		throw new NotFoundResponse("Failed to fetch media");
	}

	// Check permissions for each media item
	const mediaWithPermissions = mediaResult.value.docs.map((file) => {
		const createdById =
			typeof file.createdBy === "object" && file.createdBy !== null
				? file.createdBy.id
				: file.createdBy;
		const deletePermission = canDeleteMedia(currentUser, createdById);
		return {
			...file,
			deletePermission,
		};
	});

	// Get media stats
	const statsResult = await tryGetUserMediaStats({
		payload,
		userId,
		user: currentUser,
		overrideAccess: false,
	});

	const stats = statsResult.ok ? statsResult.value : null;

	return {
		user: userProfileContext.profileUser,
		media: mediaWithPermissions,
		pagination: {
			totalDocs: mediaResult.value.totalDocs,
			limit: mediaResult.value.limit,
			totalPages: mediaResult.value.totalPages,
			page: mediaResult.value.page,
			hasPrevPage: mediaResult.value.hasPrevPage,
			hasNextPage: mediaResult.value.hasNextPage,
			prevPage: mediaResult.value.prevPage,
			nextPage: mediaResult.value.nextPage,
		},
		isOwnProfile: userId === currentUser.id,
		stats,
		storageLimit,
		uploadLimit,
	};
};

export const action = async ({
	request,
	context,
	params,
}: Route.ActionArgs) => {
	const { payload, systemGlobals, s3Client } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser) {
		return unauthorized({ error: "Unauthorized" });
	}

	const userId = params.id ? Number(params.id) : currentUser.id;

	// Check if user can access this data
	if (userId !== currentUser.id && currentUser.role !== "admin") {
		return unauthorized({ error: "You can only manage your own media" });
	}

	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({ error: "Failed to begin transaction" });
	}

	// Get upload limit from system globals
	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	try {
		// For PATCH requests (update/rename), we can read formData directly
		if (request.method === "PATCH") {
			assertRequestMethod(request.method, "PATCH");

			const formData = await request.formData();
			const mediaIdParam = formData.get("mediaId");
			const newFilename = formData.get("newFilename")?.toString();
			const alt = formData.get("alt")?.toString();
			const caption = formData.get("caption")?.toString();

			if (!mediaIdParam) {
				return badRequest({ error: "Media ID is required" });
			}

			const mediaId = Number(mediaIdParam);
			if (Number.isNaN(mediaId)) {
				return badRequest({ error: "Invalid media ID" });
			}

			// Fetch media record to check permissions
			const mediaRecord = await payload.findByID({
				collection: "media",
				id: mediaId,
				depth: 0,
			});

			if (!mediaRecord) {
				return badRequest({ error: "Media not found" });
			}

			// Check permissions
			const createdById =
				typeof mediaRecord.createdBy === "object" &&
				mediaRecord.createdBy !== null
					? mediaRecord.createdBy.id
					: mediaRecord.createdBy;
			const deletePermission = canDeleteMedia(currentUser, createdById);

			if (!deletePermission.allowed) {
				return unauthorized({
					error:
						deletePermission.reason ||
						"You don't have permission to update this media",
				});
			}

			// If newFilename is provided, rename the file
			if (newFilename) {
				const renameResult = await tryRenameMedia({
					payload,
					s3Client,
					id: mediaId,
					newFilename,
					userId: currentUser.id,
					user: currentUser,
					req: { transactionID },
				});

				if (!renameResult.ok) {
					await payload.db.rollbackTransaction(transactionID);
					return badRequest({ error: renameResult.error.message });
				}
			}

			// Update alt and caption if provided
			if (alt !== undefined || caption !== undefined) {
				const updateData: Partial<Media> = {};
				if (alt !== undefined) {
					updateData.alt = alt;
				}
				if (caption !== undefined) {
					updateData.caption = caption;
				}

				await payload.update({
					collection: "media",
					id: mediaId,
					data: updateData,
					req: { transactionID },
				});
			}

			await payload.db.commitTransaction(transactionID);

			return ok({
				message: "Media updated successfully",
			});
		}

		// For DELETE requests, we can read formData directly (no file uploads)
		if (request.method === "DELETE") {
			assertRequestMethod(request.method, "DELETE");

			const formData = await request.formData();
			const mediaIdsParam = formData.get("mediaIds");

			if (!mediaIdsParam) {
				return badRequest({ error: "Media IDs are required" });
			}

			// Parse media IDs - can be a single ID or comma-separated IDs
			let mediaIds: number[];
			if (typeof mediaIdsParam === "string") {
				mediaIds = mediaIdsParam
					.split(",")
					.map((id) => Number(id.trim()))
					.filter((id) => !Number.isNaN(id));
			} else {
				return badRequest({ error: "Invalid media IDs format" });
			}

			if (mediaIds.length === 0) {
				return badRequest({ error: "At least one media ID is required" });
			}

			// Fetch media records to check permissions
			const mediaRecords = await payload.find({
				collection: "media",
				where: {
					id: {
						in: mediaIds,
					},
				},
				limit: mediaIds.length,
				depth: 0,
			});

			// Check permissions for each media item
			for (const media of mediaRecords.docs) {
				const createdById =
					typeof media.createdBy === "object" && media.createdBy !== null
						? media.createdBy.id
						: media.createdBy;
				const deletePermission = canDeleteMedia(currentUser, createdById);

				if (!deletePermission.allowed) {
					return unauthorized({
						error:
							deletePermission.reason ||
							"You don't have permission to delete this media",
					});
				}
			}

			// Verify all media records were found
			if (mediaRecords.docs.length !== mediaIds.length) {
				const foundIds = mediaRecords.docs.map((m) => m.id);
				const missingIds = mediaIds.filter((id) => !foundIds.includes(id));
				return badRequest({
					error: `Media records not found: ${missingIds.join(", ")}`,
				});
			}

			const result = await tryDeleteMedia({
				payload,
				s3Client,
				id: mediaIds.length === 1 ? mediaIds[0] : mediaIds,
				userId: currentUser.id,
				user: currentUser,
				req: { transactionID },
			});

			if (!result.ok) {
				await payload.db.rollbackTransaction(transactionID);
				return badRequest({ error: result.error.message });
			}

			await payload.db.commitTransaction(transactionID);

			return ok({
				message:
					mediaIds.length === 1
						? "Media deleted successfully"
						: `${mediaIds.length} media files deleted successfully`,
			});
		}

		// For POST requests (upload), we must use parseFormDataWithFallback first
		// to avoid locking the ReadableStream
		const uploadedMediaIds: number[] = [];

		const uploadHandler = async (fileUpload: FileUpload) => {
			if (fileUpload.fieldName === "file") {
				const arrayBuffer = await fileUpload.arrayBuffer();
				const fileBuffer = Buffer.from(arrayBuffer);

				const mediaResult = await tryCreateMedia({
					payload,
					file: fileBuffer,
					filename: fileUpload.name,
					mimeType: fileUpload.type,
					userId: userId,
					user: currentUser,
					req: { transactionID },
				});

				if (!mediaResult.ok) {
					throw mediaResult.error;
				}

				const mediaId = mediaResult.value.media.id;
				uploadedMediaIds.push(mediaId);
				return mediaId;
			}
		};

		// For POST requests (upload), we must use parseFormDataWithFallback first
		// to avoid locking the ReadableStream
		assertRequestMethod(request.method, "POST");

		const parsedFormData = await parseFormDataWithFallback(
			request,
			uploadHandler as FileUploadHandler,
			{
				...(maxFileSize !== undefined && { maxFileSize }),
				maxFiles: 1, // Only one file at a time
			},
		);

		// Update alt and caption if provided (optional fields)
		if (uploadedMediaIds.length > 0) {
			const alt = parsedFormData.get("alt")?.toString();
			const caption = parsedFormData.get("caption")?.toString();

			if (alt || caption) {
				for (const mediaId of uploadedMediaIds) {
					await payload.update({
						collection: "media",
						id: mediaId,
						data: {
							...(alt && { alt }),
							...(caption && { caption }),
						},
						req: { transactionID },
					});
				}
			}
		}

		await payload.db.commitTransaction(transactionID);

		return ok({
			message: "Media uploaded successfully",
		});
	} catch (error) {
		await payload.db.rollbackTransaction(transactionID);
		console.error("Media action error:", error);

		// Handle file size and count limit errors
		if (error instanceof MaxFileSizeExceededError) {
			return badRequest({
				error: `File size exceeds maximum allowed size of ${prettyBytes(maxFileSize ?? 0)}`,
			});
		}

		if (error instanceof MaxFilesExceededError) {
			return badRequest({
				error: error.message,
			});
		}

		return badRequest({
			error:
				error instanceof Error ? error.message : "Failed to process request",
		});
	}
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message || "Operation completed successfully",
			color: "green",
		});
	} else {
		notifications.show({
			title: "Error",
			message: actionData?.error || "Failed to process request",
			color: "red",
		});
	}

	return actionData;
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};

export function useDeleteMedia() {
	const fetcher = useFetcher<typeof clientAction>();
	const deleteMedia = async (mediaIds: number | number[]) => {
		const formData = new FormData();
		const ids = Array.isArray(mediaIds) ? mediaIds : [mediaIds];
		formData.append("mediaIds", ids.join(","));
		fetcher.submit(formData, { method: "DELETE" });
	};
	return {
		deleteMedia,
		isLoading: fetcher.state !== "idle",
		fetcher,
	};
}

export function useDownloadMedia() {
	const downloadMedia = (file: Media) => {
		if (!file.filename) return;
		const url =
			href(`/api/media/file/:filenameOrId`, { filenameOrId: file.filename }) +
			"?download=true";
		const link = document.createElement("a");
		link.href = url;
		link.download = file.filename;
		link.click();
	};
	return { downloadMedia };
}

export function useUploadMedia() {
	const fetcher = useFetcher<typeof clientAction>();

	const uploadMedia = (file: File, alt?: string, caption?: string) => {
		const formData = new FormData();
		formData.append("file", file);
		if (alt) {
			formData.append("alt", alt);
		}
		if (caption) {
			formData.append("caption", caption);
		}
		fetcher.submit(formData, {
			method: "POST",
			encType: ContentType.MULTIPART,
		});
	};

	return {
		uploadMedia,
		isLoading: fetcher.state !== "idle",
		fetcher,
	};
}

export function useRenameMedia() {
	const fetcher = useFetcher<typeof clientAction>();

	const renameMedia = (mediaId: number, newFilename: string) => {
		const formData = new FormData();
		formData.append("mediaId", mediaId.toString());
		formData.append("newFilename", newFilename);
		fetcher.submit(formData, { method: "PATCH" });
	};

	return {
		renameMedia,
		isLoading: fetcher.state !== "idle",
		fetcher,
	};
}

// Media Header Component
function MediaHeader({
	fullName,
	isOwnProfile,
	totalDocs,
	viewMode,
	onViewModeChange,
	onUploadClick,
}: {
	fullName: string;
	isOwnProfile: boolean;
	totalDocs: number;
	viewMode: "card" | "table";
	onViewModeChange: (value: "card" | "table") => void;
	onUploadClick: () => void;
}) {
	return (
		<Group justify="space-between" align="center">
			<Title order={1}>
				{isOwnProfile ? "My Media Drive" : `${fullName}'s Media Drive`}
			</Title>
			<Group gap="md">
				<Text size="sm" c="dimmed">
					{totalDocs} file{totalDocs !== 1 ? "s" : ""}
				</Text>
				{isOwnProfile && (
					<Button leftSection={<IconPlus size={16} />} onClick={onUploadClick}>
						Upload
					</Button>
				)}
				<SegmentedControl
					data={[
						{
							value: "card",
							label: (
								<Group gap="xs" w={64}>
									<IconLayoutGrid size={16} />
									<Text size="sm">Card</Text>
								</Group>
							),
						},
						{
							value: "table",
							label: (
								<Group gap="xs" w={64}>
									<IconList size={16} />
									<Text size="sm">Table</Text>
								</Group>
							),
						},
					]}
					value={viewMode}
					onChange={(value) => onViewModeChange(value as "card" | "table")}
				/>
			</Group>
		</Group>
	);
}

// Batch Actions Component
function BatchActions({
	selectedCount,
	onDelete,
}: {
	selectedCount: number;
	onDelete: () => void;
}) {
	if (selectedCount === 0) return null;

	return (
		<Group justify="space-between" align="center">
			<Text size="sm" c="dimmed">
				{selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
			</Text>
			<Group gap="xs">
				<Menu shadow="md">
					<Menu.Target>
						<ActionIcon variant="filled" color="red" size="lg">
							<IconTrash size={18} />
						</ActionIcon>
					</Menu.Target>
					<Menu.Dropdown>
						<Menu.Item
							leftSection={<IconTrash size={16} />}
							color="red"
							onClick={onDelete}
						>
							Delete {selectedCount} file{selectedCount !== 1 ? "s" : ""}
						</Menu.Item>
					</Menu.Dropdown>
				</Menu>
			</Group>
		</Group>
	);
}

// Audio Preview Component
function AudioPreview({
	fileUrl,
	filename,
	inline = false,
	onOpenModal,
}: {
	fileUrl: string;
	filename: string;
	inline?: boolean;
	onOpenModal?: () => void;
}) {
	if (inline) {
		return (
			<Group
				justify="center"
				style={{
					width: "100%",
					minHeight: 150,
					cursor: onOpenModal ? "pointer" : "default",
				}}
				onClick={onOpenModal}
			>
				<audio
					controls
					style={{ width: "100%", maxWidth: "100%" }}
					onClick={(e) => e.stopPropagation()}
					aria-label={filename}
				>
					<source src={fileUrl} type="audio/mpeg" />
					<source src={fileUrl} type="audio/wav" />
					<source src={fileUrl} type="audio/ogg" />
					<track
						kind="captions"
						src="data:text/vtt;base64,V0VCVlRUCg=="
						label="No captions available"
						default={false}
					/>
					Your browser does not support the audio element.
				</audio>
			</Group>
		);
	}

	return (
		<Stack gap="md" style={{ width: "100%" }}>
			<audio controls style={{ width: "100%" }} aria-label={filename}>
				<source src={fileUrl} type="audio/mpeg" />
				<source src={fileUrl} type="audio/wav" />
				<source src={fileUrl} type="audio/ogg" />
				<track
					kind="captions"
					src="data:text/vtt;base64,V0VCVlRUCg=="
					label="No captions available"
					default={false}
				/>
				Your browser does not support the audio element.
			</audio>
			<Text size="sm" c="dimmed">
				{filename}
			</Text>
		</Stack>
	);
}

// Video Preview Component
function VideoPreview({
	fileUrl,
	filename,
	inline = false,
	onOpenModal,
}: {
	fileUrl: string;
	filename: string;
	inline?: boolean;
	onOpenModal?: () => void;
}) {
	if (inline) {
		return (
			<Group
				justify="center"
				style={{
					width: "100%",
					minHeight: 150,
					maxHeight: 150,
					cursor: onOpenModal ? "pointer" : "default",
					overflow: "hidden",
				}}
				onClick={onOpenModal}
			>
				<video
					controls
					style={{
						maxWidth: "100%",
						maxHeight: "100%",
						objectFit: "contain",
					}}
					onClick={(e) => e.stopPropagation()}
					aria-label={filename}
				>
					<source src={fileUrl} type="video/mp4" />
					<source src={fileUrl} type="video/webm" />
					<source src={fileUrl} type="video/ogg" />
					<track
						kind="captions"
						src="data:text/vtt;base64,V0VCVlRUCg=="
						label="No captions available"
						default={false}
					/>
					Your browser does not support the video element.
				</video>
			</Group>
		);
	}

	return (
		<Stack gap="md" style={{ width: "100%" }}>
			<video
				controls
				style={{ width: "100%", maxHeight: "80vh" }}
				aria-label={filename}
			>
				<source src={fileUrl} type="video/mp4" />
				<source src={fileUrl} type="video/webm" />
				<source src={fileUrl} type="video/ogg" />
				<track
					kind="captions"
					src="data:text/vtt;base64,V0VCVlRUCg=="
					label="No captions available"
					default={false}
				/>
				Your browser does not support the video element.
			</video>
			<Text size="sm" c="dimmed">
				{filename}
			</Text>
		</Stack>
	);
}

// Media Rename Modal Component
function MediaRenameModal({
	file,
	opened,
	onClose,
	onRename,
}: {
	file: Media | null;
	opened: boolean;
	onClose: () => void;
	onRename: (mediaId: number, newFilename: string) => void;
}) {
	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			filename: file?.filename || "",
		},
		validate: {
			filename: (value) =>
				!value || value.trim().length === 0 ? "Filename is required" : null,
		},
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: form methods are stable and should not be in dependencies
	useEffect(() => {
		if (file) {
			form.setInitialValues({ filename: file.filename ?? "" });
			form.reset();
		}
	}, [file]);

	const handleSubmit = form.onSubmit((values) => {
		if (!file) {
			return;
		}
		onRename(file.id, values.filename.trim());
		onClose();
	});

	return (
		<Modal
			key={file?.id} // Reset state when file changes
			opened={opened}
			onClose={onClose}
			title="Rename File"
			centered
		>
			<form onSubmit={handleSubmit}>
				<Stack gap="md">
					<TextInput
						label="Filename"
						placeholder="Enter new filename"
						{...form.getInputProps("filename")}
					/>
					<Group justify="flex-end">
						<Button variant="subtle" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit">Rename</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}

// Media Usage Modal Component
function MediaUsageModal({
	file,
	opened,
	onClose,
}: {
	file: Media | null;
	opened: boolean;
	onClose: () => void;
}) {
	const { fetchMediaUsage, data, loading, error } = useMediaUsageData();
	const previousFileId = usePrevious(file?.id);
	const previousOpened = usePrevious(opened);
	const dataFileIdRef = useRef<number | null>(null);

	// Fetch usage when modal opens or file changes
	useEffect(() => {
		if (opened && file) {
			// Fetch if modal just opened or file ID changed
			if (!previousOpened || file.id !== previousFileId) {
				dataFileIdRef.current = file.id;
				fetchMediaUsage(file.id);
			}
		}
	}, [opened, file, previousOpened, previousFileId, fetchMediaUsage]);

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title={file ? `Usage for ${file.filename ?? "Media"}` : "Media Usage"}
			centered
		>
			<Stack gap="md">
				{loading && <Text c="dimmed">Loading usage data...</Text>}
				{error && (
					<Text c="red" size="sm">
						Error: {error}
					</Text>
				)}
				{data && file && file.id === dataFileIdRef.current && (
					<>
						<Text size="sm" fw={500}>
							Total Usages: {data.totalUsages}
						</Text>
						{data.totalUsages === 0 ? (
							<Text c="dimmed" size="sm">
								This media file is not currently used anywhere.
							</Text>
						) : (
							<Stack gap="xs">
								{data.usages.map((usage) => (
									<Card
										key={`${usage.collection}-${usage.documentId}-${usage.fieldPath}`}
										withBorder
										padding="xs"
									>
										<Group gap="xs" wrap="nowrap">
											<Text size="sm" fw={500}>
												{usage.collection}
											</Text>
											<Text size="sm" c="dimmed">
												Document ID: {usage.documentId}
											</Text>
											<Text size="sm" c="dimmed">
												Field: {usage.fieldPath}
											</Text>
										</Group>
									</Card>
								))}
							</Stack>
						)}
					</>
				)}
			</Stack>
		</Modal>
	);
}

// Media Preview Modal Component
function MediaPreviewModal({
	file,
	opened,
	onClose,
}: {
	file: Media | null;
	opened: boolean;
	onClose: () => void;
}) {
	if (!file) return null;

	const mediaUrl = file.filename
		? href(`/api/media/file/:filenameOrId`, {
				filenameOrId: file.filename,
			})
		: undefined;

	if (!mediaUrl) return null;

	const renderPreview = () => {
		if (file.mimeType && isImage(file.mimeType)) {
			return (
				<Image
					src={mediaUrl}
					alt={file.alt ?? file.filename ?? "Media"}
					fit="contain"
					style={{ maxHeight: "80vh" }}
				/>
			);
		}

		if (file.mimeType && isAudio(file.mimeType)) {
			return (
				<AudioPreview
					fileUrl={mediaUrl}
					filename={file.filename ?? "Audio"}
					inline={false}
				/>
			);
		}

		if (file.mimeType && isVideo(file.mimeType)) {
			return (
				<VideoPreview
					fileUrl={mediaUrl}
					filename={file.filename ?? "Video"}
					inline={false}
				/>
			);
		}

		if (file.mimeType && isPdf(file.mimeType)) {
			return (
				<iframe
					src={mediaUrl}
					style={{
						width: "100%",
						height: "80vh",
						border: "none",
					}}
					title={file.filename ?? "PDF Preview"}
				/>
			);
		}

		return (
			<Text c="dimmed" ta="center">
				Preview not available for this file type
			</Text>
		);
	};

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title={file.filename ?? "Media Preview"}
			size="xl"
			centered
		>
			{renderPreview()}
		</Modal>
	);
}

// Media Action Menu Component
function MediaActionMenu({
	file,
	onDownload,
	onDelete,
	onPreview,
	onRename,
	onShowUsage,
}: {
	file: Media & { deletePermission?: { allowed: boolean; reason: string } };
	onDownload: (file: Media) => void;
	onDelete: (file: Media) => void;
	onPreview?: (file: Media) => void;
	onRename?: (file: Media) => void;
	onShowUsage?: (file: Media) => void;
}) {
	const canDelete = file.deletePermission?.allowed ?? false;
	const canPreviewFile = canPreview(file.mimeType ?? null);
	const mediaUrl = file.filename
		? href(`/api/media/file/:filenameOrId`, {
				filenameOrId: file.filename,
			})
		: undefined;

	return (
		<Menu shadow="md" width={200}>
			<Menu.Target>
				<ActionIcon variant="subtle" size="sm">
					<IconDots size={16} />
				</ActionIcon>
			</Menu.Target>
			<Menu.Dropdown>
				{canPreviewFile && onPreview && (
					<Menu.Item
						leftSection={<IconEye size={16} />}
						onClick={() => onPreview(file)}
					>
						Preview
					</Menu.Item>
				)}
				{mediaUrl && (
					<Menu.Item
						leftSection={<IconDownload size={16} />}
						onClick={() => onDownload(file)}
					>
						Download
					</Menu.Item>
				)}
				{onShowUsage && (
					<Menu.Item
						leftSection={<IconInfoCircle size={16} />}
						onClick={() => onShowUsage(file)}
					>
						Show Usage
					</Menu.Item>
				)}
				{onRename && (
					<Menu.Item
						leftSection={<IconPencil size={16} />}
						onClick={() => onRename(file)}
					>
						Rename
					</Menu.Item>
				)}
				{canDelete && (
					<Menu.Item
						leftSection={<IconTrash size={16} />}
						color="red"
						onClick={() => onDelete(file)}
					>
						Delete
					</Menu.Item>
				)}
			</Menu.Dropdown>
		</Menu>
	);
}

// Media Card Component
function MediaCard({
	file,
	isSelected,
	onSelectionChange,
	onDownload,
	onDelete,
	onOpenModal,
	onRename,
	onOpenUsageModal,
}: {
	file: Media & { deletePermission?: { allowed: boolean; reason: string } };
	isSelected: boolean;
	onSelectionChange: (selected: boolean) => void;
	onDownload: (file: Media) => void;
	onDelete: (file: Media) => void;
	onOpenModal?: (file: Media) => void;
	onRename?: (file: Media) => void;
	onOpenUsageModal?: (file: Media) => void;
}) {
	const mediaUrl = file.filename
		? href(`/api/media/file/:filenameOrId`, {
				filenameOrId: file.filename,
			})
		: undefined;

	return (
		<Grid.Col key={file.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
			<Card
				withBorder
				padding="md"
				radius="md"
				style={{
					height: "100%",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				<Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
					<Group wrap="nowrap" align="flex-start" gap="xs">
						<Checkbox
							checked={isSelected}
							onChange={(event) =>
								onSelectionChange(event.currentTarget.checked)
							}
							style={{ flexShrink: 0 }}
						/>
						<Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
							{/* Thumbnail, Preview, or Icon */}
							<Group
								justify="center"
								style={{ minHeight: 150, overflow: "hidden" }}
							>
								{file.mimeType && isImage(file.mimeType) && mediaUrl ? (
									<Image
										src={mediaUrl}
										alt={file.alt ?? file.filename ?? "Media"}
										fit="contain"
										style={{
											maxHeight: 150,
											maxWidth: "100%",
										}}
									/>
								) : file.mimeType && isAudio(file.mimeType) && mediaUrl ? (
									<AudioPreview
										fileUrl={mediaUrl}
										filename={file.filename ?? "Audio"}
										inline={true}
									/>
								) : file.mimeType && isVideo(file.mimeType) && mediaUrl ? (
									<VideoPreview
										fileUrl={mediaUrl}
										filename={file.filename ?? "Video"}
										inline={true}
									/>
								) : (
									<Group
										justify="center"
										style={{ width: "100%", height: 150 }}
									>
										{getFileIcon(file.mimeType ?? "application/octet-stream")}
									</Group>
								)}
							</Group>

							{/* File Info */}
							<Stack gap={4} style={{ minWidth: 0 }}>
								<Text
									size="sm"
									fw={500}
									lineClamp={2}
									title={file.filename ?? undefined}
									style={{ wordBreak: "break-word" }}
								>
									{file.filename ?? "Untitled"}
								</Text>
								<Group gap="xs" justify="space-between" wrap="nowrap">
									<Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
										{prettyBytes(file.filesize || 0)}
									</Text>
									<Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
										{dayjs(file.createdAt).format("MMM DD, YYYY")}
									</Text>
								</Group>
								{file.alt && (
									<Text
										size="xs"
										c="dimmed"
										lineClamp={1}
										style={{ wordBreak: "break-word" }}
									>
										{file.alt}
									</Text>
								)}
							</Stack>

							{/* Actions */}
							<Group gap="xs" justify="flex-end">
								<MediaActionMenu
									file={file}
									onDownload={onDownload}
									onDelete={onDelete}
									onPreview={onOpenModal}
									onRename={onRename}
									onShowUsage={onOpenUsageModal}
								/>
							</Group>
						</Stack>
					</Group>
				</Stack>
			</Card>
		</Grid.Col>
	);
}

// Media Card View Component
function MediaCardView({
	media,
	selectedCardIds,
	onSelectionChange,
	onDownload,
	onDelete,
	onOpenModal,
	onRename,
	onOpenUsageModal,
}: {
	media: (Media & {
		deletePermission?: { allowed: boolean; reason: string };
	})[];
	selectedCardIds: number[];
	onSelectionChange: (ids: number[]) => void;
	onDownload: (file: Media) => void;
	onDelete: (file: Media) => void;
	onOpenModal?: (file: Media) => void;
	onRename?: (file: Media) => void;
	onOpenUsageModal?: (file: Media) => void;
}) {
	const handleCheckboxChange = (fileId: number, checked: boolean) => {
		if (checked) {
			onSelectionChange([...selectedCardIds, fileId]);
		} else {
			onSelectionChange(selectedCardIds.filter((id) => id !== fileId));
		}
	};

	return (
		<Grid>
			{media.map((file) => (
				<MediaCard
					key={file.id}
					file={file}
					isSelected={selectedCardIds.includes(file.id)}
					onSelectionChange={(checked) =>
						handleCheckboxChange(file.id, checked)
					}
					onDownload={onDownload}
					onDelete={onDelete}
					onOpenModal={onOpenModal}
					onRename={onRename}
					onOpenUsageModal={onOpenUsageModal}
				/>
			))}
		</Grid>
	);
}

// Media Table View Component
function MediaTableView({
	media,
	selectedRecords,
	onSelectionChange,
	onDownload,
	onDelete,
	onOpenModal,
	onRename,
	onOpenUsageModal,
}: {
	media: (Media & {
		deletePermission?: { allowed: boolean; reason: string };
	})[];
	selectedRecords: (Media & {
		deletePermission?: { allowed: boolean; reason: string };
	})[];
	onSelectionChange: (
		records: (Media & {
			deletePermission?: { allowed: boolean; reason: string };
		})[],
	) => void;
	onDownload: (file: Media) => void;
	onDelete: (file: Media) => void;
	onOpenModal?: (file: Media) => void;
	onRename?: (file: Media) => void;
	onOpenUsageModal?: (file: Media) => void;
}) {
	const columns = [
		{
			accessor: "filename",
			title: "Name",
			render: (file: Media) => (
				<Group gap="xs">
					{file.mimeType?.startsWith("image/") ? (
						<IconPhoto size={20} />
					) : (
						<IconFile size={20} />
					)}
					<Text size="sm" fw={500} lineClamp={1}>
						{file.filename ?? "Untitled"}
					</Text>
				</Group>
			),
		},
		{
			accessor: "filesize",
			title: "Size",
			render: (file: Media) => (
				<Text size="sm" c="dimmed">
					{prettyBytes(file.filesize || 0)}
				</Text>
			),
		},
		{
			accessor: "createdAt",
			title: "Created",
			render: (file: Media) => (
				<Text size="sm" c="dimmed">
					{dayjs(file.createdAt).format("MMM DD, YYYY")}
				</Text>
			),
		},
		{
			accessor: "actions",
			title: "",
			textAlign: "right" as const,
			render: (
				file: Media & {
					deletePermission?: { allowed: boolean; reason: string };
				},
			) => (
				<MediaActionMenu
					file={file}
					onDownload={onDownload}
					onDelete={onDelete}
					onPreview={onOpenModal}
					onRename={onRename}
					onShowUsage={onOpenUsageModal}
				/>
			),
		},
	];

	return (
		<DataTable
			records={media}
			columns={columns}
			selectedRecords={selectedRecords}
			onSelectedRecordsChange={onSelectionChange}
			striped
			highlightOnHover
			withTableBorder
			withColumnBorders
			idAccessor="id"
		/>
	);
}

// Media Pagination Component
function MediaPagination({
	totalPages,
	currentPage,
	onPageChange,
}: {
	totalPages: number;
	currentPage: number;
	onPageChange: (page: number) => void;
}) {
	if (totalPages <= 1) return null;

	return (
		<Group justify="center">
			<Pagination
				total={totalPages}
				value={currentPage}
				onChange={(page) => {
					// TODO: Implement pagination navigation
					console.log("Navigate to page:", page);
					onPageChange(page);
				}}
			/>
		</Group>
	);
}

export default function MediaPage({ loaderData }: Route.ComponentProps) {
	const {
		user,
		media,
		pagination,
		isOwnProfile,
		stats,
		storageLimit,
		uploadLimit,
	} = loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const [viewMode, setViewMode] = useState<"card" | "table">("card");
	const [selectedRecords, setSelectedRecords] = useState<Media[]>([]);
	const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
	const [previewModalOpened, setPreviewModalOpened] = useState(false);
	const [previewFile, setPreviewFile] = useState<Media | null>(null);
	const [renameModalOpened, setRenameModalOpened] = useState(false);
	const [renameFile, setRenameFile] = useState<Media | null>(null);
	const [usageModalOpened, setUsageModalOpened] = useState(false);
	const [usageFile, setUsageFile] = useState<Media | null>(null);
	const fileInputId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { deleteMedia } = useDeleteMedia();
	const { downloadMedia } = useDownloadMedia();
	const { uploadMedia } = useUploadMedia();
	const { renameMedia } = useRenameMedia();

	const handleDownload = (file: Media) => {
		downloadMedia(file);
	};

	const handleDelete = (
		file: Media & { deletePermission?: { allowed: boolean; reason: string } },
	) => {
		if (!file.deletePermission?.allowed) {
			notifications.show({
				title: "Error",
				message:
					file.deletePermission?.reason ||
					"You don't have permission to delete this media",
				color: "red",
			});
			return;
		}

		if (
			!window.confirm(
				"Are you sure you want to delete this media file? This action cannot be undone.",
			)
		) {
			return;
		}

		deleteMedia(file.id);
	};

	const handleBatchDelete = () => {
		const idsToDelete =
			viewMode === "card" ? selectedCardIds : selectedRecords.map((r) => r.id);

		if (idsToDelete.length === 0) {
			return;
		}

		if (
			!window.confirm(
				`Are you sure you want to delete ${idsToDelete.length} media file${idsToDelete.length !== 1 ? "s" : ""}? This action cannot be undone.`,
			)
		) {
			return;
		}

		deleteMedia(idsToDelete);

		// Clear selection after submission
		setSelectedCardIds([]);
		setSelectedRecords([]);
	};

	const handleTableSelectionChange = (records: Media[]) => {
		setSelectedRecords(records);
		// Sync to card selection state
		setSelectedCardIds(records.map((r) => r.id));
	};

	const handleOpenModal = (file: Media) => {
		setPreviewFile(file);
		setPreviewModalOpened(true);
	};

	const handleCloseModal = () => {
		setPreviewModalOpened(false);
		setPreviewFile(null);
	};

	const handleOpenRenameModal = (file: Media) => {
		setRenameFile(file);
		setRenameModalOpened(true);
	};

	const handleCloseRenameModal = () => {
		setRenameModalOpened(false);
		setRenameFile(null);
	};

	const handleRename = (mediaId: number, newFilename: string) => {
		renameMedia(mediaId, newFilename);
	};

	const handleOpenUsageModal = (file: Media) => {
		setUsageFile(file);
		setUsageModalOpened(true);
	};

	const handleCloseUsageModal = () => {
		setUsageModalOpened(false);
		setUsageFile(null);
	};

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			// Get all MIME types from preset options for media upload
			const allMimeTypes = PRESET_FILE_TYPE_OPTIONS.map(
				(option) => option.mimeType,
			);

			// Also include common text-based MIME types that might not be in preset
			const additionalTextTypes = [
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
			];

			const allAcceptedTypes = [
				...new Set([...allMimeTypes, ...additionalTextTypes]),
			];

			if (!allAcceptedTypes.includes(file.type)) {
				notifications.show({
					title: "Upload failed",
					message: "File type not supported",
					color: "red",
				});
				return;
			}

			// Validate file size using server-provided limit
			if (uploadLimit !== undefined && file.size > uploadLimit) {
				notifications.show({
					title: "Upload failed",
					message: `File size exceeds maximum allowed size of ${prettyBytes(uploadLimit)}`,
					color: "red",
				});
				return;
			}

			uploadMedia(file);
		}
		// Reset input so same file can be selected again
		if (event.target) {
			event.target.value = "";
		}
	};

	const handleUploadClick = () => {
		fileInputRef.current?.click();
	};

	return (
		<Container size="lg" py="xl">
			<title>{`Media | ${fullName} | Paideia LMS`}</title>
			<meta
				name="description"
				content={`View ${isOwnProfile ? "your" : fullName + "'s"} media files`}
			/>
			<meta property="og:title" content={`Media | ${fullName} | Paideia LMS`} />
			<meta
				property="og:description"
				content={`View ${isOwnProfile ? "your" : fullName + "'s"} media files`}
			/>

			<Stack gap="xl">
				<MediaHeader
					fullName={fullName}
					isOwnProfile={isOwnProfile}
					totalDocs={pagination.totalDocs}
					viewMode={viewMode}
					onViewModeChange={setViewMode}
					onUploadClick={handleUploadClick}
				/>

				{/* Temporary Stats Section */}
				{stats && (
					<Card withBorder padding="lg" radius="md">
						<Stack gap="lg">
							<Title order={3}>Media Drive Statistics</Title>
							<Grid>
								<Grid.Col span={{ base: 12, md: 6 }}>
									<Stack gap="md">
										<Text fw={500}>Media by Type</Text>
										<PieChart
											data={Object.entries(stats.mediaTypeCount)
												.filter(([, count]) => count > 0)
												.map(([type, count]) => ({
													name: type.charAt(0).toUpperCase() + type.slice(1),
													value: count,
													color: getTypeColor(type),
												}))}
											withTooltip
											withLabels
											labelsType="value"
											h={300}
											w="100%"
										/>
									</Stack>
								</Grid.Col>
								<Grid.Col span={{ base: 12, md: 6 }}>
									<Stack gap="md">
										<Text fw={500}>Storage Usage</Text>
										{storageLimit !== null && storageLimit !== undefined ? (
											<DonutChart
												data={[
													{
														name: "Used",
														value: stats.totalSize,
														color: "blue",
													},
													{
														name: "Available",
														value: Math.max(0, storageLimit - stats.totalSize),
														color: "gray.3",
													},
												]}
												withTooltip
												withLabels
												labelsType="percent"
												chartLabel={`${prettyBytes(stats.totalSize)} / ${prettyBytes(storageLimit)}`}
												h={300}
												w="100%"
											/>
										) : (
											<DonutChart
												data={[
													{
														name: "Used",
														value: stats.totalSize,
														color: "blue",
													},
												]}
												withTooltip
												withLabels
												labelsType="value"
												chartLabel={`${prettyBytes(stats.totalSize)}`}
												h={300}
												w="100%"
											/>
										)}
									</Stack>
								</Grid.Col>
							</Grid>
							<Group gap="md">
								<Text size="sm" c="dimmed">
									Total Files: <strong>{stats.count}</strong>
								</Text>
								<Text size="sm" c="dimmed">
									Total Size: <strong>{prettyBytes(stats.totalSize)}</strong>
								</Text>
								<Text size="sm" c="dimmed">
									Allowance:{" "}
									<strong>
										{storageLimit !== null && storageLimit !== undefined
											? prettyBytes(storageLimit)
											: "Unlimited"}
									</strong>
								</Text>
							</Group>
						</Stack>
					</Card>
				)}

				{/* Hidden file input */}
				{isOwnProfile && (
					<input
						id={fileInputId}
						ref={fileInputRef}
						type="file"
						accept={[
							...PRESET_FILE_TYPE_OPTIONS.map((opt) => opt.mimeType),
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
						].join(",")}
						onChange={handleFileSelect}
						style={{ display: "none" }}
					/>
				)}

				{media.length === 0 ? (
					<Text c="dimmed" ta="center" py="xl">
						No media files yet.
					</Text>
				) : viewMode === "card" ? (
					<>
						<BatchActions
							selectedCount={selectedCardIds.length}
							onDelete={handleBatchDelete}
						/>
						<MediaCardView
							media={media}
							selectedCardIds={selectedCardIds}
							onSelectionChange={setSelectedCardIds}
							onDownload={handleDownload}
							onDelete={handleDelete}
							onOpenModal={handleOpenModal}
							onRename={handleOpenRenameModal}
							onOpenUsageModal={handleOpenUsageModal}
						/>
						<MediaPagination
							totalPages={pagination.totalPages}
							currentPage={pagination.page}
							onPageChange={(page: number) => {
								// TODO: Implement pagination navigation
								console.log("Navigate to page:", page);
							}}
						/>
					</>
				) : (
					<>
						<BatchActions
							selectedCount={selectedRecords.length}
							onDelete={handleBatchDelete}
						/>
						<MediaTableView
							media={media}
							selectedRecords={selectedRecords}
							onSelectionChange={handleTableSelectionChange}
							onDownload={handleDownload}
							onDelete={handleDelete}
							onOpenModal={handleOpenModal}
							onRename={handleOpenRenameModal}
							onOpenUsageModal={handleOpenUsageModal}
						/>
						<MediaPagination
							totalPages={pagination.totalPages}
							currentPage={pagination.page}
							onPageChange={(page: number) => {
								// TODO: Implement pagination navigation
								console.log("Navigate to page:", page);
							}}
						/>
					</>
				)}

				{/* Media Preview Modal */}
				<MediaPreviewModal
					file={previewFile}
					opened={previewModalOpened}
					onClose={handleCloseModal}
				/>

				{/* Media Rename Modal */}
				<MediaRenameModal
					file={renameFile}
					opened={renameModalOpened}
					onClose={handleCloseRenameModal}
					onRename={handleRename}
				/>

				{/* Media Usage Modal */}
				<MediaUsageModal
					file={usageFile}
					opened={usageModalOpened}
					onClose={handleCloseUsageModal}
				/>
			</Stack>
		</Container>
	);
}
