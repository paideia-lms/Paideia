import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { executeAuthStrategies, getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CheckFirstUserArgs,
	type GetUserCountArgs,
	tryCheckFirstUser,
	tryGetUserCount,
	tryValidateFirstUserState,
	type ValidateFirstUserStateArgs,
} from "./check-first-user";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("First User Check Functions - With overrideAccess", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			// Run fresh migration to ensure clean database state
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});
	});

	afterAll(async () => {
		// Clean up any test data if needed
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCheckFirstUser", () => {
		test("should return true when no users exist", async () => {
			// First, ensure no users exist by clearing the collection
			await payload.delete({
				collection: "users",
				where: {},
				overrideAccess: true,
			});

			const args: CheckFirstUserArgs = {
				payload,
				overrideAccess: true,
			};

			const result = await tryCheckFirstUser(args);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(true);
			}
		});

		test("should return false when users exist", async () => {
			// Create a test user
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "test@example.com",
					password: "testpassword123",
					firstName: "Test",
					lastName: "User",
					role: "admin",
				},
				overrideAccess: true,
			};

			await tryCreateUser(userArgs);

			const args: CheckFirstUserArgs = {
				payload,
				overrideAccess: true,
			};

			const result = await tryCheckFirstUser(args);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(false);
			}
		});
	});

	describe("tryGetUserCount", () => {
		test("should return correct user count", async () => {
			const args: GetUserCountArgs = {
				payload,
				overrideAccess: true,
			};

			const result = await tryGetUserCount(args);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(typeof result.value).toBe("number");
				expect(result.value).toBeGreaterThanOrEqual(0);
			}
		});

		test("should return 0 when no users exist", async () => {
			// Clear all users first
			await payload.delete({
				collection: "users",
				where: {},
				overrideAccess: true,
			});

			const args: GetUserCountArgs = {
				payload,
				overrideAccess: true,
			};

			const result = await tryGetUserCount(args);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(0);
			}
		});
	});

	describe("tryValidateFirstUserState", () => {
		test("should return valid state with correct structure", async () => {
			const args: ValidateFirstUserStateArgs = {
				payload,
				overrideAccess: true,
			};

			const result = await tryValidateFirstUserState(args);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveProperty("needsFirstUser");
				expect(result.value).toHaveProperty("userCount");
				expect(result.value).toHaveProperty("isValid");
				expect(typeof result.value.needsFirstUser).toBe("boolean");
				expect(typeof result.value.userCount).toBe("number");
				expect(typeof result.value.isValid).toBe("boolean");
			}
		});

		test("should return isValid=true when database is accessible", async () => {
			const args: ValidateFirstUserStateArgs = {
				payload,
				overrideAccess: true,
			};

			const result = await tryValidateFirstUserState(args);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.isValid).toBe(true);
			}
		});

		test("should return userCount matching actual database state", async () => {
			// Clear users
			await payload.delete({
				collection: "users",
				where: {},
				overrideAccess: true,
			});

			const args1: ValidateFirstUserStateArgs = {
				payload,
				overrideAccess: true,
			};

			const result = await tryValidateFirstUserState(args1);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.userCount).toBe(0);
			}

			// Add a user
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "test@example.com",
					password: "testpassword123",
					firstName: "Test",
					lastName: "User",
					role: "admin",
				},
				overrideAccess: true,
			};

			await tryCreateUser(userArgs);

			const args2: ValidateFirstUserStateArgs = {
				payload,
				overrideAccess: true,
			};

			const resultAfterCreate = await tryValidateFirstUserState(args2);

			expect(resultAfterCreate.ok).toBe(true);
			if (resultAfterCreate.ok) {
				expect(resultAfterCreate.value.userCount).toBe(1);
			}
		});
	});

	describe("Integration Tests", () => {
		test("tryCheckFirstUser and tryGetUserCount should be consistent", async () => {
			const checkArgs: CheckFirstUserArgs = {
				payload,
				overrideAccess: true,
			};

			const countArgs: GetUserCountArgs = {
				payload,
				overrideAccess: true,
			};

			const needsFirstUserResult = await tryCheckFirstUser(checkArgs);
			const userCountResult = await tryGetUserCount(countArgs);

			expect(needsFirstUserResult.ok).toBe(true);
			expect(userCountResult.ok).toBe(true);

			if (needsFirstUserResult.ok && userCountResult.ok) {
				if (needsFirstUserResult.value) {
					expect(userCountResult.value).toBe(0);
				} else {
					expect(userCountResult.value).toBeGreaterThan(0);
				}
			}
		});

		test("tryValidateFirstUserState should match individual function results", async () => {
			const validateArgs: ValidateFirstUserStateArgs = {
				payload,
				overrideAccess: true,
			};

			const checkArgs: CheckFirstUserArgs = {
				payload,
				overrideAccess: true,
			};

			const countArgs: GetUserCountArgs = {
				payload,
				overrideAccess: true,
			};

			const validationState = await tryValidateFirstUserState(validateArgs);
			const needsFirstUser = await tryCheckFirstUser(checkArgs);
			const userCount = await tryGetUserCount(countArgs);

			expect(validationState.ok).toBe(true);
			expect(needsFirstUser.ok).toBe(true);
			expect(userCount.ok).toBe(true);

			if (validationState.ok && needsFirstUser.ok && userCount.ok) {
				expect(validationState.value.needsFirstUser).toBe(needsFirstUser.value);
				expect(validationState.value.userCount).toBe(userCount.value);
			}
		});
	});
});

