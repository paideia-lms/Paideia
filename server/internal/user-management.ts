import type { Payload } from "payload";
import { Result } from "typescript-result";
import type { User } from "../payload-types";

export interface CreateUserArgs {
	email: string;
	password: string;
	firstName?: string;
	lastName?: string;
	role?: User["role"];
	bio?: string;
	avatar?: number;
}

export interface UpdateUserArgs {
	firstName?: string;
	lastName?: string;
	role?: User["role"];
	bio?: string;
	avatar?: number;
	_verified?: boolean;
}

/**
 * Creates a new user using Payload local API
 */
export const tryCreateUser = Result.wrap(
	async (payload: Payload, request: Request, args: CreateUserArgs) => {
		const {
			email,
			password,
			firstName,
			lastName,
			role = "user",
			bio,
			avatar,
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
			req: request,
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
			req: request,
		});

		return newUser as User;
	},
	(error) =>
		new Error(
			`Failed to create user: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Updates an existing user using Payload local API
 */
export const tryUpdateUser = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		userId: number,
		args: UpdateUserArgs,
	) => {
		// Check if user exists
		const existingUser = await payload.findByID({
			collection: "users",
			id: userId,
			req: request,
		});

		if (!existingUser) {
			throw new Error(`User with ID ${userId} not found`);
		}

		const updatedUser = await payload.update({
			collection: "users",
			id: userId,
			data: args,
			req: request,
		});

		return updatedUser;
	},
	(error) =>
		new Error(
			`Failed to update user: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a user by email
 */
export const tryFindUserByEmail = Result.wrap(
	async (payload: Payload, email: string) => {
		const users = await payload.find({
			collection: "users",
			where: {
				email: {
					equals: email,
				},
			},
			limit: 1,
		});

		return users.docs.length > 0 ? (users.docs[0] as User) : null;
	},
	(error) =>
		new Error(
			`Failed to find user by email: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a user by ID
 */
export const tryFindUserById = Result.wrap(
	async (payload: Payload, userId: number) => {
		const user = await payload.findByID({
			collection: "users",
			id: userId,
		});

		if (!user) {
			throw new Error(`User with ID ${userId} not found`);
		}

		return user as User;
	},
	(error) =>
		new Error(
			`Failed to find user by ID: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Deletes a user by ID
 */
export const tryDeleteUser = Result.wrap(
	async (payload: Payload, request: Request, userId: number) => {
		const deletedUser = await payload.delete({
			collection: "users",
			id: userId,
			req: request,
		});

		return deletedUser as User;
	},
	(error) =>
		new Error(
			`Failed to delete user: ${error instanceof Error ? error.message : String(error)}`,
		),
);
