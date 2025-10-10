import type { Payload, TypedUser } from "payload";
import { Result } from "typescript-result";
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
	req?: Request;
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
	req?: Request;
	overrideAccess?: boolean;
	transactionID?: string | number;
}

export interface FindUserByEmailArgs {
	payload: Payload;
	email: string;
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface FindUserByIdArgs {
	payload: Payload;
	userId: number;
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface DeleteUserArgs {
	payload: Payload;
	userId: number;
	user?: TypedUser | null;
	req?: Request;
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
				role = "user",
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
