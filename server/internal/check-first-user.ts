import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export interface GetUserCountArgs extends BaseInternalFunctionArgs {}

/**
 * Gets the total count of users in the database
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 * @returns Promise<number> - number of users in the database
 */
export const tryGetUserCount = Result.wrap(
	async (args: GetUserCountArgs) => {
		const { payload, req, overrideAccess = false } = args;

		const users = await payload.find({
			collection: "users",
			req,
			overrideAccess,
		});

		return users.docs.length;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user count", {
			cause: error,
		}),
);
