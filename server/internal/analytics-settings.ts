import { Result } from "typescript-result";
import { DevelopmentError, transformError, UnknownError } from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";
import { AnalyticsSettings } from "server/collections/globals";
import { stripDepth } from "./utils/internal-function-utils";
export interface GetAnalyticsSettingsArgs extends BaseInternalFunctionArgs {}

export interface UpdateAnalyticsSettingsArgs extends BaseInternalFunctionArgs {
	data: {
		additionalJsScripts?: Array<{
			src: string;
			defer?: boolean;
		}>;
	};
}

/**
 * Read analytics settings from the AnalyticsSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export function tryGetAnalyticsSettings(args: GetAnalyticsSettingsArgs) {
	return Result.try(
		async () => {
			const { payload, req, overrideAccess = false } = args;

					const raw = await payload
						.findGlobal({
							slug: AnalyticsSettings.slug,
							req,
							overrideAccess,
						})
						.then(stripDepth<0, "findGlobal">())
						.then((result) => {
							// type narrowing
							return {
								...result,
								additionalJsScripts: result.additionalJsScripts?.map((script) => {
									if (!script.id) throw new DevelopmentError("Script ID is required");
									return {
										...script,
										id: script.id,
									};
								}),
							};
						});

					return raw;
		},
		(error) =>
		transformError(error) ??
		new UnknownError("Failed to get analytics settings", { cause: error })
	);
}

/**
 * Update analytics settings in the AnalyticsSettings global.
 * Validates each script tag before saving.
 */
export function tryUpdateAnalyticsSettings(args: UpdateAnalyticsSettingsArgs) {
	return Result.try(
		async () => {
			const { payload, data, req, overrideAccess = false } = args;

					const scripts = data.additionalJsScripts ?? [];

					const updated = await payload
						.updateGlobal({
							slug: AnalyticsSettings.slug,
							data: {
								additionalJsScripts: scripts,
							},
							req,
							overrideAccess,
						})
						.then(stripDepth<0, "updateGlobal">());

					return updated;
		},
		(error) =>
		transformError(error) ??
		new UnknownError("Failed to update analytics settings", {
			cause: error,
		})
	);
}
