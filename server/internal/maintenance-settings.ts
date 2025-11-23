import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export type GetMaintenanceSettingsArgs = BaseInternalFunctionArgs & {};

export type UpdateMaintenanceSettingsArgs = BaseInternalFunctionArgs & {
	data: {
		maintenanceMode?: boolean;
	};
};

export type MaintenanceSettings = {
	maintenanceMode: boolean;
};

const maintenanceSettingsSchema = z.object({
	maintenanceMode: z.boolean().optional(),
});

/**
 * Read maintenance settings from the MaintenanceSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export const tryGetMaintenanceSettings = Result.wrap(
	async (args: GetMaintenanceSettingsArgs): Promise<MaintenanceSettings> => {
		const { payload, user = null, req } = args;

		const raw = await payload.findGlobal({
			slug: "maintenance-settings",
			user,
			req,
			// ! this is a system request, we don't care about access control
			overrideAccess: true,
		});

		const parsed = maintenanceSettingsSchema.safeParse(raw);

		if (!parsed.success) {
			return {
				maintenanceMode: false,
			};
		}

		return {
			maintenanceMode: parsed.data.maintenanceMode ?? false,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get maintenance settings", { cause: error }),
);

/**
 * Update maintenance settings in the MaintenanceSettings global.
 */
export const tryUpdateMaintenanceSettings = Result.wrap(
	async (args: UpdateMaintenanceSettingsArgs): Promise<MaintenanceSettings> => {
		const { payload, user, data, overrideAccess = false } = args;

		const updated = await payload.updateGlobal({
			slug: "maintenance-settings",
			data: {
				maintenanceMode: data.maintenanceMode ?? false,
			},
			user,
			overrideAccess,
		});

		const parsed = maintenanceSettingsSchema.safeParse(updated);

		if (!parsed.success) {
			return {
				maintenanceMode: false,
			};
		}

		return {
			maintenanceMode: parsed.data.maintenanceMode ?? false,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update maintenance settings", {
			cause: error,
		}),
);
