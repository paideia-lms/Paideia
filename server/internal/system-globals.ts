import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import { tryGetAnalyticsSettings } from "./analytics-settings";
import { tryGetAppearanceSettings } from "./appearance-settings";
import { tryGetMaintenanceSettings } from "./maintenance-settings";
import { tryGetSitePolicies } from "./site-policies";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export type GetSystemGlobalsArgs = BaseInternalFunctionArgs & {};

/**
 * Fetch all system globals in a single call.
 * This is more efficient than fetching them individually.
 */
export const tryGetSystemGlobals = Result.wrap(
	async (args: GetSystemGlobalsArgs) => {
		const { payload, user = null, req, overrideAccess = true } = args;

		// Fetch all globals in parallel
		const [
			maintenanceResult,
			sitePoliciesResult,
			appearanceResult,
			analyticsResult,
		] = await Promise.all([
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
			tryGetAppearanceSettings({
				payload,
				user,
				req,
				overrideAccess,
			}),
			tryGetAnalyticsSettings({
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

		const appearanceSettings = {
			additionalCssStylesheets: appearanceResult.ok
				? (appearanceResult.value.additionalCssStylesheets ?? []).map(
					(stylesheet) => ({
						id: stylesheet.id ?? 0,
						url: stylesheet.url,
					}),
				)
				: [],
			color: appearanceResult.ok
				? (appearanceResult.value.color ?? "blue")
				: "blue",
			radius: appearanceResult.ok
				? (appearanceResult.value.radius ?? "sm")
				: "sm",
			logoLight: appearanceResult.ok
				? appearanceResult.value.logoLight
				: undefined,
			logoDark: appearanceResult.ok
				? appearanceResult.value.logoDark
				: undefined,
			compactLogoLight: appearanceResult.ok
				? appearanceResult.value.compactLogoLight
				: undefined,
			compactLogoDark: appearanceResult.ok
				? appearanceResult.value.compactLogoDark
				: undefined,
			faviconLight: appearanceResult.ok
				? appearanceResult.value.faviconLight
				: undefined,
			faviconDark: appearanceResult.ok
				? appearanceResult.value.faviconDark
				: undefined,
		};

		const analyticsSettings = {
			additionalJsScripts: analyticsResult.ok
				? (analyticsResult.value.additionalJsScripts ?? [])
				: [],
		};

		return {
			maintenanceSettings,
			sitePolicies,
			appearanceSettings,
			analyticsSettings,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get system globals", { cause: error }),
);
