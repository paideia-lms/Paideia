import type { Where } from "payload";
import searchQueryParser from "search-query-parser";
import { Result } from "typescript-result";
import { transformError, UnknownError } from "~/utils/error";
import type { User } from "../payload-types";
import { handleTransactionId } from "./utils/handle-transaction-id";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";
import { stripDepth } from "./utils/internal-function-utils";
import { tryCreateMedia } from "./media-management";

export interface CreateUserArgs extends BaseInternalFunctionArgs {
	data: {
		email: string;
		password: string;
		firstName?: string;
		lastName?: string;
		role?: User["role"];
		bio?: string;
		avatar?: File | null;
		theme?: "light" | "dark";
		direction?: "ltr" | "rtl";
	};
}

export interface UpdateUserArgs extends BaseInternalFunctionArgs {
	userId: number;
	data: {
		firstName?: string;
		lastName?: string;
		role?: User["role"];
		bio?: string;
		avatar?: File | null;
		_verified?: boolean;
		theme?: "light" | "dark";
		direction?: "ltr" | "rtl";
	};
}

export interface FindUserByEmailArgs extends BaseInternalFunctionArgs {
	email: string;
}

export interface FindUserByIdArgs extends BaseInternalFunctionArgs {
	userId: number;
}

export interface DeleteUserArgs extends BaseInternalFunctionArgs {
	userId: number;
}

export interface FindAllUsersArgs extends BaseInternalFunctionArgs {
	limit?: number;
	page?: number;
	sort?: string;
	query?: string;
}

export interface LoginArgs extends BaseInternalFunctionArgs {
	email: string;
	password: string;
}

export interface RegisterFirstUserArgs extends BaseInternalFunctionArgs {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
}

export interface RegisterUserArgs extends BaseInternalFunctionArgs {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	role?: User["role"];
}

export interface HandleImpersonationArgs extends BaseInternalFunctionArgs {
	impersonateUserId: string;
}

/**
 * Creates a new user using Payload local API
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryCreateUser(args: CreateUserArgs) {
	return Result.try(
		async () => {
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

				req,
				overrideAccess = false,
			} = args;

			// Check if user already exists
			const existingUsers = await payload
				.find({
					collection: "users",
					where: {
						email: {
							equals: email,
						},
					},
					limit: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			if (existingUsers.docs.length > 0) {
				throw new Error(`User with email ${email} already exists`);
			}

			const transactionInfo = await handleTransactionId(payload, req);
			const newUser = transactionInfo.tx(async ({ reqWithTransaction }) => {
				let user = await payload
					.create({
						collection: "users",
						data: {
							email,
							password,
							firstName,
							lastName,
							role,
							bio,
							theme: theme ?? "light",
							direction: direction ?? "ltr",
							// ! TODO: automatically verify the user for now, we need to fix this in the future
							_verified: true,
						},
						req: reqWithTransaction,
						depth: 0,
						overrideAccess,
					})
					.then(stripDepth<0, "create">());

				if (avatar) {
					const mediaId = await tryCreateMedia({
						payload,
						file: await avatar.arrayBuffer().then(Buffer.from),
						filename: avatar.name,
						mimeType: avatar.type,
						userId: user.id,
						req: reqWithTransaction,
						overrideAccess,
					})
						.getOrThrow()
						.then((r) => r.media.id);

					user = await payload
						.update({
							collection: "users",
							id: user.id,
							data: {
								avatar: mediaId,
							},
							req: reqWithTransaction,
							depth: 0,
							overrideAccess,
						})
						.then(stripDepth<0, "update">());
				}

				return user;
			});

			return newUser;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create user", {
				cause: error,
			}),
	);
}

/**
 * Updates an existing user using Payload local API
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 * When transactionID is provided, uses that transaction, otherwise creates a new one
 */
