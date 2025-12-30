import { DonutChart, PieChart } from "@mantine/charts";
import {
	ActionIcon,
	Avatar,
	Box,
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
	Select,
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
	IconTrash,
} from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import dayjs from "dayjs";
import { DataTable } from "mantine-datatable";
import { useQueryState } from "nuqs";
import {
	createLoader,
	parseAsInteger,
	parseAsStringEnum as parseAsStringEnumServer,
} from "nuqs/server";
import prettyBytes from "pretty-bytes";
import { useEffect, useRef, useState } from "react";
import { href, Link } from "react-router";
import { typeCreateActionRpc } from "~/utils/action-utils";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryDeleteMedia,
	tryDeleteOrphanedMedia,
	tryFindMediaByUser,
	tryGetAllMedia,
	tryGetMediaByIds,
	tryGetOrphanedMedia,
	tryGetSystemMediaStats,
	tryGetUserMediaStats,
	tryPruneAllOrphanedMedia,
	tryRenameMedia,
} from "server/internal/media-management";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import { tryFindAllUsers } from "server/internal/user-management";
import type { Media } from "server/payload-types";
import { serverOnly$ } from "vite-env-only/macros";
import { useMediaUsageData } from "~/routes/api/media-usage";
import { stringify } from "qs";
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
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/media";
import { z } from "zod";

// Define search params
export const mediaSearchParams = {
	userId: parseAsInteger,
	page: parseAsInteger.withDefault(1),
	orphanedPage: parseAsInteger.withDefault(1),
};

export const loadSearchParams = createLoader(mediaSearchParams);

enum Action {
	UpdateMedia = "updateMedia",
	DeleteMedia = "deleteMedia",
	DeleteOrphanedMedia = "deleteOrphanedMedia",
	PruneAllOrphanedMedia = "pruneAllOrphanedMedia",
}

// Define search params for media actions
export const mediaActionSearchParams = {
	action: parseAsStringEnumServer(Object.values(Action)),
};

