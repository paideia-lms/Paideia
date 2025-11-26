import type { PayloadRequest, Where } from "payload";
import { getAccessResults } from "payload";
import searchQueryParser from "search-query-parser";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import type { Media, User } from "../payload-types";
import { handleTransactionId } from "./utils/handle-transaction-id";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";
import { stripDepth } from "./utils/internal-function-utils";

export type CreateUserArgs = BaseInternalFunctionArgs & {
	data: {
		email: string;
		password: string;
		firstName?: string;
		lastName?: string;
		role?: User["role"];
		bio?: string;
		avatar?: number;
		theme?: "light" | "dark";
		direction?: "ltr" | "rtl";
	};
};

export type UpdateUserArgs = BaseInternalFunctionArgs & {
	userId: number;
	data: {
		firstName?: string;
		lastName?: string;
		role?: User["role"];
		bio?: string;
		avatar?: number | Media;
		_verified?: boolean;
		theme?: "light" | "dark";
		direction?: "ltr" | "rtl";
	};
};

export type FindUserByEmailArgs = BaseInternalFunctionArgs & {
	email: string;
};

export type FindUserByIdArgs = BaseInternalFunctionArgs & {
	userId: number;
};

export type DeleteUserArgs = BaseInternalFunctionArgs & {
	userId: number;
};

export type FindAllUsersArgs = BaseInternalFunctionArgs & {
	limit?: number;
	page?: number;
	sort?: string;
	query?: string;
};

export type LoginArgs = BaseInternalFunctionArgs & {
	email: string;
	password: string;
};

export type RegisterFirstUserArgs = BaseInternalFunctionArgs & {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
};

export type RegisterUserArgs = BaseInternalFunctionArgs & {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	role?: User["role"];
};

export type HandleImpersonationArgs = BaseInternalFunctionArgs & {
	impersonateUserId: string;
	authenticatedUser: BaseInternalFunctionArgs["user"] | null;
};

/**
 * Creates a new user using Payload local API
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryCreateUser = Result.wrap(
	async (args: CreateUserArgs) => {
		const {
			payload,
			data: {
				email,
				password,
				firstName,
				lastName,
				role = "student",
				bio,
				avatar,
				theme,
				direction,
			},
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Check if user already exists
		const existingUsers = await payload.find({
			collection: "users",
			where: {
				email: {
					equals: email,
				},
			},
			limit: 1,
			user,
			req,
			overrideAccess,
		});

		if (existingUsers.docs.length > 0) {
			throw new Error(`User with email ${email} already exists`);
		}

		const newUser = await payload
			.create({
				collection: "users",
				data: {
					email,
					password,
					firstName,
					lastName,
					role,
					bio,
					avatar,
					theme: theme ?? "light",
					direction: direction ?? "ltr",
					// ! TODO: automatically verify the user for now, we need to fix this in the future
					_verified: true,
				},
				user,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "create">());

		return newUser;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create user", {
			cause: error,
		}),
);

/**
 * Updates an existing user using Payload local API
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 * When transactionID is provided, uses that transaction, otherwise creates a new one
 */
