import type { Payload, PayloadRequest } from "payload";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import type { User } from "../payload-types";
import { tryGetMaintenanceSettings } from "./maintenance-settings";
import { tryGetSitePolicies } from "./site-policies";

export interface GetSystemGlobalsArgs {
	payload: Payload;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export type SystemGlobals = {
	maintenanceSettings: {
		maintenanceMode: boolean;
	};
	sitePolicies: {
		userMediaStorageTotal: number | null;
		siteUploadLimit: number | null;
	};
};

/**
 * Fetch all system globals in a single call.
 * This is more efficient than fetching them individually.
 */
export const tryGetSystemGlobals = Result.wrap(
	async (args: GetSystemGlobalsArgs): Promise<SystemGlobals> => {
		const { payload, user = null, req, overrideAccess = true } = args;

		// Fetch all globals in parallel
		const [maintenanceResult, sitePoliciesResult] = await Promise.all([
			tryGetMaintenanceSettings({
				payload,
				user,
				req,
				overrideAccess,
			}),
			tryGetSitePolicies({
				payload,
				user,
				req,
				overrideAccess,
			}),
		]);

		// If any critical global fails, return defaults
		const maintenanceSettings = maintenanceResult.ok
			? maintenanceResult.value
			: { maintenanceMode: false };

		const sitePolicies = sitePoliciesResult.ok
			? sitePoliciesResult.value
			: {
					userMediaStorageTotal: null,
					siteUploadLimit: null,
				};

		return {
			maintenanceSettings,
			sitePolicies,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get system globals", { cause: error }),
);

