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
import {
	parseAsInteger,
	parseAsStringEnum,
} from "nuqs";
import prettyBytes from "pretty-bytes";
import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { href, Link } from "react-router";
import { createActionMap, typeCreateActionRpc } from "~/utils/action-utils";
import { createContext } from "app/utils/create-context";
import { useNuqsSearchParams } from "~/utils/search-params-utils";
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
import { useMediaUsageData } from "~/routes/api/media-usage";
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
	InternalServerErrorResponse,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/media";
import { z } from "zod";
import { typeCreateLoader } from "app/utils/loader-utils";

// Define search params
export const loaderSearchParams = {
	userId: parseAsInteger,
	page: parseAsInteger.withDefault(1),
	orphanedPage: parseAsInteger.withDefault(1),
	viewMode: parseAsStringEnum(["card", "table"]).withDefault("card"),
};



enum Action {
	RenameMedia = "renameMedia",
	UpdateMedia = "updateMedia",
	DeleteMedia = "deleteMedia",
	DeleteOrphanedMedia = "deleteOrphanedMedia",
	PruneAllOrphanedMedia = "pruneAllOrphanedMedia",
}


const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/admin/media",
});

const renameMediaRpc = createActionRpc({
	formDataSchema: z.object({
		mediaId: z.coerce.number(),
		newFilename: z.string().min(1),
	}),
	method: "POST",
	action: Action.RenameMedia,
});

const updateMediaRpc = createActionRpc({
	formDataSchema: z.object({
		mediaId: z.coerce.number(),
		alt: z.string().optional(),
		caption: z.string().optional(),
	}),
	method: "POST",
	action: Action.UpdateMedia,
});

const deleteMediaRpc = createActionRpc({
	formDataSchema: z.object({
		mediaIds: z.string().min(1),
	}),
	method: "POST",
	action: Action.DeleteMedia,
});

const deleteOrphanedMediaRpc = createActionRpc({
	formDataSchema: z.object({
		filenames: z.string().min(1),
	}),
	method: "POST",
	action: Action.DeleteOrphanedMedia,
});

const pruneAllOrphanedMediaRpc = createActionRpc({
	method: "POST",
	action: Action.PruneAllOrphanedMedia,
});

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();


