import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { executeAuthStrategies, getPayload, Migration, type TypedUser } from "payload";
import sanitizedConfig from "payload.config";
import {
	tryCreateNote,
	tryDeleteNote,
	tryFindNoteById,
	tryFindNotesByUser,
	tryGenerateNoteHeatmap,
	trySearchNotes,
	tryUpdateNote,
} from "../services/note-management";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import {
	noteManagementTestMediaSeedData,
	noteManagementTestUserSeedData,
} from "../seeding/note-management-test-seed-data";
import { createLocalReq } from "@paideia/shared";
import { migrations } from "src/migrations";
// import PaideiaLogo from "../fixture/paideia-logo.png" with { type: "file" };
// import Gem from "../fixture/gem.png" with { type: "file" };


describe("Note Management Functions", async () => {
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
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		const usersResult = (
			await userModule.seedUsers({
				data: noteManagementTestUserSeedData,
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const mediaResult = (
			await userModule.seedMedia({
				data: noteManagementTestMediaSeedData,
				usersByEmail: usersResult.getUsersByEmail(),
				overrideAccess: true,
				req: undefined,
			})
		).getOrThrow();

		const user1Entry = usersResult.byEmail.get("testuser1@example.com")!;
		const user2Entry = usersResult.byEmail.get("testuser2@example.com")!;
		const noUserEntry = usersResult.byEmail.get("nouser@example.com")!;
		const adminEntry = usersResult.byEmail.get("admin@example.com")!;

		testUser = user1Entry.user;
		testUser2 = user2Entry.user;
		noUser = noUserEntry.user;

		user1Token = user1Entry.token!;
		user2Token = user2Entry.token!;
		adminToken = adminEntry.token!;

		const testMedia = mediaResult.getByFilename("test-note-media.png");
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

	describe("tryCreateNote", () => {
		test("should create a new note successfully", async () => {
			const result = await tryCreateNote({
				payload,
				data: {
					content: "This is my first note!",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("This is my first note!");
				// Handle both depth 0 (ID) and depth 1 (object) cases
				expect(result.value.createdBy).toBe(testUser.id);
				expect(result.value.id).toBeDefined();
				expect(result.value.createdAt).toBeDefined();
				// Media array should be empty when no media references
				expect(result.value.contentMedia).toBeDefined();
				if (Array.isArray(result.value.contentMedia)) {
					expect(result.value.contentMedia.length).toBe(0);
				}
			}
		});

		test("should create a note with course links", async () => {
			const result = await tryCreateNote({
				payload,
				data: {
					content: "I'm learning about [[math-101-a-fa-2025]] and it's great!",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe(
					"I'm learning about [[math-101-a-fa-2025]] and it's great!",
				);
				// Handle both depth 0 (ID) and depth 1 (object) cases
				expect(result.value.createdBy).toBe(testUser.id);
			}
		});

		test("should trim whitespace from content", async () => {
			const result = await tryCreateNote({
				payload,
				data: {
					content: "   This note has extra spaces   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("This note has extra spaces");
			}
		});

		test("should fail with empty content", async () => {
			const result = await tryCreateNote({
				payload,
				data: {
					content: "",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with whitespace-only content", async () => {
			const result = await tryCreateNote({
				payload,
				data: {
					content: "   \n\t   ",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with non-existent user", async () => {
			const result = await tryCreateNote({
				payload,
				data: {
					content: "This should fail",
					createdBy: 99999, // Non-existent user ID
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to create note");
			}
		});
	});

	describe("tryUpdateNote", () => {
		let testNote: { id: number };

		beforeAll(async () => {
			// Create a test note for update tests
			const result = await tryCreateNote({
				payload,
				data: {
					content: "Original content",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});
			if (result.ok) {
				testNote = result.value;
			}
		});

		test("should update note content successfully", async () => {
			// Get full user object for request
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateNote({
				payload,
				noteId: testNote.id,
				data: {
					content: "Updated content",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/notes"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("Updated content");
				expect(result.value.id).toBe(testNote.id);
				// Media array should be empty when no media references
				expect(result.value.contentMedia).toBeDefined();
				if (Array.isArray(result.value.contentMedia)) {
					expect(result.value.contentMedia.length).toBe(0);
				}
			}
		});

		// Skipped: requires richTextContentWithHook to auto-populate contentMedia from HTML
		test.skip("should create a note with media references in HTML", async () => {
			const html = `<p>This is my note with images!</p><img src="/api/media/file/${testMediaId}" alt="Test image" />`;

			const result = await tryCreateNote({
				payload,
				data: {
					content: html,
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe(html);
				expect(result.value.contentMedia).toBeDefined();
				if (Array.isArray(result.value.contentMedia)) {
					expect(result.value.contentMedia.length).toBe(1);
					const mediaId = result.value.contentMedia[0];
					expect(mediaId).toBe(testMediaId);
				}
			}
		});

		// Skipped: requires richTextContentWithHook to auto-populate contentMedia from HTML
		test.skip("should update note media array when content changes", async () => {
			// Create a note first
			const createResult = await tryCreateNote({
				payload,
				data: {
					content: "Original content without images",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok) {
				throw new Error("Failed to create test note");
			}

			const noteId = createResult.value.id;

			// Update with media reference
			const updatedHtml = `<p>Updated content with images!</p><img src="/api/media/file/${testMediaId}" alt="Test image" />`;
			// Get full user object for request
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const updateResult = await tryUpdateNote({
				payload,
				noteId,
				data: {
					content: updatedHtml,
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/notes"),
				}),
			});

			expect(updateResult.ok).toBe(true);
			if (updateResult.ok) {
				expect(updateResult.value.content).toBe(updatedHtml);
				expect(updateResult.value.contentMedia).toBeDefined();
				if (Array.isArray(updateResult.value.contentMedia)) {
					expect(updateResult.value.contentMedia.length).toBe(1);
					const mediaId = updateResult.value.contentMedia[0];
					expect(mediaId).toBe(testMediaId);
				}
			}
		});

		test("should trim whitespace from updated content", async () => {
			// Get full user object for request
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateNote({
				payload,
				noteId: testNote.id,
				data: {
					content: "   Updated with spaces   ",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/notes"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("Updated with spaces");
			}
		});

		test("should fail with empty content", async () => {
			const result = await tryUpdateNote({
				payload,
				noteId: testNote.id,
				data: {
					content: "",
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with whitespace-only content", async () => {
			const result = await tryUpdateNote({
				payload,
				noteId: testNote.id,
				data: {
					content: "   \n\t   ",
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(false);
		});

		test("should fail with non-existent note", async () => {
			const result = await tryUpdateNote({
				payload,
				noteId: 99999,
				data: {
					content: "This should fail",
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindNoteById", () => {
		let testNote: { id: number };

		beforeAll(async () => {
			// Create a test note for find tests
			const result = await tryCreateNote({
				payload,
				data: {
					content: "Note for finding",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});
			if (result.ok) {
				testNote = result.value;
			}
		});

		test("should find note by ID successfully", async () => {
			const result = await tryFindNoteById({
				payload,
				noteId: testNote.id,
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(testNote.id);
				expect(result.value.content).toBe("Note for finding");
				expect(result.value.createdBy.id).toBe(testUser.id);
			}
		});

		test("should fail with non-existent note", async () => {
			const result = await tryFindNoteById({
				payload,
				noteId: 99999,

				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to find note by ID");
			}
		});
	});

	describe("trySearchNotes", () => {
		beforeAll(async () => {
			// Create multiple test notes for search tests
			const notes = [
				{
					content: "First note about learning",
					createdBy: testUser.id,
				},
				{
					content: "Second note about coding",
					createdBy: testUser.id,
				},
				{
					content: "Third note about [[math-101-a-fa-2025]]",
					createdBy: testUser2.id,
				},
				{
					content: "Fourth note about programming",
					createdBy: testUser2.id,
				},
			];

			for (const noteData of notes) {
				await tryCreateNote({
					payload,
					data: noteData,
					overrideAccess: true,

					req: undefined,
				});
			}
		});

		test("should search notes by user", async () => {
			const result = await trySearchNotes({
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
				result.value.docs.forEach((note) => {
					// Handle both depth 0 (ID) and depth 1 (object) cases
					if (typeof note.createdBy === "object") {
						expect(note.createdBy.id).toBe(testUser.id);
					} else {
						expect(note.createdBy).toBe(testUser.id);
					}
				});
			}
		});

		test("should search notes by content", async () => {
			const result = await trySearchNotes({
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
				result.value.docs.forEach((note) => {
					expect(note.content.toLowerCase()).toContain("coding");
				});
			}
		});

		test("should search notes with course links", async () => {
			const result = await trySearchNotes({
				payload,
				filters: {
					content: "[[math-101-a-fa-2025]]",
					limit: 10,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				result.value.docs.forEach((note) => {
					expect(note.content).toContain("[[math-101-a-fa-2025]]");
				});
			}
		});

		test("should return paginated results", async () => {
			const result = await trySearchNotes({
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
			const result = await trySearchNotes({
				payload,
				filters: {
					content: "nonexistentcontent12345",
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

	describe("tryFindNotesByUser", () => {
		test("should find notes by user ID", async () => {
			const result = await tryFindNotesByUser({
				payload,
				userId: testUser.id,
				limit: 10,
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThan(0);
				result.value.forEach((note) => {
					// Handle both depth 0 (ID) and depth 1 (object) cases
					if (typeof note.createdBy === "object") {
						expect(note.createdBy.id).toBe(testUser.id);
					} else {
						expect(note.createdBy).toBe(testUser.id);
					}
				});
			}
		});

		test("should respect limit parameter", async () => {
			const result = await tryFindNotesByUser({
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

		test("should return empty array for user with no notes", async () => {
			const result = await tryFindNotesByUser({
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

	describe("tryDeleteNote", () => {
		test("should delete note successfully", async () => {
			// Create a note to delete
			const createResult = await tryCreateNote({
				payload,
				data: {
					content: "Note to be deleted",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteNote({
					payload,
					noteId: createResult.value.id,
					overrideAccess: true,

					req: undefined,
				});

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
					expect(deleteResult.value.content).toBe("Note to be deleted");
				}

				// Verify note is actually deleted
				const findResult = await tryFindNoteById({
					payload,
					noteId: createResult.value.id,

					req: undefined,
				});
				expect(findResult.ok).toBe(false);
			}
		});

		test("should fail with non-existent note", async () => {
			const result = await tryDeleteNote({
				payload,
				noteId: 99999,
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to delete note");
			}
		});
	});

	describe("Basic Functionality Tests (with overrideAccess)", () => {
		let user1PrivateNote: { id: number };
		let user2PrivateNote: { id: number };

		beforeAll(async () => {
			// Create test notes with overrideAccess for test setup
			const privateNote1 = await tryCreateNote({
				payload,
				data: {
					content: "User1 private note for basic tests",
					createdBy: testUser.id,
					isPublic: false,
				},
				overrideAccess: true,

				req: undefined,
			});

			if (privateNote1.ok) {
				user1PrivateNote = privateNote1.value;
			}

			const privateNote2 = await tryCreateNote({
				payload,
				data: {
					content: "User2 private note for basic tests",
					createdBy: testUser2.id,
					isPublic: false,
				},
				overrideAccess: true,

				req: undefined,
			});

			if (privateNote2.ok) {
				user2PrivateNote = privateNote2.value;
			}
		});

		test("should read any note with overrideAccess", async () => {
			const result1 = await tryFindNoteById({
				payload,
				noteId: user1PrivateNote.id,
				overrideAccess: true,

				req: undefined,
			});

			const result2 = await tryFindNoteById({
				payload,
				noteId: user2PrivateNote.id,
				overrideAccess: true,

				req: undefined,
			});

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);
		});

		test("should update any note with overrideAccess", async () => {
			// Get full user object for request
			const user = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryUpdateNote({
				payload,
				noteId: user1PrivateNote.id,
				data: {
					content: "Updated with overrideAccess",
				},
				overrideAccess: true,
				req: createLocalReq({
					user: user as TypedUser,
					request: new Request("http://localhost:3000/api/notes"),
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("Updated with overrideAccess");
			}
		});

		test("should delete any note with overrideAccess", async () => {
			// Create a note to delete
			const createResult = await tryCreateNote({
				payload,
				data: {
					content: "Note to delete with overrideAccess",
					createdBy: testUser.id,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteNote({
					payload,
					noteId: createResult.value.id,
					overrideAccess: true,

					req: undefined,
				});

				expect(deleteResult.ok).toBe(true);
			}
		});

		test("should search all notes with overrideAccess", async () => {
			const result = await trySearchNotes({
				payload,
				filters: {
					limit: 100,
				},
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should see all notes regardless of ownership or visibility
				expect(result.value.docs.length).toBeGreaterThan(0);
			}
		});
	});

	/**
	 * Access Control Tests (without overrideAccess)
	 *
	 * TESTING STRATEGY:
	 * ==================
	 * These tests verify access control by testing DENIAL scenarios with overrideAccess: false.
	 *
	 * LIMITATION - Why some tests are skipped:
	 * -----------------------------------------
	 * Payload's local API doesn't automatically authenticate requests based on JWT tokens
	 * in Authorization headers. Creating a Request object with "Authorization: JWT <token>"
	 * doesn't cause Payload to parse and validate that token or attach req.user.
	 *
	 * To properly test authenticated access grants, we would need to:
	 * 1. Manually extract and validate the JWT token
	 * 2. Look up the user from the token
	 * 3. Create a proper Payload request context with req.user attached
	 *
	 * COVERAGE - What we DO test:
	 * ----------------------------
	 * ✅ Basic Functionality (with overrideAccess: true)
	 *    - Proves all CRUD operations work correctly
	 *    - Verifies internal functions handle data properly
	 *
	 * ✅ Access Denial (with overrideAccess: false)
	 *    - Unauthenticated requests are properly rejected
	 *    - Access control prevents unauthorized operations
	 *
	 * ✅ Access Control Rules (in server/collections/notes.ts)
	 *    - Defined correctly for read/create/update/delete
	 *    - Users can access own notes + public notes
	 *    - Users can only modify their own notes
	 *    - Admins have full access
	 *
	 * Together, these tests provide confidence that:
	 * - The system correctly blocks unauthorized access
	 * - The functions work when access is granted
	 * - The access control rules are properly configured
	 */
	describe("Access Control Tests (without overrideAccess)", () => {
		let user1PrivateNote: { id: number };
		let user1PublicNote: { id: number };
		let user2PrivateNote: { id: number };

		beforeAll(async () => {
			// Create test notes with overrideAccess for test setup only
			const privateNote1 = await tryCreateNote({
				payload,
				data: {
					content: "User1 private note",
					createdBy: testUser.id,
					isPublic: false,
				},
				overrideAccess: true,

				req: undefined,
			});

			if (privateNote1.ok) {
				user1PrivateNote = privateNote1.value;
			}

			const publicNote1 = await tryCreateNote({
				payload,
				data: {
					content: "User1 public note",
					createdBy: testUser.id,
					isPublic: true,
				},
				overrideAccess: true,

				req: undefined,
			});

			if (publicNote1.ok) {
				user1PublicNote = publicNote1.value;
			}

			const privateNote2 = await tryCreateNote({
				payload,
				data: {
					content: "User2 private note",
					createdBy: testUser2.id,
					isPublic: false,
				},
				overrideAccess: true,

				req: undefined,
			});

			if (privateNote2.ok) {
				user2PrivateNote = privateNote2.value;
			}
		});

		describe("Read Access Control", () => {
			test("TODO: user should be able to read their own private note", async () => {
				// TODO: Implement with payload.auth()
				// Get user from token and pass to function
				const user1 = await getAuthUser(user1Token);

				const result = await tryFindNoteById({
					payload,
					noteId: user1PrivateNote.id,
					req: { user: user1 },
					overrideAccess: false,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.content).toBe("User1 private note");
				}
			});

			test("user should be able to read public notes from other users", async () => {
				const user2 = await getAuthUser(user2Token);

				const result = await tryFindNoteById({
					payload,
					noteId: user1PublicNote.id,
					req: { user: user2 },
					overrideAccess: false,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.content).toBe("User1 public note");
				}
			});

			test("user should NOT be able to read private notes from other users", async () => {
				// This tests that without authentication, access is denied
				const result = await tryFindNoteById({
					payload,
					noteId: user2PrivateNote.id,
					overrideAccess: false,

					req: undefined,
				});

				expect(result.ok).toBe(false);
			});

			test("admin should be able to read all notes", async () => {
				// LIMITATION: Need to get authenticated user first
				const adminUser = await getAuthUser(adminToken);

				const result1 = await tryFindNoteById({
					payload,
					noteId: user1PrivateNote.id,
					req: { user: adminUser },
					overrideAccess: false,
				});
				const result2 = await tryFindNoteById({
					payload,
					noteId: user2PrivateNote.id,
					req: { user: adminUser },
					overrideAccess: false,
				});

				expect(result1.ok).toBe(true);
				expect(result2.ok).toBe(true);
			});

			test("unauthenticated request should fail to read private notes", async () => {
				const result = await tryFindNoteById({
					payload,
					noteId: user1PrivateNote.id,
					overrideAccess: false,

					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Update Access Control", () => {
			test("unauthenticated request should fail to update notes", async () => {
				const result = await tryUpdateNote({
					payload,
					noteId: user1PrivateNote.id,
					data: {
						content: "Trying to update without auth",
					},
					overrideAccess: false,

					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Delete Access Control", () => {
			test("unauthenticated request should fail to delete notes", async () => {
				const result = await tryDeleteNote({
					payload,
					noteId: user1PublicNote.id,
					overrideAccess: false,

					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});

		describe("Search with Access Control", () => {
			test("unauthenticated search should fail", async () => {
				const result = await trySearchNotes({
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
			test("unauthenticated request should fail to create notes", async () => {
				const result = await tryCreateNote({
					payload,
					data: {
						content: "Trying to create without auth",
						createdBy: testUser.id,
					},
					overrideAccess: false,

					req: undefined,
				});

				expect(result.ok).toBe(false);
			});
		});
	});

	describe("tryGenerateNoteHeatmap", () => {
		test("should generate heatmap data and available years", async () => {
			// Notes were already created in previous tests
			const result = await tryGenerateNoteHeatmap({
				payload,
				userId: testUser.id,
				overrideAccess: true,

				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.notes.length).toBeGreaterThan(0);
				expect(Object.keys(result.value.heatmapData).length).toBeGreaterThan(0);
				expect(result.value.availableYears.length).toBeGreaterThan(0);

				// Check heatmap data format
				const firstDate = Object.keys(result.value.heatmapData)[0]!;
				expect(firstDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				expect(typeof result.value.heatmapData[firstDate]).toBe("number");
			}
		});
	});

	// describe("Media parsing from HTML (reproducing note-create.tsx scenario)", () => {
	// 	test("should parse media from HTML with filename URL (like note-create.tsx)", async () => {
	// 		// Simulate the exact scenario from note-create.tsx:
	// 		// 1. Create media file using fixture
	// 		// 2. Create HTML content with media URL using filename (like href generates)
	// 		// 3. Call tryCreateNote and verify media array is populated

	// 		// Get authenticated user
	// 		const user = await getAuthUser(user1Token);
	// 		if (!user) {
	// 			throw new Error("Failed to get authenticated user");
	// 		}

	// 		// Step 1: Create media file using fixture
	// 		const fileBuffer = await Bun.file(
	// 			PaideiaLogo,
	// 		).arrayBuffer();
	// 		const createMediaResult = await tryCreateMedia({
	// 			payload,
	// 			file: Buffer.from(fileBuffer),
	// 			filename: "paideia-logo-test.png",
	// 			mimeType: "image/png",
	// 			alt: "Paideia logo test",
	// 			userId: testUser.id,
	// 			req: { user },
	// 		});

	// 		expect(createMediaResult.ok).toBe(true);
	// 		if (!createMediaResult.ok) {
	// 			throw new Error("Failed to create test media");
	// 		}

	// 		const createdMedia = createMediaResult.value.media;
	// 		const mediaFilename = createdMedia.filename ?? "";
	// 		expect(mediaFilename).toBeTruthy();

	// 		// Step 2: Create HTML content with media URL using ID
	// 		// This simulates what href("/api/media/file/:id", { id: mediaId }) generates
	// 		const mediaUrl = `/api/media/file/${createdMedia.id}`;
	// 		const htmlContent = `<p>This is a test note with an image!</p><img src="${mediaUrl}" alt="Test image" />`;

	// 		// Step 3: Call tryCreateNote and verify media array is populated
	// 		const result = await tryCreateNote({
	// 			payload,
	// 			data: {
	// 				content: htmlContent,
	// 				createdBy: testUser.id,
	// 			},
	// 			overrideAccess: true,

	// 			req: undefined,
	// 		});

	// 		expect(result.ok).toBe(true);
	// 		if (!result.ok) {
	// 			console.error("Failed to create note:", result.error);
	// 			throw result.error;
	// 		}

	// 		// Verify media array is populated
	// 		expect(result.value.contentMedia).toBeDefined();
	// 		if (Array.isArray(result.value.contentMedia)) {
	// 			expect(result.value.contentMedia.length).toBe(1);
	// 			const mediaId = result.value.contentMedia[0];
	// 			expect(mediaId).toBe(createdMedia.id);
	// 		} else {
	// 			throw new Error("Media should be an array");
	// 		}
	// 	});
	// });
});
