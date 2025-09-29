import type { Payload } from "payload";
import sanitizedConfig from "../payload.config";

/**
 * Checks if the database has any users
 * @returns Promise<boolean> - true if no users exist (first user needed), false if users exist
 */
export async function checkFirstUser(payload: Payload): Promise<boolean> {
	try {
		const users = await payload.find({
			collection: "users",
			limit: 1,
		});

		return users.docs.length === 0;
	} catch (error) {
		console.error("Error checking for first user:", error);
		throw new Error("Failed to check if first user exists");
	}
}

/**
 * Gets the total count of users in the database
 * @returns Promise<number> - number of users in the database
 */
export async function getUserCount(payload: Payload): Promise<number> {
	try {
		const users = await payload.find({
			collection: "users",
		});

		return users.docs.length;
	} catch (error) {
		console.error("Error getting user count:", error);
		throw new Error("Failed to get user count");
	}
}

/**
 * Validates if the database is in a state where first user creation is needed
 * This is more comprehensive than just checking user count - it also validates
 * the database connection and payload configuration
 * @returns Promise<{ needsFirstUser: boolean; userCount: number; isValid: boolean }>
 */
export async function validateFirstUserState(payload: Payload): Promise<{
	needsFirstUser: boolean;
	userCount: number;
	isValid: boolean;
}> {
	try {
		if (!payload.db.connect)
			throw new Error("Database connection not established");

		// Test database connection
		await payload.db.connect();

		const users = await payload.find({
			collection: "users",
		});

		const userCount = users.docs.length;
		const needsFirstUser = userCount === 0;

		return {
			needsFirstUser,
			userCount,
			isValid: true,
		};
	} catch (error) {
		console.error("Error validating first user state:", error);
		return {
			needsFirstUser: true, // Assume we need first user if we can't check
			userCount: 0,
			isValid: false,
		};
	}
}
