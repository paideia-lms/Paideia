import type { Payload, PayloadRequest, TypedUser } from "payload";
import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";
import type { User } from "../payload-types";

export interface GetSitePoliciesArgs {
	payload: Payload;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdateSitePoliciesArgs {
	payload: Payload;
	user: User;
	data: {
		userMediaStorageTotal?: number | null;
		siteUploadLimit?: number | null;
	};
	overrideAccess?: boolean;
}

export type SitePolicies = {
	userMediaStorageTotal: number | null;
	siteUploadLimit: number | null;
};

const sitePoliciesSchema = z.object({
	userMediaStorageTotal: z.number().min(0).nullable().optional(),
	siteUploadLimit: z.number().min(0).nullable().optional(),
});

/**
 * Read site policies from the SitePolicies global.
 * Falls back to sensible defaults when unset/partial.
 */
export const tryGetSitePolicies = Result.wrap(
	async (args: GetSitePoliciesArgs): Promise<SitePolicies> => {
		const { payload, user = null, req } = args;

		const raw = await payload.findGlobal({
			slug: "site-policies",
			user,
			req,
			// ! this is a system request, we don't care about access control
			overrideAccess: true,
		});

		const parsed = sitePoliciesSchema.safeParse(raw);

		if (!parsed.success) {
			return {
				userMediaStorageTotal: null,
				siteUploadLimit: null,
			};
		}

		return {
			userMediaStorageTotal: parsed.data.userMediaStorageTotal ?? null,
			siteUploadLimit: parsed.data.siteUploadLimit ?? null,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get site policies", { cause: error }),
);

/**
 * Update site policies in the SitePolicies global.
 */
export const tryUpdateSitePolicies = Result.wrap(
	async (args: UpdateSitePoliciesArgs): Promise<SitePolicies> => {
		const { payload, user, data, overrideAccess = false } = args;

		const updated = await payload.updateGlobal({
			slug: "site-policies",
			data: {
				userMediaStorageTotal: data.userMediaStorageTotal ?? null,
				siteUploadLimit: data.siteUploadLimit ?? null,
			},
			user,
			overrideAccess,
		});

		const parsed = sitePoliciesSchema.safeParse(updated);

		if (!parsed.success) {
			return {
				userMediaStorageTotal: null,
				siteUploadLimit: null,
			};
		}

		return {
			userMediaStorageTotal: parsed.data.userMediaStorageTotal ?? null,
			siteUploadLimit: parsed.data.siteUploadLimit ?? null,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update site policies", {
			cause: error,
		}),
);
