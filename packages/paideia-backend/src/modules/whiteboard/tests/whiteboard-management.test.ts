import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../../../payload.config";
import {
	tryCreateWhiteboard,
	tryDeleteWhiteboard,
	tryFindWhiteboardById,
	tryFindWhiteboardsByUser,
	trySearchWhiteboards,
	tryUpdateWhiteboard,
} from "../services/whiteboard-management";
import { trySeedUsers } from "../../user/seeding/users-builder";
import { predefinedUserSeedData } from "../../user/seeding/predefined-user-seed-data";

describe("Whiteboard Management Functions", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	let testUser: { id: number };
	let testUser2: { id: number };

	beforeAll(async () => {
		while (!payload.db.drizzle) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		await payload.db.migrateFresh({
			forceAcceptWarning: true,
		});

		const usersResult = await trySeedUsers({
			payload,
			data: predefinedUserSeedData,
			overrideAccess: true,
			req: undefined,
		}).getOrThrow();

		const user1Entry = usersResult.byEmail.get("user@example.com")!;
		const user2Entry = usersResult.byEmail.get("instructor@example.com")!;

		testUser = user1Entry.user;
		testUser2 = user2Entry.user;
	});

	afterAll(async () => {
		await payload.db.migrateFresh({
			forceAcceptWarning: true,
		});
	});

	describe("tryCreateWhiteboard", () => {
		test("should create a new whiteboard successfully", async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "My First Whiteboard",
					description: "This is a test whiteboard",
					content: JSON.stringify({ elements: [] }),
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const whiteboard = result.value as any;
				expect(whiteboard.title).toBe("My First Whiteboard");
				expect(whiteboard.description).toBe("This is a test whiteboard");
				expect(whiteboard.createdBy).toBe(testUser.id);
				expect(whiteboard.id).toBeDefined();
				expect(whiteboard.createdAt).toBeDefined();
			}
		});

		test("should create a whiteboard with only required fields", async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Minimal Whiteboard",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const whiteboard = result.value as any;
				expect(whiteboard.title).toBe("Minimal Whiteboard");
				expect(whiteboard.createdBy).toBe(testUser.id);
			}
		});

		test("should trim whitespace from title", async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "   Whiteboard with spaces   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const whiteboard = result.value as any;
				expect(whiteboard.title).toBe("Whiteboard with spaces");
			}
		});

		test("should trim whitespace from description and content", async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Test Whiteboard",
					description: "   Description with spaces   ",
					content: "   Content with spaces   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const whiteboard = result.value as any;
				expect(whiteboard.description).toBe("Description with spaces");
				expect(whiteboard.content).toBe("Content with spaces");
			}
		});

		test("should fail with empty title", async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with whitespace-only title", async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with title exceeding 500 characters", async () => {
			const longTitle = "a".repeat(501);
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: longTitle,
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should accept title with exactly 500 characters", async () => {
			const exactTitle = "a".repeat(500);
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: exactTitle,
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
		});

		test("should fail with non-existent user", async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Test Whiteboard",
					createdBy: 999999,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("tryUpdateWhiteboard", () => {
		let testWhiteboardId: number;

		beforeAll(async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Original Title",
					description: "Original Description",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				testWhiteboardId = result.value.id;
			}
		});

		test("should update whiteboard title successfully", async () => {
			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboardId,
				data: {
					title: "Updated Title",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const whiteboard = result.value as any;
				expect(whiteboard.title).toBe("Updated Title");
			}
		});

		test("should update multiple fields", async () => {
			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboardId,
				data: {
					title: "New Title",
					description: "New Description",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const whiteboard = result.value as any;
				expect(whiteboard.title).toBe("New Title");
				expect(whiteboard.description).toBe("New Description");
			}
		});

		test("should trim whitespace from updated fields", async () => {
			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboardId,
				data: {
					title: "   Trimmed Title   ",
					description: "   Trimmed Description   ",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const whiteboard = result.value as any;
				expect(whiteboard.title).toBe("Trimmed Title");
				expect(whiteboard.description).toBe("Trimmed Description");
			}
		});

		test("should fail with empty title", async () => {
			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboardId,
				data: {
					title: "",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with whitespace-only title", async () => {
			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboardId,
				data: {
					title: "   ",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with title exceeding 500 characters", async () => {
			const longTitle = "a".repeat(501);
			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboardId,
				data: {
					title: longTitle,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with non-existent whiteboard", async () => {
			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: 999999,
				data: {
					title: "Test",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindWhiteboardById", () => {
		let testWhiteboardId: number;

		beforeAll(async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Find Me Whiteboard",
					description: "Test Description",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				testWhiteboardId = result.value.id;
			}
		});

		test("should find whiteboard by ID successfully", async () => {
			const result = await tryFindWhiteboardById({
				payload,
				whiteboardId: testWhiteboardId,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const whiteboard = result.value as any;
				expect(whiteboard.title).toBe("Find Me Whiteboard");
				expect(whiteboard.description).toBe("Test Description");
			}
		});

		test("should fail with non-existent whiteboard", async () => {
			const result = await tryFindWhiteboardById({
				payload,
				whiteboardId: 999999,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("trySearchWhiteboards", () => {
		beforeAll(async () => {
			await tryCreateWhiteboard({
				payload,
				data: {
					title: "Searchable Whiteboard 1",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			await tryCreateWhiteboard({
				payload,
				data: {
					title: "Searchable Whiteboard 2",
					createdBy: testUser2.id,
				},
				overrideAccess: true,
				req: undefined,
			});
		});

		test("should search whiteboards by user", async () => {
			const result = await trySearchWhiteboards({
				payload,
				filters: {
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
			}
		});

		test("should search whiteboards by title", async () => {
			const result = await trySearchWhiteboards({
				payload,
				filters: {
					title: "Searchable",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBe(2);
			}
		});

		test("should return paginated results", async () => {
			const result = await trySearchWhiteboards({
				payload,
				filters: {
					limit: 1,
					page: 1,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBe(1);
				expect(result.value.totalPages).toBeGreaterThan(0);
			}
		});

		test("should return empty results for non-matching search", async () => {
			const result = await trySearchWhiteboards({
				payload,
				filters: {
					title: "NonExistentTitle12345",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBe(0);
			}
		});
	});

	describe("tryFindWhiteboardsByUser", () => {
		test("should find whiteboards by user ID", async () => {
			const result = await tryFindWhiteboardsByUser({
				payload,
				userId: testUser.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThan(0);
			}
		});

		test("should respect limit parameter", async () => {
			const result = await tryFindWhiteboardsByUser({
				payload,
				userId: testUser.id,
				limit: 1,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBe(1);
			}
		});

		test("should return empty array for user with no whiteboards", async () => {
			const result = await tryFindWhiteboardsByUser({
				payload,
				userId: 999999,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBe(0);
			}
		});
	});

	describe("tryDeleteWhiteboard", () => {
		let testWhiteboardId: number;

		beforeAll(async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Delete Me Whiteboard",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				testWhiteboardId = result.value.id;
			}
		});

		test("should delete whiteboard successfully", async () => {
			const result = await tryDeleteWhiteboard({
				payload,
				whiteboardId: testWhiteboardId,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
		});

		test("should fail with non-existent whiteboard", async () => {
			const result = await tryDeleteWhiteboard({
				payload,
				whiteboardId: 999999,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("Basic Functionality Tests", () => {
		test("should read any whiteboard with overrideAccess", async () => {
			const createResult = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Read Test Whiteboard",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const findResult = await tryFindWhiteboardById({
				payload,
				whiteboardId: createResult.value.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(findResult.ok).toBe(true);
			if (findResult.ok) {
				expect((findResult.value as any).title).toBe("Read Test Whiteboard");
			}
		});

		test("should update any whiteboard with overrideAccess", async () => {
			const createResult = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Update Test Whiteboard",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const updateResult = await tryUpdateWhiteboard({
				payload,
				whiteboardId: createResult.value.id,
				data: {
					title: "Updated Title",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(updateResult.ok).toBe(true);
			if (updateResult.ok) {
				expect((updateResult.value as any).title).toBe("Updated Title");
			}
		});

		test("should delete any whiteboard with overrideAccess", async () => {
			const createResult = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Delete Test Whiteboard",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const deleteResult = await tryDeleteWhiteboard({
				payload,
				whiteboardId: createResult.value.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(deleteResult.ok).toBe(true);
		});

		test("should search all whiteboards with overrideAccess", async () => {
			const result = await trySearchWhiteboards({
				payload,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
			}
		});
	});
});
