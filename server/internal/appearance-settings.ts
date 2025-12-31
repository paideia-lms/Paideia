import { Result } from "typescript-result";
import {
	DevelopmentError,
	transformError,
	UnauthorizedError,
	UnknownError,
} from "~/utils/error";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import { AppearanceSettings } from "server/collections/globals";
import { tryCreateMedia } from "./media-management";
import { handleTransactionId } from "./utils/handle-transaction-id";
export interface GetAppearanceSettingsArgs extends BaseInternalFunctionArgs {}

export interface UpdateAppearanceSettingsArgs extends BaseInternalFunctionArgs {
	data: {
		additionalCssStylesheets?: string[];
		color?: (typeof validColors)[number];
		radius?: "xs" | "sm" | "md" | "lg" | "xl";
		logoLight?: File | null;
		logoDark?: File | null;
		compactLogoLight?: File | null;
		compactLogoDark?: File | null;
		faviconLight?: File | null;
		faviconDark?: File | null;
	};
}

const validColors = [
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
] as const;

const _validRadius = ["xs", "sm", "md", "lg", "xl"] as const;

/**
 * Read appearance settings from the AppearanceSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export function tryGetAppearanceSettings(args: GetAppearanceSettingsArgs) {
	return Result.try(
		async () => {
			const { payload, req, overrideAccess = false } = args;

			const setting = await payload
				.findGlobal({
					slug: AppearanceSettings.slug,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findGlobal">())
				.then((raw) => {
					return {
						...raw,
						additionalCssStylesheets:
							// type narrowing
							raw.additionalCssStylesheets?.map((stylesheet) => {
								if (!stylesheet.id)
									throw new DevelopmentError("Stylesheet ID is required");
								return {
									...stylesheet,
									id: stylesheet.id,
								};
							}) ?? [],
						color: raw.color ?? "blue",
						radius: raw.radius ?? "sm",
						logoLight: raw.logoLight ?? null,
						logoDark: raw.logoDark ?? null,
						compactLogoLight: raw.compactLogoLight ?? null,
						compactLogoDark: raw.compactLogoDark ?? null,
						faviconLight: raw.faviconLight ?? null,
						faviconDark: raw.faviconDark ?? null,
					};
				});

			return setting;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get appearance settings", { cause: error }),
	);
}

/**
 * Clear a logo field in appearance settings (set to null).
 */
export interface ClearLogoArgs extends BaseInternalFunctionArgs {
	field: LogoField;
}

