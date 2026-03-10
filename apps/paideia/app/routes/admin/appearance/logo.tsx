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
import { IconPhoto, IconTrash } from "@tabler/icons-react";
import {
	MediaPickerModal,
	type MediaPickerModalHandle,
} from "app/components/media-picker";
import { DefaultErrorBoundary } from "app/components/default-error-boundary";
import {
	typeCreateActionRpc,
	createActionMap,
} from "app/utils/router/action-utils";
import { parseAsStringEnum } from "nuqs/server";
import { typeCreateLoader } from "app/utils/router/loader-utils";
import type React from "react";
import { useRef } from "react";
import { href } from "react-router";
import { globalContextKey } from "server/contexts/global-context";
import { userContextKey } from "server/contexts/user-context";
import {
	badRequest,
	ForbiddenResponse,
	forbidden,
	ok,
	StatusCode,
	unauthorized,
} from "app/utils/router/responses";
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
		currentUserId: currentUser.id,
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
	logoLight: z.number().nullable(),
	logoDark: z.number().nullable(),
	compactLogoLight: z.number().nullable(),
	compactLogoDark: z.number().nullable(),
	faviconLight: z.number().nullable(),
	faviconDark: z.number().nullable(),
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
	formDataSchema: inputSchema.partial(),
	searchParams: logoSearchParams,
	method: "POST",
	action: Action.Upload,
});

