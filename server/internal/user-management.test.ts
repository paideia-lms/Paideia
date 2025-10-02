import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateUserArgs,
	tryCreateUser,
	tryDeleteUser,
	tryFindUserByEmail,
	tryFindUserById,
	tryUpdateUser,
	type UpdateUserArgs,
} from "./user-management";

describe("User Management Functions", () => {
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
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateUser", () => {
		test("should create a new user successfully", async () => {
			const userArgs: CreateUserArgs = {
				email: "test@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
				role: "student",
			};

			const result = await tryCreateUser(payload, mockRequest, userArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.email).toBe(userArgs.email);
				expect(result.value.firstName).toBe(userArgs.firstName);
				expect(result.value.lastName).toBe(userArgs.lastName);
				expect(result.value.role).toBe(userArgs.role);
			}
		});

		test("should fail when creating user with duplicate email", async () => {
			const userArgs: CreateUserArgs = {
				email: "duplicate@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
			};

			// Create first user
			const firstResult = await tryCreateUser(payload, mockRequest, userArgs);
			expect(firstResult.ok).toBe(true);

			// Try to create second user with same email
			const secondResult = await tryCreateUser(payload, mockRequest, userArgs);
			expect(secondResult.ok).toBe(false);
			if (!secondResult.ok) {
				expect(secondResult.error.message).toContain("already exists");
			}
		});

		test("should create user with default role as student", async () => {
			const userArgs: CreateUserArgs = {
				email: "default-role@example.com",
				password: "testpassword123",
				firstName: "Default",
				lastName: "User",
			};

			const result = await tryCreateUser(payload, mockRequest, userArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.role).toBe("student");
			}
		});
	});

	describe("tryUpdateUser", () => {
		test("should update user successfully", async () => {
			// First create a user
			const createArgs: CreateUserArgs = {
				email: "update-test@example.com",
				password: "testpassword123",
				firstName: "Update",
				lastName: "Test",
			};

			const createResult = await tryCreateUser(
				payload,
				mockRequest,
				createArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const updateArgs: UpdateUserArgs = {
					firstName: "Updated",
					lastName: "Name",
					role: "instructor",
					bio: "Updated bio",
				};

				const updateResult = await tryUpdateUser(
					payload,
					mockRequest,
					createResult.value.id,
					updateArgs,
				);

				expect(updateResult.ok).toBe(true);
				if (updateResult.ok) {
					expect(updateResult.value.firstName).toBe("Updated");
					expect(updateResult.value.lastName).toBe("Name");
					expect(updateResult.value.role).toBe("instructor");
					expect(updateResult.value.bio).toBe("Updated bio");
				}
			}
		});

		test("should fail when updating non-existent user", async () => {
			const updateArgs: UpdateUserArgs = {
				firstName: "Non",
				lastName: "Existent",
			};

			const result = await tryUpdateUser(
				payload,
				mockRequest,
				99999,
				updateArgs,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Not Found");
			}
		});
	});

	describe("tryFindUserByEmail", () => {
		test("should find existing user by email", async () => {
			const userArgs: CreateUserArgs = {
				email: "find-test@example.com",
				password: "testpassword123",
				firstName: "Find",
				lastName: "Test",
			};

			await tryCreateUser(payload, mockRequest, userArgs);

			const result = await tryFindUserByEmail(payload, "find-test@example.com");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).not.toBeNull();
				expect(result.value!.email).toBe("find-test@example.com");
			}
		});

		test("should return null for non-existent email", async () => {
			const result = await tryFindUserByEmail(
				payload,
				"nonexistent@example.com",
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(null);
			}
		});
	});

	describe("tryFindUserById", () => {
		test("should find existing user by ID", async () => {
			const userArgs: CreateUserArgs = {
				email: "find-by-id@example.com",
				password: "testpassword123",
				firstName: "FindById",
				lastName: "Test",
			};

			const createResult = await tryCreateUser(payload, mockRequest, userArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const findResult = await tryFindUserById(
					payload,
					createResult.value.id,
				);

				expect(findResult.ok).toBe(true);
				if (findResult.ok) {
					expect(findResult.value.id).toBe(createResult.value.id);
					expect(findResult.value.email).toBe("find-by-id@example.com");
				}
			}
		});

		test("should fail when finding non-existent user by ID", async () => {
			const result = await tryFindUserById(payload, 99999);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Not Found");
			}
		});
	});

	describe("tryDeleteUser", () => {
		test("should delete user successfully", async () => {
			const userArgs: CreateUserArgs = {
				email: "delete-test@example.com",
				password: "testpassword123",
				firstName: "Delete",
				lastName: "Test",
			};

			const createResult = await tryCreateUser(payload, mockRequest, userArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteUser(
					payload,
					mockRequest,
					createResult.value.id,
				);

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
				}

				// Verify user is actually deleted
				const findResult = await tryFindUserById(
					payload,
					createResult.value.id,
				);
				expect(findResult.ok).toBe(false);
			}
		});
	});

	describe("Integration Tests", () => {
		test("should handle complete user lifecycle", async () => {
			// Create user
			const createArgs: CreateUserArgs = {
				email: "lifecycle@example.com",
				password: "testpassword123",
				firstName: "Lifecycle",
				lastName: "Test",
				role: "student",
			};

			const createResult = await tryCreateUser(
				payload,
				mockRequest,
				createArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const userId = createResult.value.id;

				// Find by email
				const findByEmailResult = await tryFindUserByEmail(
					payload,
					"lifecycle@example.com",
				);
				expect(findByEmailResult.ok).toBe(true);

				// Find by ID
				const findByIdResult = await tryFindUserById(payload, userId);
				expect(findByIdResult.ok).toBe(true);

				// Update user
				const updateArgs: UpdateUserArgs = {
					role: "instructor",
					bio: "Updated in lifecycle test",
				};
				const updateResult = await tryUpdateUser(
					payload,
					mockRequest,
					userId,
					updateArgs,
				);
				expect(updateResult.ok).toBe(true);

				// Delete user
				const deleteResult = await tryDeleteUser(payload, mockRequest, userId);
				expect(deleteResult.ok).toBe(true);

				// Verify deletion
				const findAfterDeleteResult = await tryFindUserById(payload, userId);
				expect(findAfterDeleteResult.ok).toBe(false);
			}
		});
	});
});
