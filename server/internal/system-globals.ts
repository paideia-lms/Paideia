import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import { tryGetAnalyticsSettings } from "./analytics-settings";
import { tryGetAppearanceSettings } from "./appearance-settings";
import { tryGetMaintenanceSettings } from "./maintenance-settings";
import { tryGetSitePolicies } from "./site-policies";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export interface GetSystemGlobalsArgs extends BaseInternalFunctionArgs {}

/**
 * Fetch all system globals in a single call.
 * This is more efficient than fetching them individually.
 */
export function tryGetSystemGlobals(args: GetSystemGlobalsArgs) {
	return Result.try(
		async () => {
			const { payload, req, overrideAccess = true } = args;

					// Fetch all globals in parallel
					const [
						maintenanceSettings,
						sitePolicies,
						appearanceSettings,
						analyticsSettings,
					] = await Promise.all([
						tryGetMaintenanceSettings({
							payload,
							req,
							overrideAccess,
						}).getOrDefault({
							maintenanceMode: false,
						}),
						tryGetSitePolicies({
							payload,
							req,
							overrideAccess,
						}).getOrDefault({
							userMediaStorageTotal: null,
							siteUploadLimit: null,
						}),
						tryGetAppearanceSettings({
							payload,
							req,
							overrideAccess,
						})
							.getOrDefault({
								additionalCssStylesheets: undefined,
								color: "blue",
								radius: "sm",
								logoLight: undefined,
								logoDark: undefined,
								compactLogoLight: undefined,
								compactLogoDark: undefined,
								faviconLight: undefined,
								faviconDark: undefined,
							})
							.then((result) => {
								// type narrowing
								return {
									...result,
									additionalCssStylesheets: result.additionalCssStylesheets ?? [],
								};
							}),
						tryGetAnalyticsSettings({
							payload,
							req,
							overrideAccess,
						})
							.getOrNull()
							.then((result) => {
								return {
									additionalJsScripts: result?.additionalJsScripts ?? [],
								};
							}),
					]);

					return {
						maintenanceSettings,
						sitePolicies,
						appearanceSettings,
						analyticsSettings,
					};
		},
		(error) =>
		transformError(error) ??
		new UnknownError("Failed to get system globals", { cause: error })
	);
}
