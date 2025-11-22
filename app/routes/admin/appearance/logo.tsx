import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import {
	Alert,
	Button,
	Card,
	Grid,
	Group,
	Image,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type {
	FileUpload,
	FileUploadHandler,
} from "@remix-run/form-data-parser";
import {
	MaxFileSizeExceededError,
	MaxFilesExceededError,
} from "@remix-run/form-data-parser";
import { IconPhoto, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import prettyBytes from "pretty-bytes";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryClearLogo,
	tryGetAppearanceSettings,
	tryUpdateAppearanceSettings,
} from "server/internal/appearance-settings";
import { tryCreateMedia } from "server/internal/media-management";
import type { Media } from "server/payload-types";
import { assertRequestMethod } from "~/utils/assert-request-method";
import { ContentType } from "~/utils/get-content-type";
import { parseFormDataWithFallback } from "~/utils/parse-form-data-with-fallback";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/logo";

type LogoField =
	| "logoLight"
	| "logoDark"
	| "compactLogoLight"
	| "compactLogoDark"
	| "faviconLight"
	| "faviconDark";

type LogoData = {
	logoLight?: Media | null;
	logoDark?: Media | null;
	compactLogoLight?: Media | null;
	compactLogoDark?: Media | null;
	faviconLight?: Media | null;
	faviconDark?: Media | null;
};

export const loader = async ({ context }: Route.LoaderArgs) => {
	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can access this area");
	}

	const settings = await tryGetAppearanceSettings({
		payload,
		overrideAccess: true,
	});

	if (!settings.ok) {
		throw new ForbiddenResponse("Failed to get appearance settings");
	}

	const logoData: LogoData = {};

	// Fetch media objects for each logo field if they exist
	const logoFields: LogoField[] = [
		"logoLight",
		"logoDark",
		"compactLogoLight",
		"compactLogoDark",
		"faviconLight",
		"faviconDark",
	];

	for (const field of logoFields) {
		const mediaId = settings.value[field];
		if (mediaId) {
			try {
				const media = await payload.findByID({
					collection: "media",
					id: mediaId,
					depth: 0,
					overrideAccess: true,
				});
				logoData[field] = media as Media;
			} catch {
				// Media not found, set to null
				logoData[field] = null;
			}
		}
	}



	return {
		logos: logoData,
		uploadLimit: systemGlobals.sitePolicies
			.siteUploadLimit,
	};
};

export const action = async ({
	request,
	context,
}: Route.ActionArgs) => {
	const { payload, systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		return forbidden({ error: "Only admins can access this area" });
	}

	// Handle clear logo action
	const url = new URL(request.url);
	const actionType = url.searchParams.get("action");
	const fieldParam = url.searchParams.get("field");

	if (actionType === "clear" && fieldParam) {
		const field = fieldParam as LogoField;
		if (
			field === "logoLight" ||
			field === "logoDark" ||
			field === "compactLogoLight" ||
			field === "compactLogoDark" ||
			field === "faviconLight" ||
			field === "faviconDark"
		) {
			const clearResult = await tryClearLogo({
				payload,
				user: currentUser,
				field,
				overrideAccess: false,
			});

			if (!clearResult.ok) {
				return badRequest({ error: clearResult.error.message });
			}

			return ok({
				message: "Logo cleared successfully",
				logoField: field,
			});
		}
		return badRequest({ error: "Invalid field name" });
	}

	const transactionID = await payload.db.beginTransaction();

	if (!transactionID) {
		return badRequest({ error: "Failed to begin transaction" });
	}

	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	try {
		assertRequestMethod(request.method, "POST");

		const uploadedMediaIds: number[] = [];
		let logoField: LogoField | null = null;

		const uploadHandler = async (fileUpload: FileUpload) => {
			// Determine which logo field this file is for
			const fieldName = fileUpload.fieldName as LogoField;
			if (
				fieldName === "logoLight" ||
				fieldName === "logoDark" ||
				fieldName === "compactLogoLight" ||
				fieldName === "compactLogoDark" ||
				fieldName === "faviconLight" ||
				fieldName === "faviconDark"
			) {
				logoField = fieldName;

				const arrayBuffer = await fileUpload.arrayBuffer();
				const fileBuffer = Buffer.from(arrayBuffer);

				// Validate MIME type is an image
				if (!fileUpload.type.startsWith("image/")) {
					throw new Error("File must be an image");
				}

				const mediaResult = await tryCreateMedia({
					payload,
					file: fileBuffer,
					filename: fileUpload.name,
					mimeType: fileUpload.type,
					userId: currentUser.id,
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

		await parseFormDataWithFallback(
			request,
			uploadHandler as FileUploadHandler,
			{
				...(maxFileSize !== undefined && { maxFileSize }),
				maxFiles: 1,
			},
		);

		if (uploadedMediaIds.length === 0 || !logoField) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: "No file uploaded or invalid field name" });
		}

		// Get current appearance settings
		const currentSettings = await tryGetAppearanceSettings({
			payload,
			overrideAccess: true,
		});

		if (!currentSettings.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: "Failed to get current settings" });
		}

		// Update appearance settings with the new logo
		const updateData: {
			[K in LogoField]?: number | null;
		} = {
			[logoField]: uploadedMediaIds[0],
		};

		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			user: currentUser,
			data: updateData,
			req: { transactionID },
			overrideAccess: false,
		});

		if (!updateResult.ok) {
			await payload.db.rollbackTransaction(transactionID);
			return badRequest({ error: updateResult.error.message });
		}

		await payload.db.commitTransaction(transactionID);

		return ok({
			message: "Logo uploaded successfully",
			logoField,
		});
	} catch (error) {
		await payload.db.rollbackTransaction(transactionID);
		console.error("Logo upload error:", error);

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

export async function clientAction({
	serverAction,
}: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message || "Logo uploaded successfully",
			color: "green",
		});
	} else {
		notifications.show({
			title: "Error",
			message: actionData?.error || "Failed to upload logo",
			color: "red",
		});
	}

	return actionData;
}

