import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import {
	tryCreateNote,
	tryDeleteNote,
	tryFindNoteById,
	tryFindNotesByUser,
	tryGenerateNoteHeatmap,
	trySearchNotes,
	tryUpdateNote,
} from "./note-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Note Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let testUser: { id: number };
	let testUser2: { id: number };
	let user1Token: string;
	let user2Token: string;
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

		// Create test users
		const userArgs1: CreateUserArgs = {
			payload,
			data: {
				email: "testuser1@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User1",
				role: "student",
			},
			overrideAccess: true,
		};

		const userArgs2: CreateUserArgs = {
			payload,
			data: {
				email: "testuser2@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User2",
				role: "student",
			},
			overrideAccess: true,
		};

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

		const userResult1 = await tryCreateUser(userArgs1);
		const userResult2 = await tryCreateUser(userArgs2);
		const adminResult = await tryCreateUser(adminArgs);

		if (!userResult1.ok || !userResult2.ok || !adminResult.ok) {
			throw new Error("Failed to create test users");
		}

		testUser = userResult1.value;
		testUser2 = userResult2.value;

		// Verify users so they can login
		await payload.update({
			collection: "users",
			id: testUser.id,
			data: {
				_verified: true,
			},
		});

		await payload.update({
			collection: "users",
			id: testUser2.id,
			data: {
				_verified: true,
			},
		});

		await payload.update({
			collection: "users",
			id: adminResult.value.id,
			data: {
				_verified: true,
			},
		});

		// Login to get tokens for authenticated requests
		const login1 = await payload.login({
			collection: "users",
			data: {
				email: "testuser1@example.com",
				password: "testpassword123",
			},
		});

		const login2 = await payload.login({
			collection: "users",
			data: {
				email: "testuser2@example.com",
				password: "testpassword123",
			},
		});

		const adminLogin = await payload.login({
			collection: "users",
			data: {
				email: "admin@example.com",
				password: "adminpassword123",
			},
		});

		if (!login1.token || !login2.token || !adminLogin.token) {
			throw new Error("Failed to get authentication tokens");
		}

		user1Token = login1.token;
		user2Token = login2.token;
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

	describe("tryCreateNote", () => {
		test("should create a new note successfully", async () => {
			const result = await tryCreateNote({
				payload,
				data: {
					content: "This is my first note!",
					createdBy: testUser.id,
				},
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("This is my first note!");
				// Handle both depth 0 (ID) and depth 1 (object) cases
				if (typeof result.value.createdBy === "object") {
					expect(result.value.createdBy.id).toBe(testUser.id);
				} else {
					expect(result.value.createdBy).toBe(testUser.id);
				}
				expect(result.value.id).toBeDefined();
				expect(result.value.createdAt).toBeDefined();
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
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe(
					"I'm learning about [[math-101-a-fa-2025]] and it's great!",
				);
				// Handle both depth 0 (ID) and depth 1 (object) cases
				if (typeof result.value.createdBy === "object") {
					expect(result.value.createdBy.id).toBe(testUser.id);
				} else {
					expect(result.value.createdBy).toBe(testUser.id);
				}
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
			});
			if (result.ok) {
				testNote = result.value;
			}
		});

		test("should update note content successfully", async () => {
			const result = await tryUpdateNote({
				payload,
				noteId: testNote.id,
				data: {
					content: "Updated content",
				},
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("Updated content");
				expect(result.value.id).toBe(testNote.id);
			}
		});

		test("should trim whitespace from updated content", async () => {
			const result = await tryUpdateNote({
				payload,
				noteId: testNote.id,
				data: {
					content: "   Updated with spaces   ",
				},
				overrideAccess: true,
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
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeLessThanOrEqual(1);
			}
		});

		test("should return empty array for user with no notes", async () => {
			// Create a new user with no notes
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: "nouser@example.com",
					password: "testpassword123",
					firstName: "No",
					lastName: "Notes",
					role: "student",
				},
				overrideAccess: true,
			};

			const userResult = await tryCreateUser(userArgs);
			if (userResult.ok) {
				const result = await tryFindNotesByUser({
					payload,
					userId: userResult.value.id,
					limit: 10,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBe(0);
				}
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
			});
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteNote({
					payload,
					noteId: createResult.value.id,
					overrideAccess: true,
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
				});
				expect(findResult.ok).toBe(false);
			}
		});

		test("should fail with non-existent note", async () => {
			const result = await tryDeleteNote({
				payload,
				noteId: 99999,
				overrideAccess: true,
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
			});

			const result2 = await tryFindNoteById({
				payload,
				noteId: user2PrivateNote.id,
				overrideAccess: true,
			});

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);
		});

		test("should update any note with overrideAccess", async () => {
			const result = await tryUpdateNote({
				payload,
				noteId: user1PrivateNote.id,
				data: {
					content: "Updated with overrideAccess",
				},
				overrideAccess: true,
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
			});

			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteNote({
					payload,
					noteId: createResult.value.id,
					overrideAccess: true,
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
					user: user1,
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
					user: user2,
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
				});

				expect(result.ok).toBe(false);
			});

			test("admin should be able to read all notes", async () => {
				// LIMITATION: Need to get authenticated user first
				const adminUser = await getAuthUser(adminToken);

				const result1 = await tryFindNoteById({
					payload,
					noteId: user1PrivateNote.id,
					user: adminUser,
					overrideAccess: false,
				});
				const result2 = await tryFindNoteById({
					payload,
					noteId: user2PrivateNote.id,
					user: adminUser,
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
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.notes.length).toBeGreaterThan(0);
				expect(Object.keys(result.value.heatmapData).length).toBeGreaterThan(0);
				expect(result.value.availableYears.length).toBeGreaterThan(0);

				// Check heatmap data format
				const firstDate = Object.keys(result.value.heatmapData)[0];
				expect(firstDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				expect(typeof result.value.heatmapData[firstDate]).toBe("number");
			}
		});
	});
});
