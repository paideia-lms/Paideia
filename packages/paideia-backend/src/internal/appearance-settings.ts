import { Result } from "typescript-result";
import {
	DevelopmentError,
	transformError,
	UnauthorizedError,
	UnknownError,
} from "../errors";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import { AppearanceSettings } from "server/collections/globals";
import { handleTransactionId } from "./utils/handle-transaction-id";
export interface GetAppearanceSettingsArgs extends BaseInternalFunctionArgs {}

export interface UpdateAppearanceSettingsArgs extends BaseInternalFunctionArgs {
	data: {
		additionalCssStylesheets?: string[];
		color?: (typeof validColors)[number];
		radius?: "xs" | "sm" | "md" | "lg" | "xl";
		logoLight?: number | null;
		logoDark?: number | null;
		compactLogoLight?: number | null;
		compactLogoDark?: number | null;
		faviconLight?: number | null;
		faviconDark?: number | null;
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


			const transactionInfo = await handleTransactionId(payload, req);

			return transactionInfo.tx(async ({ reqWithTransaction }) => {
				const updateData: Record<string, unknown> = {};
				if (data.additionalCssStylesheets !== undefined) {
					updateData.additionalCssStylesheets =
						data.additionalCssStylesheets.map((stylesheet) => ({
							url: stylesheet,
						}));
				}
				if (data.color !== undefined) updateData.color = data.color;
				if (data.radius !== undefined) updateData.radius = data.radius;
				if (data.logoLight !== undefined) updateData.logoLight = data.logoLight;
				if (data.logoDark !== undefined) updateData.logoDark = data.logoDark;
				if (data.compactLogoLight !== undefined)
					updateData.compactLogoLight = data.compactLogoLight;
				if (data.compactLogoDark !== undefined)
					updateData.compactLogoDark = data.compactLogoDark;
				if (data.faviconLight !== undefined)
					updateData.faviconLight = data.faviconLight;
				if (data.faviconDark !== undefined)
					updateData.faviconDark = data.faviconDark;

				return await payload
					.updateGlobal({
						slug: "appearance-settings",
						data: updateData,
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