export function useUploadLogo(field: LogoField) {
	const fetcher = useFetcher<typeof clientAction>();

	const uploadLogo = (file: File) => {
		const formData = new FormData();
		formData.append(field, file);
		fetcher.submit(formData, {
			method: "POST",
			encType: ContentType.MULTIPART,
		});
	};

	return {
		uploadLogo,
		isLoading: fetcher.state !== "idle",
		fetcher,
	};
}

export function useClearLogo(field: LogoField) {
	const fetcher = useFetcher<typeof clientAction>();

	const clearLogo = () => {
		fetcher.submit(null, {
			method: "POST",
			action: `?action=clear&field=${field}`,
		});
	};

	return {
		clearLogo,
		isLoading: fetcher.state !== "idle",
		fetcher,
	};
}

function LogoDropzoneBase({
	label,
	logo,
	onDrop,
	onClear,
	isLoading,
	isClearing,
	uploadLimit,
}: {
	label: string;
	logo?: Media | null;
	onDrop: (files: File[]) => void;
	onClear: () => void;
	isLoading: boolean;
	isClearing: boolean;
	uploadLimit?: number;
}) {
	const logoUrl = logo?.filename
		? href(`/api/media/file/:filenameOrId`, {
			filenameOrId: logo.filename,
		})
		: null;

	return (
		<Card withBorder padding="md" radius="md">
			<Stack gap="md">
				<Group justify="space-between" align="center">
					<Text size="sm" fw={500}>
						{label}
					</Text>
					{logoUrl && (
						<Button
							variant="subtle"
							color="red"
							size="xs"
							leftSection={<IconTrash size={14} />}
							onClick={onClear}
							loading={isClearing}
							disabled={isLoading || isClearing}
						>
							Clear
						</Button>
					)}
				</Group>
				<Dropzone
					onDrop={onDrop}
					onReject={() => {
						notifications.show({
							title: "Upload failed",
							message: `File must be an image${uploadLimit ? ` under ${prettyBytes(uploadLimit)}` : ""}`,
							color: "red",
						});
					}}
					maxSize={uploadLimit}
					accept={IMAGE_MIME_TYPE}
					multiple={false}
					disabled={isLoading || isClearing}
				>
					<Group
						justify="center"
						gap="xl"
						mih={220}
						style={{ pointerEvents: "none" }}
					>
						{logoUrl ? (
							<Image
								src={logoUrl}
								alt={label}
								fit="contain"
								style={{ maxHeight: 200, maxWidth: "100%" }}
							/>
						) : (
							<>
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
									<IconPhoto
										size={52}
										color="var(--mantine-color-dimmed)"
										stroke={1.5}
									/>
								</Dropzone.Idle>

								<div>
									<Text size="xl" inline>
										Drag images here or click to select files
									</Text>
									<Text size="sm" c="dimmed" inline mt={7}>
										{uploadLimit
											? `Attach as many files as you like, each file should not exceed ${prettyBytes(uploadLimit)}`
											: "Image file"}
									</Text>
								</div>
							</>
						)}
					</Group>
				</Dropzone>
			</Stack>
		</Card>
	);
}

function LogoLightDropzone({
	logo,
	uploadLimit,
}: {
	logo?: Media | null;
	uploadLimit?: number;
}) {
	const { uploadLogo, isLoading } = useUploadLogo("logoLight");
	const { clearLogo, isLoading: isClearing } = useClearLogo("logoLight");

	return (
		<LogoDropzoneBase
			label="Logo (Light Mode)"
			logo={logo}
			onDrop={(files) => {
				if (files[0]) {
					uploadLogo(files[0]);
				}
			}}
			onClear={clearLogo}
			isLoading={isLoading}
			isClearing={isClearing}
			uploadLimit={uploadLimit}
		/>
	);
}

