import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { executeAuthStrategies, getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateUserArgs,
	type DeleteUserArgs,
	type FindAllUsersArgs,
	type FindUserByEmailArgs,
	type FindUserByIdArgs,
	tryCreateUser,
	tryDeleteUser,
	tryFindAllUsers,
	tryFindUserByEmail,
	tryFindUserById,
	tryHandleImpersonation,
	tryUpdateUser,
	type UpdateUserArgs,
	tryRegisterFirstUser,
	tryGetUserCount,
} from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { User } from "../payload-types";

describe("User Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let adminToken: string;
	const mockRequest = new Request("http://localhost:3000/test");

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
		} catch (error) {
			console.warn("Migration failed, continuing with existing state:", error);
		}

		payload = await getPayload({
			config: sanitizedConfig,
		});

		// Create admin user for testing
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
			req: undefined,
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
			req: undefined,
		});

		// Login to get admin token
		const adminLogin = await payload.login({
			collection: "users",
			data: {
				email: "admin@example.com",
				password: "adminpassword123",
			},
		});

		if (!adminLogin.token) {
			throw new Error("Failed to get admin token");
		}

		adminToken = adminLogin.token;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateUser", () => {
		test("should create a new user successfully with overrideAccess", async () => {
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "test@example.com",
					password: "testpassword123",
					firstName: "Test",
					lastName: "User",
					role: "student",
				},
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryCreateUser(userArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.email).toBe("test@example.com");
				expect(result.value.firstName).toBe("Test");
				expect(result.value.lastName).toBe("User");
				expect(result.value.role).toBe("student");
			}
		});

		test("should fail when creating user with duplicate email", async () => {
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "duplicate@example.com",
					password: "testpassword123",
					firstName: "Test",
					lastName: "User",
				},
				overrideAccess: true,
				req: undefined,
			};

			// Create first user
			const firstResult = await tryCreateUser(userArgs);
			expect(firstResult.ok).toBe(true);

			// Try to create second user with same email
			const secondResult = await tryCreateUser(userArgs);
			expect(secondResult.ok).toBe(false);
		});

		test("should create user with default role as user", async () => {
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "default-role@example.com",
					password: "testpassword123",
					firstName: "Default",
					lastName: "User",
				},
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryCreateUser(userArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.role).toBe("student");
			}
		});

		test("admin should be able to create users", async () => {
			const adminUser = await getAuthUser(adminToken);

			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "created-by-admin@example.com",
					password: "testpassword123",
					firstName: "Created",
					lastName: "ByAdmin",
				},
				req: { user: adminUser },
				overrideAccess: false,
			};

			const result = await tryCreateUser(userArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.email).toBe("created-by-admin@example.com");
			}
		});

		test("unauthenticated request should fail to create user", async () => {
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "unauthorized@example.com",
					password: "testpassword123",
					firstName: "Unauthorized",
					lastName: "User",
				},
				overrideAccess: false,
				req: undefined,
			};

			const result = await tryCreateUser(userArgs);

			expect(result.ok).toBe(false);
		});

		test("should create user with explicit theme value", async () => {
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "theme-dark@example.com",
					password: "testpassword123",
					firstName: "Theme",
					lastName: "Dark",
					theme: "dark",
				},
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryCreateUser(userArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.theme).toBe("dark");
			}
		});

		test("should create user with default theme as light when not specified", async () => {
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "theme-default@example.com",
					password: "testpassword123",
					firstName: "Theme",
					lastName: "Default",
				},
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryCreateUser(userArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.theme).toBe("light");
			}
		});
	});

	describe("tryUpdateUser", () => {
		test("should update user successfully with overrideAccess", async () => {
			// First create a user
			const createArgs: CreateUserArgs = {
				payload,
				data: {
					email: "update-test@example.com",
					password: "testpassword123",
					firstName: "Update",
					lastName: "Test",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateUser(createArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const updateArgs: UpdateUserArgs = {
					payload,
					userId: createResult.value.id,
					data: {
						firstName: "Updated",
						lastName: "Name",
						role: "student",
						bio: "Updated bio",
					},
					overrideAccess: true,
					req: undefined,
				};

				const updateResult = await tryUpdateUser(updateArgs);

				expect(updateResult.ok).toBe(true);
				if (updateResult.ok) {
					expect(updateResult.value.firstName).toBe("Updated");
					expect(updateResult.value.lastName).toBe("Name");
					expect(updateResult.value.role).toBe("student");
					expect(updateResult.value.bio).toBe("Updated bio");
				}
			}
		});

		test("should fail when updating non-existent user", async () => {
			const updateArgs: UpdateUserArgs = {
				payload,
				userId: 99999,
				data: {
					firstName: "Non",
					lastName: "Existent",
				},
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryUpdateUser(updateArgs);

			expect(result.ok).toBe(false);
		});

		test("unauthenticated request should fail to update user", async () => {
			const updateArgs: UpdateUserArgs = {
				payload,
				userId: 1,
				data: {
					firstName: "Unauthorized",
				},
				overrideAccess: false,
				req: undefined,
			};

			const result = await tryUpdateUser(updateArgs);

			expect(result.ok).toBe(false);
		});

		test("should update user theme from light to dark", async () => {
			// Create a user with light theme
			const createArgs: CreateUserArgs = {
				payload,
				data: {
					email: "theme-update-test@example.com",
					password: "testpassword123",
					firstName: "ThemeUpdate",
					lastName: "Test",
					theme: "light",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateUser(createArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				expect(createResult.value.theme).toBe("light");

				// Update theme to dark
				const updateArgs: UpdateUserArgs = {
					payload,
					userId: createResult.value.id,
					data: {
						theme: "dark",
					},
					overrideAccess: true,
					req: undefined,
				};

				const updateResult = await tryUpdateUser(updateArgs);

				expect(updateResult.ok).toBe(true);
				if (updateResult.ok) {
					expect(updateResult.value.theme).toBe("dark");
				}
			}
		});
	});

	describe("tryFindUserByEmail", () => {
		test("should find existing user by email with overrideAccess", async () => {
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "find-test@example.com",
					password: "testpassword123",
					firstName: "Find",
					lastName: "Test",
				},
				overrideAccess: true,
				req: undefined,
			};

			await tryCreateUser(userArgs);

			const findArgs: FindUserByEmailArgs = {
				payload,
				email: "find-test@example.com",
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryFindUserByEmail(findArgs);

			expect(result.ok).toBe(true);
			if (result.ok && result.value) {
				expect(result.value.email).toBe("find-test@example.com");
			}
		});

		test("should return null for non-existent email", async () => {
			const findArgs: FindUserByEmailArgs = {
				payload,
				email: "nonexistent@example.com",
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryFindUserByEmail(findArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeNull();
			}
		});

		test("unauthenticated request should fail to find user", async () => {
			const findArgs: FindUserByEmailArgs = {
				payload,
				email: "find-test@example.com",
				overrideAccess: false,
				req: undefined,
			};

			const result = await tryFindUserByEmail(findArgs);

			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindUserById", () => {
		test("should find existing user by ID with overrideAccess", async () => {
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "find-by-id@example.com",
					password: "testpassword123",
					firstName: "FindById",
					lastName: "Test",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateUser(userArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const findArgs: FindUserByIdArgs = {
					payload,
					userId: createResult.value.id,
					overrideAccess: true,
					req: undefined,
				};

				const findResult = await tryFindUserById(findArgs);

				expect(findResult.ok).toBe(true);
				if (findResult.ok) {
					expect(findResult.value.id).toBe(createResult.value.id);
					expect(findResult.value.email).toBe("find-by-id@example.com");
				}
			}
		});

		test("should fail when finding non-existent user by ID", async () => {
			const findArgs: FindUserByIdArgs = {
				payload,
				userId: 99999,
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryFindUserById(findArgs);

			expect(result.ok).toBe(false);
		});

		test("unauthenticated request should fail to find user", async () => {
			const findArgs: FindUserByIdArgs = {
				payload,
				userId: 1,
				overrideAccess: false,
				req: undefined,
			};

			const result = await tryFindUserById(findArgs);

			expect(result.ok).toBe(false);
		});
	});

	describe("tryDeleteUser", () => {
		test("should delete user successfully with overrideAccess", async () => {
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "delete-test@example.com",
					password: "testpassword123",
					firstName: "Delete",
					lastName: "Test",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateUser(userArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteArgs: DeleteUserArgs = {
					payload,
					userId: createResult.value.id,
					overrideAccess: true,
					req: undefined,
				};

				const deleteResult = await tryDeleteUser(deleteArgs);

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
				}

				// Verify user is actually deleted
				const findArgs: FindUserByIdArgs = {
					payload,
					userId: createResult.value.id,
					overrideAccess: true,
					req: undefined,
				};

				const findResult = await tryFindUserById(findArgs);
				expect(findResult.ok).toBe(false);
			}
		});

		test("admin should be able to delete any user", async () => {
			// Create a test user
			const createArgs: CreateUserArgs = {
				payload,
				data: {
					email: "admin-delete-test@example.com",
					password: "testpassword123",
					firstName: "AdminDelete",
					lastName: "Test",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateUser(createArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const adminUser = await getAuthUser(adminToken);

				const deleteArgs: DeleteUserArgs = {
					payload,
					userId: createResult.value.id,
					req: { user: adminUser },
					overrideAccess: false,
				};

				const deleteResult = await tryDeleteUser(deleteArgs);

				expect(deleteResult.ok).toBe(true);
			}
		});

		test("unauthenticated request should fail to delete user", async () => {
			const deleteArgs: DeleteUserArgs = {
				payload,
				userId: 1,
				overrideAccess: false,
				req: undefined,
			};

			const result = await tryDeleteUser(deleteArgs);

			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindAllUsers", () => {
		test("should find all users with overrideAccess", async () => {
			// Create a few test users
			const userEmails = [
				"findall1@example.com",
				"findall2@example.com",
				"findall3@example.com",
			];

			for (const email of userEmails) {
				const createArgs: CreateUserArgs = {
					payload,
					data: {
						email,
						password: "testpassword123",
						firstName: "FindAll",
						lastName: "Test",
					},
					overrideAccess: true,
					req: undefined,
				};

				await tryCreateUser(createArgs);
			}

			const findArgs: FindAllUsersArgs = {
				payload,
				limit: 100,
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryFindAllUsers(findArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThanOrEqual(3);
				expect(result.value.totalDocs).toBeGreaterThanOrEqual(3);
			}
		});

		test("should support pagination", async () => {
			const findArgs: FindAllUsersArgs = {
				payload,
				limit: 2,
				page: 1,
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryFindAllUsers(findArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeLessThanOrEqual(2);
				expect(result.value.limit).toBe(2);
				expect(result.value.page).toBe(1);
			}
		});

		test("should support sorting", async () => {
			const findArgs: FindAllUsersArgs = {
				payload,
				sort: "-createdAt",
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryFindAllUsers(findArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
			}
		});

		test("admin should be able to find all users", async () => {
			const adminUser = await getAuthUser(adminToken);

			const findArgs: FindAllUsersArgs = {
				payload,
				req: { user: adminUser },
				overrideAccess: false,
			};

			const result = await tryFindAllUsers(findArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
			}
		});

		test("unauthenticated request should fail to find all users", async () => {
			const findArgs: FindAllUsersArgs = {
				payload,
				overrideAccess: false,
				req: undefined,
			};

			const result = await tryFindAllUsers(findArgs);

			expect(result.ok).toBe(false);
		});

		test("should comprehensively test search functionality with text and role filters", async () => {
			// Create diverse test users with different roles and names
			const testUsers = [
				{
					email: "alice.admin@search-test.com",
					firstName: "Alice",
					lastName: "Administrator",
					role: "admin" as const,
				},
				{
					email: "bob.manager@search-test.com",
					firstName: "Bob",
					lastName: "Manager",
					role: "content-manager" as const,
				},
				{
					email: "charlie.viewer@search-test.com",
					firstName: "Charlie",
					lastName: "Viewer",
					role: "analytics-viewer" as const,
				},
				{
					email: "alice.user@search-test.com",
					firstName: "Alice",
					lastName: "Smith",
					role: "student" as const,
				},
				{
					email: "david.developer@search-test.com",
					firstName: "David",
					lastName: "Developer",
					role: "student" as const,
				},
			];

			// Create all test users
			for (const userData of testUsers) {
				const createArgs: CreateUserArgs = {
					payload,
					data: {
						...userData,
						password: "testpassword123",
					},
					overrideAccess: true,
					req: undefined,
				};
				await tryCreateUser(createArgs);
			}

			// Test 1: Search by first name
			const searchByFirstName = await tryFindAllUsers({
				payload,
				query: "Alice",
				overrideAccess: true,
				req: undefined,
			});

			expect(searchByFirstName.ok).toBe(true);
			if (searchByFirstName.ok) {
				expect(searchByFirstName.value.docs.length).toBe(2);
				expect(
					searchByFirstName.value.docs.every((user) =>
						user.firstName?.includes("Alice"),
					),
				).toBe(true);
			}

			// Test 2: Search by last name
			const searchByLastName = await tryFindAllUsers({
				payload,
				query: "Manager",
				overrideAccess: true,
				req: undefined,
			});

			expect(searchByLastName.ok).toBe(true);
			if (searchByLastName.ok) {
				expect(searchByLastName.value.docs.length).toBe(1);
				expect(searchByLastName.value.docs[0]?.lastName).toBe("Manager");
			}

			// Test 3: Search by email
			const searchByEmail = await tryFindAllUsers({
				payload,
				query: "developer",
				overrideAccess: true,
				req: undefined,
			});

			expect(searchByEmail.ok).toBe(true);
			if (searchByEmail.ok) {
				expect(searchByEmail.value.docs.length).toBe(1);
				expect(searchByEmail.value.docs[0]?.email).toContain("developer");
			}

			// Test 4: Filter by single role
			const filterByAdminRole = await tryFindAllUsers({
				payload,
				query: "role:admin",
				overrideAccess: true,
				req: undefined,
			});

			expect(filterByAdminRole.ok).toBe(true);
			if (filterByAdminRole.ok) {
				expect(
					filterByAdminRole.value.docs.every((user) => user.role === "admin"),
				).toBe(true);
			}

			// Test 5: Filter by multiple roles
			const filterByMultipleRoles = await tryFindAllUsers({
				payload,
				query: "role:content-manager,analytics-viewer",
				overrideAccess: true,
				req: undefined,
			});

			expect(filterByMultipleRoles.ok).toBe(true);
			if (filterByMultipleRoles.ok) {
				expect(
					filterByMultipleRoles.value.docs.every(
						(user) =>
							user.role === "content-manager" ||
							user.role === "analytics-viewer",
					),
				).toBe(true);
			}

			// Test 6: Combined text search and role filter
			const combinedSearch = await tryFindAllUsers({
				payload,
				query: "Alice role:admin",
				overrideAccess: true,
				req: undefined,
			});

			expect(combinedSearch.ok).toBe(true);
			if (combinedSearch.ok) {
				expect(combinedSearch.value.docs.length).toBe(1);
				expect(combinedSearch.value.docs[0]?.firstName).toBe("Alice");
				expect(combinedSearch.value.docs[0]?.role).toBe("admin");
			}

			// Test 7: Search with pagination
			const searchWithPagination = await tryFindAllUsers({
				payload,
				query: "search-test",
				limit: 2,
				page: 1,
				overrideAccess: true,
				req: undefined,
			});

			expect(searchWithPagination.ok).toBe(true);
			if (searchWithPagination.ok) {
				expect(searchWithPagination.value.docs.length).toBe(2);
				expect(searchWithPagination.value.limit).toBe(2);
				expect(searchWithPagination.value.page).toBe(1);
				expect(searchWithPagination.value.totalDocs).toBeGreaterThanOrEqual(5);
			}

			// Test 8: Search with no results
			const noResultsSearch = await tryFindAllUsers({
				payload,
				query: "nonexistentuser12345",
				overrideAccess: true,
				req: undefined,
			});

			expect(noResultsSearch.ok).toBe(true);
			if (noResultsSearch.ok) {
				expect(noResultsSearch.value.docs.length).toBe(0);
				expect(noResultsSearch.value.totalDocs).toBe(0);
			}

			// Test 9: Empty query should return all users
			const emptyQuerySearch = await tryFindAllUsers({
				payload,
				query: "",
				overrideAccess: true,
				req: undefined,
			});

			expect(emptyQuerySearch.ok).toBe(true);
			if (emptyQuerySearch.ok) {
				expect(emptyQuerySearch.value.docs.length).toBeGreaterThanOrEqual(5);
			}

			// Test 10: Admin can use search functionality
			const adminUser = await getAuthUser(adminToken);
			const adminSearch = await tryFindAllUsers({
				payload,
				query: "Alice",
				req: { user: adminUser },
				overrideAccess: false,
			});

			expect(adminSearch.ok).toBe(true);
			if (adminSearch.ok) {
				expect(adminSearch.value.docs.length).toBeGreaterThanOrEqual(1);
			}
		});
	});

	describe("Integration Tests", () => {
		test("should handle complete user lifecycle with overrideAccess", async () => {
			// Create user
			const createArgs: CreateUserArgs = {
				payload,
				data: {
					email: "lifecycle@example.com",
					password: "testpassword123",
					firstName: "Lifecycle",
					lastName: "Test",
					role: "student",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateUser(createArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const userId = createResult.value.id;

				// Find by email
				const findByEmailArgs: FindUserByEmailArgs = {
					payload,
					email: "lifecycle@example.com",
					overrideAccess: true,
					req: undefined,
				};

				const findByEmailResult = await tryFindUserByEmail(findByEmailArgs);
				expect(findByEmailResult.ok).toBe(true);

				// Find by ID
				const findByIdArgs: FindUserByIdArgs = {
					payload,
					userId,
					overrideAccess: true,
					req: undefined,
				};

				const findByIdResult = await tryFindUserById(findByIdArgs);
				expect(findByIdResult.ok).toBe(true);

				// Update user
				const updateArgs: UpdateUserArgs = {
					payload,
					userId,
					data: {
						role: "student",
						bio: "Updated in lifecycle test",
					},
					overrideAccess: true,
					req: undefined,
				};

				const updateResult = await tryUpdateUser(updateArgs);
				expect(updateResult.ok).toBe(true);

				// Delete user
				const deleteArgs: DeleteUserArgs = {
					payload,
					userId,
					overrideAccess: true,
					req: undefined,
				};

				const deleteResult = await tryDeleteUser(deleteArgs);
				expect(deleteResult.ok).toBe(true);

				// Verify deletion
				const findAfterDeleteArgs: FindUserByIdArgs = {
					payload,
					userId,
					overrideAccess: true,
					req: undefined,
				};

				const findAfterDeleteResult =
					await tryFindUserById(findAfterDeleteArgs);
				expect(findAfterDeleteResult.ok).toBe(false);
			}
		});
	});

	describe("User Impersonation", () => {
		let adminUser: any;
		let studentUser: any;

		beforeAll(async () => {
			// Create test admin user
			const adminResult = await tryCreateUser({
				payload,
				data: {
					email: "impersonate-admin@test.com",
					password: "password123",
					firstName: "Impersonate",
					lastName: "Admin",
					role: "admin",
				},
				overrideAccess: true,
				req: undefined,
			});

			if (!adminResult.ok) {
				throw new Error("Failed to create admin user for impersonation test");
			}
			adminUser = adminResult.value;

			// Create test student user
			const studentResult = await tryCreateUser({
				payload,
				data: {
					email: "impersonate-student@test.com",
					password: "password123",
					firstName: "Impersonate",
					lastName: "Student",
					role: "student",
				},
				overrideAccess: true,
				req: undefined,
			});

			if (!studentResult.ok) {
				throw new Error("Failed to create student user for impersonation test");
			}
			studentUser = studentResult.value;
		});

		afterAll(async () => {
			// Clean up test users
			if (adminUser) {
				await payload.delete({
					collection: "users",
					id: adminUser.id,
					overrideAccess: true,
					req: undefined,
				});
			}
			if (studentUser) {
				await payload.delete({
					collection: "users",
					id: studentUser.id,
					overrideAccess: true,
					req: undefined,
				});
			}
		});

		test("should not allow admin to impersonate another admin", async () => {
			// Create another admin user
			const anotherAdminResult = await tryCreateUser({
				payload,
				data: {
					email: "impersonate-admin2@test.com",
					password: "password123",
					firstName: "Impersonate2",
					lastName: "Admin",
					role: "admin",
				},
				overrideAccess: true,
				req: undefined,
			});

			if (!anotherAdminResult.ok) {
				throw new Error("Failed to create second admin user");
			}

			const result = await tryHandleImpersonation({
				payload,
				impersonateUserId: String(anotherAdminResult.value.id),
				req: createLocalReq({ request: mockRequest, user: adminUser }),
			});

			expect(result.ok).toBe(true);
			expect(result.value).toBeNull();

			// Clean up
			await payload.delete({
				collection: "users",
				id: anotherAdminResult.value.id,
				overrideAccess: true,
				req: undefined,
			});
		});

		test("should return null for invalid user ID", async () => {
			const result = await tryHandleImpersonation({
				payload,
				impersonateUserId: "invalid",
				req: createLocalReq({ request: mockRequest, user: adminUser }),
			});

			expect(result.ok).toBe(true);
			expect(result.value).toBeNull();
		});

		test("should return null for non-existent user ID", async () => {
			const result = await tryHandleImpersonation({
				payload,
				impersonateUserId: "99999",
				req: createLocalReq({ request: mockRequest, user: adminUser }),
			});

			expect(result.ok).toBe(true);
			expect(result.value).toBeNull();
		});
	});
});

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

	describe("tryGetUserCount", () => {
		test("should return correct user count", async () => {
			const result = await tryGetUserCount({
				payload,
				overrideAccess: true,
				req: undefined,
			});

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
				req: undefined,
			});

			const result = await tryGetUserCount({
				payload,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(0);
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
			req: undefined,
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
			req: undefined,
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
			req: undefined,
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
			req: undefined,
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

	describe("Access Control - tryGetUserCount", () => {
		test("admin should be able to get user count", async () => {
			const adminUser = await getAuthUser(adminToken);

			const result = await tryGetUserCount({
				payload,
				req: { user: adminUser },
				overrideAccess: false,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeGreaterThan(0);
			}
		});

		test("regular user should be able to get user count", async () => {
			const regularUser = await getAuthUser(userToken);

			const result = await tryGetUserCount({
				payload,
				req: { user: regularUser },
				overrideAccess: false,
			});

			// Based on access control, everyone can read users
			expect(result.ok).toBe(true);
		});

		test("unauthenticated request should fail", async () => {
			const result = await tryGetUserCount({
				payload,
				overrideAccess: false,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});
});

describe("Authentication Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;

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

		// Create mock request object
		mockRequest = new Request("http://localhost:3000/test");
	});

	afterAll(async () => {
		// Clean up test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
			await $`bun scripts/clean-s3.ts`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("First User Registration and Authentication Flow", () => {
		test("should check that no users exist initially", async () => {
			const result = await tryGetUserCount({
				payload,
				overrideAccess: true,
				req: undefined,
			}).getOrThrow();

			expect(result).toBe(0);
		});

		test("should create and auto-login first user", async () => {
			const firstUserArgs = {
				email: "admin@example.com",
				password: "password123",
				firstName: "Admin",
				lastName: "User",
			};

			const registerResult = await tryRegisterFirstUser({
				payload,
				req: mockRequest,
				...firstUserArgs,
			});

			if (!registerResult.ok) {
				throw new Error(
					`Failed to create first user: ${registerResult.error.message}`,
				);
			}

			const result = registerResult.value;

			// Verify user creation
			expect(result.user.email).toBe(firstUserArgs.email);
			expect(result.user.firstName).toBe(firstUserArgs.firstName);
			expect(result.user.lastName).toBe(firstUserArgs.lastName);
			expect(result.user.role).toBe("admin");

			// Verify login tokens
			expect(result.token).toBeDefined();
			expect(result.exp).toBeDefined();

			// Verify token is a string
			expect(typeof result.token).toBe("string");
			expect(result.token.length).toBeGreaterThan(0);

			// Verify expiration is a number (Unix timestamp)
			expect(typeof result.exp).toBe("number");
			expect(result.exp).toBeGreaterThan(Date.now() / 1000);
		});

		test("should verify there is 1 user after user creation", async () => {
			const result = await tryGetUserCount({
				payload,
				overrideAccess: true,
				req: undefined,
			}).getOrThrow();

			expect(result).toBe(1);
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
			const authResult = await executeAuthStrategies({
				headers: authenticatedRequest.headers,
				canSetHeaders: true,
				payload,
			});

			// Verify authentication
			expect(authResult.user).toBeDefined();

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

			const authResult = await executeAuthStrategies({
				headers: invalidRequest.headers,
				canSetHeaders: true,
				payload,
			});

			// Should not be authenticated
			expect(authResult.user).toBeNull();
		});

		test("should fail authentication with no token", async () => {
			const unauthenticatedRequest = new Request("http://localhost:3000/test");

			const authResult = await executeAuthStrategies({
				headers: unauthenticatedRequest.headers,
				canSetHeaders: true,
				payload,
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
			const authResult = await executeAuthStrategies({
				headers: cookieRequest.headers,
				canSetHeaders: true,
				payload,
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

			const authResult = await executeAuthStrategies({
				headers: loggedOutRequest.headers,
				canSetHeaders: true,
				payload,
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
					theme: "light",
					direction: "ltr",
					role: "student",
					_verified: true,
				},
				req: mockRequest,
			});

			expect(secondUser).toBeDefined();
			expect(secondUser.email).toBe("user2@example.com");
			expect(secondUser.role).toBe("student");

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
			expect(user.role).toBe("student");

			// Authenticate with second user's token
			const authenticatedRequest = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `Bearer ${loginResult.token}`,
				},
			});

			const authResult = await executeAuthStrategies({
				headers: authenticatedRequest.headers,
				canSetHeaders: true,
				payload,
			});

			expect(authResult.user).toBeDefined();
			const authenticatedUser = authResult.user as User;
			expect(authenticatedUser.id).toBe(secondUser.id);
			expect(authenticatedUser.email).toBe("user2@example.com");
			expect(authenticatedUser.role).toBe("student");
		});
	});
});
