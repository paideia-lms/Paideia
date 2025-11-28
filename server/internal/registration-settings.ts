import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export type GetRegistrationSettingsArgs = BaseInternalFunctionArgs & {};

export type UpdateRegistrationSettingsArgs = BaseInternalFunctionArgs & {
	data: {
		disableRegistration?: boolean;
		showRegistrationButton?: boolean;
	};
};

export type RegistrationSettings = {
	disableRegistration: boolean;
	showRegistrationButton: boolean;
};

const registrationSettingsSchema = z.object({
	disableRegistration: z.boolean().optional(),
	showRegistrationButton: z.boolean().optional(),
});

/**
 * Read registration settings from the RegistrationSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export const tryGetRegistrationSettings = Result.wrap(
	async (args: GetRegistrationSettingsArgs): Promise<RegistrationSettings> => {
		const { payload, req, overrideAccess = false } = args;

		const raw = await payload.findGlobal({
			slug: "registration-settings",
			req,
			overrideAccess,
		});

		const parsed = registrationSettingsSchema.safeParse(raw);

		if (!parsed.success) {
			return {
				disableRegistration: false,
				showRegistrationButton: true,
			};
		}

		return {
			disableRegistration: parsed.data.disableRegistration ?? false,
			showRegistrationButton: parsed.data.showRegistrationButton ?? true,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get registration settings", { cause: error }),
);

/**
 * Update registration settings in the RegistrationSettings global.
 */
export const tryUpdateRegistrationSettings = Result.wrap(
	async (
		args: UpdateRegistrationSettingsArgs,
	): Promise<RegistrationSettings> => {
		const { payload, user, data, overrideAccess = false } = args;

		const updated = await payload.updateGlobal({
			slug: "registration-settings",
			data: {
				disableRegistration: data.disableRegistration ?? false,
				showRegistrationButton: data.showRegistrationButton ?? true,
			},
			user,
			overrideAccess,
		});

		const parsed = registrationSettingsSchema.safeParse(updated);

		if (!parsed.success) {
			return {
				disableRegistration: false,
				showRegistrationButton: true,
			};
		}

		return {
			disableRegistration: parsed.data.disableRegistration ?? false,
			showRegistrationButton: parsed.data.showRegistrationButton ?? true,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update registration settings", {
			cause: error,
		}),
);