function LogoDarkDropzone({
	logo,
	uploadLimit,
}: {
	logo?: Media | null;
	uploadLimit?: number;
}) {
	const { uploadLogo, isLoading } = useUploadLogo("logoDark");
	const { clearLogo, isLoading: isClearing } = useClearLogo("logoDark");

	return (
		<LogoDropzoneBase
			label="Logo (Dark Mode)"
			logo={logo}
			onDrop={(files) => {
				if (files[0]) {
					uploadLogo(files[0]);
				}
			}}
			onClear={clearLogo}
			isLoading={isLoading}
			isClearing={isClearing}
			uploadLimit={uploadLimit}
		/>
	);
}

function CompactLogoLightDropzone({
	logo,
	uploadLimit,
}: {
	logo?: Media | null;
	uploadLimit?: number;
}) {
	const { uploadLogo, isLoading } = useUploadLogo("compactLogoLight");
	const { clearLogo, isLoading: isClearing } = useClearLogo("compactLogoLight");

	return (
		<LogoDropzoneBase
			label="Compact Logo (Light Mode)"
			logo={logo}
			onDrop={(files) => {
				if (files[0]) {
					uploadLogo(files[0]);
				}
			}}
			onClear={clearLogo}
			isLoading={isLoading}
			isClearing={isClearing}
			uploadLimit={uploadLimit}
		/>
	);
}

function CompactLogoDarkDropzone({
	logo,
	uploadLimit,
}: {
	logo?: Media | null;
	uploadLimit?: number;
}) {
	const { uploadLogo, isLoading } = useUploadLogo("compactLogoDark");
	const { clearLogo, isLoading: isClearing } = useClearLogo("compactLogoDark");

	return (
		<LogoDropzoneBase
			label="Compact Logo (Dark Mode)"
			logo={logo}
			onDrop={(files) => {
				if (files[0]) {
					uploadLogo(files[0]);
				}
			}}
			onClear={clearLogo}
			isLoading={isLoading}
			isClearing={isClearing}
			uploadLimit={uploadLimit}
		/>
	);
}

function FaviconLightDropzone({
	logo,
	uploadLimit,
}: {
	logo?: Media | null;
	uploadLimit?: number;
}) {
	const { uploadLogo, isLoading } = useUploadLogo("faviconLight");
	const { clearLogo, isLoading: isClearing } = useClearLogo("faviconLight");

	return (
		<LogoDropzoneBase
			label="Favicon (Light Mode)"
			logo={logo}
			onDrop={(files) => {
				if (files[0]) {
					uploadLogo(files[0]);
				}
			}}
			onClear={clearLogo}
			isLoading={isLoading}
			isClearing={isClearing}
			uploadLimit={uploadLimit}
		/>
	);
}

function FaviconDarkDropzone({
	logo,
	uploadLimit,
}: {
	logo?: Media | null;
	uploadLimit?: number;
}) {
	const { uploadLogo, isLoading } = useUploadLogo("faviconDark");
	const { clearLogo, isLoading: isClearing } = useClearLogo("faviconDark");

	return (
		<LogoDropzoneBase
			label="Favicon (Dark Mode)"
			logo={logo}
			onDrop={(files) => {
				if (files[0]) {
					uploadLogo(files[0]);
				}
			}}
			onClear={clearLogo}
			isLoading={isLoading}
			isClearing={isClearing}
			uploadLimit={uploadLimit}
		/>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

export default function AdminLogoPage({
	loaderData,
}: Route.ComponentProps) {
	const { logos, uploadLimit } = loaderData;

	return (
		<Stack gap="md" my="lg">
			<title>Logo Settings | Admin | Paideia LMS</title>
			<meta
				name="description"
				content="Configure logo settings including logos and favicons for light and dark modes."
			/>
			<meta
				property="og:title"
				content="Logo Settings | Admin | Paideia LMS"
			/>
			<meta
				property="og:description"
				content="Configure logo settings including logos and favicons for light and dark modes."
			/>
			<Title order={2}>Logo Settings</Title>

			<Alert
				title="Logo Usage Information"
				color="blue"
				variant="light"
				mb="md"
			>
				<Text size="sm">
					<strong>Logo:</strong> The logo is displayed in the header of the
					application. Different logos can be set for light and dark themes.
					<br />
					<strong>Compact Logo:</strong> Not currently used in the application.
					<br />
					<strong>Favicon:</strong> The favicon appears in browser tabs and
					bookmarks. Different favicons can be set for light and dark themes.
				</Text>
			</Alert>

			<Grid>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<LogoLightDropzone logo={logos.logoLight} uploadLimit={uploadLimit ?? undefined} />
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<LogoDarkDropzone logo={logos.logoDark} uploadLimit={uploadLimit ?? undefined} />
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<CompactLogoLightDropzone logo={logos.compactLogoLight} uploadLimit={uploadLimit ?? undefined} />
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<CompactLogoDarkDropzone logo={logos.compactLogoDark} uploadLimit={uploadLimit ?? undefined} />
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<FaviconLightDropzone logo={logos.faviconLight} uploadLimit={uploadLimit ?? undefined} />
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<FaviconDarkDropzone logo={logos.faviconDark} uploadLimit={uploadLimit ?? undefined} />
				</Grid.Col>
			</Grid>
		</Stack>
	);
}

