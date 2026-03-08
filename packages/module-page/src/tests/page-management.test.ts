import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { executeAuthStrategies, getPayload, Migration, type TypedUser } from "payload";
import sanitizedConfig from "payload.config";
import {
	tryCreatePage,
	tryDeletePage,
	tryFindPageById,
	tryFindPagesByUser,
	trySearchPages,
	tryUpdatePage,
} from "../services/page-management";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import {
	pageManagementTestMediaSeedData,
	pageManagementTestUserSeedData,
} from "../seeding/page-management-test-seed-data";
import { createLocalReq } from "@paideia/shared";
import { migrations } from "src/migrations";

type TestPage = {
	id: number;
	title: string;
	description?: string;
	content?: string;
	createdBy: number | { id: number };
	createdAt: string;
	updatedAt: string;
};

describe("Page Management Functions", async () => {
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
				data: pageManagementTestUserSeedData,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const mediaResult = (
			await userModule.seedMedia({
				data: pageManagementTestMediaSeedData,
				usersByEmail: usersResult.getUsersByEmail(),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const user1Entry = usersResult.byEmail.get("testuser1@example.com")!;
		const user2Entry = usersResult.byEmail.get("testuser2@example.com")!;
		const noUserEntry = usersResult.byEmail.get("nopages@example.com")!;
		const adminEntry = usersResult.byEmail.get("admin@example.com")!;

		testUser = user1Entry.user;
		testUser2 = user2Entry.user;
		noUser = noUserEntry.user;

		user1Token = user1Entry.token!;
		user2Token = user2Entry.token!;
		adminToken = adminEntry.token!;

		const testMedia = mediaResult.getByFilename("test-page-media.png");
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

	describe("tryCreatePage", () => {
		test("should create a new page successfully", async () => {
			const result = await tryCreatePage({
				payload,
				data: {
					title: "My First Page",
					description: "This is a test page",
					content: "Page content goes here",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const page = result.value as any;
				expect(page.title).toBe("My First Page");
				expect(page.description).toBe("This is a test page");
				expect(page.content).toBe("Page content goes here");
				expect(page.createdBy).toBe(testUser.id);
				expect(page.id).toBeDefined();
				expect(page.createdAt).toBeDefined();
			}
		});

		test("should create a page with only required fields", async () => {
			const result = await tryCreatePage({
				payload,
				data: {
					title: "Minimal Page",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const page = result.value as any;
				expect(page.title).toBe("Minimal Page");
				expect(page.createdBy).toBe(testUser.id);
			}
		});

		test("should trim whitespace from title", async () => {
			const result = await tryCreatePage({
				payload,
				data: {
					title: "   Page with spaces   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const page = result.value as any;
				expect(page.title).toBe("Page with spaces");
			}
		});

		test("should trim whitespace from description and content", async () => {
			const result = await tryCreatePage({
				payload,
				data: {
					title: "Test Page",
					description: "   Description with spaces   ",
					content: "   Content with spaces   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const page = result.value as any;
				expect(page.description).toBe("Description with spaces");
				expect(page.content).toBe("Content with spaces");
			}
		});

		test("should fail with empty title", async () => {
			const result = await tryCreatePage({
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
			const result = await tryCreatePage({
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
			const result = await tryCreatePage({
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
			const result = await tryCreatePage({
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
				expect((result.value as TestPage).title).toBe(maxTitle);
			}
		});

		test("should fail with non-existent user", async () => {
			const result = await tryCreatePage({
				payload,
				data: {
					title: "Test Page",
					createdBy: 99999,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to create page");
			}
		});
	});

	describe("tryUpdatePage", () => {
		let testPage: { id: number };

		beforeAll(async () => {
			const result = await tryCreatePage({
				payload,
				data: {
					title: "Original Title",
					description: "Original description",
					content: "Original content",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				testPage = result.value;
			}
		});

		test("should update page title successfully", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdatePage({
				payload,
				pageId: testPage.id,
				data: {
					title: "Updated Title",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/pages"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestPage).title).toBe("Updated Title");
				expect(result.value.id).toBe(testPage.id);
			}
		});

		test("should update multiple fields", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdatePage({
				payload,
				pageId: testPage.id,
				data: {
					title: "New Title",
					description: "New description",
					content: "New content",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/pages"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestPage).title).toBe("New Title");
				expect((result.value as TestPage).description).toBe("New description");
				expect(result.value.content).toBe("New content");
			}
		});

		test("should trim whitespace from updated fields", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdatePage({
				payload,
				pageId: testPage.id,
				data: {
					title: "   Updated with spaces   ",
					description: "   Desc with spaces   ",
					content: "   Content with spaces   ",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/pages"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestPage).title).toBe("Updated with spaces");
				expect((result.value as TestPage).description).toBe("Desc with spaces");
				expect(result.value.content).toBe("Content with spaces");
			}
		});

		test("should fail with empty title", async () => {
			const result = await tryUpdatePage({
				payload,
				pageId: testPage.id,
				data: {
					title: "",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with whitespace-only title", async () => {
			const result = await tryUpdatePage({
				payload,
				pageId: testPage.id,
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
			const result = await tryUpdatePage({
				payload,
				pageId: testPage.id,
				data: {
					title: longTitle,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with non-existent page", async () => {
			const result = await tryUpdatePage({
				payload,
				pageId: 99999,
				data: {
					title: "This should fail",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindPageById", () => {
		let testPage: { id: number };

		beforeAll(async () => {
			const result = await tryCreatePage({
				payload,
				data: {
					title: "Page for finding",
					description: "Test description",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				testPage = result.value;
			}
		});

		test("should find page by ID successfully", async () => {
			const result = await tryFindPageById({
				payload,
				pageId: testPage.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(testPage.id);
				expect((result.value as TestPage).title).toBe("Page for finding");
				expect((result.value as TestPage).description).toBe("Test description");
				expect(result.value.createdBy.id).toBe(testUser.id);
			}
		});

		test("should fail with non-existent page", async () => {
			const result = await tryFindPageById({
				payload,
				pageId: 99999,
				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to find page by ID");
			}
		});
	});

	describe("trySearchPages", () => {
		beforeAll(async () => {
			const pages = [
				{
					title: "Learning Guide",
					description: "A guide about learning",
					content: "Content about learning",
					createdBy: testUser.id,
				},
				{
					title: "Coding Tutorial",
					description: "A coding tutorial",
					content: "Content about coding",
					createdBy: testUser.id,
				},
				{
					title: "Math Notes",
					description: "Mathematics notes",
					content: "Advanced mathematics",
					createdBy: testUser2.id,
				},
				{
					title: "Programming Tips",
					description: "Programming tips and tricks",
					content: "Advanced programming",
					createdBy: testUser2.id,
				},
			];

			for (const pageData of pages) {
				await tryCreatePage({
					payload,
					data: pageData,
					overrideAccess: true,
					req: undefined,
				});
			}
		});

		test("should search pages by user", async () => {
			const result = await trySearchPages({
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
				result.value.docs.forEach((page) => {
					if (typeof page.createdBy === "object") {
						expect(page.createdBy.id).toBe(testUser.id);
					} else {
						expect(page.createdBy).toBe(testUser.id);
					}
				});
			}
		});

		test("should search pages by title", async () => {
			const result = await trySearchPages({
				payload,
				filters: {
					title: "Guide",
					limit: 10,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				result.value.docs.forEach((page) => {
					expect(page.title.toLowerCase()).toContain("guide");
				});
			}
		});

		test("should search pages by content", async () => {
			const result = await trySearchPages({
				payload,
				filters: {
					content: "coding",
					limit: 10,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				result.value.docs.forEach((page) => {
					expect(page.content?.toLowerCase()).toContain("coding");
				});
			}
		});

		test("should return paginated results", async () => {
			const result = await trySearchPages({
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
			const result = await trySearchPages({
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

	describe("tryFindPagesByUser", () => {
		test("should find pages by user ID", async () => {
			const result = await tryFindPagesByUser({
				payload,
				userId: testUser.id,
				limit: 10,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThan(0);
				result.value.forEach((page) => {
					if (typeof page.createdBy === "object") {
						expect(page.createdBy.id).toBe(testUser.id);
					} else {
						expect(page.createdBy).toBe(testUser.id);
					}
				});
			}
		});

		test("should respect limit parameter", async () => {
			const result = await tryFindPagesByUser({
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

		test("should return empty array for user with no pages", async () => {
			const result = await tryFindPagesByUser({
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

	describe("tryDeletePage", () => {
		test("should delete page successfully", async () => {
			const createResult = await tryCreatePage({
				payload,
				data: {
					title: "Page to be deleted",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeletePage({
					payload,
					pageId: createResult.value.id,
					overrideAccess: true,
					req: undefined,
				});

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
					expect((deleteResult.value as TestPage).title).toBe("Page to be deleted");
				}

				const findResult = await tryFindPageById({
					payload,
					pageId: createResult.value.id,
					req: undefined,
				});
				expect(findResult.ok).toBe(false);
			}
		});

		test("should fail with non-existent page", async () => {
			const result = await tryDeletePage({
				payload,
				pageId: 99999,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to delete page");
			}
		});
	});

	describe("Basic Functionality Tests (with overrideAccess)", () => {
		let user1Page: { id: number };
		let user2Page: { id: number };

		beforeAll(async () => {
			const page1 = await tryCreatePage({
				payload,
				data: {
					title: "User1 page for basic tests",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			if (page1.ok) {
				user1Page = page1.value;
			}

			const page2 = await tryCreatePage({
				payload,
				data: {
					title: "User2 page for basic tests",
					createdBy: testUser2.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			if (page2.ok) {
				user2Page = page2.value;
			}
		});

		test("should read any page with overrideAccess", async () => {
			const result1 = await tryFindPageById({
				payload,
				pageId: user1Page.id,
				overrideAccess: true,
				req: undefined,
			});

			const result2 = await tryFindPageById({
				payload,
				pageId: user2Page.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);
		});

		test("should update any page with overrideAccess", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdatePage({
				payload,
				pageId: user1Page.id,
				data: {
					title: "Updated with overrideAccess",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/pages"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestPage).title).toBe("Updated with overrideAccess");
			}
		});

		test("should delete any page with overrideAccess", async () => {
			const createResult = await tryCreatePage({
				payload,
				data: {
					title: "Page to delete with overrideAccess",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeletePage({
					payload,
					pageId: createResult.value.id,
					overrideAccess: true,
					req: undefined,
				});

				expect(deleteResult.ok).toBe(true);
			}
		});

		test("should search all pages with overrideAccess", async () => {
			const result = await trySearchPages({
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
		let user1Page: { id: number };

		beforeAll(async () => {
			const page1 = await tryCreatePage({
				payload,
				data: {
					title: "User1 test page",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			if (page1.ok) {
				user1Page = page1.value;
			}
		});

		describe("Read Access Control", () => {
			test("user should be able to read their own page", async () => {
				const user1 = await getAuthUser(user1Token);

				const result = await tryFindPageById({
					payload,
					pageId: user1Page.id,
					req: { user: user1 },
					overrideAccess: false,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect((result.value as TestPage).title).toBe("User1 test page");
				}
			});

			test("unauthenticated request should fail to read pages", async () => {
				const result = await tryFindPageById({
					payload,
					pageId: user1Page.id,
					overrideAccess: false,
					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Update Access Control", () => {
			test("unauthenticated request should fail to update pages", async () => {
				const result = await tryUpdatePage({
					payload,
					pageId: user1Page.id,
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
			test("unauthenticated request should fail to delete pages", async () => {
				const result = await tryDeletePage({
					payload,
					pageId: user1Page.id,
					overrideAccess: false,
					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Search with Access Control", () => {
			test("unauthenticated search should fail", async () => {
				const result = await trySearchPages({
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
			test("unauthenticated request should fail to create pages", async () => {
				const result = await tryCreatePage({
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
