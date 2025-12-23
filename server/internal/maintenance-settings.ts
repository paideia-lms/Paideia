import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import { MaintenanceSettings } from "server/collections/globals";

export interface GetMaintenanceSettingsArgs extends BaseInternalFunctionArgs {}

export interface UpdateMaintenanceSettingsArgs
	extends BaseInternalFunctionArgs {
	data: {
		maintenanceMode?: boolean;
	};
}

/**
 * Read maintenance settings from the MaintenanceSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export function tryGetMaintenanceSettings(args: GetMaintenanceSettingsArgs) {
	return Result.try(
		async () => {
			const { payload, req, overrideAccess = false } = args;

			const raw = await payload
				.findGlobal({
					slug: MaintenanceSettings.slug,
					req,
					overrideAccess,
				})
				.then(stripDepth<0, "findGlobal">());

			return {
				maintenanceMode: raw.maintenanceMode ?? false,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get maintenance settings", { cause: error }),
	);
}

/**
 * Update maintenance settings in the MaintenanceSettings global.
 */
export function tryUpdateMaintenanceSettings(
	args: UpdateMaintenanceSettingsArgs,
) {
	return Result.try(
		async () => {
			const { payload, req, data, overrideAccess = false } = args;

			const updated = await payload
				.updateGlobal({
					slug: "maintenance-settings",
					data: {
						maintenanceMode: data.maintenanceMode ?? false,
					},
					req,
					overrideAccess,
				})
				.then(stripDepth<0, "updateGlobal">());

			return {
				maintenanceMode: updated.maintenanceMode ?? false,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update maintenance settings", {
				cause: error,
			}),
	);
}