export const tryUpdateUser = Result.wrap(
	async (args: UpdateUserArgs) => {
		const {
			payload,
			userId,
			data,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		const updatedUser = await payload
			.update({
				collection: "users",
				id: userId,
				data,
				user,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "update">());

		return updatedUser;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update user", {
			cause: error,
		}),
);

/**
 * Finds a user by email
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindUserByEmail = Result.wrap(
	async (args: FindUserByEmailArgs) => {
		const { payload, email, user = null, req, overrideAccess = false } = args;

		const foundUser = await payload
			.find({
				collection: "users",
				where: {
					email: {
						equals: email,
					},
				},
				limit: 1,
				user,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "find">())
			.then((users) => {
				if (users.docs.length === 0) {
					return null;
				}
				return users.docs[0];
			});

		return foundUser;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find user by email", {
			cause: error,
		}),
);

/**
 * Finds a user by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindUserById = Result.wrap(
	async (args: FindUserByIdArgs) => {
		const { payload, userId, user = null, req, overrideAccess = false } = args;

		const foundUser = await payload
			.findByID({
				collection: "users",
				id: userId,
				user,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "findByID">());

		return foundUser;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find user by ID", {
			cause: error,
		}),
);

/**
 * Deletes a user by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryDeleteUser = Result.wrap(
	async (args: DeleteUserArgs) => {
		const { payload, userId, user = null, req, overrideAccess = false } = args;

		const deletedUser = await payload
			.delete({
				collection: "users",
				id: userId,
				user,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "delete">());

		return deletedUser;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete user", {
			cause: error,
		}),
);

/**
 * Finds all users with pagination
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindAllUsers = Result.wrap(
	async (args: FindAllUsersArgs) => {
		const {
			payload,
			limit = 100,
			page = 1,
			sort = "-createdAt",
			query,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Parse search query
		const where: Where = {};
		if (query) {
			const parsed = searchQueryParser.parse(query, {
				keywords: ["role"],
			});

			const searchText = typeof parsed === "string" ? parsed : parsed.text;
			const roleFilter = typeof parsed === "object" ? parsed.role : undefined;

			const orConditions = [];

			// Text search across firstName, lastName, and email
			if (searchText) {
				const textArray = Array.isArray(searchText) ? searchText : [searchText];
				for (const text of textArray) {
					if (text) {
						orConditions.push(
							{
								firstName: {
									contains: text,
								},
							},
							{
								lastName: {
									contains: text,
								},
							},
							{
								email: {
									contains: text,
								},
							},
						);
					}
				}
			}

			if (orConditions.length > 0) {
				where.or = orConditions;
			}

			// Role filter
			if (roleFilter) {
				const roles = Array.isArray(roleFilter) ? roleFilter : [roleFilter];
				where.role = {
					in: roles as User["role"][],
				};
			}
		}

		const usersResult = await payload
			.find({
				collection: "users",
				where,
				limit,
				page,
				sort,
				depth: 1,
				user,
				req,
				overrideAccess,
			})
			.then(stripDepth<1, "find">());

		return {
			docs: usersResult.docs,
			totalDocs: usersResult.totalDocs,
			limit: usersResult.limit || limit,
			totalPages: usersResult.totalPages || 0,
			page: usersResult.page || page,
			pagingCounter: usersResult.pagingCounter || 0,
			hasPrevPage: usersResult.hasPrevPage || false,
			hasNextPage: usersResult.hasNextPage || false,
			prevPage: usersResult.prevPage || null,
			nextPage: usersResult.nextPage || null,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find all users", {
			cause: error,
		}),
);

/**
 * Logs in a user and returns authentication token and user data
 * Validates credentials and returns token with expiration
 */
export const tryLogin = Result.wrap(
	async (args: LoginArgs) => {
		const { payload, email, password, req } = args;

		const loginResult = await payload.login({
			collection: "users",
			req,
			data: {
				email,
				password,
			},
		});

		const { exp, token, user } = loginResult;

		if (!exp || !token) {
			throw new Error("Login failed: missing token or expiration");
		}

		return {
			token,
			exp,
			user,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to login", {
			cause: error,
		}),
);

/**
 * Registers the first user in the system
 * Creates an admin user, verifies them, and logs them in
 * Uses transactions to ensure all operations succeed or fail together
 * First user is always created as an admin
 */
export const tryRegisterFirstUser = Result.wrap(
	async (args: RegisterFirstUserArgs) => {
		const { payload, email, password, firstName, lastName, req } = args;

		// Check if users already exist
		const existingUsers = await payload.find({
			collection: "users",
			limit: 1,
			// ! we are using overrideAccess here because it is always a system request, we don't care about access control
			overrideAccess: true,
		});

		if (existingUsers.docs.length > 0) {
			throw new Error("Users already exist in the system");
		}

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Create the first user as admin
			const newUser = await payload
				.create({
					collection: "users",
					data: {
						email,
						password,
						firstName,
						lastName,
						role: "admin",
						theme: "light",
						direction: "ltr",
					},
					// ! we are using overrideAccess here because it is always a system request, we don't care about access control
					overrideAccess: true,
					req: reqWithTransaction,
				})
				.then(stripDepth<0, "create">());

			// Auto-verify the first user
			await payload.update({
				collection: "users",
				id: newUser.id,
				data: {
					_verified: true,
				},
				// ! we are using overrideAccess here because it is always a system request, we don't care about access control
				overrideAccess: true,
				req: reqWithTransaction,
			});

			// Log in the new user (outside transaction)
			const loginResult = await payload.login({
				collection: "users",
				req: reqWithTransaction,
				data: {
					email,
					password,
				},
				// ! this has override access because it is a system request, we don't care about access control
				overrideAccess: true,
			});

			const { exp, token, user } = loginResult;

			if (!exp || !token) {
				throw new Error("Login failed: missing token or expiration");
			}

			return {
				token,
				exp,
				user,
			};
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to register first user", {
			cause: error,
		}),
);