export function tryClearLogo(args: ClearLogoArgs) {
	return Result.try(
		async () => {
			const { payload, field, req, overrideAccess = false } = args;

			const updated = await payload
				.updateGlobal({
					slug: AppearanceSettings.slug,
					data: {
						[field]: null,
					},
					req,
					overrideAccess,
					depth: 0,
				})
				.then(stripDepth<0, "updateGlobal">());

			return updated;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to clear logo", { cause: error }),
	);
}

type LogoField =
	| "logoLight"
	| "logoDark"
	| "compactLogoLight"
	| "compactLogoDark"
	| "faviconLight"
	| "faviconDark";

/**
 * Update appearance settings in the AppearanceSettings global.
 */
export function tryUpdateAppearanceSettings(
	args: UpdateAppearanceSettingsArgs,
) {
	return Result.try(
		async () => {
			const { payload, data, req, overrideAccess = false } = args;

			const currentUser = req?.user;
			if (!currentUser) {
				throw new UnauthorizedError("Unauthorized");
			}

			// Validate URLs before saving
			// const stylesheets = data.additionalCssStylesheets ?? [];
			// urlSchema.parse(stylesheets.map((stylesheet) => stylesheet.url));
			// // Validate color if provided
			// if (data.color !== undefined) {
			// 	if (!validColors.includes(data.color as (typeof validColors)[number])) {
			// 		throw new Error(
			// 			`Invalid color: ${data.color}. Must be one of: ${validColors.join(", ")}`,
			// 		);
			// 	}
			// }

			// // Validate radius if provided
			// if (data.radius !== undefined) {
			// 	if (!validRadius.includes(data.radius)) {
			// 		throw new Error(
			// 			`Invalid radius: ${data.radius}. Must be one of: ${validRadius.join(", ")}`,
			// 		);
			// 	}
			// }

			// const updateData: {
			// 	additionalCssStylesheets?: Array<{ url: string }>;
			// 	color?: (typeof validColors)[number];
			// 	radius?: (typeof validRadius)[number];
			// 	logoLight?: number | null;
			// 	logoDark?: number | null;
			// 	compactLogoLight?: number | null;
			// 	compactLogoDark?: number | null;
			// 	faviconLight?: number | null;
			// 	faviconDark?: number | null;
			// } = {};

			// if (data.additionalCssStylesheets !== undefined) {
			// 	updateData.additionalCssStylesheets = stylesheets;
			// }
			// if (data.color !== undefined) {
			// 	updateData.color = data.color as (typeof validColors)[number];
			// }
			// if (data.radius !== undefined) {
			// 	updateData.radius = data.radius;
			// }
			// if (data.logoLight !== undefined) {
			// 	updateData.logoLight = data.logoLight;
			// }
			// if (data.logoDark !== undefined) {
			// 	updateData.logoDark = data.logoDark;
			// }
			// if (data.compactLogoLight !== undefined) {
			// 	updateData.compactLogoLight = data.compactLogoLight;
			// }
			// if (data.compactLogoDark !== undefined) {
			// 	updateData.compactLogoDark = data.compactLogoDark;
			// }
			// if (data.faviconLight !== undefined) {
			// 	updateData.faviconLight = data.faviconLight;
			// }
			// if (data.faviconDark !== undefined) {
			// 	updateData.faviconDark = data.faviconDark;
			// }

			const transactionInfo = await handleTransactionId(payload, req);

			return transactionInfo.tx(async ({ reqWithTransaction }) => {
				return await payload
					.updateGlobal({
						slug: "appearance-settings",
						data: {
							additionalCssStylesheets: data.additionalCssStylesheets?.map(
								(stylesheet) => ({
									url: stylesheet,
								}),
							),
							color: data.color,
							radius: data.radius,
							logoLight: data.logoLight
								? await tryCreateMedia({
										payload,
										file: await data.logoLight.arrayBuffer().then(Buffer.from),
										filename: data.logoLight.name ?? "unknown",
										mimeType: data.logoLight.type ?? "application/octet-stream",
										alt: "Logo",
										caption: "Logo",
										userId: currentUser.id,
										req: reqWithTransaction,
										overrideAccess,
									})
										.getOrThrow()
										.then((r) => r.media.id)
								: undefined,
							logoDark: data.logoDark
								? await tryCreateMedia({
										payload,
										file: await data.logoDark.arrayBuffer().then(Buffer.from),
										filename: data.logoDark.name ?? "unknown",
										mimeType: data.logoDark.type ?? "application/octet-stream",
										alt: "Logo",
										caption: "Logo",
										userId: currentUser.id,
										req: reqWithTransaction,
										overrideAccess,
									})
										.getOrThrow()
										.then((r) => r.media.id)
								: undefined,
							compactLogoLight: data.compactLogoLight
								? await tryCreateMedia({
										payload,
										file: await data.compactLogoLight
											.arrayBuffer()
											.then(Buffer.from),
										filename: data.compactLogoLight.name ?? "unknown",
										mimeType:
											data.compactLogoLight.type ?? "application/octet-stream",
										alt: "Compact Logo",
										caption: "Compact Logo",
										userId: currentUser.id,
										req: reqWithTransaction,
										overrideAccess,
									})
										.getOrThrow()
										.then((r) => r.media.id)
								: undefined,
							compactLogoDark: data.compactLogoDark
								? await tryCreateMedia({
										payload,
										file: await data.compactLogoDark
											.arrayBuffer()
											.then(Buffer.from),
										filename: data.compactLogoDark.name ?? "unknown",
										mimeType:
											data.compactLogoDark.type ?? "application/octet-stream",
										alt: "Compact Logo",
										caption: "Compact Logo",
										userId: currentUser.id,
										req: reqWithTransaction,
										overrideAccess,
									})
										.getOrThrow()
										.then((r) => r.media.id)
								: undefined,
							faviconLight: data.faviconLight
								? await tryCreateMedia({
										payload,
										file: await data.faviconLight
											.arrayBuffer()
											.then(Buffer.from),
										filename: data.faviconLight.name ?? "unknown",
										mimeType:
											data.faviconLight.type ?? "application/octet-stream",
										alt: "Favicon",
										caption: "Favicon",
										userId: currentUser.id,
										req: reqWithTransaction,
										overrideAccess,
									})
										.getOrThrow()
										.then((r) => r.media.id)
								: undefined,
							faviconDark: data.faviconDark
								? await tryCreateMedia({
										payload,
										file: await data.faviconDark
											.arrayBuffer()
											.then(Buffer.from),
										filename: data.faviconDark.name ?? "unknown",
										mimeType:
											data.faviconDark.type ?? "application/octet-stream",
										alt: "Favicon",
										caption: "Favicon",
										userId: currentUser.id,
										req: reqWithTransaction,
										overrideAccess,
									})
										.getOrThrow()
										.then((r) => r.media.id)
								: undefined,
						},
						req: reqWithTransaction,
						overrideAccess,
						depth: 1,
					})
					.then(stripDepth<1, "updateGlobal">())
					.then((raw) => {
						return {
							...raw,
							additionalCssStylesheets: raw.additionalCssStylesheets ?? [],
							color: raw.color ?? "blue",
							radius: raw.radius ?? "sm",
							logoLight: raw.logoLight ?? null,
							logoDark: raw.logoDark ?? null,
							compactLogoLight: raw.compactLogoLight ?? null,
							compactLogoDark: raw.compactLogoDark ?? null,
							faviconLight: raw.faviconLight ?? null,
							faviconDark: raw.faviconDark ?? null,
						};
					});
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update appearance settings", {
				cause: error,
			}),
	);
}
