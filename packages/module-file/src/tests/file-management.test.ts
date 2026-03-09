import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { executeAuthStrategies, getPayload, Migration, type TypedUser } from "payload";
import sanitizedConfig from "payload.config";
import {
	tryCreateFile,
	tryDeleteFile,
	tryFindFileById,
	tryFindFilesByUser,
	trySearchFiles,
	tryUpdateFile,
} from "../services/file-management";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import {
	fileManagementTestMediaSeedData,
	fileManagementTestUserSeedData,
} from "../seeding/file-management-test-seed-data";
import { createLocalReq } from "@paideia/shared";
import { migrations } from "src/migrations";

type TestFile = {
	id: number;
	title: string;
	description?: string;
	media?: number[] | Array<{ id: number }>;
	createdBy: number | { id: number };
	createdAt: string;
	updatedAt: string;
};

describe("File Management Functions", async () => {
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
	let testMediaId1: number;
	let testMediaId2: number;

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
				data: fileManagementTestUserSeedData,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const mediaResult = (
			await userModule.seedMedia({
				data: fileManagementTestMediaSeedData,
				usersByEmail: usersResult.getUsersByEmail(),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const user1Entry = usersResult.byEmail.get("testuser1@example.com")!;
		const user2Entry = usersResult.byEmail.get("testuser2@example.com")!;
		const noUserEntry = usersResult.byEmail.get("nofiles@example.com")!;
		const adminEntry = usersResult.byEmail.get("admin@example.com")!;

		testUser = user1Entry.user;
		testUser2 = user2Entry.user;
		noUser = noUserEntry.user;

		user1Token = user1Entry.token!;
		user2Token = user2Entry.token!;
		adminToken = adminEntry.token!;

		const media1 = mediaResult.getByFilename("test-file-attachment-1.png");
		const media2 = mediaResult.getByFilename("test-file-attachment-2.png");
		testMediaId1 = media1.id;
		testMediaId2 = media2.id;
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

	describe("tryCreateFile", () => {
		test("should create a new file successfully", async () => {
			const result = await tryCreateFile({
				payload,
				data: {
					title: "My First File Resource",
					description: "Shared files for students",
					media: [testMediaId1],
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const file = result.value as any;
				expect(file.title).toBe("My First File Resource");
				expect(file.description).toBe("Shared files for students");
				expect(file.createdBy).toBe(testUser.id);
				expect(file.id).toBeDefined();
				expect(file.createdAt).toBeDefined();
			}
		});

		test("should create a file with multiple media attachments", async () => {
			const result = await tryCreateFile({
				payload,
				data: {
					title: "Multi-file Resource",
					media: [testMediaId1, testMediaId2],
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
		});

		test("should create a file with no media attachments", async () => {
			const result = await tryCreateFile({
				payload,
				data: {
					title: "Empty File Resource",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const file = result.value as any;
				expect(file.title).toBe("Empty File Resource");
			}
		});

		test("should create a file with only required fields", async () => {
			const result = await tryCreateFile({
				payload,
				data: {
					title: "Minimal File",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const file = result.value as any;
				expect(file.title).toBe("Minimal File");
				expect(file.createdBy).toBe(testUser.id);
			}
		});

		test("should trim whitespace from title", async () => {
			const result = await tryCreateFile({
				payload,
				data: {
					title: "   File with spaces   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const file = result.value as any;
				expect(file.title).toBe("File with spaces");
			}
		});

		test("should trim whitespace from description", async () => {
			const result = await tryCreateFile({
				payload,
				data: {
					title: "Test File",
					description: "   Description with spaces   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const file = result.value as any;
				expect(file.description).toBe("Description with spaces");
			}
		});

		test("should fail with empty title", async () => {
			const result = await tryCreateFile({
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
			const result = await tryCreateFile({
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
			const result = await tryCreateFile({
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
			const result = await tryCreateFile({
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
				expect((result.value as TestFile).title).toBe(maxTitle);
			}
		});

		test("should fail with non-existent user", async () => {
			const result = await tryCreateFile({
				payload,
				data: {
					title: "Test File",
					createdBy: 99999,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to create file");
			}
		});
	});

	describe("tryUpdateFile", () => {
		let testFile: { id: number };

		beforeAll(async () => {
			const result = await tryCreateFile({
				payload,
				data: {
					title: "Original Title",
					description: "Original description",
					media: [testMediaId1],
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				testFile = result.value;
			}
		});

		test("should update file title successfully", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateFile({
				payload,
				fileId: testFile.id,
				data: {
					title: "Updated Title",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/files"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestFile).title).toBe("Updated Title");
				expect(result.value.id).toBe(testFile.id);
			}
		});

		test("should update media attachments", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateFile({
				payload,
				fileId: testFile.id,
				data: {
					media: [testMediaId1, testMediaId2],
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/files"),
				}),
			});

			expect(result.ok).toBe(true);
		});

		test("should update multiple fields", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateFile({
				payload,
				fileId: testFile.id,
				data: {
					title: "New Title",
					description: "New description",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/files"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestFile).title).toBe("New Title");
				expect((result.value as TestFile).description).toBe("New description");
			}
		});

		test("should trim whitespace from updated fields", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateFile({
				payload,
				fileId: testFile.id,
				data: {
					title: "   Updated with spaces   ",
					description: "   Desc with spaces   ",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/files"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestFile).title).toBe("Updated with spaces");
				expect((result.value as TestFile).description).toBe("Desc with spaces");
			}
		});

		test("should fail with empty title", async () => {
			const result = await tryUpdateFile({
				payload,
				fileId: testFile.id,
				data: {
					title: "",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with whitespace-only title", async () => {
			const result = await tryUpdateFile({
				payload,
				fileId: testFile.id,
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
			const result = await tryUpdateFile({
				payload,
				fileId: testFile.id,
				data: {
					title: longTitle,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with non-existent file", async () => {
			const result = await tryUpdateFile({
				payload,
				fileId: 99999,
				data: {
					title: "This should fail",
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindFileById", () => {
		let testFile: { id: number };

		beforeAll(async () => {
			const result = await tryCreateFile({
				payload,
				data: {
					title: "Find Me File",
					description: "Test Description",
					media: [testMediaId1],
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			if (result.ok) {
				testFile = result.value;
			}
		});

		test("should find file by ID successfully", async () => {
			const result = await tryFindFileById({
				payload,
				fileId: testFile.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(testFile.id);
				expect((result.value as TestFile).title).toBe("Find Me File");
				expect((result.value as TestFile).description).toBe("Test Description");
				expect(result.value.createdBy.id).toBe(testUser.id);
			}
		});

		test("should find file with populated media", async () => {
			const result = await tryFindFileById({
				payload,
				fileId: testFile.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const file = result.value as any;
				expect(file.media).toBeDefined();
				expect(Array.isArray(file.media)).toBe(true);
				expect(file.media.length).toBeGreaterThan(0);
			}
		});

		test("should fail with non-existent file", async () => {
			const result = await tryFindFileById({
				payload,
				fileId: 99999,
				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to find file by ID");
			}
		});
	});

	describe("trySearchFiles", () => {
		beforeAll(async () => {
			const files = [
				{
					title: "Searchable File 1",
					description: "A searchable file resource",
					createdBy: testUser.id,
				},
				{
					title: "Searchable File 2",
					description: "Another searchable file resource",
					createdBy: testUser2.id,
				},
			];

			for (const fileData of files) {
				await tryCreateFile({
					payload,
					data: fileData,
					overrideAccess: true,
					req: undefined,
				});
			}
		});

		test("should search files by user", async () => {
			const result = await trySearchFiles({
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

		test("should search files by title", async () => {
			const result = await trySearchFiles({
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
			const result = await trySearchFiles({
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
			const result = await trySearchFiles({
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

	describe("tryFindFilesByUser", () => {
		test("should find files by user ID", async () => {
			const result = await tryFindFilesByUser({
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
			const result = await tryFindFilesByUser({
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

		test("should return empty array for user with no files", async () => {
			const result = await tryFindFilesByUser({
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

	describe("tryDeleteFile", () => {
		test("should delete file successfully", async () => {
			const createResult = await tryCreateFile({
				payload,
				data: {
					title: "File to be deleted",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteFile({
					payload,
					fileId: createResult.value.id,
					overrideAccess: true,
					req: undefined,
				});

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
					expect((deleteResult.value as TestFile).title).toBe("File to be deleted");
				}

				const findResult = await tryFindFileById({
					payload,
					fileId: createResult.value.id,
					req: undefined,
				});
				expect(findResult.ok).toBe(false);
			}
		});

		test("should fail with non-existent file", async () => {
			const result = await tryDeleteFile({
				payload,
				fileId: 99999,
				overrideAccess: true,
				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to delete file");
			}
		});
	});

	describe("Basic Functionality Tests (with overrideAccess)", () => {
		let user1File: { id: number };
		let user2File: { id: number };

		beforeAll(async () => {
			const f1 = await tryCreateFile({
				payload,
				data: {
					title: "User1 file for basic tests",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			if (f1.ok) {
				user1File = f1.value;
			}

			const f2 = await tryCreateFile({
				payload,
				data: {
					title: "User2 file for basic tests",
					createdBy: testUser2.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			if (f2.ok) {
				user2File = f2.value;
			}
		});

		test("should read any file with overrideAccess", async () => {
			const result1 = await tryFindFileById({
				payload,
				fileId: user1File.id,
				overrideAccess: true,
				req: undefined,
			});

			const result2 = await tryFindFileById({
				payload,
				fileId: user2File.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);
		});

		test("should update any file with overrideAccess", async () => {
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateFile({
				payload,
				fileId: user1File.id,
				data: {
					title: "Updated with overrideAccess",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/files"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect((result.value as TestFile).title).toBe("Updated with overrideAccess");
			}
		});

		test("should delete any file with overrideAccess", async () => {
			const createResult = await tryCreateFile({
				payload,
				data: {
					title: "File to delete with overrideAccess",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteFile({
					payload,
					fileId: createResult.value.id,
					overrideAccess: true,
					req: undefined,
				});

				expect(deleteResult.ok).toBe(true);
			}
		});

		test("should search all files with overrideAccess", async () => {
			const result = await trySearchFiles({
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
		let user1File: { id: number };

		beforeAll(async () => {
			const f1 = await tryCreateFile({
				payload,
				data: {
					title: "User1 test file",
					createdBy: testUser.id,
				},
				overrideAccess: true,
				req: undefined,
			});

			if (f1.ok) {
				user1File = f1.value;
			}
		});

		describe("Read Access Control", () => {
			test("user should be able to read their own file", async () => {
				const user1 = await getAuthUser(user1Token);

				const result = await tryFindFileById({
					payload,
					fileId: user1File.id,
					req: { user: user1 },
					overrideAccess: false,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect((result.value as TestFile).title).toBe("User1 test file");
				}
			});

			test("unauthenticated request should fail to read files", async () => {
				const result = await tryFindFileById({
					payload,
					fileId: user1File.id,
					overrideAccess: false,
					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Update Access Control", () => {
			test("unauthenticated request should fail to update files", async () => {
				const result = await tryUpdateFile({
					payload,
					fileId: user1File.id,
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
			test("unauthenticated request should fail to delete files", async () => {
				const result = await tryDeleteFile({
					payload,
					fileId: user1File.id,
					overrideAccess: false,
					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Search with Access Control", () => {
			test("unauthenticated search should fail", async () => {
				const result = await trySearchFiles({
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
			test("unauthenticated request should fail to create files", async () => {
				const result = await tryCreateFile({
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
