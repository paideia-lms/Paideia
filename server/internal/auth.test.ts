import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import type { User } from "../payload-types";
import { checkFirstUser } from "./check-first-user";
import { registerFirstUser } from "./register-first-user";

describe("Authentication Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;

	beforeAll(async () => {
		// Refresh environment and database for clean test state
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		// Create mock request object
		mockRequest = new Request("http://localhost:3000/test");
	});

	afterAll(async () => {
		// Clean up test data
		try {
			await payload.delete({
				collection: "users",
				where: {},
			});
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("First User Registration and Authentication Flow", () => {
		test("should check that no users exist initially", async () => {
			const needsFirstUser = await checkFirstUser(payload);
			expect(needsFirstUser).toBe(true);
		});

		test("should create and auto-login first user", async () => {
			const firstUserArgs = {
				email: "admin@example.com",
				password: "password123",
				firstName: "Admin",
				lastName: "User",
			};

			const result = await registerFirstUser(
				payload,
				mockRequest,
				firstUserArgs,
			);

			// Verify user creation
			expect(result.email).toBe(firstUserArgs.email);
			expect(result.firstName).toBe(firstUserArgs.firstName);
			expect(result.lastName).toBe(firstUserArgs.lastName);
			expect(result.role).toBe("admin");
			// expect(result._verified).toBe(true);

			// Verify login tokens
			expect(result.token).toBeDefined();

			if (!result.token) throw new Error("Test error: token is undefined");

			expect(result.exp).toBeDefined();
			expect(result._strategy).toBe("local-jwt");
			expect(result.collection).toBe("users");

			// Verify token is a string
			expect(typeof result.token).toBe("string");
			expect(result.token.length).toBeGreaterThan(0);

			// Verify expiration is a number (Unix timestamp)
			expect(typeof result.exp).toBe("number");
			expect(result.exp).toBeGreaterThan(Date.now() / 1000);
		});

		test("should verify first user check returns false after user creation", async () => {
			const needsFirstUser = await checkFirstUser(payload);
			expect(needsFirstUser).toBe(false);
		});
	});

	describe("Manual Login Flow", () => {
		test("should login with correct credentials", async () => {
			const loginData = {
				email: "admin@example.com",
				password: "password123",
			};

			const loginResult = await payload.login({
				collection: "users",
				req: mockRequest,
				data: loginData,
			});

			// Verify login result
			expect(loginResult.user).toBeDefined();
			expect(loginResult.token).toBeDefined();
			expect(loginResult.exp).toBeDefined();

			// Verify user data
			const user = loginResult.user as User;
			expect(user.email).toBe(loginData.email);
			expect(user.role).toBe("admin");
			expect(user._verified).toBe(true);

			// Verify token properties
			expect(typeof loginResult.token).toBe("string");
			if (!loginResult.token) throw new Error("Test error: token is undefined");
			expect(loginResult.token.length).toBeGreaterThan(0);
			expect(typeof loginResult.exp).toBe("number");
		});

		test("should fail login with incorrect credentials", async () => {
			const invalidLoginData = {
				email: "admin@example.com",
				password: "wrongpassword",
			};

			await expect(
				payload.login({
					collection: "users",
					req: mockRequest,
					data: invalidLoginData,
				}),
			).rejects.toThrow();
		});

		test("should fail login with non-existent user", async () => {
			const nonExistentLoginData = {
				email: "nonexistent@example.com",
				password: "password123",
			};

			await expect(
				payload.login({
					collection: "users",
					req: mockRequest,
					data: nonExistentLoginData,
				}),
			).rejects.toThrow();
		});
	});

	describe("Authentication and Profile Access", () => {
		let authToken: string;
		let userId: number;

		test("should login and get authentication token", async () => {
			const loginData = {
				email: "admin@example.com",
				password: "password123",
			};

			const loginResult = await payload.login({
				collection: "users",
				req: mockRequest,
				data: loginData,
			});

			if (!loginResult.token) throw new Error("Test error: token is undefined");

			authToken = loginResult.token;
			userId = (loginResult.user as User).id;

			expect(authToken).toBeDefined();
			expect(typeof authToken).toBe("string");
			expect(userId).toBeDefined();
			expect(typeof userId).toBe("number");
		});

		test("should authenticate user with token and get profile", async () => {
			// Create authenticated request with token in headers
			const authenticatedRequest = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			// Authenticate using payload.auth
			const authResult = await payload.auth({
				headers: authenticatedRequest.headers,
			});

			// Verify authentication
			expect(authResult.user).toBeDefined();
			expect(authResult.permissions).toBeDefined();

			// Verify user profile
			const user = authResult.user as User;
			expect(user.id).toBe(userId);
			expect(user.email).toBe("admin@example.com");
			expect(user.firstName).toBe("Admin");
			expect(user.lastName).toBe("User");
			expect(user.role).toBe("admin");
			expect(user._verified).toBe(true);
		});

		test("should get user profile by ID when authenticated", async () => {
			// Create authenticated request
			const authenticatedRequest = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			// Find user by ID with authenticated request
			const userProfile = await payload.findByID({
				collection: "users",
				id: userId,
				req: authenticatedRequest,
			});

			// Verify profile data
			expect(userProfile).toBeDefined();
			expect(userProfile.id).toBe(userId);
			expect(userProfile.email).toBe("admin@example.com");
			expect(userProfile.firstName).toBe("Admin");
			expect(userProfile.lastName).toBe("User");
			expect(userProfile.role).toBe("admin");
			expect(userProfile._verified).toBe(true);
		});

		test("should fail authentication with invalid token", async () => {
			const invalidRequest = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: "Bearer invalid_token_here",
				},
			});

			const authResult = await payload.auth({
				headers: invalidRequest.headers,
			});

			// Should not be authenticated
			expect(authResult.user).toBeNull();
		});

		test("should fail authentication with no token", async () => {
			const unauthenticatedRequest = new Request("http://localhost:3000/test");

			const authResult = await payload.auth({
				headers: unauthenticatedRequest.headers,
			});

			// Should not be authenticated
			expect(authResult.user).toBeNull();
		});
	});

	describe("Cookie-based Authentication Simulation", () => {
		let authToken: string;
		let userId: number;

		test("should simulate cookie-based authentication flow", async () => {
			// Step 1: Login to get token
			const loginResult = await payload.login({
				collection: "users",
				req: mockRequest,
				data: {
					email: "admin@example.com",
					password: "password123",
				},
			});

			if (!loginResult.token) throw new Error("Test error: token is undefined");

			authToken = loginResult.token;
			userId = (loginResult.user as User).id;

			// Step 2: Simulate request with cookie (using Authorization header as proxy)
			// In real app, this would be a cookie header like "Cookie: payload-token=..."
			const cookieRequest = new Request("http://localhost:3000/test", {
				headers: {
					// In real implementation, this would be the cookie
					Authorization: `Bearer ${authToken}`,
				},
			});

			// Step 3: Authenticate the request
			const authResult = await payload.auth({
				headers: cookieRequest.headers,
			});

			// Step 4: Verify authentication worked
			expect(authResult.user).toBeDefined();
			const user = authResult.user as User;
			expect(user.id).toBe(userId);
			expect(user.email).toBe("admin@example.com");
			expect(user.role).toBe("admin");

			// Step 5: Access protected resource (user's own profile)
			const profileResult = await payload.findByID({
				collection: "users",
				id: userId,
				req: cookieRequest,
			});

			expect(profileResult).toBeDefined();
			expect(profileResult.id).toBe(userId);
			expect(profileResult.email).toBe("admin@example.com");
		});

		test("should simulate logout by invalidating token access", async () => {
			// In a real logout, the cookie would be cleared
			// Here we simulate an unauthenticated request after logout
			const loggedOutRequest = new Request("http://localhost:3000/test");

			const authResult = await payload.auth({
				headers: loggedOutRequest.headers,
			});

			// Should not be authenticated after logout
			expect(authResult.user).toBeNull();
		});
	});

	describe("Multiple User Authentication", () => {
		test("should create a second user and test separate authentication", async () => {
			// Create second user
			const secondUser = await payload.create({
				collection: "users",
				data: {
					email: "user2@example.com",
					password: "password456",
					firstName: "Second",
					lastName: "User",
					role: "instructor",
					_verified: true,
				},
				req: mockRequest,
			});

			expect(secondUser).toBeDefined();
			expect(secondUser.email).toBe("user2@example.com");
			expect(secondUser.role).toBe("instructor");

			// Login as second user
			const loginResult = await payload.login({
				collection: "users",
				req: mockRequest,
				data: {
					email: "user2@example.com",
					password: "password456",
				},
			});

			expect(loginResult.user).toBeDefined();
			expect(loginResult.token).toBeDefined();

			const user = loginResult.user as User;
			expect(user.email).toBe("user2@example.com");
			expect(user.role).toBe("instructor");

			// Authenticate with second user's token
			const authenticatedRequest = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `Bearer ${loginResult.token}`,
				},
			});

			const authResult = await payload.auth({
				headers: authenticatedRequest.headers,
			});

			expect(authResult.user).toBeDefined();
			const authenticatedUser = authResult.user as User;
			expect(authenticatedUser.id).toBe(secondUser.id);
			expect(authenticatedUser.email).toBe("user2@example.com");
			expect(authenticatedUser.role).toBe("instructor");
		});
	});
});
