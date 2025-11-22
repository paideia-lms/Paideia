import type { Payload, PayloadRequest, TypedUser } from "payload";
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
	additionalCssStylesheets: string[];
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

// Schema that accepts both number IDs and objects with id property
const logoFieldSchema = z.union([
	z.number(),
	z.null(),
	z.object({ id: z.number() }),
	z.object({ id: z.string() }),
]);

const appearanceSettingsSchema = z.object({
	additionalCssStylesheets: z
		.array(
			z.object({
				url: z.string().url(),
			}),
		)
		.optional(),
	color: z.enum([...validColors] as [string, ...string[]]).optional(),
	radius: z.enum([...validRadius] as [string, ...string[]]).optional(),
	logoLight: logoFieldSchema.optional(),
	logoDark: logoFieldSchema.optional(),
	compactLogoLight: logoFieldSchema.optional(),
	compactLogoDark: logoFieldSchema.optional(),
	faviconLight: logoFieldSchema.optional(),
	faviconDark: logoFieldSchema.optional(),
});

/**
 * Read appearance settings from the AppearanceSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export const tryGetAppearanceSettings = Result.wrap(
	async (args: GetAppearanceSettingsArgs): Promise<AppearanceSettings> => {
		const { payload, user = null, req } = args;

		const raw = await payload.findGlobal({
			slug: "appearance-settings",
			user,
			req,
			// ! this is a system request, we don't care about access control
			overrideAccess: true,
		});

		const stylesheets = raw.additionalCssStylesheets ?? [];
		const color = raw.color ?? "blue";
		const radius = raw.radius ?? "sm";

		// Validate color is in allowed list
		if (!validColors.includes(color as (typeof validColors)[number])) {
			return {
				additionalCssStylesheets: stylesheets.map((item) => item.url),
				color: "blue",
				radius: radius as "xs" | "sm" | "md" | "lg" | "xl",
			};
		}

		// Validate radius is in allowed list
		if (!validRadius.includes(radius as (typeof validRadius)[number])) {
			return {
				additionalCssStylesheets: stylesheets.map((item) => item.url),
				color: color as string,
				radius: "sm",
			};
		}

		// Extract logo fields - handle both object and ID formats
		const getLogoId = (
			logo: number | null | undefined | { id: number } | { id: string },
		): number | null | undefined => {
			if (logo === null || logo === undefined) return logo;
			if (typeof logo === "number") return logo;
			if (typeof logo === "object" && logo !== null && "id" in logo) {
				return typeof logo.id === "number" ? logo.id : null;
			}
			return null;
		};

		return {
			additionalCssStylesheets: stylesheets.map((item) => item.url),
			color: color as string,
			radius: radius as "xs" | "sm" | "md" | "lg" | "xl",
			logoLight: getLogoId(raw.logoLight),
			logoDark: getLogoId(raw.logoDark),
			compactLogoLight: getLogoId(raw.compactLogoLight),
			compactLogoDark: getLogoId(raw.compactLogoDark),
			faviconLight: getLogoId(raw.faviconLight),
			faviconDark: getLogoId(raw.faviconDark),
		};
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
	}): Promise<AppearanceSettings> => {
		const { payload, user, field, req, overrideAccess = false } = args;

		const updateData: {
			[K in LogoField]?: number | null;
		} = {
			[field]: null,
		};

		const updated = await payload.updateGlobal({
			slug: "appearance-settings",
			data: updateData,
			user,
			req,
			overrideAccess,
		});

		const updatedStylesheets = updated.additionalCssStylesheets ?? [];
		const color = updated.color ?? "blue";
		const radius = updated.radius ?? "sm";

		// Validate color is in allowed list
		const validColor = validColors.includes(
			color as (typeof validColors)[number],
		)
			? (color as string)
			: "blue";

		// Validate radius is in allowed list
		const validRadiusValue = validRadius.includes(
			radius as (typeof validRadius)[number],
		)
			? (radius as "xs" | "sm" | "md" | "lg" | "xl")
			: "sm";

		// Extract logo fields - handle both object and ID formats
		const getLogoId = (
			logo: number | null | undefined | { id: number } | { id: string },
		): number | null | undefined => {
			if (logo === null || logo === undefined) return logo;
			if (typeof logo === "number") return logo;
			if (typeof logo === "object" && logo !== null && "id" in logo) {
				return typeof logo.id === "number" ? logo.id : null;
			}
			return null;
		};

		return {
			additionalCssStylesheets: updatedStylesheets.map((item) => item.url),
			color: validColor,
			radius: validRadiusValue,
			logoLight: getLogoId(updated.logoLight),
			logoDark: getLogoId(updated.logoDark),
			compactLogoLight: getLogoId(updated.compactLogoLight),
			compactLogoDark: getLogoId(updated.compactLogoDark),
			faviconLight: getLogoId(updated.faviconLight),
			faviconDark: getLogoId(updated.faviconDark),
		};
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
	async (args: UpdateAppearanceSettingsArgs): Promise<AppearanceSettings> => {
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

		const updated = await payload.updateGlobal({
			slug: "appearance-settings",
			data: updateData,
			user,
			req,
			overrideAccess,
		});

		const parsed = appearanceSettingsSchema.safeParse(updated);

		if (!parsed.success) {
			return {
				additionalCssStylesheets: [],
				color: "blue",
				radius: "sm",
			};
		}

		const updatedStylesheets = parsed.data.additionalCssStylesheets ?? [];
		const color = parsed.data.color ?? "blue";
		const radius = parsed.data.radius ?? "sm";

		// Validate color is in allowed list
		const validColor = validColors.includes(
			color as (typeof validColors)[number],
		)
			? (color as string)
			: "blue";

		// Validate radius is in allowed list
		const validRadiusValue = validRadius.includes(
			radius as (typeof validRadius)[number],
		)
			? (radius as "xs" | "sm" | "md" | "lg" | "xl")
			: "sm";

		// Extract logo fields - handle both object and ID formats
		const getLogoId = (
			logo: number | null | undefined | { id: number } | { id: string },
		): number | null | undefined => {
			if (logo === null || logo === undefined) return logo;
			if (typeof logo === "number") return logo;
			if (typeof logo === "object" && logo !== null && "id" in logo) {
				return typeof logo.id === "number" ? logo.id : null;
			}
			return null;
		};

		return {
			additionalCssStylesheets: updatedStylesheets.map((item) => item.url),
			color: validColor,
			radius: validRadiusValue,
			logoLight: getLogoId(
				parsed.data.logoLight as
				| number
				| null
				| undefined
				| { id: number }
				| { id: string },
			),
			logoDark: getLogoId(
				parsed.data.logoDark as
				| number
				| null
				| undefined
				| { id: number }
				| { id: string },
			),
			compactLogoLight: getLogoId(
				parsed.data.compactLogoLight as
				| number
				| null
				| undefined
				| { id: number }
				| { id: string },
			),
			compactLogoDark: getLogoId(
				parsed.data.compactLogoDark as
				| number
				| null
				| undefined
				| { id: number }
				| { id: string },
			),
			faviconLight: getLogoId(
				parsed.data.faviconLight as
				| number
				| null
				| undefined
				| { id: number }
				| { id: string },
			),
			faviconDark: getLogoId(
				parsed.data.faviconDark as
				| number
				| null
				| undefined
				| { id: number }
				| { id: string },
			),
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update appearance settings", {
			cause: error,
		}),
);
