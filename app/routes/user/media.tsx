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
import {
	createLoader,
} from "nuqs/server";
import { parseAsInteger, parseAsStringEnum } from "nuqs";
import prettyBytes from "pretty-bytes";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { href } from "react-router";
import { z } from "zod";
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { typeCreateLoader } from "app/utils/loader-utils";
import { useNuqsSearchParams } from "~/utils/search-params-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryCreateMedia,
	tryDeleteMedia,
	tryFindMediaByUser,
	tryGetMediaById,
	tryGetMediaByIds,
	tryGetUserMediaStats,
	tryRenameMedia,
} from "server/internal/media-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import type { Media } from "server/payload-types";
import { permissions } from "server/utils/permissions";
import { useMediaUsageData } from "~/routes/api/media-usage";
import { PRESET_FILE_TYPE_OPTIONS } from "~/utils/file-types";
import {
	canPreview,
	getFileIcon,
	getTypeColor,
	isAudio,
	isImage,
	isPdf,
	isVideo,
} from "~/utils/media-helpers";
import {
	badRequest,
	ForbiddenResponse,
	NotFoundResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/media";
import { userProfileContextKey } from "server/contexts/user-profile-context";

// Define search params
const loaderSearchParams = {
	viewMode: parseAsStringEnum(["card", "table"]).withDefault("card"),
	page: parseAsInteger.withDefault(1),
};

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader({
	searchParams: loaderSearchParams,
})(async ({ context, params, searchParams }) => {
	const { payload, systemGlobals, payloadRequest } =
		context.get(globalContextKey);
	const userSession = context.get(userContextKey);
	const userProfileContext = context.get(userProfileContextKey);

	if (!userSession?.isAuthenticated) {
		throw new NotFoundResponse("Unauthorized");
	}

	if (!userProfileContext) {
		throw new NotFoundResponse("User not found");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (!currentUser) {
		throw new NotFoundResponse("Unauthorized");
	}

	const userId = params.id ?? currentUser.id;

	// Check if user can access this data
	if (userId !== currentUser.id && currentUser.role !== "admin") {
		throw new ForbiddenResponse("You can only view your own media");
	}

	// Get storage limit from system globals
	const storageLimit = systemGlobals.sitePolicies.userMediaStorageTotal;
	const uploadLimit = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	// Fetch media for the user
	const mediaResult = await tryFindMediaByUser({
		payload,
		userId,
		limit: 20,
		page: searchParams.page,
		depth: 0,
		req: payloadRequest,
	});

	if (!mediaResult.ok) {
		throw new NotFoundResponse("Failed to fetch media");
	}

	// Check permissions for each media item
	const mediaWithPermissions = mediaResult.value.docs.map((file) => {
		const deletePermission = permissions.media.canDelete(
			currentUser,
			file.createdBy.id,
		);
		return {
			...file,
			deletePermission,
		};
	});

	// Get media stats
	const stats = await tryGetUserMediaStats({
		payload,
		userId,
		req: payloadRequest,
	}).getOrNull();

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
		searchParams,
	};
});

enum Action {
	Upload = "upload",
	Update = "update",
	Delete = "delete",
}

// Define search params for media actions
export const mediaSearchParams = {
	action: parseAsStringEnum(Object.values(Action)),
};

export const loadSearchParams = createLoader(mediaSearchParams);

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/user/media/:id?",
});

const createUploadActionRpc = createActionRpc({
	formDataSchema: z.object({
		file: z.file(),
		alt: z.string().optional(),
		caption: z.string().optional(),
	}),
	method: "POST",
	action: Action.Upload,
});

const createUpdateActionRpc = createActionRpc({
	formDataSchema: z.object({
		mediaId: z.string().min(1),
		newFilename: z.string().optional(),
		alt: z.string().optional(),
		caption: z.string().optional(),
	}),
	method: "POST",
	action: Action.Update,
});

const createDeleteActionRpc = createActionRpc({
	formDataSchema: z.object({
		mediaIds: z.number().array(),
	}),
	method: "POST",
	action: Action.Delete,
});