describe("First User Check Functions - With Access Control", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let adminToken: string;
	let userToken: string;

	// Helper to get authenticated user from token
	const getAuthUser = async (token: string): Promise<TypedUser | null> => {
		const authResult = await executeAuthStrategies({
			headers: new Headers({
				Authorization: `Bearer ${token}`,
			}),
			canSetHeaders: true,
			payload,
		});
		return authResult.user;
	};

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		// Create admin user
		const adminArgs: CreateUserArgs = {
			payload,
			data: {
				email: "admin@example.com",
				password: "adminpassword123",
				firstName: "Admin",
				lastName: "User",
				role: "admin",
			},
			overrideAccess: true,
		};

		const adminResult = await tryCreateUser(adminArgs);
		if (!adminResult.ok) {
			throw new Error("Failed to create admin user");
		}

		// Verify admin
		await payload.update({
			collection: "users",
			id: adminResult.value.id,
			data: {
				_verified: true,
			},
			overrideAccess: true,
		});

		// Create regular user
		const userArgs: CreateUserArgs = {
			payload,
			data: {
				email: "user@example.com",
				password: "userpassword123",
				firstName: "Regular",
				lastName: "User",
				role: "student",
			},
			overrideAccess: true,
		};

		const userResult = await tryCreateUser(userArgs);
		if (!userResult.ok) {
			throw new Error("Failed to create regular user");
		}

		// Verify regular user
		await payload.update({
			collection: "users",
			id: userResult.value.id,
			data: {
				_verified: true,
			},
			overrideAccess: true,
		});

		// Login to get tokens
		const adminLogin = await payload.login({
			collection: "users",
			data: {
				email: "admin@example.com",
				password: "adminpassword123",
			},
		});

		const userLogin = await payload.login({
			collection: "users",
			data: {
				email: "user@example.com",
				password: "userpassword123",
			},
		});

		if (!adminLogin.token || !userLogin.token) {
			throw new Error("Failed to get authentication tokens");
		}

		adminToken = adminLogin.token;
		userToken = userLogin.token;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("Access Control - tryCheckFirstUser", () => {
		test("admin should be able to check first user", async () => {
			const adminUser = await getAuthUser(adminToken);

			const args: CheckFirstUserArgs = {
				payload,
				req: { user: adminUser },
				overrideAccess: false,
			};

			const result = await tryCheckFirstUser(args);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// We have users, so this should be false
				expect(result.value).toBe(false);
			}
		});

		test("regular user should be able to check first user", async () => {
			const regularUser = await getAuthUser(userToken);

			const args: CheckFirstUserArgs = {
				payload,
				req: { user: regularUser },
				overrideAccess: false,
			};

			const result = await tryCheckFirstUser(args);

			// Based on access control, everyone can read users
			expect(result.ok).toBe(true);
		});

		test("unauthenticated request should fail", async () => {
			const args: CheckFirstUserArgs = {
				payload,
				overrideAccess: false,
			};

			const result = await tryCheckFirstUser(args);

			expect(result.ok).toBe(false);
		});
	});

	describe("Access Control - tryGetUserCount", () => {
		test("admin should be able to get user count", async () => {
			const adminUser = await getAuthUser(adminToken);

			const args: GetUserCountArgs = {
				payload,
				req: { user: adminUser },
				overrideAccess: false,
			};

			const result = await tryGetUserCount(args);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeGreaterThan(0);
			}
		});

		test("regular user should be able to get user count", async () => {
			const regularUser = await getAuthUser(userToken);

			const args: GetUserCountArgs = {
				payload,
				req: { user: regularUser },
				overrideAccess: false,
			};

			const result = await tryGetUserCount(args);

			// Based on access control, everyone can read users
			expect(result.ok).toBe(true);
		});

		test("unauthenticated request should fail", async () => {
			const args: GetUserCountArgs = {
				payload,
				overrideAccess: false,
			};

			const result = await tryGetUserCount(args);

			expect(result.ok).toBe(false);
		});
	});

	describe("Access Control - tryValidateFirstUserState", () => {
		test("admin should be able to validate first user state", async () => {
			const adminUser = await getAuthUser(adminToken);

			const args: ValidateFirstUserStateArgs = {
				payload,
				req: { user: adminUser },
				overrideAccess: false,
			};

			const result = await tryValidateFirstUserState(args);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.isValid).toBe(true);
				expect(result.value.userCount).toBeGreaterThan(0);
				expect(result.value.needsFirstUser).toBe(false);
			}
		});

		test("regular user should be able to validate first user state", async () => {
			const regularUser = await getAuthUser(userToken);

			const args: ValidateFirstUserStateArgs = {
				payload,
				req: { user: regularUser },
				overrideAccess: false,
			};

			const result = await tryValidateFirstUserState(args);

			// Based on access control, everyone can read users
			expect(result.ok).toBe(true);
		});

		test("unauthenticated request should fail", async () => {
			const args: ValidateFirstUserStateArgs = {
				payload,
				overrideAccess: false,
			};

			const result = await tryValidateFirstUserState(args);

			expect(result.ok).toBe(false);
		});
	});
});
