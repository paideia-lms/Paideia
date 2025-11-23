import type { Payload, PayloadRequest, TypedUser } from "payload";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";
import type { User } from "../payload-types";

export interface GetAppearanceSettingsArgs {
	payload: Payload;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdateAppearanceSettingsArgs {
	payload: Payload;
	user: User;
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
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export type AppearanceSettings = {
	additionalCssStylesheets: { url: string; id?: string | null }[];
	color: string;
	radius: "xs" | "sm" | "md" | "lg" | "xl";
	logoLight?: number | null;
	logoDark?: number | null;
	compactLogoLight?: number | null;
	compactLogoDark?: number | null;
	faviconLight?: number | null;
	faviconDark?: number | null;
};

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
		const { payload, user = null, req } = args;

		const setting = await payload
			.findGlobal({
				slug: "appearance-settings",
				user,
				req,
				// ! this is a system request, we don't care about access control
				overrideAccess: true,
			})
			.then((raw) => {
				// type narrow down the raw to AppearanceSetting
				assertZodInternal(
					"tryGetAppearanceSettings: Color",
					raw.color,
					z.enum([...validColors] as [string, ...string[]]).nullish(),
				);
				assertZodInternal(
					"tryGetAppearanceSettings: Radius",
					raw.radius,
					z.enum([...validRadius] as [string, ...string[]]).nullish(),
				);
				assertZodInternal(
					"tryGetAppearanceSettings: Logo",
					raw.logoLight,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryGetAppearanceSettings: Logo",
					raw.logoDark,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryGetAppearanceSettings: Logo",
					raw.compactLogoLight,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryGetAppearanceSettings: Logo",
					raw.compactLogoDark,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryGetAppearanceSettings: Logo",
					raw.faviconLight,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryGetAppearanceSettings: Logo",
					raw.faviconDark,
					z.object({ id: z.number() }).nullish(),
				);
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
export const tryClearLogo = Result.wrap(
	async (args: {
		payload: Payload;
		user: User;
		field: LogoField;
		req?: Partial<PayloadRequest>;
		overrideAccess?: boolean;
	}) => {
		const { payload, user, field, req, overrideAccess = false } = args;

		const updateData: {
			[K in LogoField]?: number | null;
		} = {
			[field]: null,
		};

		const updated = await payload
			.updateGlobal({
				slug: "appearance-settings",
				data: updateData,
				user,
				req,
				overrideAccess,
			})
			.then((raw) => {
				assertZodInternal(
					"tryClearLogo: Color",
					raw.color,
					z.enum([...validColors] as [string, ...string[]]).nullish(),
				);
				assertZodInternal(
					"tryClearLogo: Radius",
					raw.radius,
					z.enum([...validRadius] as [string, ...string[]]).nullish(),
				);
				assertZodInternal(
					"tryClearLogo: Logo",
					raw.logoLight,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryClearLogo: Logo",
					raw.logoDark,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryClearLogo: Logo",
					raw.compactLogoLight,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryClearLogo: Logo",
					raw.compactLogoDark,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryClearLogo: Logo",
					raw.faviconLight,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryClearLogo: Logo",
					raw.faviconDark,
					z.object({ id: z.number() }).nullish(),
				);
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
		const { payload, user, data, req, overrideAccess = false } = args;

		// Validate URLs before saving
		const stylesheets = data.additionalCssStylesheets ?? [];
		for (const stylesheet of stylesheets) {
			try {
				const url = new URL(stylesheet.url);
				if (url.protocol !== "http:" && url.protocol !== "https:") {
					throw new Error(
						`Invalid URL protocol: ${url.protocol}. Only HTTP and HTTPS are allowed.`,
					);
				}
			} catch (error) {
				if (error instanceof Error) {
					throw error;
				}
				throw new Error(`Invalid URL format: ${stylesheet.url}`);
			}
		}

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
				user,
				req,
				overrideAccess,
			})
			.then((raw) => {
				assertZodInternal(
					"tryUpdateAppearanceSettings: Color",
					raw.color,
					z.enum([...validColors] as [string, ...string[]]).nullish(),
				);
				assertZodInternal(
					"tryUpdateAppearanceSettings: Radius",
					raw.radius,
					z.enum([...validRadius] as [string, ...string[]]).nullish(),
				);
				assertZodInternal(
					"tryUpdateAppearanceSettings: Logo",
					raw.logoLight,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryUpdateAppearanceSettings: Logo",
					raw.logoDark,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryUpdateAppearanceSettings: Logo",
					raw.compactLogoLight,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryUpdateAppearanceSettings: Logo",
					raw.compactLogoDark,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryUpdateAppearanceSettings: Logo",
					raw.faviconLight,
					z.object({ id: z.number() }).nullish(),
				);
				assertZodInternal(
					"tryUpdateAppearanceSettings: Logo",
					raw.faviconDark,
					z.object({ id: z.number() }).nullish(),
				);
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
