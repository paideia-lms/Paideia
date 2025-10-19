import { $ } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import { type CreateUserArgs, tryCreateUser } from "./user-management";
import {
    type CreateWhiteboardArgs,
    tryCreateWhiteboard,
    tryDeleteWhiteboard,
    tryGetWhiteboardById,
    tryUpdateWhiteboard,
} from "./whiteboard-management";

describe("Whiteboard Management Functions", () => {
    let payload: Awaited<ReturnType<typeof getPayload>>;
    let testUser: { id: number };

    beforeAll(async () => {
        // Refresh environment and database for clean test state
        try {
            await $`bun run migrate:fresh`;
        } catch (error) {
            console.warn("Migration failed, continuing with existing state:", error);
        }

        payload = await getPayload({
            config: sanitizedConfig,
        });

        // Create test user
        const userArgs: CreateUserArgs = {
            payload,
            data: {
                email: "testuser@example.com",
                password: "testpassword123",
                firstName: "Test",
                lastName: "User",
                role: "student",
            },
            overrideAccess: true,
        };

        const userResult = await tryCreateUser(userArgs);

        if (!userResult.ok) {
            throw new Error("Failed to create test user");
        }

        testUser = userResult.value;
    });

    afterAll(async () => {
        // Cleanup if needed

        try {
            await $`bun run migrate:fresh --force-accept-warning`;
        } catch (error) {
            console.warn("Cleanup failed:", error);
        }
    });

    test("should create a whiteboard with valid JSON content", async () => {
        const whiteboardContent = JSON.stringify({
            shapes: [],
            bindings: [],
            assets: [],
        });

        const createArgs: CreateWhiteboardArgs = {
            payload,
            content: whiteboardContent,
            userId: testUser.id,
            overrideAccess: true,
        };

        const result = await tryCreateWhiteboard(createArgs);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.content).toBe(whiteboardContent);
            expect(result.value.createdBy.id).toBe(testUser.id);
        }
    });

    test("should create a whiteboard with empty content", async () => {
        const createArgs: CreateWhiteboardArgs = {
            payload,
            content: "",
            userId: testUser.id,
            overrideAccess: true,
        };

        const result = await tryCreateWhiteboard(createArgs);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.content).toBe("");
        }
    });

    test("should fail to create a whiteboard without userId", async () => {
        const createArgs = {
            payload,
            content: "{}",
            userId: undefined,
            overrideAccess: true,
        } as unknown as CreateWhiteboardArgs;

        const result = await tryCreateWhiteboard(createArgs);

        expect(result.ok).toBe(false);
    });

    test("should get a whiteboard by ID", async () => {
        // Create a whiteboard first
        const whiteboardContent = JSON.stringify({ test: "data" });
        const createArgs: CreateWhiteboardArgs = {
            payload,
            content: whiteboardContent,
            userId: testUser.id,
            overrideAccess: true,
        };

        const createResult = await tryCreateWhiteboard(createArgs);
        expect(createResult.ok).toBe(true);

        if (createResult.ok) {
            const whiteboardId = createResult.value.id;

            // Get the whiteboard
            const getResult = await tryGetWhiteboardById({
                payload,
                id: whiteboardId,
                overrideAccess: true,
            });

            expect(getResult.ok).toBe(true);
            if (getResult.ok) {
                expect(getResult.value.id).toBe(whiteboardId);
                expect(getResult.value.content).toBe(whiteboardContent);
            }
        }
    });

    test("should fail to get a non-existent whiteboard", async () => {
        const result = await tryGetWhiteboardById({ payload, id: 999999, overrideAccess: true });

        expect(result.ok).toBe(false);
    });

    test("should update a whiteboard content", async () => {
        // Create a whiteboard first
        const originalContent = JSON.stringify({ version: 1 });
        const createArgs: CreateWhiteboardArgs = {
            payload,
            content: originalContent,
            userId: testUser.id,
            overrideAccess: true,
        };

        const createResult = await tryCreateWhiteboard(createArgs);
        expect(createResult.ok).toBe(true);

        if (createResult.ok) {
            const whiteboardId = createResult.value.id;

            // Update the whiteboard
            const updatedContent = JSON.stringify({ version: 2 });
            const updateResult = await tryUpdateWhiteboard({
                payload,
                id: whiteboardId,
                content: updatedContent,
                overrideAccess: true,
            });

            expect(updateResult.ok).toBe(true);
            if (updateResult.ok) {
                expect(updateResult.value.content).toBe(updatedContent);
            }
        }
    });

    test("should fail to update a non-existent whiteboard", async () => {
        const result = await tryUpdateWhiteboard({
            payload,
            id: 999999,
            content: JSON.stringify({ test: "data" }),
            overrideAccess: true,
        });

        expect(result.ok).toBe(false);
    });

    test("should delete a whiteboard", async () => {
        // Create a whiteboard first
        const createArgs: CreateWhiteboardArgs = {
            payload,
            content: JSON.stringify({ delete: "test" }),
            userId: testUser.id,
            overrideAccess: true,
        };

        const createResult = await tryCreateWhiteboard(createArgs);
        expect(createResult.ok).toBe(true);

        if (createResult.ok) {
            const whiteboardId = createResult.value.id;

            // Delete the whiteboard
            const deleteResult = await tryDeleteWhiteboard({
                payload,
                id: whiteboardId,
                overrideAccess: true,
            });

            expect(deleteResult.ok).toBe(true);
            if (deleteResult.ok) {
                expect(deleteResult.value.success).toBe(true);
            }

            // Verify the whiteboard is deleted
            const getResult = await tryGetWhiteboardById({
                payload,
                id: whiteboardId,
                overrideAccess: true,
            });
            expect(getResult.ok).toBe(false);
        }
    });

    test("should fail to delete a non-existent whiteboard", async () => {
        const result = await tryDeleteWhiteboard({ payload, id: 999999, overrideAccess: true });

        expect(result.ok).toBe(false);

    });
});

