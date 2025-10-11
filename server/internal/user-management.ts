import type { Payload, PayloadRequest, TypedUser, Where } from "payload";
import searchQueryParser from "search-query-parser";
import { assertZod } from "server/utils/type-narrowing";
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
	};
	user?: TypedUser | null;
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
	};
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
	transactionID?: string | number;
}

export interface FindUserByEmailArgs {
	payload: Payload;
	email: string;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface FindUserByIdArgs {
	payload: Payload;
	userId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface DeleteUserArgs {
	payload: Payload;
	userId: number;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface FindAllUsersArgs {
	payload: Payload;
	limit?: number;
	page?: number;
	sort?: string;
	query?: string;
	user?: TypedUser | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface FindAllUsersResult {
	docs: User[];
	totalDocs: number;
	limit: number;
	totalPages: number;
	page: number;
	pagingCounter: number;
	hasPrevPage: boolean;
	hasNextPage: boolean;
	prevPage: number | null;
	nextPage: number | null;
}

export interface LoginArgs {
	payload: Payload;
	email: string;
	password: string;
	req?: Partial<PayloadRequest>;
}

export interface LoginResult {
	token: string;
	exp: number;
	user: User;
}

export interface RegisterFirstUserArgs {
	payload: Payload;
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	req?: Partial<PayloadRequest>;
}

export interface RegisterFirstUserResult {
	token: string;
	exp: number;
	user: User;
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
			overrideAccess: true, // Always allow checking if user exists
		});

		if (existingUsers.docs.length > 0) {
			throw new Error(`User with email ${email} already exists`);
		}

		const newUser = await payload.create({
			collection: "users",
			data: {
				email,
				password,
				firstName,
				lastName,
				role,
				bio,
				avatar,
			},
			user,
			req,
			overrideAccess,
		});

		return newUser as User;
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

		const updatedUser = await payload.update({
			collection: "users",
			id: userId,
			data,
			user,
			req: transactionID ? { transactionID, ...req } : req,
			overrideAccess,
		});

		return updatedUser as User;
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

		const users = await payload.find({
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

		return users.docs.length > 0 ? (users.docs[0] as User) : null;
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

		const foundUser = await payload.findByID({
			collection: "users",
			id: userId,
			user,
			req,
			overrideAccess,
		});

		if (!foundUser) {
			throw new Error(`User with ID ${userId} not found`);
		}

		return foundUser as User;
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

		const deletedUser = await payload.delete({
			collection: "users",
			id: userId,
			user,
			req,
			overrideAccess,
		});

		return deletedUser as User;
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
	async (args: FindAllUsersArgs): Promise<FindAllUsersResult> => {
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
					assertZod(avatar, z.object({ id: z.number() }).nullable());
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
	async (args: LoginArgs): Promise<LoginResult> => {
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
			user: user as User,
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
	async (args: RegisterFirstUserArgs): Promise<RegisterFirstUserResult> => {
		const { payload, email, password, firstName, lastName, req } = args;

		// Check if users already exist
		const existingUsers = await payload.find({
			collection: "users",
			limit: 1,
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
				},
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
				overrideAccess: true,
				req: transactionID ? { transactionID, ...req } : req,
			});

			// Commit the transaction if it exists
			if (transactionID) {
				await payload.db.commitTransaction(transactionID);
			}

			// Log in the new user (outside transaction)
			const loginResult = await payload.login({
				collection: "users",
				req,
				data: {
					email,
					password,
				},
			});

			const { exp, token } = loginResult;

			if (!exp || !token) {
				throw new Error("Login failed: missing token or expiration");
			}

			return {
				token,
				exp,
				user: newUser as User,
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
