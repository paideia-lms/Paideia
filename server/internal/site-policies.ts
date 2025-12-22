import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import {
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import { SitePolicies } from "server/collections/globals";

export interface GetSitePoliciesArgs extends BaseInternalFunctionArgs {}

export interface UpdateSitePoliciesArgs extends BaseInternalFunctionArgs {
	data: {
		userMediaStorageTotal?: number | null;
		siteUploadLimit?: number | null;
	};
}

/**
 * Read site policies from the SitePolicies global.
 * Falls back to sensible defaults when unset/partial.
 */
export function tryGetSitePolicies(args: GetSitePoliciesArgs) {
	return Result.try(
		async () => {
			const { payload, req, overrideAccess = false } = args;

					const raw = await payload
						.findGlobal({
							slug: SitePolicies.slug,
							req,
							overrideAccess,
							depth: 1,
						})
						.then(stripDepth<1, "findGlobal">());

					return {
						userMediaStorageTotal: raw.userMediaStorageTotal ?? null,
						siteUploadLimit: raw.siteUploadLimit ?? null,
					};
		},
		(error) =>
		transformError(error) ??
		new UnknownError("Failed to get site policies", { cause: error })
	);
}

/**
 * Update site policies in the SitePolicies global.
 */
export function tryUpdateSitePolicies(args: UpdateSitePoliciesArgs) {
	return Result.try(
		async () => {
			const { payload, data, req, overrideAccess = false } = args;

					const updated = await payload
						.updateGlobal({
							slug: SitePolicies.slug,
							data: {
								userMediaStorageTotal: data.userMediaStorageTotal ?? null,
								siteUploadLimit: data.siteUploadLimit ?? null,
							},
							overrideAccess,
							req,
							depth: 0,
						})
						.then(stripDepth<0, "updateGlobal">());

					return {
						userMediaStorageTotal: updated.userMediaStorageTotal ?? null,
						siteUploadLimit: updated.siteUploadLimit ?? null,
					};
		},
		(error) =>
		transformError(error) ??
		new UnknownError("Failed to update site policies", {
			cause: error,
		})
	);
}
