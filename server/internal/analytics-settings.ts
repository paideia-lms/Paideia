import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export type GetAnalyticsSettingsArgs = BaseInternalFunctionArgs & {};

export type UpdateAnalyticsSettingsArgs = BaseInternalFunctionArgs & {
	data: {
		additionalJsScripts?: Array<{
			src: string;
			defer?: boolean;
		}>;
	};
};

/**
 * Read analytics settings from the AnalyticsSettings global.
 * Falls back to sensible defaults when unset/partial.
 */
export const tryGetAnalyticsSettings = Result.wrap(
	async (args: GetAnalyticsSettingsArgs) => {
		const { payload, user = null, req } = args;

		const raw = await payload.findGlobal({
			slug: "analytics-settings",
			user,
			req,
			// ! this is a system request, we don't care about access control
			overrideAccess: true,
		});

		return raw;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get analytics settings", { cause: error }),
);

/**
 * Update analytics settings in the AnalyticsSettings global.
 * Validates each script tag before saving.
 */
export const tryUpdateAnalyticsSettings = Result.wrap(
	async (args: UpdateAnalyticsSettingsArgs) => {
		const { payload, user, data, req, overrideAccess = false } = args;

		const scripts = data.additionalJsScripts ?? [];

		const updated = await payload.updateGlobal({
			slug: "analytics-settings",
			data: {
				additionalJsScripts: scripts,
			},
			user,
			req,
			overrideAccess,
		});

		return updated;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update analytics settings", {
			cause: error,
		}),
);