const uploadAction = createUploadActionRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, systemGlobals, payloadRequest } =
			context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const userId = params.id ? Number(params.id) : currentUser.id;

		// Check if user can access this data
		if (userId !== currentUser.id && currentUser.role !== "admin") {
			return unauthorized({ error: "You can only manage your own media" });
		}

		// Get upload limit from system globals
		const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

		const file = formData.file;

		if (!file || !(file instanceof File)) {
			return badRequest({ error: "File is required" });
		}

		// Validate file size
		if (maxFileSize !== undefined && file.size > maxFileSize) {
			return badRequest({
				error: `File size exceeds maximum allowed size of ${prettyBytes(maxFileSize)}`,
			});
		}

		// Convert file to buffer
		const arrayBuffer = await file.arrayBuffer();
		const fileBuffer = Buffer.from(arrayBuffer);

		// Create media using tryCreateMedia
		const createResult = await tryCreateMedia({
			payload,
			file: fileBuffer,
			filename: file.name,
			mimeType: file.type || "application/octet-stream",
			alt: formData.alt,
			caption: formData.caption,
			userId,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!createResult.ok) {
			return badRequest({
				error: createResult.error.message || "Failed to upload media",
			});
		}

		return ok({
			message: "Media uploaded successfully",
		});
	},
);

const useUpload = createUploadActionRpc.createHook<typeof uploadAction>();

const updateAction = createUpdateActionRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, s3Client, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const userId = params.id ? Number(params.id) : currentUser.id;

		// Check if user can access this data
		if (userId !== currentUser.id && currentUser.role !== "admin") {
			return unauthorized({ error: "You can only manage your own media" });
		}

		const mediaId = Number(formData.mediaId);
		if (Number.isNaN(mediaId)) {
			return badRequest({ error: "Invalid media ID" });
		}

		const transactionInfo = await handleTransactionId(payload, payloadRequest);
		return await transactionInfo.tx(async (txInfo) => {
			// Fetch media record to check permissions
			const mediaRecordResult = await tryGetMediaById({
				payload,
				id: mediaId,
				req: txInfo.reqWithTransaction,
			});

			if (!mediaRecordResult.ok) {
				return badRequest({ error: mediaRecordResult.error.message });
			}

			const mediaRecord = mediaRecordResult.value;

			// Check permissions
			const createdById = mediaRecord.createdBy.id;
			const deletePermission = permissions.media.canDelete(
				currentUser,
				createdById,
			);

			if (!deletePermission.allowed) {
				return unauthorized({
					error:
						deletePermission.reason ||
						"You don't have permission to update this media",
				});
			}

			// If newFilename is provided, rename the file
			if (formData.newFilename) {
				const renameResult = await tryRenameMedia({
					payload,
					s3Client,
					id: mediaId,
					newFilename: formData.newFilename,
					userId: currentUser.id,
					req: txInfo.reqWithTransaction,
				});

				if (!renameResult.ok) {
					return badRequest({ error: renameResult.error.message });
				}
			}

			// Update alt and caption if provided
			if (formData.alt !== undefined || formData.caption !== undefined) {
				const updateData: Partial<Media> = {};
				if (formData.alt !== undefined) {
					updateData.alt = formData.alt;
				}
				if (formData.caption !== undefined) {
					updateData.caption = formData.caption;
				}

				await payload.update({
					collection: "media",
					id: mediaId,
					data: updateData,
					req: txInfo.reqWithTransaction,
				});
			}

			return ok({
				message: "Media updated successfully",
			});
		});
	},
);

const useUpdate = createUpdateActionRpc.createHook<typeof updateAction>();

