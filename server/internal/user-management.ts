import type { Payload, PayloadRequest, Where } from "payload";
import { getAccessResults } from "payload";
import searchQueryParser from "search-query-parser";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import { transformError, UnknownError } from "~/utils/error";
import type { Media, User } from "../payload-types";

export interface CreateUserArgs {
	payload: Payload;
	data: {
		email: string;
		password: string;
		firstName?: string;
		lastName?: string;
		role?: User["role"];
		bio?: string;
		avatar?: number;
		theme?: "light" | "dark";
	};
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdateUserArgs {
	payload: Payload;
	userId: number;
	data: {
		firstName?: string;
		lastName?: string;
		role?: User["role"];
		bio?: string;
		avatar?: number | Media;
		_verified?: boolean;
		theme?: "light" | "dark";
	};
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	transactionID?: string | number;
}

export interface FindUserByEmailArgs {
	payload: Payload;
	email: string;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface FindUserByIdArgs {
	payload: Payload;
	userId: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface DeleteUserArgs {
	payload: Payload;
	userId: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface FindAllUsersArgs {
	payload: Payload;
	limit?: number;
	page?: number;
	sort?: string;
	query?: string;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface LoginArgs {
	payload: Payload;
	email: string;
	password: string;
	req?: Partial<PayloadRequest>;
}

export interface RegisterFirstUserArgs {
	payload: Payload;
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	req?: Partial<PayloadRequest>;
}

export interface RegisterUserArgs {
	payload: Payload;
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	req?: Partial<PayloadRequest>;
	user?: User | null;
}

export interface HandleImpersonationArgs {
	payload: Payload;
	impersonateUserId: string;
	authenticatedUser: User;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

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
				},
				user,
				req,
				overrideAccess,
			})
			.then((u) => {
				const avatar = u.avatar;
				assertZodInternal(
					"tryCreateUser: User avatar is required",
					avatar,
					z.object({ id: z.number() }).nullish(),
				);
				return {
					...u,
					avatar,
				};
			});

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
			transactionID,
		} = args;

		const updatedUser = await payload
			.update({
				collection: "users",
				id: userId,
				data,
				user,
				req: transactionID ? { transactionID, ...req } : req,
				overrideAccess,
			})
			.then((u) => {
				const avatar = u.avatar;
				assertZodInternal(
					"tryFindUserByEmail: User avatar is required",
					avatar,
					z.object({ id: z.number() }).nullish(),
				);
				return {
					...u,
					avatar,
				};
			});

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
			.then((users) => {
				if (users.docs.length === 0) {
					return null;
				}
				const user = users.docs[0];
				const avatar = user.avatar;
				assertZodInternal(
					"tryFindUserByEmail: User avatar is required",
					avatar,
					z.object({ id: z.number() }).nullish(),
				);
				return {
					...user,
					avatar,
				};
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
			.then((u) => {
				const avatar = u.avatar;
				assertZodInternal(
					"tryFindUserById: User avatar is required",
					avatar,
					z.object({ id: z.number() }).nullish(),
				);
				return {
					...u,
					avatar,
				};
			});

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
			.then((u) => {
				const avatar = u.avatar;
				assertZodInternal(
					"tryDeleteUser: User avatar is required",
					avatar,
					z.object({ id: z.number() }).nullish(),
				);
				return {
					...u,
					avatar,
				};
			});

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
			.then((result) => {
				const docs = result.docs.map((doc) => {
					const avatar = doc.avatar;
					// type narrowing - avatar can be null
					assertZodInternal(
						"tryFindAllUsers: User avatar is required",
						avatar,
						z.object({ id: z.number() }).nullish(),
					);
					return {
						...doc,
						avatar: avatar,
					};
				});
				return {
					...result,
					docs,
				};
			});

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

		const loginResult = await payload
			.login({
				collection: "users",
				req,
				data: {
					email,
					password,
				},
			})
			.then((l) => {
				const user = l.user;
				const avatar = user.avatar;
				assertZodInternal(
					"tryLogin: User avatar is required",
					avatar,
					z.object({ id: z.number() }).nullish(),
				);
				return {
					...l,
					user: { ...user, avatar },
				};
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

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

		try {
			// Create the first user as admin
			const newUser = await payload.create({
				collection: "users",
				data: {
					email,
					password,
					firstName,
					lastName,
					role: "admin",
					theme: "light",
				},
				// ! we are using overrideAccess here because it is always a system request, we don't care about access control
				overrideAccess: true,
				req: transactionID ? { transactionID, ...req } : req,
			});

			// Auto-verify the first user
			await payload.update({
				collection: "users",
				id: newUser.id,
				data: {
					_verified: true,
				},
				// ! we are using overrideAccess here because it is always a system request, we don't care about access control
				overrideAccess: true,
				req: transactionID ? { transactionID, ...req } : req,
			});

			// Commit the transaction if it exists
			if (transactionID) {
				await payload.db.commitTransaction(transactionID);
			}

			// Log in the new user (outside transaction)
			const loginResult = await payload
				.login({
					collection: "users",
					req,
					data: {
						email,
						password,
					},
				})
				.then((l) => {
					const user = l.user;
					const avatar = user.avatar;
					assertZodInternal(
						"tryRegisterFirstUser: User avatar is required",
						avatar,
						z.object({ id: z.number() }).nullish(),
					);
					return {
						...l,
						user: { ...user, avatar },
					};
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
		} catch (error) {
			// Rollback transaction on error if it exists
			if (transactionID) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to register first user", {
			cause: error,
		}),
);

/**
 * Registers a regular user (non-admin) and logs them in
 */
export const tryRegisterUser = Result.wrap(
	async (args: RegisterUserArgs) => {
		const {
			payload,
			email,
			password,
			firstName,
			lastName,
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
			overrideAccess: false,
		});
		if (existing.docs.length > 0) {
			throw new Error(`User with email ${email} already exists`);
		}

		await payload.create({
			collection: "users",
			data: {
				email,
				password,
				firstName,
				lastName,
				role: "student",
				theme: "light",
			},
			user,
			req,
			overrideAccess: false,
		});

		// Login new user
		const loginResult = await payload
			.login({
				collection: "users",
				req,
				data: { email, password },
			})
			.then((l) => {
				const user = l.user;
				const avatar = user.avatar;
				assertZodInternal(
					"tryRegisterUser: User avatar is required",
					avatar,
					z.object({ id: z.number() }).nullish(),
				);
				return { ...l, user: { ...user, avatar } };
			});

		const { exp, token, user: loggedInUser } = loginResult;
		if (!exp || !token) {
			throw new Error("Login failed: missing token or expiration");
		}

		return { token, exp, user: loggedInUser };
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
