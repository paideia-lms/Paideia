import type { Payload, PayloadRequest } from "payload";
import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";
import type { User } from "../payload-types";

export interface GetAppearanceSettingsArgs {
	payload: Payload;
	user?: User | null;
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
	};
	overrideAccess?: boolean;
}

export type AppearanceSettings = {
	additionalCssStylesheets: string[];
	color: string;
	radius: "xs" | "sm" | "md" | "lg" | "xl";
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

		const parsed = appearanceSettingsSchema.safeParse(raw);

		if (!parsed.success) {
			return {
				additionalCssStylesheets: [],
				color: "blue",
				radius: "sm",
			};
		}

		const stylesheets = parsed.data.additionalCssStylesheets ?? [];
		const color = parsed.data.color ?? "blue";
		const radius = parsed.data.radius ?? "sm";

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

		return {
			additionalCssStylesheets: stylesheets.map((item) => item.url),
			color: color as string,
			radius: radius as "xs" | "sm" | "md" | "lg" | "xl",
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get appearance settings", { cause: error }),
);

/**
 * Update appearance settings in the AppearanceSettings global.
 */
export const tryUpdateAppearanceSettings = Result.wrap(
	async (args: UpdateAppearanceSettingsArgs): Promise<AppearanceSettings> => {
		const { payload, user, data, overrideAccess = false } = args;

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

		const updated = await payload.updateGlobal({
			slug: "appearance-settings",
			data: updateData,
			user,
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

		return {
			additionalCssStylesheets: updatedStylesheets.map((item) => item.url),
			color: validColor,
			radius: validRadiusValue,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update appearance settings", {
			cause: error,
		}),
);
