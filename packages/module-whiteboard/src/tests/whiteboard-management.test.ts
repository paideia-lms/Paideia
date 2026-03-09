import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { executeAuthStrategies, getPayload, Migration, type TypedUser } from "payload";
import sanitizedConfig from "payload.config";
import {
	tryCreateWhiteboard,
	tryDeleteWhiteboard,
	tryFindWhiteboardById,
	tryFindWhiteboardsByUser,
	trySearchWhiteboards,
	tryUpdateWhiteboard,
} from "../services/whiteboard-management";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import {
	whiteboardManagementTestMediaSeedData,
	whiteboardManagementTestUserSeedData,
} from "../seeding/whiteboard-management-test-seed-data";
import { createLocalReq } from "@paideia/shared";
import { migrations } from "src/migrations";

type TestWhiteboard = {
	id: number;
	title: string;
	description?: string;
	content?: string;
	createdBy: number | { id: number };
	createdAt: string;
	updatedAt: string;
};

describe("Whiteboard Management Functions", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let testUser: { id: number };
	let testUser2: { id: number };
	let noUser: { id: number };
	let user1Token: string;
	let user2Token: string;
	let adminToken: string;
	let testMediaId: number;
	let _testMediaFilename: string;

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
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		const usersResult = (
			await userModule.seedUsers({
				data: whiteboardManagementTestUserSeedData,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const mediaResult = (
			await userModule.seedMedia({
				data: whiteboardManagementTestMediaSeedData,
				usersByEmail: usersResult.getUsersByEmail(),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const user1Entry = usersResult.byEmail.get("testuser1@example.com")!;
		const user2Entry = usersResult.byEmail.get("testuser2@example.com")!;
		const noUserEntry = usersResult.byEmail.get("nowhiteboards@example.com")!;
		const adminEntry = usersResult.byEmail.get("admin@example.com")!;

		testUser = user1Entry.user;
		testUser2 = user2Entry.user;
		noUser = noUserEntry.user;

		user1Token = user1Entry.token!;
		user2Token = user2Entry.token!;
		adminToken = adminEntry.token!;

		const testMedia = mediaResult.getByFilename("test-whiteboard-media.png");
		testMediaId = testMedia.id;
		_testMediaFilename = testMedia.filename ?? "";
	});

	afterAll(async () => {
		try {
			await infrastructureModule.migrateFresh({
				migrations: migrations as Migration[],
				forceAcceptWarning: true,
			});
			await infrastructureModule.cleanS3();
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
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
					content: "   {}   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const whiteboard = result.value as any;
				expect(whiteboard.description).toBe("Description with spaces");
				expect(whiteboard.content).toBe("{}");
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
					title: "   \n\t   ",
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
			const maxTitle = "a".repeat(500);
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: maxTitle,
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestWhiteboard).title).toBe(maxTitle);
			}
		});

		test("should fail with non-existent user", async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Test Whiteboard",
					createdBy: 99999,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to create whiteboard");
			}
		});
	});

	describe("tryUpdateWhiteboard", () => {
		let testWhiteboard: { id: number };

		beforeAll(async () => {
			const result = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Original Title",
					description: "Original Description",
					content: JSON.stringify({ elements: [] }),
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				testWhiteboard = result.value;
			}
		});

		test("should update whiteboard title successfully", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboard.id,
				data: {
					title: "Updated Title",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/whiteboards"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestWhiteboard).title).toBe("Updated Title");
				expect(result.value.id).toBe(testWhiteboard.id);
			}
		});

		test("should update multiple fields", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboard.id,
				data: {
					title: "New Title",
					description: "New Description",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/whiteboards"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestWhiteboard).title).toBe("New Title");
				expect((result.value as TestWhiteboard).description).toBe("New Description");
			}
		});

		test("should trim whitespace from updated fields", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboard.id,
				data: {
					title: "   Updated with spaces   ",
					description: "   Desc with spaces   ",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/whiteboards"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestWhiteboard).title).toBe("Updated with spaces");
				expect((result.value as TestWhiteboard).description).toBe("Desc with spaces");
			}
		});

		test("should fail with empty title", async () => {
			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: testWhiteboard.id,
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
				whiteboardId: testWhiteboard.id,
				data: {
					title: "   \n\t   ",
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
				whiteboardId: testWhiteboard.id,
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
				whiteboardId: 99999,
				data: {
					title: "This should fail",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindWhiteboardById", () => {
		let testWhiteboard: { id: number };

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
				testWhiteboard = result.value;
			}
		});

		test("should find whiteboard by ID successfully", async () => {
			const result = await tryFindWhiteboardById({
				payload,
				whiteboardId: testWhiteboard.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(testWhiteboard.id);
				expect((result.value as TestWhiteboard).title).toBe("Find Me Whiteboard");
				expect((result.value as TestWhiteboard).description).toBe("Test Description");
				expect(result.value.createdBy.id).toBe(testUser.id);
			}
		});

		test("should fail with non-existent whiteboard", async () => {
			const result = await tryFindWhiteboardById({
				payload,
				whiteboardId: 99999,
				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to find whiteboard by ID");
			}
		});
	});

	describe("trySearchWhiteboards", () => {
		beforeAll(async () => {
			const whiteboards = [
				{
					title: "Searchable Whiteboard 1",
					description: "A searchable whiteboard",
					content: JSON.stringify({ elements: [{ type: "rectangle" }] }),
					createdBy: testUser.id,
				},
				{
					title: "Searchable Whiteboard 2",
					description: "Another searchable whiteboard",
					content: JSON.stringify({ elements: [{ type: "circle" }] }),
					createdBy: testUser2.id,
				},
			];

			for (const wbData of whiteboards) {
				await tryCreateWhiteboard({
					payload,
					data: wbData,
					overrideAccess: true,
					req: undefined,
				});
			}
		});

		test("should search whiteboards by user", async () => {
			const result = await trySearchWhiteboards({
				payload,
				filters: {
					createdBy: testUser.id,
					limit: 10,
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
					limit: 10,
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
					limit: 2,
					page: 1,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeLessThanOrEqual(2);
				expect(result.value.limit).toBe(2);
				expect(result.value.page).toBe(1);
				expect(result.value.totalDocs).toBeDefined();
				expect(result.value.totalPages).toBeDefined();
			}
		});

		test("should return empty results for non-matching search", async () => {
			const result = await trySearchWhiteboards({
				payload,
				filters: {
					title: "nonexistenttitle12345",
					limit: 10,
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
				limit: 10,
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
				expect(result.value.length).toBeLessThanOrEqual(1);
			}
		});

		test("should return empty array for user with no whiteboards", async () => {
			const result = await tryFindWhiteboardsByUser({
				payload,
				userId: noUser.id,
				limit: 10,
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
		test("should delete whiteboard successfully", async () => {
			const createResult = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Whiteboard to be deleted",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteWhiteboard({
					payload,
					whiteboardId: createResult.value.id,
					overrideAccess: true,
					req: undefined,
				});

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
					expect((deleteResult.value as TestWhiteboard).title).toBe("Whiteboard to be deleted");
				}

				const findResult = await tryFindWhiteboardById({
					payload,
					whiteboardId: createResult.value.id,
					req: undefined,
				});
				expect(findResult.ok).toBe(false);
			}
		});

		test("should fail with non-existent whiteboard", async () => {
			const result = await tryDeleteWhiteboard({
				payload,
				whiteboardId: 99999,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to delete whiteboard");
			}
		});
	});

	describe("Basic Functionality Tests (with overrideAccess)", () => {
		let user1Whiteboard: { id: number };
		let user2Whiteboard: { id: number };

		beforeAll(async () => {
			const wb1 = await tryCreateWhiteboard({
				payload,
				data: {
					title: "User1 whiteboard for basic tests",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			if (wb1.ok) {
				user1Whiteboard = wb1.value;
			}

			const wb2 = await tryCreateWhiteboard({
				payload,
				data: {
					title: "User2 whiteboard for basic tests",
					createdBy: testUser2.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			if (wb2.ok) {
				user2Whiteboard = wb2.value;
			}
		});

		test("should read any whiteboard with overrideAccess", async () => {
			const result1 = await tryFindWhiteboardById({
				payload,
				whiteboardId: user1Whiteboard.id,
				overrideAccess: true,
				req: undefined,
			});

			const result2 = await tryFindWhiteboardById({
				payload,
				whiteboardId: user2Whiteboard.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);
		});

		test("should update any whiteboard with overrideAccess", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateWhiteboard({
				payload,
				whiteboardId: user1Whiteboard.id,
				data: {
					title: "Updated with overrideAccess",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/whiteboards"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestWhiteboard).title).toBe("Updated with overrideAccess");
			}
		});

		test("should delete any whiteboard with overrideAccess", async () => {
			const createResult = await tryCreateWhiteboard({
				payload,
				data: {
					title: "Whiteboard to delete with overrideAccess",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteWhiteboard({
					payload,
					whiteboardId: createResult.value.id,
					overrideAccess: true,
					req: undefined,
				});

				expect(deleteResult.ok).toBe(true);
			}
		});

		test("should search all whiteboards with overrideAccess", async () => {
			const result = await trySearchWhiteboards({
				payload,
				filters: {
					limit: 100,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Access Control Tests (without overrideAccess)", () => {
		let user1Whiteboard: { id: number };

		beforeAll(async () => {
			const wb1 = await tryCreateWhiteboard({
				payload,
				data: {
					title: "User1 test whiteboard",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			if (wb1.ok) {
				user1Whiteboard = wb1.value;
			}
		});

		describe("Read Access Control", () => {
			test("user should be able to read their own whiteboard", async () => {
				const user1 = await getAuthUser(user1Token);

				const result = await tryFindWhiteboardById({
					payload,
					whiteboardId: user1Whiteboard.id,
					req: { user: user1 },
					overrideAccess: false,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect((result.value as TestWhiteboard).title).toBe("User1 test whiteboard");
				}
			});

			test("unauthenticated request should fail to read whiteboards", async () => {
				const result = await tryFindWhiteboardById({
					payload,
					whiteboardId: user1Whiteboard.id,
					overrideAccess: false,
					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Update Access Control", () => {
			test("unauthenticated request should fail to update whiteboards", async () => {
				const result = await tryUpdateWhiteboard({
					payload,
					whiteboardId: user1Whiteboard.id,
					data: {
						title: "Trying to update without auth",
					},
					overrideAccess: false,
					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Delete Access Control", () => {
			test("unauthenticated request should fail to delete whiteboards", async () => {
				const result = await tryDeleteWhiteboard({
					payload,
					whiteboardId: user1Whiteboard.id,
					overrideAccess: false,
					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Search with Access Control", () => {
			test("unauthenticated search should fail", async () => {
				const result = await trySearchWhiteboards({
					payload,
					filters: {
						limit: 10,
					},
					overrideAccess: false,
					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Create with Authentication", () => {
			test("unauthenticated request should fail to create whiteboards", async () => {
				const result = await tryCreateWhiteboard({
					payload,
					data: {
						title: "Trying to create without auth",
						createdBy: testUser.id,
					},
					overrideAccess: false,
					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});
	});
});