export const loader = createRouteLoader({
	searchParams: loaderSearchParams,
})(async ({ context, searchParams }) => {
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
	const { userId, page, orphanedPage } = searchParams;
	const limit = 20;

	const mediaResult = (userId ? await tryFindMediaByUser({
		payload,
		userId,
		limit,
		page,
		depth: 1, // Include createdBy user info
		req: payloadRequest,
		overrideAccess: true,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to fetch media");
	}) : await tryGetAllMedia({
		payload,
		limit,
		page,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to fetch media");
	}));
	const mediaWithPermissions = mediaResult.docs.map((file) => ({
		...file,
		deletePermission: { allowed: true, reason: "" },
	}));

	const stats = userId ? await tryGetUserMediaStats({
		payload,
		userId,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to fetch user media stats");
	}) : await tryGetSystemMediaStats({
		payload,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to fetch system media stats");
	});

	const systemStats = await tryGetSystemMediaStats({
		payload,
		req: payloadRequest,
	}).getOrElse(() => {
		throw new ForbiddenResponse("Failed to fetch system media stats");
	});



	// Fetch users for the filter dropdown
	const userOptions = await tryFindAllUsers({
		payload,
		limit: 100,
		page: 1,
		sort: "-createdAt",
		req: payloadRequest,
	}).getOrElse(() => {
		throw new InternalServerErrorResponse("Failed to get users");
	}).then(
		(users) => {
			return users.docs.map((user) => ({
				value: user.id.toString(),
				label:
					`${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
			}));
		}
	)

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
			totalDocs: mediaResult.totalDocs,
			limit: mediaResult.limit,
			totalPages: mediaResult.totalPages,
			page: mediaResult.page,
			hasPrevPage: mediaResult.hasPrevPage,
			hasNextPage: mediaResult.hasNextPage,
			prevPage: mediaResult.prevPage,
			nextPage: mediaResult.nextPage,
		},
		stats,
		systemStats,
		selectedUserId: userId ?? null,
		userOptions,
		orphanedMedia,
		searchParams,
	};
});

const renameMediaAction = renameMediaRpc.createAction(
	async ({ context, formData }) => {
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

		const renameResult = await tryRenameMedia({
			payload,
			s3Client,
			id: formData.mediaId,
			newFilename: formData.newFilename,
			userId: currentUser.id,
			req: payloadRequest,
		});

		if (!renameResult.ok) {
			return badRequest({ error: renameResult.error.message });
		}

		return ok({
			message: "Media renamed successfully",
		});
	}
);

const useRenameMedia = renameMediaRpc.createHook<typeof renameMediaAction>();

const updateMediaAction = updateMediaRpc.createAction(
	async ({ context, formData }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser || userSession.authenticatedUser;

		if (!currentUser || currentUser.role !== "admin") {
			return unauthorized({ error: "Only admins can perform this action" });
		}


		await payload.update({
			collection: "media",
			id: formData.mediaId,
			data: {
				alt: formData.alt,
				caption: formData.caption,
			},
			req: payloadRequest,
		});

		return ok({
			message: "Media updated successfully",
		});
	},
);

const useUpdateMedia = updateMediaRpc.createHook<typeof updateMediaAction>();

const deleteMediaAction = deleteMediaRpc.createAction(
	async ({ context, formData }) => {
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
	},
);

const useDeleteMedia = deleteMediaRpc.createHook<typeof deleteMediaAction>();

const deleteOrphanedMediaAction = deleteOrphanedMediaRpc.createAction(
	async ({ context, formData }) => {
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
	},
);

const useDeleteOrphanedMedia =
	deleteOrphanedMediaRpc.createHook<typeof deleteOrphanedMediaAction>();

const pruneAllOrphanedMediaAction = pruneAllOrphanedMediaRpc.createAction(
	async ({ context }) => {
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

		const result = await tryPruneAllOrphanedMedia({
			payload,
			s3Client,
			req: payloadRequest,
			// ! we can override access because we are admin
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
	},
);

const usePruneAllOrphanedMedia =
	pruneAllOrphanedMediaRpc.createHook<typeof pruneAllOrphanedMediaAction>();

// Export hooks for use in components
export {
	useRenameMedia,
	useDeleteMedia,
	useUpdateMedia,
	useDeleteOrphanedMedia,
	usePruneAllOrphanedMedia,
};

const [action] = createActionMap({
	[Action.RenameMedia]: renameMediaAction as any,
	[Action.UpdateMedia]: updateMediaAction as any,
	[Action.DeleteMedia]: deleteMediaAction as any,
	[Action.DeleteOrphanedMedia]: deleteOrphanedMediaAction as any,
	[Action.PruneAllOrphanedMedia]: pruneAllOrphanedMediaAction as any,
});

export { action }

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
	const downloadMedia = (file: {
		filename: string;
		id: number;
	}) => {
		const url = href(`/api/media/file/:mediaId`, { mediaId: file.id.toString() }) + "?download=true";
		const link = document.createElement("a");
		link.href = url;
		// Normalize filename to only allow ASCII and remove unsafe characters, fallback to "download.jpg"
		const safeFilename = "download.jpg";
		link.download = safeFilename;
		link.click();
	};
	return { downloadMedia };
}

// Media Header Component
function MediaHeader({
	totalDocs,
	viewMode,
	selectedUserId,
	userOptions,
}: {
	totalDocs: number;
	viewMode: "card" | "table";
	selectedUserId: number | null;
	userOptions: Array<{ value: string; label: string }>;
}) {
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);


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
						onChange={(value) => {
							setQueryParams({ viewMode: value as "card" | "table" });
						}}
					/>
				</Group>
			</Group>
			<Select
				label="Filter by User"
				placeholder="Select a user to filter media (leave empty for all media)"
				data={userOptions}
				value={selectedUserId?.toString() || null}
				onChange={(value) => {
					setQueryParams({ userId: value ? Number(value) : null, page: 1 });
				}}
				searchable
				clearable
				w={400}
			/>
		</Stack>
	);
}

// Media Selection Context
interface MediaSelectionProviderProps {
	media: Route.ComponentProps["loaderData"]["media"];
	children:
	| React.ReactNode
	| ((props: {
		selectedCardIds: number[];
		selectedRecords: Route.ComponentProps["loaderData"]["media"];
	}) => React.ReactNode);
}

interface UseMediaSelectionValueProps {
	media: Route.ComponentProps["loaderData"]["media"];
}

function useMediaSelectionValue({ media }: UseMediaSelectionValueProps) {
	const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);

	// Derive selectedRecords from selectedCardIds and media
	const selectedRecords = useMemo(
		() => media.filter((record) => selectedCardIds.includes(record.id)),
		[media, selectedCardIds],
	);

	const handleTableSelectionChange = (
		records: Route.ComponentProps["loaderData"]["media"],
	) => {
		setSelectedCardIds(records.map((r) => r.id));
	};

	const clearSelection = () => {
		setSelectedCardIds([]);
	};

	return {
		selectedCardIds,
		setSelectedCardIds,
		selectedRecords,
		handleTableSelectionChange,
		clearSelection,
	};
}

const [MediaSelectionContext, useMediaSelection] = createContext(
	useMediaSelectionValue,
);

function MediaSelectionProvider({
	media,
	children,
}: MediaSelectionProviderProps) {
	const values = useMediaSelectionValue({ media });
	return (
		<MediaSelectionContext.Provider value={values}>
			{typeof children === "function"
				? children({
					selectedCardIds: values.selectedCardIds,
					selectedRecords: values.selectedRecords,
				})
				: React.Children.map(children, (child) => {
					if (React.isValidElement(child)) {
						return React.cloneElement(child as React.ReactElement<any>, {
							selectedCardIds: values.selectedCardIds,
							selectedRecords: values.selectedRecords,
						});
					}
					return child;
				})}
		</MediaSelectionContext.Provider>
	);
}

// Batch Actions Component
function BatchActions({
	selectedCardIds,
	selectedRecords,
}: {
	selectedCardIds: number[];
	selectedRecords: Route.ComponentProps["loaderData"]["media"];
}) {
	const { clearSelection } = useMediaSelection();
	const { submit: deleteMedia } = useDeleteMedia();

	const selectedCount =
		selectedRecords.length > 0 ? selectedRecords.length : selectedCardIds.length;

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
				mediaIds: selectedCardIds.join(","),
			},
		});

		// Clear selection after submission
		clearSelection();
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
				}}
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
export interface MediaRenameModalHandle {
	open: () => void;
}

interface MediaRenameModalProps {
	file: Media;
}

export const MediaRenameModal = forwardRef<
	MediaRenameModalHandle,
	MediaRenameModalProps
>(({ file }, ref) => {
	const [opened, setOpened] = useState(false);
	const { submit: renameMedia } = useRenameMedia();
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

	useImperativeHandle(ref, () => ({
		open: () => {
			form.setInitialValues({ filename: file.filename ?? "" });
			form.reset();
			setOpened(true);
		},
	}));

	const handleSubmit = form.onSubmit(async (values) => {
		await renameMedia({
			values: {
				mediaId: file.id,
				newFilename: values.filename.trim(),
			},
		});
		form.reset();
		setOpened(false);
	});

	return (
		<Modal
			key={file?.id} // Reset state when file changes
			opened={opened}
			onClose={() => setOpened(false)}
			onExitTransitionEnd={() => form.reset()}
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
						<Button
							variant="subtle"
							onClick={() => setOpened(false)}
							type="button"
						>
							Cancel
						</Button>
						<Button type="submit">Rename</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
});

MediaRenameModal.displayName = "MediaRenameModal";

// Media Preview Modal Component
export interface MediaPreviewModalHandle {
	open: () => void;
}

interface MediaPreviewModalProps {
	file: Media;
}

export const MediaPreviewModal = forwardRef<
	MediaPreviewModalHandle,
	MediaPreviewModalProps
>(({ file }, ref) => {
	const [opened, setOpened] = useState(false);

	useImperativeHandle(ref, () => ({
		open: () => {
			setOpened(true);
		},
	}));

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
			onClose={() => setOpened(false)}
			title={file.filename ?? "Media Preview"}
			size="xl"
			centered
		>
			{renderPreview()}
		</Modal>
	);
});

MediaPreviewModal.displayName = "MediaPreviewModal";

// Media Usage Modal Component
export interface MediaUsageModalHandle {
	open: () => void;
}

interface MediaUsageModalProps {
	file: Media;
}

export const MediaUsageModal = forwardRef<
	MediaUsageModalHandle,
	MediaUsageModalProps
>(({ file }, ref) => {
	const [opened, setOpened] = useState(false);
	const {
		load: fetchMediaUsage,
		data: mediaUsageData,
		isLoading,
	} = useMediaUsageData();
	const previousFileId = usePrevious(file?.id);
	const previousOpened = usePrevious(opened);
	const dataFileIdRef = useRef<number | null>(null);

	useImperativeHandle(ref, () => ({
		open: () => {
			setOpened(true);
		},
	}));

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
			onClose={() => setOpened(false)}
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
});

MediaUsageModal.displayName = "MediaUsageModal";

// Media Action Menu Component
function MediaActionMenu({
	file,
}: {
	file: Route.ComponentProps["loaderData"]["media"][number];
}) {
	const { downloadMedia } = useDownloadMedia();
	const { submit: deleteMedia } = useDeleteMedia();

	const previewModalRef = useRef<MediaPreviewModalHandle>(null);
	const renameModalRef = useRef<MediaRenameModalHandle>(null);
	const usageModalRef = useRef<MediaUsageModalHandle>(null);

	const canDelete = file.deletePermission?.allowed ?? true; // Admin can always delete
	const canPreviewFile = canPreview(file.mimeType ?? null);
	const mediaUrl = file.id
		? href(`/api/media/file/:mediaId`, {
			mediaId: file.id.toString(),
		})
		: undefined;

	const handleDelete = async () => {
		if (
			!window.confirm(
				"Are you sure you want to delete this media file? This action cannot be undone.",
			)
		) {
			return;
		}

		await deleteMedia({
			values: {
				mediaIds: String(file.id),
			},
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
							onClick={() => previewModalRef.current?.open()}
						>
							Preview
						</Menu.Item>
					)}
					{mediaUrl && (
						<Menu.Item
							leftSection={<IconDownload size={16} />}
							onClick={() => {
								downloadMedia({
									filename: file.filename ?? `file-${file.id}`,
									id: file.id,
								});
							}}
						>
							Download
						</Menu.Item>
					)}
					<Menu.Item
						leftSection={<IconInfoCircle size={16} />}
						onClick={() => usageModalRef.current?.open()}
					>
						Show Usage
					</Menu.Item>
					<Menu.Item
						leftSection={<IconPencil size={16} />}
						onClick={() => renameModalRef.current?.open()}
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

			<MediaPreviewModal ref={previewModalRef} file={file} />

			<MediaRenameModal ref={renameModalRef} file={file} />

			<MediaUsageModal ref={usageModalRef} file={file} />
		</>
	);
}

// Media Card Component
function MediaCard({
	file,
	selectedCardIds,
}: {
	file: Route.ComponentProps["loaderData"]["media"][number];
	selectedCardIds: number[];
}) {
	const { setSelectedCardIds } = useMediaSelection();
	const isSelected = selectedCardIds.includes(file.id);

	const handleCheckboxChange = (checked: boolean) => {
		if (checked) {
			setSelectedCardIds([...selectedCardIds, file.id]);
		} else {
			setSelectedCardIds(selectedCardIds.filter((id) => id !== file.id));
		}
	};

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
								handleCheckboxChange(event.currentTarget.checked)
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
								<MediaActionMenu file={file} />
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
}: {
	media: Route.ComponentProps["loaderData"]["media"];
	selectedCardIds: number[];
}) {
	return (
		<Grid>
			{media.map((file) => (
				<MediaCard
					key={file.id}
					file={file}
					selectedCardIds={selectedCardIds}
				/>
			))}
		</Grid>
	);
}

// Media Table View Component
function MediaTableView({
	media,
	selectedRecords,
}: {
	media: Route.ComponentProps["loaderData"]["media"];
	selectedRecords: Route.ComponentProps["loaderData"]["media"];
}) {
	const { handleTableSelectionChange } = useMediaSelection();
	const columns = [
		{
			accessor: "filename",
			title: "Name",
			render: (file: Route.ComponentProps["loaderData"]["media"][number]) => (
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
			render: (file: Route.ComponentProps["loaderData"]["media"][number]) => {
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
			render: (file: Route.ComponentProps["loaderData"]["media"][number]) => (
				<Text size="sm" c="dimmed">
					{prettyBytes(file.filesize || 0)}
				</Text>
			),
		},
		{
			accessor: "createdAt",
			title: "Created",
			render: (file: Route.ComponentProps["loaderData"]["media"][number]) => (
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
				file: Route.ComponentProps["loaderData"]["media"][number],
			) => (
				<MediaActionMenu file={file} />
			),
		},
	];

	return (
		<DataTable
			records={media}
			columns={columns}
			selectedRecords={selectedRecords}
			onSelectedRecordsChange={handleTableSelectionChange}
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

	const handlePageChange = (page: number) => {
		setQueryParams({
			page: page,
		});
	};

	if (totalPages <= 1) return null;

	return (
		<Group justify="center">
			<Pagination
				total={totalPages}
				value={currentPage}
				onChange={handlePageChange}
			/>
		</Group>
	);
}

// Orphaned Media Pagination Component
function OrphanedMediaPagination({
	totalPages,
	currentPage,
}: {
	totalPages: number;
	currentPage: number;
}) {
	const setQueryParams = useNuqsSearchParams(loaderSearchParams);

	const handlePageChange = (page: number) => {
		setQueryParams({
			orphanedPage: page,
		});
	};

	if (totalPages <= 1) return null;

	return (
		<Group justify="center">
			<Pagination
				total={totalPages}
				value={currentPage}
				onChange={handlePageChange}
			/>
		</Group>
	);
}

// Orphaned Media File Type
type OrphanedMediaFile = NonNullable<Route.ComponentProps["loaderData"]["orphanedMedia"]>['files'][number];

// Orphaned Media Selection Context
interface UseOrphanedMediaSelectionValueProps {
	orphanedPage: number;
}

function useOrphanedMediaSelectionValue({
	orphanedPage,
}: UseOrphanedMediaSelectionValueProps) {
	const [selectedOrphanedIds, setSelectedOrphanedIds] = useState<string[]>([]);

	// Clear selection when page changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: orphanedPage is needed to clear selection when page changes
	useEffect(() => {
		setSelectedOrphanedIds([]);
	}, [orphanedPage]);

	const handleTableSelectionChange = (records: OrphanedMediaFile[]) => {
		setSelectedOrphanedIds(records.map((r) => r.filename));
	};

	const clearSelection = () => {
		setSelectedOrphanedIds([]);
	};

	return {
		selectedOrphanedIds,
		setSelectedOrphanedIds,
		handleTableSelectionChange,
		clearSelection,
	};
}

const [
	OrphanedMediaSelectionContext,
	useOrphanedMediaSelection,
] = createContext(useOrphanedMediaSelectionValue);

// Orphaned Media Table Component
function OrphanedMediaTable({
	files,
	pagination,
	selectedOrphanedIds,
}: {
	files: OrphanedMediaFile[];
	pagination: {
		totalPages: number;
		page: number;
		hasPrevPage: boolean;
		hasNextPage: boolean;
	};
	selectedOrphanedIds: string[];
}) {
	const { handleTableSelectionChange, clearSelection } =
		useOrphanedMediaSelection();
	const { submit: deleteOrphanedMedia, isLoading } = useDeleteOrphanedMedia();

	const selectedFiles = files.filter((file) =>
		selectedOrphanedIds.includes(file.filename),
	);

	const handleDelete = () => {
		if (selectedOrphanedIds.length === 0) {
			return;
		}

		if (
			!window.confirm(
				`Are you sure you want to delete ${selectedOrphanedIds.length} orphaned file${selectedOrphanedIds.length !== 1 ? "s" : ""}? This action cannot be undone.`,
			)
		) {
			return;
		}

		deleteOrphanedMedia({
			values: {
				filenames: selectedOrphanedIds.join(","),
			},
		});

		clearSelection();
	};

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

	return (
		<Stack gap="md">
			{selectedOrphanedIds.length > 0 && (
				<Group justify="space-between" align="center">
					<Text size="sm" c="dimmed">
						{selectedOrphanedIds.length} file
						{selectedOrphanedIds.length !== 1 ? "s" : ""} selected
					</Text>
					<Button
						color="red"
						leftSection={<IconTrash size={16} />}
						onClick={handleDelete}
						loading={isLoading}
					>
						Delete Selected
					</Button>
				</Group>
			)}
			<DataTable
				records={files}
				columns={columns}
				selectedRecords={selectedFiles}
				onSelectedRecordsChange={handleTableSelectionChange}
				striped
				highlightOnHover
				withTableBorder
				withColumnBorders
				idAccessor="filename"
			/>
			<OrphanedMediaPagination
				totalPages={pagination.totalPages}
				currentPage={pagination.page}
			/>
		</Stack>
	);
}

function PruneAllOrphanedButton({ totalFiles }: { totalFiles: number }) {
	const { submit: pruneAllOrphaned, isLoading: isPruningAll } =
		usePruneAllOrphanedMedia();

	const handleClick = () => {
		if (
			window.confirm(
				`Are you sure you want to prune all ${totalFiles} orphaned file${totalFiles !== 1 ? "s" : ""}? This action cannot be undone.`,
			)
		) {
			pruneAllOrphaned({});
		}
	};

	return (
		<Button
			color="red"
			leftSection={<IconTrash size={16} />}
			onClick={handleClick}
			loading={isPruningAll}
		>
			Prune All ({totalFiles})
		</Button>
	);
}

function OrphanedMediaSection({
	orphanedMedia,
}: {
	orphanedMedia: NonNullable<Route.ComponentProps["loaderData"]["orphanedMedia"]>;
}) {
	const { selectedOrphanedIds, setSelectedOrphanedIds, handleTableSelectionChange, clearSelection } = useOrphanedMediaSelectionValue({
		orphanedPage: orphanedMedia.page,
	});

	return (
		<Card withBorder padding="lg" radius="md">
			<Stack gap="lg">
				<Group justify="space-between" align="center">
					<Title order={2}>Orphaned Media Files</Title>
					{orphanedMedia.totalFiles > 0 && (
						<PruneAllOrphanedButton totalFiles={orphanedMedia.totalFiles} />
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
					<OrphanedMediaSelectionContext.Provider value={{
						setSelectedOrphanedIds,
						handleTableSelectionChange,
						clearSelection,
					}}>
						<OrphanedMediaTable
							files={orphanedMedia.files}
							pagination={{
								totalPages: orphanedMedia.totalPages,
								page: orphanedMedia.page,
								hasPrevPage: orphanedMedia.hasPrevPage,
								hasNextPage: orphanedMedia.hasNextPage,
							}}
							selectedOrphanedIds={selectedOrphanedIds}
						/>
					</OrphanedMediaSelectionContext.Provider>
				)}
			</Stack>
		</Card>
	);
}

function StatsSection({
	stats,
	systemStats,
	currentUserId,
}: {
	stats: NonNullable<Route.ComponentProps["loaderData"]["stats"]>;
	systemStats: NonNullable<Route.ComponentProps["loaderData"]["systemStats"]>;
	currentUserId: number | null;
}) {
	return (
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
	);
}

// Media Views Component (uses context)
function MediaViews({
	viewMode,
	media,
	pagination,
	selectedCardIds,
	selectedRecords,
}: {
	viewMode: "card" | "table";
	media: Route.ComponentProps["loaderData"]["media"];
	pagination: Route.ComponentProps["loaderData"]["pagination"];
	selectedCardIds: number[];
	selectedRecords: Route.ComponentProps["loaderData"]["media"];
}) {
	return viewMode === "card" ? (
		<>
			<BatchActions
				selectedCardIds={selectedCardIds}
				selectedRecords={selectedRecords}
			/>
			<MediaCardView media={media} selectedCardIds={selectedCardIds} />
			<MediaPagination
				totalPages={pagination.totalPages}
				currentPage={pagination.page}
			/>
		</>
	) : (
		<>
			<BatchActions
				selectedCardIds={selectedCardIds}
				selectedRecords={selectedRecords}
			/>
			<MediaTableView media={media} selectedRecords={selectedRecords} />
			<MediaPagination
				totalPages={pagination.totalPages}
				currentPage={pagination.page}
			/>
		</>
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
		searchParams: {
			userId,
			viewMode,
		},
	} = loaderData;
	// Sync userId from loader data
	const currentUserId = userId ?? initialUserId;


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
					viewMode={viewMode}
					totalDocs={pagination.totalDocs}
					selectedUserId={currentUserId}
					userOptions={userOptions}
				/>

				{/* Stats Section */}
				{stats && (
					<StatsSection
						stats={stats}
						systemStats={systemStats}
						currentUserId={currentUserId}
					/>
				)}

				{media.length === 0 ? (
					<Text c="dimmed" ta="center" py="xl">
						No media files in the system.
					</Text>
				) : (
					<MediaSelectionProvider media={media}>
						{({ selectedCardIds, selectedRecords }) => (
							<MediaViews
								viewMode={viewMode}
								media={media}
								pagination={pagination}
								selectedCardIds={selectedCardIds}
								selectedRecords={selectedRecords}
							/>
						)}
					</MediaSelectionProvider>
				)}

				{/* Orphaned Media Section */}
				{orphanedMedia && (
					<OrphanedMediaSection
						orphanedMedia={orphanedMedia}
					/>
				)}
			</Stack>
		</Container>
	);
}