export const loadActionSearchParams = createLoader(mediaActionSearchParams);

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createUpdateMediaActionRpc = createActionRpc({
	formDataSchema: z.object({
		mediaId: z.coerce.number(),
		newFilename: z.string().optional(),
		alt: z.string().optional(),
		caption: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateMedia,
});

const createDeleteMediaActionRpc = createActionRpc({
	formDataSchema: z.object({
		mediaIds: z.string().min(1),
	}),
	method: "POST",
	action: Action.DeleteMedia,
});

const createDeleteOrphanedMediaActionRpc = createActionRpc({
	formDataSchema: z.object({
		filenames: z.string().min(1),
	}),
	method: "POST",
	action: Action.DeleteOrphanedMedia,
});

const createPruneAllOrphanedMediaActionRpc = createActionRpc({
	method: "POST",
	action: Action.PruneAllOrphanedMedia,
});

export function getRouteUrl(action: Action) {
	return href("/admin/media") + "?" + stringify({ action });
}

export const loader = async ({ context, request }: Route.LoaderArgs) => {
	const globalContext = context.get(globalContextKey);
	const { payload, s3Client, payloadRequest } = globalContext;
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser || userSession.authenticatedUser;

	if (!currentUser || currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can access this page");
	}

	// Get search params
	const { userId, page, orphanedPage } = loadSearchParams(request);
	const limit = 20;

	// Fetch media - either for a specific user or all media
	let mediaResult:
		| Awaited<ReturnType<typeof tryFindMediaByUser>>
		| Awaited<ReturnType<typeof tryGetAllMedia>>;
	let statsResult:
		| Awaited<ReturnType<typeof tryGetUserMediaStats>>
		| Awaited<ReturnType<typeof tryGetSystemMediaStats>>;
	let systemStatsResult: Awaited<
		ReturnType<typeof tryGetSystemMediaStats>
	> | null = null;

	if (userId) {
		// Fetch media for specific user
		mediaResult = await tryFindMediaByUser({
			payload,
			userId,
			limit,
			page,
			depth: 1, // Include createdBy user info
			req: payloadRequest,
			overrideAccess: true,
		});

		// Get user-specific stats
		statsResult = await tryGetUserMediaStats({
			payload,
			userId,
			req: payloadRequest,
			overrideAccess: true,
		});

		// Also get system-wide stats for comparison
		systemStatsResult = await tryGetSystemMediaStats({
			payload,
			req: payloadRequest,
		});
	} else {
		// Fetch all media in the system
		mediaResult = await tryGetAllMedia({
			payload,
			limit,
			page,
			req: payloadRequest,
		});

		// Get system-wide media stats
		statsResult = await tryGetSystemMediaStats({
			payload,
			req: payloadRequest,
		});
	}

	if (!mediaResult.ok) {
		throw new ForbiddenResponse("Failed to fetch media");
	}

	// Admin can delete/rename any media, so all have deletePermission
	const mediaWithPermissions = mediaResult.value.docs.map((file) => ({
		...file,
		deletePermission: { allowed: true, reason: "" },
	}));

	const stats = statsResult.ok ? statsResult.value : null;
	const systemStats = systemStatsResult?.ok ? systemStatsResult.value : null;

	// Fetch users for the filter dropdown
	const usersResult = await tryFindAllUsers({
		payload,
		limit: 100,
		page: 1,
		sort: "-createdAt",
		req: payloadRequest,
	});

	const userOptions = usersResult.ok
		? usersResult.value.docs.map((user) => ({
				value: user.id.toString(),
				label:
					`${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
			}))
		: [];

	// Fetch orphaned media files
	const orphanedMediaResult = await tryGetOrphanedMedia({
		payload,
		s3Client,
		limit,
		page: orphanedPage,
		req: payloadRequest,
	});

	const orphanedMedia = orphanedMediaResult.ok
		? orphanedMediaResult.value
		: null;

	return {
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
		stats,
		systemStats,
		selectedUserId: userId ?? null,
		userOptions,
		orphanedMedia,
	};
};

const [updateMediaAction, useUpdateMedia] = createUpdateMediaActionRpc(
	serverOnly$(async ({ context, formData }) => {
		const { payload, s3Client, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		if (!currentUser || currentUser.role !== "admin") {
			return unauthorized({ error: "Only admins can perform this action" });
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Fetch media record to verify it exists
			const mediaRecord = await payload.findByID({
				collection: "media",
				id: formData.mediaId,
				depth: 0,
				req: reqWithTransaction,
			});

			if (!mediaRecord) {
				return badRequest({ error: "Media not found" });
			}

			// If newFilename is provided, rename the file
			if (formData.newFilename) {
				const renameResult = await tryRenameMedia({
					payload,
					s3Client,
					id: formData.mediaId,
					newFilename: formData.newFilename,
					userId: currentUser.id,
					req: reqWithTransaction,
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
					id: formData.mediaId,
					data: updateData,
					req: reqWithTransaction,
				});
			}

			return ok({
				message: "Media updated successfully",
			});
		});
	})!,
	{
		action: ({ searchParams }) => getRouteUrl(searchParams.action),
	},
);

const [deleteMediaAction, useDeleteMedia] = createDeleteMediaActionRpc(
	serverOnly$(async ({ context, formData }) => {
		const { payload, s3Client, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		if (!currentUser || currentUser.role !== "admin") {
			return unauthorized({ error: "Only admins can perform this action" });
		}

		// Handle transaction ID
		const transactionInfo = await handleTransactionId(payload, payloadRequest);

		return transactionInfo.tx(
			async ({ reqWithTransaction }) => {
				// Parse media IDs - can be a single ID or comma-separated IDs
				const mediaIds = formData.mediaIds
					.split(",")
					.map((id) => Number(id.trim()))
					.filter((id) => !Number.isNaN(id));

				if (mediaIds.length === 0) {
					return badRequest({ error: "At least one media ID is required" });
				}

				// Verify all media records exist
				const mediaRecordsResult = await tryGetMediaByIds({
					payload,
					ids: mediaIds,
					req: reqWithTransaction,
				});

				if (!mediaRecordsResult.ok) {
					return badRequest({ error: mediaRecordsResult.error.message });
				}

				const mediaRecords = mediaRecordsResult.value;

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
					id: mediaIds,
					req: reqWithTransaction,
				});

				if (!result.ok) {
					return badRequest({ error: result.error.message });
				}

				return ok({
					message:
						mediaIds.length === 1
							? "Media deleted successfully"
							: `${mediaIds.length} media files deleted successfully`,
				});
			},
			(result) => {
				return result.data.status === StatusCode.BadRequest;
			},
		);
	})!,
	{
		action: ({ searchParams }) => getRouteUrl(searchParams.action),
	},
);

const [deleteOrphanedMediaAction, useDeleteOrphanedMedia] =
	createDeleteOrphanedMediaActionRpc(
		serverOnly$(async ({ context, formData }) => {
			const { payload, s3Client, payloadRequest } =
				context.get(globalContextKey);
			const userSession = context.get(userContextKey);

			if (!userSession?.isAuthenticated) {
				return unauthorized({ error: "Unauthorized" });
			}

			const currentUser =
				userSession.effectiveUser || userSession.authenticatedUser;

			if (!currentUser || currentUser.role !== "admin") {
				return unauthorized({ error: "Only admins can perform this action" });
			}

			// Handle transaction ID
			const transactionInfo = await handleTransactionId(
				payload,
				payloadRequest,
			);

			return transactionInfo.tx(
				async ({ reqWithTransaction }) => {
					// Parse filenames - can be a single filename or comma-separated filenames
					const filenames = formData.filenames
						.split(",")
						.map((name) => name.trim())
						.filter((name) => name.length > 0);

					if (filenames.length === 0) {
						return badRequest({ error: "At least one filename is required" });
					}

					const result = await tryDeleteOrphanedMedia({
						payload,
						s3Client,
						filenames,
						req: reqWithTransaction,
						overrideAccess: true,
					});

					if (!result.ok) {
						return badRequest({ error: result.error.message });
					}

					return ok({
						message:
							result.value.deletedCount === 1
								? "Orphaned file deleted successfully"
								: `${result.value.deletedCount} orphaned files deleted successfully`,
					});
				},
				(result) => {
					return result.data.status === StatusCode.BadRequest;
				},
			);
		})!,
		{
			action: ({ searchParams }) => getRouteUrl(searchParams.action),
		},
	);

const [pruneAllOrphanedMediaAction, usePruneAllOrphanedMedia] =
	createPruneAllOrphanedMediaActionRpc(
		serverOnly$(async ({ context }) => {
			const { payload, s3Client, payloadRequest } =
				context.get(globalContextKey);
			const userSession = context.get(userContextKey);

			if (!userSession?.isAuthenticated) {
				return unauthorized({ error: "Unauthorized" });
			}

			const currentUser =
				userSession.effectiveUser || userSession.authenticatedUser;

			if (!currentUser || currentUser.role !== "admin") {
				return unauthorized({ error: "Only admins can perform this action" });
			}

			// Handle transaction ID
			const transactionInfo = await handleTransactionId(
				payload,
				payloadRequest,
			);

			return transactionInfo.tx(async ({ reqWithTransaction }) => {
				const result = await tryPruneAllOrphanedMedia({
					payload,
					s3Client,
					req: reqWithTransaction,
					overrideAccess: true,
				});

				if (!result.ok) {
					return badRequest({ error: result.error.message });
				}

				if (result.value.deletedCount === 0) {
					return ok({
						message: "No orphaned files to delete",
					});
				}

				return ok({
					message: `Pruned ${result.value.deletedCount} orphaned file${result.value.deletedCount !== 1 ? "s" : ""} successfully`,
				});
			});
		})!,
		{
			action: ({ searchParams }) => getRouteUrl(searchParams.action),
		},
	);

// Export hooks for use in components
export {
	useDeleteMedia,
	useUpdateMedia,
	useDeleteOrphanedMedia,
	usePruneAllOrphanedMedia,
};

const actionMap = {
	[Action.UpdateMedia]: updateMediaAction,
	[Action.DeleteMedia]: deleteMediaAction,
	[Action.DeleteOrphanedMedia]: deleteOrphanedMediaAction,
	[Action.PruneAllOrphanedMedia]: pruneAllOrphanedMediaAction,
};

export const action = async (args: Route.ActionArgs) => {
	const { request } = args;
	const { action: actionType } = loadActionSearchParams(request);

	if (!actionType) {
		return badRequest({ error: "Action is required" });
	}

	const actionHandler = actionMap[actionType];
	if (!actionHandler) {
		return badRequest({ error: "Invalid action" });
	}

	return actionHandler(args);
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

export function useDownloadMedia() {
	const downloadMedia = (file: Media) => {
		if (!file.filename) return;
		const url = `/api/media/file/${file.filename}?download=true`;
		const link = document.createElement("a");
		link.href = url;
		link.download = file.filename;
		link.click();
	};
	return { downloadMedia };
}

// Media Header Component
function MediaHeader({
	totalDocs,
	viewMode,
	onViewModeChange,
	selectedUserId,
	onUserIdChange,
	userOptions,
}: {
	totalDocs: number;
	viewMode: "card" | "table";
	onViewModeChange: (value: "card" | "table") => void;
	selectedUserId: number | null;
	onUserIdChange: (userId: number | null) => void;
	userOptions: Array<{ value: string; label: string }>;
}) {
	return (
		<Stack gap="md">
			<Group justify="space-between" align="center">
				<Title order={1}>
					{selectedUserId ? "User Media" : "System Media"}
				</Title>
				<Group gap="md">
					<Text size="sm" c="dimmed">
						{totalDocs} file{totalDocs !== 1 ? "s" : ""}
					</Text>
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
			<Select
				label="Filter by User"
				placeholder="Select a user to filter media (leave empty for all media)"
				data={userOptions}
				value={selectedUserId?.toString() || null}
				onChange={(value) => {
					onUserIdChange(value ? Number(value) : null);
				}}
				searchable
				clearable
				w={400}
			/>
		</Stack>
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: file changes should reset form
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
	const canDelete = file.deletePermission?.allowed ?? true; // Admin can always delete
	const canPreviewFile = canPreview(file.mimeType ?? null);
	const mediaUrl = file.id
		? href(`/api/media/file/:mediaId`, {
				mediaId: file.id.toString(),
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
	const mediaUrl = file.id
		? href(`/api/media/file/:mediaId`, {
				mediaId: file.id.toString(),
			})
		: undefined;

	// Get creator info
	const creatorId =
		typeof file.createdBy === "object" && file.createdBy !== null
			? file.createdBy.id
			: file.createdBy;
	const creatorName =
		typeof file.createdBy === "object" && file.createdBy !== null
			? `${file.createdBy.firstName || ""} ${file.createdBy.lastName || ""}`.trim() ||
				"Unknown"
			: "Unknown";
	const creatorAvatarId =
		typeof file.createdBy === "object" && file.createdBy !== null
			? typeof file.createdBy.avatar === "object" &&
				file.createdBy.avatar !== null
				? file.createdBy.avatar.id
				: file.createdBy.avatar
			: null;
	const creatorAvatarUrl = creatorAvatarId
		? href(`/api/media/file/:mediaId`, {
				mediaId: creatorAvatarId.toString(),
			})
		: undefined;
	const profileUrl = creatorId
		? href("/user/profile/:id?", {
				id: creatorId.toString(),
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
								{profileUrl ? (
									<Group gap="xs" align="center">
										<Avatar
											src={creatorAvatarUrl}
											alt={creatorName}
											size={20}
											radius="xl"
										/>
										<Text
											size="xs"
											c="dimmed"
											component={Link}
											to={profileUrl}
											style={{ textDecoration: "none" }}
											onMouseEnter={(e) => {
												e.currentTarget.style.textDecoration = "underline";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.textDecoration = "none";
											}}
										>
											By: {creatorName}
										</Text>
									</Group>
								) : (
									<Group gap="xs" align="center">
										<Avatar
											src={creatorAvatarUrl}
											alt={creatorName}
											size={20}
											radius="xl"
										/>
										<Text size="xs" c="dimmed">
											By: {creatorName}
										</Text>
									</Group>
								)}
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
			accessor: "createdBy",
			title: "Created By",
			render: (file: Media) => {
				const creatorId =
					typeof file.createdBy === "object" && file.createdBy !== null
						? file.createdBy.id
						: file.createdBy;
				const creatorName =
					typeof file.createdBy === "object" && file.createdBy !== null
						? `${file.createdBy.firstName || ""} ${file.createdBy.lastName || ""}`.trim() ||
							"Unknown"
						: "Unknown";
				const creatorAvatarId =
					typeof file.createdBy === "object" && file.createdBy !== null
						? typeof file.createdBy.avatar === "object" &&
							file.createdBy.avatar !== null
							? file.createdBy.avatar.id
							: file.createdBy.avatar
						: null;
				const creatorAvatarUrl = creatorAvatarId
					? href(`/api/media/file/:mediaId`, {
							mediaId: creatorAvatarId.toString(),
						})
					: undefined;
				const profileUrl = creatorId
					? href("/user/profile/:id?", {
							id: creatorId.toString(),
						})
					: undefined;

				return (
					<Group gap="xs" align="center">
						<Avatar
							src={creatorAvatarUrl}
							alt={creatorName}
							size={24}
							radius="xl"
						/>
						{profileUrl ? (
							<Text
								size="sm"
								c="dimmed"
								component={Link}
								to={profileUrl}
								style={{ textDecoration: "none" }}
								onMouseEnter={(e) => {
									e.currentTarget.style.textDecoration = "underline";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.textDecoration = "none";
								}}
							>
								{creatorName}
							</Text>
						) : (
							<Text size="sm" c="dimmed">
								{creatorName}
							</Text>
						)}
					</Group>
				);
			},
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
					onPageChange(page);
				}}
			/>
		</Group>
	);
}

// Orphaned Media File Type
type OrphanedMediaFile = {
	filename: string;
	size: number;
	lastModified?: Date;
};

// Orphaned Media Table Component
function OrphanedMediaTable({
	files,
	selectedFilenames,
	onSelectionChange,
	onDelete,
	pagination,
	onPageChange,
}: {
	files: OrphanedMediaFile[];
	selectedFilenames: string[];
	onSelectionChange: (filenames: string[]) => void;
	onDelete: (filenames: string[]) => void;
	pagination: {
		totalPages: number;
		page: number;
		hasPrevPage: boolean;
		hasNextPage: boolean;
	};
	onPageChange: (page: number) => void;
}) {
	const columns = [
		{
			accessor: "filename",
			title: "Filename",
			render: (file: OrphanedMediaFile) => (
				<Text size="sm" fw={500} lineClamp={1}>
					{file.filename}
				</Text>
			),
		},
		{
			accessor: "size",
			title: "Size",
			render: (file: OrphanedMediaFile) => (
				<Text size="sm" c="dimmed">
					{prettyBytes(file.size)}
				</Text>
			),
		},
	];

	const selectedFiles = files.filter((file) =>
		selectedFilenames.includes(file.filename),
	);

	return (
		<Stack gap="md">
			{selectedFilenames.length > 0 && (
				<Group justify="space-between" align="center">
					<Text size="sm" c="dimmed">
						{selectedFilenames.length} file
						{selectedFilenames.length !== 1 ? "s" : ""} selected
					</Text>
					<Button
						color="red"
						leftSection={<IconTrash size={16} />}
						onClick={() => {
							if (
								window.confirm(
									`Are you sure you want to delete ${selectedFilenames.length} orphaned file${selectedFilenames.length !== 1 ? "s" : ""}? This action cannot be undone.`,
								)
							) {
								onDelete(selectedFilenames);
							}
						}}
					>
						Delete Selected
					</Button>
				</Group>
			)}
			<DataTable
				records={files}
				columns={columns}
				selectedRecords={selectedFiles}
				onSelectedRecordsChange={(records) => {
					onSelectionChange(records.map((r) => r.filename));
				}}
				striped
				highlightOnHover
				withTableBorder
				withColumnBorders
				idAccessor="filename"
			/>
			<MediaPagination
				totalPages={pagination.totalPages}
				currentPage={pagination.page}
				onPageChange={onPageChange}
			/>
		</Stack>
	);
}

export default function AdminMediaPage({ loaderData }: Route.ComponentProps) {
	const {
		media,
		pagination,
		stats,
		systemStats,
		selectedUserId: initialUserId,
		userOptions,
		orphanedMedia,
	} = loaderData;
	const [viewMode, setViewMode] = useState<"card" | "table">("card");
	const [selectedRecords, setSelectedRecords] = useState<Media[]>([]);
	const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
	const [previewModalOpened, setPreviewModalOpened] = useState(false);
	const [previewFile, setPreviewFile] = useState<Media | null>(null);
	const [renameModalOpened, setRenameModalOpened] = useState(false);
	const [renameFile, setRenameFile] = useState<Media | null>(null);
	const [usageModalOpened, setUsageModalOpened] = useState(false);
	const [usageFile, setUsageFile] = useState<Media | null>(null);
	const [selectedOrphanedFilenames, setSelectedOrphanedFilenames] = useState<
		string[]
	>([]);
	const [userId, setUserId] = useQueryState(
		"userId",
		parseAsInteger.withOptions({
			shallow: false,
		}),
	);
	const [, setPage] = useQueryState(
		"page",
		parseAsInteger.withDefault(1).withOptions({
			shallow: false,
		}),
	);
	const [, setOrphanedPage] = useQueryState(
		"orphanedPage",
		parseAsInteger.withDefault(1).withOptions({
			shallow: false,
		}),
	);
	const { submit: deleteMedia } = useDeleteMedia();
	const { downloadMedia } = useDownloadMedia();
	const { submit: updateMedia } = useUpdateMedia();
	const { submit: deleteOrphanedMedia, fetcher: orphanedFetcher } =
		useDeleteOrphanedMedia();
	const {
		submit: pruneAllOrphaned,
		isLoading: isPruningAll,
		fetcher: pruneFetcher,
	} = usePruneAllOrphanedMedia();

	// Sync userId from loader data
	const currentUserId = userId ?? initialUserId;

	const handleUserIdChange = (newUserId: number | null) => {
		setUserId(newUserId);
		// Reset to page 1 when user filter changes
		setPage(1);
	};

	const handlePageChange = (newPage: number) => {
		setPage(newPage);
	};

	const handleDownload = (file: Media) => {
		downloadMedia(file);
	};

	const handleDelete = (
		file: Media & { deletePermission?: { allowed: boolean; reason: string } },
	) => {
		if (
			!window.confirm(
				"Are you sure you want to delete this media file? This action cannot be undone.",
			)
		) {
			return;
		}

		deleteMedia({
			values: {
				mediaIds: String(file.id),
			},
		});
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

		deleteMedia({
			values: {
				mediaIds: idsToDelete.join(","),
			},
		});

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
		updateMedia({
			values: {
				mediaId,
				newFilename,
			},
		});
	};

	const handleOpenUsageModal = (file: Media) => {
		setUsageFile(file);
		setUsageModalOpened(true);
	};

	const handleCloseUsageModal = () => {
		setUsageModalOpened(false);
		setUsageFile(null);
	};

	const handleOrphanedPageChange = (newPage: number) => {
		setOrphanedPage(newPage);
		// Clear selection when page changes
		setSelectedOrphanedFilenames([]);
	};

	const handleOrphanedSelectionChange = (filenames: string[]) => {
		setSelectedOrphanedFilenames(filenames);
	};

	const handleDeleteOrphaned = (filenames: string[]) => {
		// Delete only selected files from current page
		deleteOrphanedMedia({
			values: {
				filenames: filenames.join(","),
			},
		});
		// Clear selection after deletion
		setSelectedOrphanedFilenames([]);
	};

	const handlePruneAllOrphaned = () => {
		pruneAllOrphaned({});
	};

	// Clear orphaned selection when fetcher completes successfully
	useEffect(() => {
		if (orphanedFetcher.state === "idle" || pruneFetcher.state === "idle") {
			if (selectedOrphanedFilenames.length > 0) {
				setSelectedOrphanedFilenames([]);
			}
		}
	}, [
		orphanedFetcher.state,
		pruneFetcher.state,
		selectedOrphanedFilenames.length,
	]);

	return (
		<Container size="lg" py="xl">
			<title>Media Management | Site Administration | Paideia LMS</title>
			<meta name="description" content="Manage all media files in the system" />
			<meta
				property="og:title"
				content="Media Management | Site Administration | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Manage all media files in the system"
			/>

			<Stack gap="xl">
				<MediaHeader
					totalDocs={pagination.totalDocs}
					viewMode={viewMode}
					onViewModeChange={setViewMode}
					selectedUserId={currentUserId}
					onUserIdChange={handleUserIdChange}
					userOptions={userOptions}
				/>

				{/* Stats Section */}
				{stats && (
					<Card withBorder padding="lg" radius="md">
						<Stack gap="lg">
							<Title order={3}>
								{currentUserId
									? "User Media Statistics"
									: "System Media Statistics"}
							</Title>
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
										<Text fw={500}>Total Storage</Text>
										{currentUserId && systemStats ? (
											// User view: show user storage vs system storage
											<>
												<DonutChart
													data={[
														{
															name: "User Storage",
															value: stats.totalSize,
															color: "blue",
														},
														{
															name: "System Storage",
															value: Math.max(
																0,
																systemStats.totalSize - stats.totalSize,
															),
															color: "green",
														},
													]}
													withTooltip
													withLabels
													labelsType="value"
													chartLabel={`${prettyBytes(stats.totalSize)}`}
													h={300}
													w="100%"
												/>
												<Group gap="xl" mt="md">
													<Box>
														<Text size="xs" c="dimmed">
															User Storage
														</Text>
														<Text size="sm" fw={500}>
															{prettyBytes(stats.totalSize)}
														</Text>
													</Box>
													<Box>
														<Text size="xs" c="dimmed">
															System Storage
														</Text>
														<Text size="sm" fw={500}>
															{prettyBytes(systemStats.totalSize)}
														</Text>
													</Box>
												</Group>
											</>
										) : (
											// System view: just show total storage
											<>
												<DonutChart
													data={[
														{
															name: "Total Storage",
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
												<Group gap="xl" mt="md">
													<Box>
														<Text size="xs" c="dimmed">
															Total Storage
														</Text>
														<Text size="sm" fw={500}>
															{prettyBytes(stats.totalSize)}
														</Text>
													</Box>
												</Group>
											</>
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
							</Group>
						</Stack>
					</Card>
				)}

				{media.length === 0 ? (
					<Text c="dimmed" ta="center" py="xl">
						No media files in the system.
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
							onPageChange={handlePageChange}
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
							onPageChange={handlePageChange}
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

				{/* Orphaned Media Section */}
				{orphanedMedia && (
					<Card withBorder padding="lg" radius="md">
						<Stack gap="lg">
							<Group justify="space-between" align="center">
								<Title order={2}>Orphaned Media Files</Title>
								{orphanedMedia.totalFiles > 0 && (
									<Button
										color="red"
										leftSection={<IconTrash size={16} />}
										onClick={() => {
											if (
												window.confirm(
													`Are you sure you want to prune all ${orphanedMedia.totalFiles} orphaned file${orphanedMedia.totalFiles !== 1 ? "s" : ""}? This action cannot be undone.`,
												)
											) {
												handlePruneAllOrphaned();
											}
										}}
										loading={isPruningAll}
									>
										Prune All ({orphanedMedia.totalFiles})
									</Button>
								)}
							</Group>
							<Text size="sm" c="dimmed">
								Files in S3 storage that are not managed by the system (not in
								database). Total: {orphanedMedia.totalFiles} files (
								{prettyBytes(orphanedMedia.totalSize)})
							</Text>
							{orphanedMedia.files.length === 0 ? (
								<Text c="dimmed" ta="center" py="xl">
									No orphaned media files found.
								</Text>
							) : (
								<OrphanedMediaTable
									files={orphanedMedia.files}
									selectedFilenames={selectedOrphanedFilenames}
									onSelectionChange={handleOrphanedSelectionChange}
									onDelete={handleDeleteOrphaned}
									pagination={{
										totalPages: orphanedMedia.totalPages,
										page: orphanedMedia.page,
										hasPrevPage: orphanedMedia.hasPrevPage,
										hasNextPage: orphanedMedia.hasNextPage,
									}}
									onPageChange={handleOrphanedPageChange}
								/>
							)}
						</Stack>
					</Card>
				)}
			</Stack>
		</Container>
	);
}
