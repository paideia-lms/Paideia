import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export interface CheckFirstUserArgs extends BaseInternalFunctionArgs {}

export interface GetUserCountArgs extends BaseInternalFunctionArgs {}

export interface ValidateFirstUserStateArgs extends BaseInternalFunctionArgs {}

/**
 * Checks if the database has any users
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 * @returns Promise<boolean> - true if no users exist (first user needed), false if users exist
 */
export const tryCheckFirstUser = Result.wrap(
	async (args: CheckFirstUserArgs) => {
		const { payload, req, overrideAccess = false } = args;

		const users = await payload.find({
			collection: "users",
			limit: 1,
			req,
			overrideAccess,
		});

		return users.docs.length === 0;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to check if first user exists", {
			cause: error,
		}),
);

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

/**
 * Validates if the database is in a state where first user creation is needed
 * This is more comprehensive than just checking user count - it also validates
 * the database connection and payload configuration
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 * @returns Promise<{ needsFirstUser: boolean; userCount: number; isValid: boolean }>
 */
export const tryValidateFirstUserState = Result.wrap(
	async (args: ValidateFirstUserStateArgs) => {
		const { payload, req, overrideAccess = false } = args;

		if (!payload.db.connect) {
			throw new Error("Database connection not established");
		}

		// Test database connection
		await payload.db.connect();

		const users = await payload.find({
			collection: "users",
			req,
			overrideAccess,
		});

		const userCount = users.docs.length;
		const needsFirstUser = userCount === 0;

		return {
			needsFirstUser,
			userCount,
			isValid: true,
		};
	},
	(error) => {
		// Return a failed result with default state instead of throwing
		return (
			transformError(error) ??
			new UnknownError("Failed to validate first user state", {
				cause: error,
			})
		);
	},
);
