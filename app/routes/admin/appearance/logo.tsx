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
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { IconPhoto, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import { createLoader, parseAsStringEnum } from "nuqs/server";
import prettyBytes from "pretty-bytes";
import { stringify } from "qs";
import { href, useFetcher } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryClearLogo,
	tryGetAppearanceSettings,
	tryUpdateAppearanceSettings,
} from "server/internal/appearance-settings";
import { handleTransactionId } from "server/internal/utils/handle-transaction-id";
import type { Media } from "server/payload-types";
import { ContentType } from "~/utils/get-content-type";
import { handleUploadError } from "~/utils/handle-upload-errors";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
import type { Route } from "./+types/logo";
import { createLocalReq } from "server/internal/utils/internal-function-utils";

enum Action {
	Clear = "clear",
	Upload = "upload",
}
enum Field {
	LogoLight = "logoLight",
	LogoDark = "logoDark",
	CompactLogoLight = "compactLogoLight",
	CompactLogoDark = "compactLogoDark",
	FaviconLight = "faviconLight",
	FaviconDark = "faviconDark",
}

// Define search params for logo actions
export const logoSearchParams = {
	action: parseAsStringEnum(Object.values(Action)),
	field: parseAsStringEnum(Object.values(Field)),
};

export const loadSearchParams = createLoader(logoSearchParams);

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
	const { systemGlobals } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		throw new ForbiddenResponse("Unauthorized");
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		throw new ForbiddenResponse("Only admins can access this area");
	}

	// Get logo data directly from system globals
	const logoData: LogoData = {
		logoLight: systemGlobals.appearanceSettings.logoLight ?? null,
		logoDark: systemGlobals.appearanceSettings.logoDark ?? null,
		compactLogoLight: systemGlobals.appearanceSettings.compactLogoLight ?? null,
		compactLogoDark: systemGlobals.appearanceSettings.compactLogoDark ?? null,
		faviconLight: systemGlobals.appearanceSettings.faviconLight ?? null,
		faviconDark: systemGlobals.appearanceSettings.faviconDark ?? null,
	};

	return {
		logos: logoData,
		uploadLimit: systemGlobals.sitePolicies.siteUploadLimit,
	};
};

const clearAction = async ({
	request,
	context,
	searchParams,
}: Route.ActionArgs & { searchParams: { action: Action; field: Field } }) => {
	const { field } = searchParams;
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

	const clearResult = await tryClearLogo({
		payload,
		req: createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
		field,
	});

	if (!clearResult.ok) {
		return badRequest({ error: clearResult.error.message });
	}

	return ok({
		message: "Logo cleared successfully",
		logoField: field,
	});
};

const uploadAction = async ({
	request,
	context,
	searchParams,
}: Route.ActionArgs & { searchParams: { action: Action; field: Field } }) => {
	const { field: _field } = searchParams;
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

	const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;

	// Handle transaction ID
	const transactionInfo = await handleTransactionId(
		payload,
		createLocalReq({
			request,
			user: currentUser,
			context: { routerContext: context },
		}),
	);

	return await transactionInfo.tx(async (txInfo) => {
		let logoField: LogoField | null = null;

		// Parse form data with media upload handler
		const parseResult = await tryParseFormDataWithMediaUpload({
			payload,
			request,
			userId: currentUser.id,
			req: txInfo.reqWithTransaction,
			maxFileSize,
			maxFiles: 1,
			fields: [
				{
					fieldName: (fieldName) => {
						const validFields: LogoField[] = [
							"logoLight",
							"logoDark",
							"compactLogoLight",
							"compactLogoDark",
							"faviconLight",
							"faviconDark",
						];
						return validFields.includes(fieldName as LogoField);
					},
					alt: (fieldName) => `${fieldName} image`,
					onUpload: (fieldName, _mediaId, _filename) => {
						logoField = fieldName as LogoField;
					},
				},
			],
			validateFile: (fileUpload) => {
				// Validate MIME type is an image
				if (!fileUpload.type.startsWith("image/")) {
					throw new Error("File must be an image");
				}
			},
		});

		if (!parseResult.ok) {
			return handleUploadError(
				parseResult.error,
				maxFileSize,
				"Failed to parse form data",
			);
		}

		const { uploadedMedia } = parseResult.value;

		if (uploadedMedia.length === 0 || !logoField) {
			return badRequest({
				error: "No file uploaded or invalid field name",
			});
		}

		// Get current appearance settings
		const currentSettings = await tryGetAppearanceSettings({
			payload,
			overrideAccess: true,
			req: txInfo.reqWithTransaction,
		});

		if (!currentSettings.ok) {
			return badRequest({ error: "Failed to get current settings" });
		}

		// Update appearance settings with the new logo
		const updateData: {
			[K in LogoField]?: number | null;
		} = {
			[logoField]: uploadedMedia[0]!.mediaId,
		};

		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			data: updateData,
			req: txInfo.reqWithTransaction,
			overrideAccess: false,
		});

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({
			message: "Logo uploaded successfully",
			logoField,
		});
	});
};

