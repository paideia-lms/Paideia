import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import { RegistrationSettings } from "server/collections/globals";

export interface GetRegistrationSettingsArgs extends BaseInternalFunctionArgs {}

export interface UpdateRegistrationSettingsArgs
	extends BaseInternalFunctionArgs {
	data: {
		disableRegistration?: boolean;
		showRegistrationButton?: boolean;
	};
}

/**
 * Read registration settings from the RegistrationSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export const tryGetRegistrationSettings = Result.wrap(
	async (args: GetRegistrationSettingsArgs) => {
		const { payload, req, overrideAccess = false } = args;

		const raw = await payload
			.findGlobal({
				slug: RegistrationSettings.slug,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "findGlobal">());

		return {
			disableRegistration: raw.disableRegistration ?? false,
			showRegistrationButton: raw.showRegistrationButton ?? true,
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
	async (args: UpdateRegistrationSettingsArgs) => {
		const { payload, req, data, overrideAccess = false } = args;

		const updated = await payload
			.updateGlobal({
				slug: RegistrationSettings.slug,
				data: {
					disableRegistration: data.disableRegistration ?? undefined,
					showRegistrationButton: data.showRegistrationButton ?? undefined,
				},
				req,
				overrideAccess,
				depth: 0,
			})
			.then(stripDepth<0, "updateGlobal">());
		return {
			disableRegistration: updated.disableRegistration ?? false,
			showRegistrationButton: updated.showRegistrationButton ?? true,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update registration settings", {
			cause: error,
		}),
);