const clearAction = clearRpc.createAction(async ({ context, searchParams }) => {
	const { field } = searchParams;
	if (!field) {
		return badRequest({ error: "Field is required" });
	}

	const { paideia, requestContext } = context.get(globalContextKey);
	const userSession = context.get(userContextKey);

	if (!userSession?.isAuthenticated) {
		return unauthorized({ error: "Unauthorized" });
	}

	const currentUser =
		userSession.effectiveUser ?? userSession.authenticatedUser;

	if (currentUser.role !== "admin") {
		return forbidden({ error: "Only admins can access this area" });
	}

	const clearResult = await paideia.tryClearLogo({
		req: requestContext,
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
		const { paideia, requestContext } = context.get(globalContextKey);
		const userSession = context.get(userContextKey);

		if (!userSession?.isAuthenticated) {
			return unauthorized({ error: "Unauthorized" });
		}

		const currentUser =
			userSession.effectiveUser ?? userSession.authenticatedUser;

		if (currentUser.role !== "admin") {
			return forbidden({ error: "Only admins can access this area" });
		}

		const updateResult = await paideia.tryUpdateAppearanceSettings({
			data: formData,
			req: requestContext,
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
			message: actionData.message,
			color: "green",
		});
	} else if (
		actionData?.status === StatusCode.BadRequest ||
		actionData?.status === StatusCode.Unauthorized ||
		actionData?.status === StatusCode.Forbidden
	) {
		notifications.show({
			title: "Error",
			message: actionData.error,
			color: "red",
		});
	}

	return actionData;
}

export function useUploadLogo(field: Field) {
	const { submit, isLoading, fetcher } = useUploadLogoRpc();

	const uploadLogo = (file: number) => {
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

function LogoCardBase({
	label,
	logo,
	onClear,
	isLoading,
	isClearing,
	mediaPickerRef,
}: {
	label: string;
	logo?: Media | null;
	onClear: () => void;
	isLoading: boolean;
	isClearing: boolean;
	mediaPickerRef: React.RefObject<MediaPickerModalHandle | null>;
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
					<Group gap="xs">
						<Button
							variant="light"
							size="xs"
							leftSection={<IconPhoto size={14} />}
							onClick={() => mediaPickerRef.current?.open()}
							disabled={isLoading || isClearing}
						>
							Choose
						</Button>
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
				</Group>
				<Group
					justify="center"
					style={{
						minHeight: 180,
						backgroundColor: "var(--mantine-color-gray-0)",
						borderRadius: "var(--mantine-radius-sm)",
					}}
				>
					{logoUrl ? (
						<Image
							src={logoUrl}
							alt={label}
							fit="contain"
							style={{ maxHeight: 180, maxWidth: "100%" }}
						/>
					) : (
						<IconPhoto
							size={52}
							color="var(--mantine-color-dimmed)"
							stroke={1.5}
						/>
					)}
				</Group>
			</Stack>
		</Card>
	);
}

function LogoLightCard({
	logo,
	currentUserId,
}: {
	logo?: Media | null;
	currentUserId: number;
}) {
	const mediaPickerRef = useRef<MediaPickerModalHandle>(null);
	const { uploadLogo, isLoading } = useUploadLogo(Field.LogoLight);
	const { clearLogo, isLoading: isClearing } = useClearLogo(Field.LogoLight);

	return (
		<>
			<LogoCardBase
				label="Logo (Light Mode)"
				logo={logo}
				onClear={clearLogo}
				isLoading={isLoading}
				isClearing={isClearing}
				mediaPickerRef={mediaPickerRef}
			/>
			<MediaPickerModal
				ref={mediaPickerRef}
				userId={currentUserId}
				onSelect={(mediaId) => uploadLogo(mediaId)}
				imagesOnly
			/>
		</>
	);
}

function LogoDarkCard({
	logo,
	currentUserId,
}: {
	logo?: Media | null;
	currentUserId: number;
}) {
	const mediaPickerRef = useRef<MediaPickerModalHandle>(null);
	const { uploadLogo, isLoading } = useUploadLogo(Field.LogoDark);
	const { clearLogo, isLoading: isClearing } = useClearLogo(Field.LogoDark);

	return (
		<>
			<LogoCardBase
				label="Logo (Dark Mode)"
				logo={logo}
				onClear={clearLogo}
				isLoading={isLoading}
				isClearing={isClearing}
				mediaPickerRef={mediaPickerRef}
			/>
			<MediaPickerModal
				ref={mediaPickerRef}
				userId={currentUserId}
				onSelect={(mediaId) => uploadLogo(mediaId)}
				imagesOnly
			/>
		</>
	);
}

function CompactLogoLightCard({
	logo,
	currentUserId,
}: {
	logo?: Media | null;
	currentUserId: number;
}) {
	const mediaPickerRef = useRef<MediaPickerModalHandle>(null);
	const { uploadLogo, isLoading } = useUploadLogo(Field.CompactLogoLight);
	const { clearLogo, isLoading: isClearing } = useClearLogo(
		Field.CompactLogoLight,
	);

	return (
		<>
			<LogoCardBase
				label="Compact Logo (Light Mode)"
				logo={logo}
				onClear={clearLogo}
				isLoading={isLoading}
				isClearing={isClearing}
				mediaPickerRef={mediaPickerRef}
			/>
			<MediaPickerModal
				ref={mediaPickerRef}
				userId={currentUserId}
				onSelect={(mediaId) => uploadLogo(mediaId)}
				imagesOnly
			/>
		</>
	);
}

function CompactLogoDarkCard({
	logo,
	currentUserId,
}: {
	logo?: Media | null;
	currentUserId: number;
}) {
	const mediaPickerRef = useRef<MediaPickerModalHandle>(null);
	const { uploadLogo, isLoading } = useUploadLogo(Field.CompactLogoDark);
	const { clearLogo, isLoading: isClearing } = useClearLogo(
		Field.CompactLogoDark,
	);

	return (
		<>
			<LogoCardBase
				label="Compact Logo (Dark Mode)"
				logo={logo}
				onClear={clearLogo}
				isLoading={isLoading}
				isClearing={isClearing}
				mediaPickerRef={mediaPickerRef}
			/>
			<MediaPickerModal
				ref={mediaPickerRef}
				userId={currentUserId}
				onSelect={(mediaId) => uploadLogo(mediaId)}
				imagesOnly
			/>
		</>
	);
}

function FaviconLightCard({
	logo,
	currentUserId,
}: {
	logo?: Media | null;
	currentUserId: number;
}) {
	const mediaPickerRef = useRef<MediaPickerModalHandle>(null);
	const { uploadLogo, isLoading } = useUploadLogo(Field.FaviconLight);
	const { clearLogo, isLoading: isClearing } = useClearLogo(Field.FaviconLight);

	return (
		<>
			<LogoCardBase
				label="Favicon (Light Mode)"
				logo={logo}
				onClear={clearLogo}
				isLoading={isLoading}
				isClearing={isClearing}
				mediaPickerRef={mediaPickerRef}
			/>
			<MediaPickerModal
				ref={mediaPickerRef}
				userId={currentUserId}
				onSelect={(mediaId) => uploadLogo(mediaId)}
				imagesOnly
			/>
		</>
	);
}

function FaviconDarkCard({
	logo,
	currentUserId,
}: {
	logo?: Media | null;
	currentUserId: number;
}) {
	const mediaPickerRef = useRef<MediaPickerModalHandle>(null);
	const { uploadLogo, isLoading } = useUploadLogo(Field.FaviconDark);
	const { clearLogo, isLoading: isClearing } = useClearLogo(Field.FaviconDark);

	return (
		<>
			<LogoCardBase
				label="Favicon (Dark Mode)"
				logo={logo}
				onClear={clearLogo}
				isLoading={isLoading}
				isClearing={isClearing}
				mediaPickerRef={mediaPickerRef}
			/>
			<MediaPickerModal
				ref={mediaPickerRef}
				userId={currentUserId}
				onSelect={(mediaId) => uploadLogo(mediaId)}
				imagesOnly
			/>
		</>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return <DefaultErrorBoundary error={error} />;
}

export default function AdminLogoPage({ loaderData }: Route.ComponentProps) {
	const { logos, currentUserId } = loaderData;

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
					<br />
					<strong>Choose:</strong> Select an image from your media drive or
					upload a new one.
				</Text>
			</Alert>

			<Grid>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<LogoLightCard logo={logos.logoLight} currentUserId={currentUserId} />
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<LogoDarkCard logo={logos.logoDark} currentUserId={currentUserId} />
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<CompactLogoLightCard
						logo={logos.compactLogoLight}
						currentUserId={currentUserId}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<CompactLogoDarkCard
						logo={logos.compactLogoDark}
						currentUserId={currentUserId}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<FaviconLightCard
						logo={logos.faviconLight}
						currentUserId={currentUserId}
					/>
				</Grid.Col>
				<Grid.Col span={{ base: 12, md: 6 }}>
					<FaviconDarkCard
						logo={logos.faviconDark}
						currentUserId={currentUserId}
					/>
				</Grid.Col>
			</Grid>
		</Stack>
	);
}