const deleteAction = createDeleteActionRpc.createAction(
	async ({ context, formData, params }) => {
		const { payload, s3Client, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (!currentUser) {
			return unauthorized({ error: "Unauthorized" });
		}

		const userId = params.id ? Number(params.id) : currentUser.id;

		// Check if user can access this data
		if (userId !== currentUser.id && currentUser.role !== "admin") {
			return unauthorized({ error: "You can only manage your own media" });
		}

		if (formData.mediaIds.length === 0) {
			return badRequest({ error: "At least one media ID is required" });
		}

		// Fetch media records to check permissions
		const mediaRecordsResult = await tryGetMediaByIds({
			payload,
			ids: formData.mediaIds,
			req: payloadRequest,
		});

		if (!mediaRecordsResult.ok) {
			return badRequest({ error: mediaRecordsResult.error.message });
		}

		const mediaRecords = mediaRecordsResult.value;

		// Check permissions for each media item
		for (const media of mediaRecords.docs) {
			const createdById = media.createdBy;
			const deletePermission = permissions.media.canDelete(
				currentUser,
				createdById,
			);

			if (!deletePermission.allowed) {
				return unauthorized({
					error:
						deletePermission.reason ||
						"You don't have permission to delete this media",
				});
			}
		}

		// Verify all media records were found
		if (mediaRecords.docs.length !== formData.mediaIds.length) {
			const foundIds = mediaRecords.docs.map((m) => m.id);
			const missingIds = formData.mediaIds.filter(
				(id) => !foundIds.includes(id),
			);
			return badRequest({
				error: `Media records not found: ${missingIds.join(", ")}`,
			});
		}

		const result = await tryDeleteMedia({
			payload,
			s3Client,
			id: formData.mediaIds,
			req: payloadRequest,
		});

		if (!result.ok) {
			return badRequest({
				error: result.error?.message ?? "Failed to delete media",
			});
		}

		return ok({
			message:
				formData.mediaIds.length === 1
					? "Media deleted successfully"
					: `${formData.mediaIds.length} media files deleted successfully`,
		});
	},
);

const useDelete = createDeleteActionRpc.createHook<typeof deleteAction>();

const [action] = createActionMap({
	[Action.Upload]: uploadAction,
	[Action.Update]: updateAction,
	[Action.Delete]: deleteAction,
});

export { action };

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message || "Operation completed successfully",
			color: "green",
		});
	} else if (actionData?.status === StatusCode.BadRequest) {
		notifications.show({
			title: "Error",
			message: actionData.error || "Failed to process request",
			color: "red",
		});
	} else if (actionData?.status === StatusCode.Unauthorized) {
		notifications.show({
			title: "Error",
			message: actionData.error || "Unauthorized",
			color: "red",
		});
	}

	return actionData;
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	return <DefaultErrorBoundary error={error} />;
};


export function useDownloadMedia() {
	const downloadMedia = (file: Media) => {
		if (!file.id) return;
		const url =
			href(`/api/media/file/:mediaId`, { mediaId: file.id.toString() }) +
			"?download=true";
		const link = document.createElement("a");
		link.href = url;
		link.download = file.filename || `file-${file.id}`;
		link.click();
	};
	return { downloadMedia };
}

export function useUploadMedia(userId?: number) {
	const { submit: uploadMedia, isLoading, fetcher } = useUpload();
	return {
		uploadMedia: async (file: File, alt?: string, caption?: string) => {
			await uploadMedia({
				values: {
					file,
					alt,
					caption,
				},
				params: userId ? { id: userId } : {},
			});
		},
		isLoading,
		fetcher,
	};
}

export function useRenameMedia(userId?: number) {
	const { submit: updateMedia, isLoading, fetcher } = useUpdate();
	return {
		renameMedia: async (mediaId: number, newFilename: string) => {
			await updateMedia({
				values: {
					mediaId: mediaId.toString(),
					newFilename,
				},
				params: userId ? { id: userId } : {},
			});
		},
		isLoading,
		fetcher,
	};
}

// Upload Button Component
function UploadButton({
	userId,
	uploadLimit,
}: {
	userId: number;
	uploadLimit?: number;
}) {
	const fileInputId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { uploadMedia } = useUploadMedia(userId);

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
		<>
			<Button leftSection={<IconPlus size={16} />} onClick={handleUploadClick}>
				Upload
			</Button>
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
		</>
	);
}

// Media Header Component
function MediaHeader({
	fullName,
	isOwnProfile,
	totalDocs,
	viewMode,
	userId,
	uploadLimit,
}: {
	fullName: string;
	isOwnProfile: boolean;
	totalDocs: number;
	viewMode: "card" | "table";
	userId: number;
	uploadLimit?: number;
}) {
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);

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
					<UploadButton userId={userId} uploadLimit={uploadLimit} />
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
					onChange={(value) => {
						setQueryParams({ viewMode: value as "card" | "table" });
					}}
				/>
			</Group>
		</Group>
	);
}