/**
 * Registers a regular user (non-admin) and logs them in
 * Uses transactions to ensure all operations succeed or fail together
 */
export const tryRegisterUser = Result.wrap(
	async (args: RegisterUserArgs) => {
		const {
			payload,
			email,
			password,
			firstName,
			lastName,
			role = "student",
			req,
			user = null,
		} = args;

		// Ensure not already exists
		const existing = await payload.find({
			collection: "users",
			where: { email: { equals: email } },
			limit: 1,
			user,
			req,
			// ! this has override access because it is a system request, we don't care about access control
			overrideAccess: true,
		});
		if (existing.docs.length > 0) {
			throw new Error(`User with email ${email} already exists`);
		}

		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Create the user within transaction
			await payload.create({
				collection: "users",
				data: {
					email,
					password,
					firstName,
					lastName,
					role: role ?? "student",
					theme: "light",
					direction: "ltr",
					// ! TODO: automatically verify the user for now, we need to fix this in the future
					_verified: true,
				},
				user,
				req: reqWithTransaction,
				// ! this has override access because it is a system request, we don't care about access control
				overrideAccess: true,
			});

			// Login new user (outside transaction)
			const loginResult = await payload.login({
				collection: "users",
				req,
				data: { email, password },
				// ! this has override access because it is a system request, we don't care about access control
				overrideAccess: true,
			});

			const { exp, token, user: loggedInUser } = loginResult;
			if (!exp || !token) {
				throw new Error("Login failed: missing token or expiration");
			}

			return { token, exp, user: loggedInUser };
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to register user", { cause: error }),
);

/**
 * Handles impersonation logic for admin users
 * Validates the target user and returns their data with permissions
 * Returns null if impersonation is not allowed or fails
 */
export const tryHandleImpersonation = Result.wrap(
	async (args: HandleImpersonationArgs) => {
		const {
			payload,
			impersonateUserId,
			authenticatedUser,
			req,
			overrideAccess = false,
		} = args;

		const targetUserId = Number(impersonateUserId);

		if (Number.isNaN(targetUserId)) {
			return null;
		}

		// Fetch the target user
		const targetUserResult = await tryFindUserById({
			payload,
			userId: targetUserId,
			user: authenticatedUser,
			overrideAccess,
			req,
		});

		if (!targetUserResult.ok || !targetUserResult.value) {
			return null;
		}

		const targetUser = targetUserResult.value;

		// Only allow impersonating non-admin users
		if (targetUser.role === "admin") {
			return null;
		}

		// Get permissions for the target user
		const accessResults = await getAccessResults({
			req: { user: targetUser, payload } as PayloadRequest,
		});

		const permissions = Object.keys(accessResults).filter(
			(key) => accessResults[key as keyof typeof accessResults],
		);

		return { targetUser, permissions };
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to handle impersonation", {
			cause: error,
		}),
);