export function tryUpdateUser(args: UpdateUserArgs) {
	return Result.try(
		async () => {
			const { payload, userId, data, req, overrideAccess = false } = args;

			const transactionInfo = await handleTransactionId(payload, req);
			return transactionInfo.tx(async ({ reqWithTransaction }) => {
				const updatedUser = await payload
					.update({
						collection: "users",
						id: userId,
						data: {
							...data,
							avatar: data.avatar
								? await tryCreateMedia({
										payload,
										file: await data.avatar.arrayBuffer().then(Buffer.from),
										filename: data.avatar.name,
										mimeType: data.avatar.type,
										alt: "User avatar",
										caption: "User avatar",
										req: reqWithTransaction,
										overrideAccess,
										userId,
									})
										.getOrThrow()
										.then((r) => r.media.id)
								: undefined,
						},
						req: reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<0, "update">());

				return updatedUser;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update user", {
				cause: error,
			}),
	);
}

/**
 * Finds a user by email
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryFindUserByEmail(args: FindUserByEmailArgs) {
	return Result.try(
		async () => {
			const { payload, email, req, overrideAccess = false } = args;

			const foundUser = await payload
				.find({
					collection: "users",
					where: {
						email: {
							equals: email,
						},
					},
					limit: 1,
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
}

/**
 * Finds a user by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryFindUserById(args: FindUserByIdArgs) {
	return Result.try(
		async () => {
			const { payload, userId, req, overrideAccess = false } = args;

			const foundUser = await payload
				.findByID({
					collection: "users",
					id: userId,
					depth: 0,
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
}

/**
 * Deletes a user by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryDeleteUser(args: DeleteUserArgs) {
	return Result.try(
		async () => {
			const { payload, userId, req, overrideAccess = false } = args;

			const deletedUser = await payload
				.delete({
					collection: "users",
					id: userId,
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
}

/**
 * Finds all users with pagination
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryFindAllUsers(args: FindAllUsersArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				limit = 100,
				page = 1,
				sort = "-createdAt",
				query,

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
					const textArray = Array.isArray(searchText)
						? searchText
						: [searchText];
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
}

/**
 * Logs in a user and returns authentication token and user data
 * Validates credentials and returns token with expiration
 */
export function tryLogin(args: LoginArgs) {
	return Result.try(
		async () => {
			const { payload, email, password, req, overrideAccess = false } = args;

			const loginResult = await payload.login({
				collection: "users",
				req,
				data: {
					email,
					password,
				},
				overrideAccess,
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
}

/**
 * Registers the first user in the system
 * Creates an admin user, verifies them, and logs them in
 * Uses transactions to ensure all operations succeed or fail together
 * First user is always created as an admin
 */
export function tryRegisterFirstUser(args: RegisterFirstUserArgs) {
	return Result.try(
		async () => {
			const { payload, email, password, firstName, lastName, req } = args;

			// Check if users already exist
			const existingUsers = await payload.find({
				collection: "users",
				limit: 1,
				// ! we are using overrideAccess here because it is always a system request, we don't care about access control
				overrideAccess: true,
				req,
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
}

/**
 * Registers a regular user (non-admin) and logs them in
 * Uses transactions to ensure all operations succeed or fail together
 */
export function tryRegisterUser(args: RegisterUserArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				email,
				password,
				firstName,
				lastName,
				role = "student",
				req,
			} = args;

			// Ensure not already exists
			const existing = await payload.find({
				collection: "users",
				where: { email: { equals: email } },
				limit: 1,
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
}

/**
 * Handles impersonation logic for admin users
 * Validates the target user and returns their data with permissions
 * Returns null if impersonation is not allowed or fails
 */
export function tryHandleImpersonation(args: HandleImpersonationArgs) {
	return Result.try(
		async () => {
			const { payload, impersonateUserId, req, overrideAccess = false } = args;

			const targetUserId = Number(impersonateUserId);

			if (Number.isNaN(targetUserId)) {
				return null;
			}

			// Fetch the target user
			const targetUser = await tryFindUserById({
				payload,
				userId: targetUserId,
				// this is a system request, we don't care about access control
				overrideAccess: true,
				req,
			}).getOrNull();
			if (targetUser === null) return null;

			// Only allow impersonating non-admin users
			if (targetUser.role === "admin") {
				return null;
			}

			// Get permissions for the target user
			// const accessResults = await getAccessResults({
			// 	req: { user: targetUser, payload } as PayloadRequest,
			// });

			// const permissions = Object.keys(accessResults).filter(
			// 	(key) => accessResults[key as keyof typeof accessResults],
			// );

			return { targetUser };
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to handle impersonation", {
				cause: error,
			}),
	);
}

export interface GetUserCountArgs extends BaseInternalFunctionArgs {}

/**
 * Gets the total count of users in the database
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 * @returns Promise<number> - number of users in the database
 */
export function tryGetUserCount(args: GetUserCountArgs) {
	return Result.try(
		async () => {
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
}