const getActionUrl = (action: Action, field: Field) => {
	return href("/admin/appearance/logo") + "?" + stringify({ action, field });
};

export const action = async (args: Route.ActionArgs) => {
	const { request, context } = args;
	// Handle clear logo action
	const { action: actionType, field: fieldParam } = loadSearchParams(request);

	if (!actionType || !fieldParam) {
		return badRequest({ error: "Action and field are required" });
	}

	if (actionType === "clear") {
		return clearAction({
			...args,
			searchParams: {
				action: actionType,
				field: fieldParam,
			},
		});
	} else if (actionType === "upload") {
		return uploadAction({
			...args,
			searchParams: {
				action: actionType,
				field: fieldParam,
			},
		});
	}

	return badRequest({ error: "Invalid action" });
};

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	const actionData = await serverAction();

	if (actionData?.status === StatusCode.Ok) {
		notifications.show({
			title: "Success",
			message: actionData.message || "Logo uploaded successfully",
			color: "green",
		});
	} else if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized ||
		actionData?.status === StatusCode.Forbidden
	) {
		notifications.show({
			title: "Error",
			message: actionData?.error || "Failed to upload logo",
			color: "red",
		});
	}

	return actionData;
}

export function useUploadLogo(field: Field) {
	const fetcher = useFetcher<typeof clientAction>();

	const uploadLogo = (file: File) => {
		const formData = new FormData();
		formData.append(field, file);
		fetcher.submit(formData, {
			method: "POST",
			encType: ContentType.MULTIPART,
			action: getActionUrl(Action.Upload, field),
		});
	};

	return {
		uploadLogo,
		isLoading: fetcher.state !== "idle",
		fetcher,
	};
}

export function useClearLogo(field: Field) {
	const fetcher = useFetcher<typeof clientAction>();

	const clearLogo = () => {
		fetcher.submit(null, {
			method: "POST",
			action: getActionUrl(Action.Clear, field),
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
	const { uploadLogo, isLoading } = useUploadLogo(Field.LogoLight);
	const { clearLogo, isLoading: isClearing } = useClearLogo(Field.LogoLight);

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
	const { uploadLogo, isLoading } = useUploadLogo(Field.LogoDark);
	const { clearLogo, isLoading: isClearing } = useClearLogo(Field.LogoDark);

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
	const { uploadLogo, isLoading } = useUploadLogo(Field.CompactLogoLight);
	const { clearLogo, isLoading: isClearing } = useClearLogo(
		Field.CompactLogoLight,
	);

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
	const { uploadLogo, isLoading } = useUploadLogo(Field.CompactLogoDark);
	const { clearLogo, isLoading: isClearing } = useClearLogo(
		Field.CompactLogoDark,
	);

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
	const { uploadLogo, isLoading } = useUploadLogo(Field.FaviconLight);
	const { clearLogo, isLoading: isClearing } = useClearLogo(Field.FaviconLight);

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
	const { uploadLogo, isLoading } = useUploadLogo(Field.FaviconDark);
	const { clearLogo, isLoading: isClearing } = useClearLogo(Field.FaviconDark);

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

export default function AdminLogoPage({ loaderData }: Route.ComponentProps) {
	const { logos, uploadLimit } = loaderData;

	return (
		<Stack gap="md" my="lg">
			<title>Logo Settings | Admin | Paideia LMS</title>
			<meta
				name="description"
				content="Configure logo settings including logos and favicons for light and dark modes."
			/>
			<meta property="og:title" content="Logo Settings | Admin | Paideia LMS" />
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
					<LogoLightDropzone
						logo={logos.logoLight}
						uploadLimit={uploadLimit ?? undefined}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<LogoDarkDropzone
						logo={logos.logoDark}
						uploadLimit={uploadLimit ?? undefined}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<CompactLogoLightDropzone
						logo={logos.compactLogoLight}
						uploadLimit={uploadLimit ?? undefined}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<CompactLogoDarkDropzone
						logo={logos.compactLogoDark}
						uploadLimit={uploadLimit ?? undefined}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<FaviconLightDropzone
						logo={logos.faviconLight}
						uploadLimit={uploadLimit ?? undefined}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<FaviconDarkDropzone
						logo={logos.faviconDark}
						uploadLimit={uploadLimit ?? undefined}
					/>
				</Grid.Col>
			</Grid>
		</Stack>
	);
}
