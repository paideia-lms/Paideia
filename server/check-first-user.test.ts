import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "./payload.config";
import { checkFirstUser, getUserCount, validateFirstUserState } from "./check-first-user";

describe("First User Check Functions", () => {
    let payload: Awaited<ReturnType<typeof getPayload>>;

    beforeAll(async () => {
        // Refresh environment and database for clean test state
        try {
            // Run fresh migration to ensure clean database state
            await $`bun run migrate:fresh`;
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
            await payload.delete({
                collection: "users",
                where: {},
            });
        } catch (error) {
            console.warn("Cleanup failed:", error);
        }
    });

    describe("checkFirstUser", () => {
        test("should return true when no users exist", async () => {
            // First, ensure no users exist by clearing the collection
            await payload.delete({
                collection: "users",
                where: {},
            });

            const result = await checkFirstUser();
            expect(result).toBe(true);
        });

        test("should return false when users exist", async () => {
            // Create a test user
            await payload.create({
                collection: "users",
                data: {
                    email: "test@example.com",
                    password: "testpassword123",
                    firstName: "Test",
                    lastName: "User",
                    role: "admin",
                },
            });

            const result = await checkFirstUser();
            expect(result).toBe(false);
        });
    });

    describe("getUserCount", () => {
        test("should return correct user count", async () => {
            const count = await getUserCount();
            expect(typeof count).toBe("number");
            expect(count).toBeGreaterThanOrEqual(0);
        });

        test("should return 0 when no users exist", async () => {
            // Clear all users first
            await payload.delete({
                collection: "users",
                where: {},
            });

            const count = await getUserCount();
            expect(count).toBe(0);
        });
    });

    describe("validateFirstUserState", () => {
        test("should return valid state with correct structure", async () => {
            const result = await validateFirstUserState();

            expect(result).toHaveProperty("needsFirstUser");
            expect(result).toHaveProperty("userCount");
            expect(result).toHaveProperty("isValid");
            expect(typeof result.needsFirstUser).toBe("boolean");
            expect(typeof result.userCount).toBe("number");
            expect(typeof result.isValid).toBe("boolean");
        });

        test("should return isValid=true when database is accessible", async () => {
            const result = await validateFirstUserState();
            expect(result.isValid).toBe(true);
        });

        test("should return userCount matching actual database state", async () => {
            // Clear users
            await payload.delete({
                collection: "users",
                where: {},
            });

            const result = await validateFirstUserState();
            expect(result.userCount).toBe(0);

            // Add a user
            await payload.create({
                collection: "users",
                data: {
                    email: "test@example.com",
                    password: "testpassword123",
                    firstName: "Test",
                    lastName: "User",
                    role: "admin",
                },
            });

            const resultAfterCreate = await validateFirstUserState();
            expect(resultAfterCreate.userCount).toBe(1);
        });
    });

    describe("Integration Tests", () => {
        test("checkFirstUser and getUserCount should be consistent", async () => {
            const needsFirstUser = await checkFirstUser();
            const userCount = await getUserCount();

            if (needsFirstUser) {
                expect(userCount).toBe(0);
            } else {
                expect(userCount).toBeGreaterThan(0);
            }
        });

        test("validateFirstUserState should match individual function results", async () => {
            const validationState = await validateFirstUserState();
            const needsFirstUser = await checkFirstUser();
            const userCount = await getUserCount();

            expect(validationState.needsFirstUser).toBe(needsFirstUser);
            expect(validationState.userCount).toBe(userCount);
        });
    });
});
