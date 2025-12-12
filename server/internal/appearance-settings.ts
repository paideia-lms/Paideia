import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import { AppearanceSettings } from "server/collections/globals";
import { urlSchema } from "./utils/common-schema";
export interface GetAppearanceSettingsArgs extends BaseInternalFunctionArgs {}

export interface UpdateAppearanceSettingsArgs extends BaseInternalFunctionArgs {
	data: {
		additionalCssStylesheets?: Array<{ url: string }>;
		color?: string;
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

const validRadius = ["xs", "sm", "md", "lg", "xl"] as const;

/**
 * Read appearance settings from the AppearanceSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export const tryGetAppearanceSettings = Result.wrap(
	async (args: GetAppearanceSettingsArgs) => {
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

		return setting;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get appearance settings", { cause: error }),
);

/**
 * Clear a logo field in appearance settings (set to null).
 */
export interface ClearLogoArgs extends BaseInternalFunctionArgs {
	field: LogoField;
}

export const tryClearLogo = Result.wrap(
	async (args: ClearLogoArgs) => {
		const { payload, field, req, overrideAccess = false } = args;

		const updated = await payload
			.updateGlobal({
				slug: AppearanceSettings.slug,
				data: {
					[field]: null,
				},
				req,
				overrideAccess,
				depth: 1,
			})
			.then(stripDepth<1, "updateGlobal">());

		return updated;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to clear logo", { cause: error }),
);

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
export const tryUpdateAppearanceSettings = Result.wrap(
	async (args: UpdateAppearanceSettingsArgs) => {
		const { payload, data, req, overrideAccess = false } = args;

		// Validate URLs before saving
		const stylesheets = data.additionalCssStylesheets ?? [];
		urlSchema.parse(stylesheets.map((stylesheet) => stylesheet.url));
		// Validate color if provided
		if (data.color !== undefined) {
			if (!validColors.includes(data.color as (typeof validColors)[number])) {
				throw new Error(
					`Invalid color: ${data.color}. Must be one of: ${validColors.join(", ")}`,
				);
			}
		}

		// Validate radius if provided
		if (data.radius !== undefined) {
			if (!validRadius.includes(data.radius)) {
				throw new Error(
					`Invalid radius: ${data.radius}. Must be one of: ${validRadius.join(", ")}`,
				);
			}
		}

		const updateData: {
			additionalCssStylesheets?: Array<{ url: string }>;
			color?: (typeof validColors)[number];
			radius?: (typeof validRadius)[number];
			logoLight?: number | null;
			logoDark?: number | null;
			compactLogoLight?: number | null;
			compactLogoDark?: number | null;
			faviconLight?: number | null;
			faviconDark?: number | null;
		} = {};

		if (data.additionalCssStylesheets !== undefined) {
			updateData.additionalCssStylesheets = stylesheets;
		}
		if (data.color !== undefined) {
			updateData.color = data.color as (typeof validColors)[number];
		}
		if (data.radius !== undefined) {
			updateData.radius = data.radius;
		}
		if (data.logoLight !== undefined) {
			updateData.logoLight = data.logoLight;
		}
		if (data.logoDark !== undefined) {
			updateData.logoDark = data.logoDark;
		}
		if (data.compactLogoLight !== undefined) {
			updateData.compactLogoLight = data.compactLogoLight;
		}
		if (data.compactLogoDark !== undefined) {
			updateData.compactLogoDark = data.compactLogoDark;
		}
		if (data.faviconLight !== undefined) {
			updateData.faviconLight = data.faviconLight;
		}
		if (data.faviconDark !== undefined) {
			updateData.faviconDark = data.faviconDark;
		}

		const updated = await payload
			.updateGlobal({
				slug: "appearance-settings",
				data: updateData,
				req,
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
		return updated;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update appearance settings", { cause: error }),
);
