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
	};
	overrideAccess?: boolean;
}

export type AppearanceSettings = {
	additionalCssStylesheets: string[];
};

const appearanceSettingsSchema = z.object({
	additionalCssStylesheets: z
		.array(
			z.object({
				url: z.string().url(),
			}),
		)
		.optional(),
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
			};
		}

		const stylesheets = parsed.data.additionalCssStylesheets ?? [];

		return {
			additionalCssStylesheets: stylesheets.map((item) => item.url),
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

		const updated = await payload.updateGlobal({
			slug: "appearance-settings",
			data: {
				additionalCssStylesheets: stylesheets,
			},
			user,
			overrideAccess,
		});

		const parsed = appearanceSettingsSchema.safeParse(updated);

		if (!parsed.success) {
			return {
				additionalCssStylesheets: [],
			};
		}

		const updatedStylesheets = parsed.data.additionalCssStylesheets ?? [];

		return {
			additionalCssStylesheets: updatedStylesheets.map((item) => item.url),
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update appearance settings", {
			cause: error,
		}),
);
