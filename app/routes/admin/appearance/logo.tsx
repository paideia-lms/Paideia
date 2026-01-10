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
import { typeCreateActionRpc, createActionMap } from "app/utils/action-utils";
import { parseAsStringEnum } from "nuqs/server";
import { typeCreateLoader } from "app/utils/loader-utils";
import prettyBytes from "pretty-bytes";
import { href } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	tryClearLogo,
	tryUpdateAppearanceSettings,
} from "server/internal/appearance-settings";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	StatusCode,
	unauthorized,
} from "~/utils/responses";
import type { Route } from "./+types/logo";
import { z } from "zod";

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

type LogoData = Route.ComponentProps["loaderData"]["logos"];

type Media = NonNullable<LogoData[keyof LogoData]>;

const createRouteLoader = typeCreateLoader<Route.LoaderArgs>();

export const loader = createRouteLoader()(async ({ context }) => {
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
	const logoData = {
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
});

const urlSchema = z
	.url()
	.refine((url) => url.startsWith("http") || url.startsWith("https"), {
		message: "URL must start with http or https",
	})
	.array();

const inputSchema = z.object({
	additionalCssStylesheets: urlSchema.optional(),
	color: z
		.enum([
			"blue",
			"pink",
			"indigo",
			"green",
			"orange",
			"gray",
			"grape",
			"cyan",
			"lime",
			"red",
			"violet",
			"teal",
			"yellow",
		])
		.optional(),
	radius: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
	logoLight: z.file().nullish(),
	logoDark: z.file().nullish(),
	compactLogoLight: z.file().nullish(),
	compactLogoDark: z.file().nullish(),
	faviconLight: z.file().nullish(),
	faviconDark: z.file().nullish(),
});

const createActionRpc = typeCreateActionRpc<Route.ActionArgs>({
	route: "/admin/appearance/logo",
});

const clearRpc = createActionRpc({
	searchParams: logoSearchParams,
	method: "POST",
	action: Action.Clear,
});

const uploadRpc = createActionRpc({
	formDataSchema: inputSchema,
	searchParams: logoSearchParams,
	method: "POST",
	action: Action.Upload,
});

const clearAction = clearRpc.createAction(async ({ context, searchParams }) => {
	const { field } = searchParams;
	if (!field) {
		return badRequest({ error: "Field is required" });
	}

	const { payload, payloadRequest } = context.get(globalContextKey);
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
		req: payloadRequest,
		field,
	});

	if (!clearResult.ok) {
		return badRequest({ error: clearResult.error.message });
	}

	return ok({
		message: "Logo cleared successfully",
		logoField: field,
	});
});

const useClearLogoRpc = clearRpc.createHook<typeof clearAction>();

const uploadAction = uploadRpc.createAction(
	async ({ context, formData, searchParams: _searchParams }) => {
		const { payload, payloadRequest } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (currentUser.role !== "admin") {
			return forbidden({ error: "Only admins can access this area" });
		}

		const updateResult = await tryUpdateAppearanceSettings({
			payload,
			data: formData,
			req: payloadRequest,
			overrideAccess: false,
		});

		if (!updateResult.ok) {
			return badRequest({ error: updateResult.error.message });
		}

		return ok({
			message: "Logo uploaded successfully",
		});
	},
);

const useUploadLogoRpc = uploadRpc.createHook<typeof uploadAction>();

const [action] = createActionMap({
	[Action.Clear]: clearAction,
	[Action.Upload]: uploadAction,
});

export { action };

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
	const { submit, isLoading, fetcher } = useUploadLogoRpc();

	const uploadLogo = (file: File) => {
		submit({
			searchParams: { field },
			values: {
				[field]: file,
			},
		});
	};

	return {
		uploadLogo,
		isLoading,
		fetcher,
	};
}

export function useClearLogo(field: Field) {
	const { submit, isLoading, fetcher } = useClearLogoRpc();

	const clearLogo = () => {
		submit({
			searchParams: { field },
		});
	};

	return {
		clearLogo,
		isLoading,
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
	const logoUrl = logo?.id
		? href(`/api/media/file/:mediaId`, {
				mediaId: logo.id.toString(),
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