// Batch Actions Component
function BatchActions({
	selectedCount,
	selectedCardIds,
	userId,
	onSelectionClear,
}: {
	selectedCount: number;
	selectedCardIds: number[];
	userId: number;
	onSelectionClear: () => void;
}) {
	const { submit: deleteMedia } = useDelete();

	if (selectedCount === 0) return null;

	const handleDelete = async () => {
		if (selectedCardIds.length === 0) {
			return;
		}

		if (
			!window.confirm(
				`Are you sure you want to delete ${selectedCardIds.length} media file${selectedCardIds.length !== 1 ? "s" : ""}? This action cannot be undone.`,
			)
		) {
			return;
		}

		await deleteMedia({
			values: {
				mediaIds: selectedCardIds,
			},
			params: { id: userId },
		});

		onSelectionClear();
	};

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
							onClick={handleDelete}
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
}: {
	fileUrl: string;
	filename: string;
	inline?: boolean;
}) {
	if (inline) {
		return (
			<Group
				justify="center"
				style={{
					width: "100%",
					minHeight: 150,
					maxHeight: 150,
					overflow: "hidden",
				}}
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
	userId,
}: {
	file: Media | null;
	opened: boolean;
	onClose: () => void;
	userId: number;
}) {
	const { renameMedia } = useRenameMedia(userId);
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

	const handleSubmit = form.onSubmit(async (values) => {
		if (!file) {
			return;
		}
		await renameMedia(file.id, values.filename.trim());
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
	const {
		load: fetchMediaUsage,
		data: mediaUsageData,
		isLoading,
	} = useMediaUsageData();
	const previousFileId = usePrevious(file?.id);
	const previousOpened = usePrevious(opened);
	const dataFileIdRef = useRef<number | null>(null);

	// Fetch usage when modal opens or file changes
	useEffect(() => {
		if (opened && file) {
			// Fetch if modal just opened or file ID changed
			if (!previousOpened || file.id !== previousFileId) {
				dataFileIdRef.current = file.id;
				fetchMediaUsage({ params: { mediaId: file.id } });
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
				{isLoading && <Text c="dimmed">Loading usage data...</Text>}
				{mediaUsageData?.status === StatusCode.BadRequest && (
					<Text c="red" size="sm">
						Error: {mediaUsageData.error}
					</Text>
				)}
				{mediaUsageData?.status === StatusCode.Ok &&
					file &&
					file.id === dataFileIdRef.current && (
						<>
							<Text size="sm" fw={500}>
								Total Usages: {mediaUsageData.totalUsages}
							</Text>
							{mediaUsageData.totalUsages === 0 ? (
								<Text c="dimmed" size="sm">
									This media file is not currently used anywhere.
								</Text>
							) : (
								<Stack gap="xs">
									{mediaUsageData.usages.map((usage) => (
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

	const mediaUrl = file.id
		? href(`/api/media/file/:mediaId`, {
			mediaId: file.id.toString(),
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
	userId,
}: {
	file: Media & { deletePermission?: { allowed: boolean; reason: string } };
	userId: number;
}) {
	const { downloadMedia } = useDownloadMedia();
	const { submit: deleteMedia } = useDelete();

	const [previewModalOpened, setPreviewModalOpened] = useState(false);
	const [renameModalOpened, setRenameModalOpened] = useState(false);
	const [usageModalOpened, setUsageModalOpened] = useState(false);

	const canDelete = file.deletePermission?.allowed ?? false;
	const canPreviewFile = canPreview(file.mimeType ?? null);
	const mediaUrl = file.id
		? href(`/api/media/file/:mediaId`, {
			mediaId: file.id.toString(),
		})
		: undefined;

	const handleDelete = async () => {
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

		await deleteMedia({
			values: {
				mediaIds: [file.id],
			},
			params: { id: userId },
		});
	};

	return (
		<>
			<Menu shadow="md" width={200}>
				<Menu.Target>
					<ActionIcon variant="subtle" size="sm">
						<IconDots size={16} />
					</ActionIcon>
				</Menu.Target>
				<Menu.Dropdown>
					{canPreviewFile && (
						<Menu.Item
							leftSection={<IconEye size={16} />}
							onClick={() => setPreviewModalOpened(true)}
						>
							Preview
						</Menu.Item>
					)}
					{mediaUrl && (
						<Menu.Item
							leftSection={<IconDownload size={16} />}
							onClick={() => downloadMedia(file)}
						>
							Download
						</Menu.Item>
					)}
					<Menu.Item
						leftSection={<IconInfoCircle size={16} />}
						onClick={() => setUsageModalOpened(true)}
					>
						Show Usage
					</Menu.Item>
					<Menu.Item
						leftSection={<IconPencil size={16} />}
						onClick={() => setRenameModalOpened(true)}
					>
						Rename
					</Menu.Item>
					{canDelete && (
						<Menu.Item
							leftSection={<IconTrash size={16} />}
							color="red"
							onClick={handleDelete}
						>
							Delete
						</Menu.Item>
					)}
				</Menu.Dropdown>
			</Menu>

			<MediaPreviewModal
				file={file}
				opened={previewModalOpened}
				onClose={() => setPreviewModalOpened(false)}
			/>

			<MediaRenameModal
				file={file}
				opened={renameModalOpened}
				onClose={() => setRenameModalOpened(false)}
				userId={userId}
			/>

			<MediaUsageModal
				file={file}
				opened={usageModalOpened}
				onClose={() => setUsageModalOpened(false)}
			/>
		</>
	);
}

// Media Card Component
function MediaCard({
	file,
	isSelected,
	onSelectionChange,
	userId,
}: {
	file: Media & { deletePermission?: { allowed: boolean; reason: string } };
	isSelected: boolean;
	onSelectionChange: (selected: boolean) => void;
	userId: number;
}) {
	const mediaUrl = file.id
		? href(`/api/media/file/:mediaId`, {
			mediaId: file.id.toString(),
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
								<MediaActionMenu file={file} userId={userId} />
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
	userId,
}: {
	media: (Media & {
		deletePermission?: { allowed: boolean; reason: string };
	})[];
	selectedCardIds: number[];
	onSelectionChange: (ids: number[]) => void;
	userId: number;
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
					userId={userId}
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
	userId,
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
	userId: number;
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
				<MediaActionMenu file={file} userId={userId} />
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
}: {
	totalPages: number;
	currentPage: number;
}) {
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);

	if (totalPages <= 1) return null;

	return (
		<Group justify="center">
			<Pagination
				total={totalPages}
				value={currentPage}
				onChange={(page) => {
					setQueryParams({ page });
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
		searchParams: { viewMode },
	} = loaderData;
	const fullName = `${user.firstName} ${user.lastName}`.trim() || "Anonymous";
	const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);

	// Derive selectedRecords from selectedCardIds and media
	const selectedRecords = useMemo(
		() => media.filter((record) => selectedCardIds.includes(record.id)),
		[media, selectedCardIds],
	);

	const handleTableSelectionChange = (records: Media[]) => {
		setSelectedCardIds(records.map((r) => r.id));
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
					userId={user.id}
					uploadLimit={uploadLimit}
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

				{media.length === 0 ? (
					<Text c="dimmed" ta="center" py="xl">
						No media files yet.
					</Text>
				) : viewMode === "card" ? (
					<>
						<BatchActions
							selectedCount={selectedCardIds.length}
							selectedCardIds={selectedCardIds}
							userId={user.id}
							onSelectionClear={() => setSelectedCardIds([])}
						/>
						<MediaCardView
							media={media}
							selectedCardIds={selectedCardIds}
							onSelectionChange={setSelectedCardIds}
							userId={user.id}
						/>
						<MediaPagination
							totalPages={pagination.totalPages}
							currentPage={pagination.page}
						/>
					</>
				) : (
					<>
						<BatchActions
							selectedCount={selectedRecords.length}
							selectedCardIds={selectedCardIds}
							userId={user.id}
							onSelectionClear={() => setSelectedCardIds([])}
						/>
						<MediaTableView
							media={media}
							selectedRecords={selectedRecords}
							onSelectionChange={handleTableSelectionChange}
							userId={user.id}
						/>
						<MediaPagination
							totalPages={pagination.totalPages}
							currentPage={pagination.page}
						/>
					</>
				)}
			</Stack>
		</Container>
	);
}
