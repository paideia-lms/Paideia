import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
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
	tryUpdateUser,
	type UpdateUserArgs,
} from "./user-management";

describe("User Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let adminToken: string;

	// Helper to get authenticated user from token
	const getAuthUser = async (token: string): Promise<TypedUser | null> => {
		const authResult = await payload.auth({
			headers: new Headers({
				Authorization: `Bearer ${token}`,
			}),
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
					role: "user",
				},
				overrideAccess: true,
			};

			const result = await tryCreateUser(userArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.email).toBe("test@example.com");
				expect(result.value.firstName).toBe("Test");
				expect(result.value.lastName).toBe("User");
				expect(result.value.role).toBe("user");
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
			};

			const result = await tryCreateUser(userArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.role).toBe("user");
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
				user: adminUser,
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
			};

			const result = await tryCreateUser(userArgs);

			expect(result.ok).toBe(false);
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
						role: "user",
						bio: "Updated bio",
					},
					overrideAccess: true,
				};

				const updateResult = await tryUpdateUser(updateArgs);

				expect(updateResult.ok).toBe(true);
				if (updateResult.ok) {
					expect(updateResult.value.firstName).toBe("Updated");
					expect(updateResult.value.lastName).toBe("Name");
					expect(updateResult.value.role).toBe("user");
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
			};

			const result = await tryUpdateUser(updateArgs);

			expect(result.ok).toBe(false);
		});

		test("admin should be able to update any user", async () => {
			// Create a test user
			const createArgs: CreateUserArgs = {
				payload,
				data: {
					email: "admin-update-test@example.com",
					password: "testpassword123",
					firstName: "AdminUpdate",
					lastName: "Test",
				},
				overrideAccess: true,
			};

			const createResult = await tryCreateUser(createArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const adminUser = await getAuthUser(adminToken);

				const updateArgs: UpdateUserArgs = {
					payload,
					userId: createResult.value.id,
					data: {
						bio: "Updated by admin",
					},
					user: adminUser,
					overrideAccess: false,
				};

				const updateResult = await tryUpdateUser(updateArgs);

				expect(updateResult.ok).toBe(true);
				if (updateResult.ok) {
					expect(updateResult.value.bio).toBe("Updated by admin");
				}
			}
		});

		test("unauthenticated request should fail to update user", async () => {
			const updateArgs: UpdateUserArgs = {
				payload,
				userId: 1,
				data: {
					firstName: "Unauthorized",
				},
				overrideAccess: false,
			};

			const result = await tryUpdateUser(updateArgs);

			expect(result.ok).toBe(false);
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
			};

			await tryCreateUser(userArgs);

			const findArgs: FindUserByEmailArgs = {
				payload,
				email: "find-test@example.com",
				overrideAccess: true,
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
			};

			const result = await tryFindUserByEmail(findArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(null);
			}
		});

		test("unauthenticated request should fail to find user", async () => {
			const findArgs: FindUserByEmailArgs = {
				payload,
				email: "find-test@example.com",
				overrideAccess: false,
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
			};

			const createResult = await tryCreateUser(userArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const findArgs: FindUserByIdArgs = {
					payload,
					userId: createResult.value.id,
					overrideAccess: true,
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
			};

			const result = await tryFindUserById(findArgs);

			expect(result.ok).toBe(false);
		});

		test("unauthenticated request should fail to find user", async () => {
			const findArgs: FindUserByIdArgs = {
				payload,
				userId: 1,
				overrideAccess: false,
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
			};

			const createResult = await tryCreateUser(userArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteArgs: DeleteUserArgs = {
					payload,
					userId: createResult.value.id,
					overrideAccess: true,
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
			};

			const createResult = await tryCreateUser(createArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const adminUser = await getAuthUser(adminToken);

				const deleteArgs: DeleteUserArgs = {
					payload,
					userId: createResult.value.id,
					user: adminUser,
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
				};

				await tryCreateUser(createArgs);
			}

			const findArgs: FindAllUsersArgs = {
				payload,
				limit: 100,
				overrideAccess: true,
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
				user: adminUser,
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
					role: "user" as const,
				},
				{
					email: "david.developer@search-test.com",
					firstName: "David",
					lastName: "Developer",
					role: "user" as const,
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
				};
				await tryCreateUser(createArgs);
			}

			// Test 1: Search by first name
			const searchByFirstName = await tryFindAllUsers({
				payload,
				query: "Alice",
				overrideAccess: true,
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
				user: adminUser,
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
					role: "user",
				},
				overrideAccess: true,
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
				};

				const findByEmailResult = await tryFindUserByEmail(findByEmailArgs);
				expect(findByEmailResult.ok).toBe(true);

				// Find by ID
				const findByIdArgs: FindUserByIdArgs = {
					payload,
					userId,
					overrideAccess: true,
				};

				const findByIdResult = await tryFindUserById(findByIdArgs);
				expect(findByIdResult.ok).toBe(true);

				// Update user
				const updateArgs: UpdateUserArgs = {
					payload,
					userId,
					data: {
						role: "user",
						bio: "Updated in lifecycle test",
					},
					overrideAccess: true,
				};

				const updateResult = await tryUpdateUser(updateArgs);
				expect(updateResult.ok).toBe(true);

				// Delete user
				const deleteArgs: DeleteUserArgs = {
					payload,
					userId,
					overrideAccess: true,
				};

				const deleteResult = await tryDeleteUser(deleteArgs);
				expect(deleteResult.ok).toBe(true);

				// Verify deletion
				const findAfterDeleteArgs: FindUserByIdArgs = {
					payload,
					userId,
					overrideAccess: true,
				};

				const findAfterDeleteResult =
					await tryFindUserById(findAfterDeleteArgs);
				expect(findAfterDeleteResult.ok).toBe(false);
			}
		});
	});
});
