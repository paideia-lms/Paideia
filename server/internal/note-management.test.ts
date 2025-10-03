import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateNoteArgs,
	tryCreateNote,
	tryDeleteNote,
	tryFindNoteById,
	tryFindNotesByUser,
	tryFindNotesWithCourseLinks,
	trySearchNotes,
	tryUpdateNote,
	type UpdateNoteArgs,
} from "./note-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Note Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUser: { id: number };
	let testUser2: { id: number };

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

		// Create test users
		const userArgs1: CreateUserArgs = {
			email: "testuser1@example.com",
			password: "testpassword123",
			firstName: "Test",
			lastName: "User1",
			role: "student",
		};

		const userArgs2: CreateUserArgs = {
			email: "testuser2@example.com",
			password: "testpassword123",
			firstName: "Test",
			lastName: "User2",
			role: "instructor",
		};

		const userResult1 = await tryCreateUser(payload, mockRequest, userArgs1);
		const userResult2 = await tryCreateUser(payload, mockRequest, userArgs2);

		if (!userResult1.ok || !userResult2.ok) {
			throw new Error("Failed to create test users");
		}

		testUser = userResult1.value;
		testUser2 = userResult2.value;
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
			const noteArgs: CreateNoteArgs = {
				content: "This is my first note!",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, mockRequest, noteArgs);

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
			const noteArgs: CreateNoteArgs = {
				content: "I'm learning about [[math-101-a-fa-2025]] and it's great!",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, mockRequest, noteArgs);

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
			const noteArgs: CreateNoteArgs = {
				content: "   This note has extra spaces   ",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, mockRequest, noteArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("This note has extra spaces");
			}
		});

		test("should fail with empty content", async () => {
			const noteArgs: CreateNoteArgs = {
				content: "",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, mockRequest, noteArgs);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("content cannot be empty");
			}
		});

		test("should fail with whitespace-only content", async () => {
			const noteArgs: CreateNoteArgs = {
				content: "   \n\t   ",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, mockRequest, noteArgs);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("content cannot be empty");
			}
		});

		test("should fail with non-existent user", async () => {
			const noteArgs: CreateNoteArgs = {
				content: "This should fail",
				createdBy: 99999, // Non-existent user ID
			};

			const result = await tryCreateNote(payload, mockRequest, noteArgs);

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
			const noteArgs: CreateNoteArgs = {
				content: "Original content",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, mockRequest, noteArgs);
			if (result.ok) {
				testNote = result.value;
			}
		});

		test("should update note content successfully", async () => {
			const updateArgs: UpdateNoteArgs = {
				content: "Updated content",
			};

			const result = await tryUpdateNote(
				payload,
				mockRequest,
				testNote.id,
				updateArgs,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("Updated content");
				expect(result.value.id).toBe(testNote.id);
			}
		});

		test("should trim whitespace from updated content", async () => {
			const updateArgs: UpdateNoteArgs = {
				content: "   Updated with spaces   ",
			};

			const result = await tryUpdateNote(
				payload,
				mockRequest,
				testNote.id,
				updateArgs,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("Updated with spaces");
			}
		});

		test("should fail with empty content", async () => {
			const updateArgs: UpdateNoteArgs = {
				content: "",
			};

			const result = await tryUpdateNote(
				payload,
				mockRequest,
				testNote.id,
				updateArgs,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("content cannot be empty");
			}
		});

		test("should fail with whitespace-only content", async () => {
			const updateArgs: UpdateNoteArgs = {
				content: "   \n\t   ",
			};

			const result = await tryUpdateNote(
				payload,
				mockRequest,
				testNote.id,
				updateArgs,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("content cannot be empty");
			}
		});

		test("should fail with non-existent note", async () => {
			const updateArgs: UpdateNoteArgs = {
				content: "This should fail",
			};

			const result = await tryUpdateNote(
				payload,
				mockRequest,
				99999,
				updateArgs,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to update note");
			}
		});
	});

	describe("tryFindNoteById", () => {
		let testNote: { id: number };

		beforeAll(async () => {
			// Create a test note for find tests
			const noteArgs: CreateNoteArgs = {
				content: "Note for finding",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, mockRequest, noteArgs);
			if (result.ok) {
				testNote = result.value;
			}
		});

		test("should find note by ID successfully", async () => {
			const result = await tryFindNoteById(payload, testNote.id);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(testNote.id);
				expect(result.value.content).toBe("Note for finding");
				// Handle both depth 0 (ID) and depth 1 (object) cases
				if (typeof result.value.createdBy === "object") {
					expect(result.value.createdBy.id).toBe(testUser.id);
				} else {
					expect(result.value.createdBy).toBe(testUser.id);
				}
			}
		});

		test("should fail with non-existent note", async () => {
			const result = await tryFindNoteById(payload, 99999);

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
				{ content: "First note about learning", createdBy: testUser.id },
				{ content: "Second note about coding", createdBy: testUser.id },
				{
					content: "Third note about [[math-101-a-fa-2025]]",
					createdBy: testUser2.id,
				},
				{ content: "Fourth note about programming", createdBy: testUser2.id },
			];

			for (const note of notes) {
				await tryCreateNote(payload, mockRequest, note);
			}
		});

		test("should search notes by user", async () => {
			const result = await trySearchNotes(payload, {
				createdBy: testUser.id,
				limit: 10,
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
			const result = await trySearchNotes(payload, {
				content: "coding",
				limit: 10,
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
			const result = await trySearchNotes(payload, {
				content: "[[math-101-a-fa-2025]]",
				limit: 10,
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
			const result = await trySearchNotes(payload, {
				limit: 2,
				page: 1,
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
			const result = await trySearchNotes(payload, {
				content: "nonexistentcontent12345",
				limit: 10,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBe(0);
			}
		});
	});

	describe("tryFindNotesByUser", () => {
		test("should find notes by user ID", async () => {
			const result = await tryFindNotesByUser(payload, testUser.id, 10);

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
			const result = await tryFindNotesByUser(payload, testUser.id, 1);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeLessThanOrEqual(1);
			}
		});

		test("should return empty array for user with no notes", async () => {
			// Create a new user with no notes
			const userArgs: CreateUserArgs = {
				email: "nouser@example.com",
				password: "testpassword123",
				firstName: "No",
				lastName: "Notes",
				role: "student",
			};

			const userResult = await tryCreateUser(payload, mockRequest, userArgs);
			if (userResult.ok) {
				const result = await tryFindNotesByUser(
					payload,
					userResult.value.id,
					10,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBe(0);
				}
			}
		});
	});

	describe("tryFindNotesWithCourseLinks", () => {
		test("should find notes containing course links", async () => {
			const result = await tryFindNotesWithCourseLinks(payload, 10);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThan(0);
				result.value.forEach((note) => {
					expect(note.content).toContain("[[");
				});
			}
		});

		test("should respect limit parameter", async () => {
			const result = await tryFindNotesWithCourseLinks(payload, 1);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeLessThanOrEqual(1);
			}
		});
	});

	describe("tryDeleteNote", () => {
		test("should delete note successfully", async () => {
			// Create a note to delete
			const noteArgs: CreateNoteArgs = {
				content: "Note to be deleted",
				createdBy: testUser.id,
			};

			const createResult = await tryCreateNote(payload, mockRequest, noteArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteNote(
					payload,
					mockRequest,
					createResult.value.id,
				);

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
					expect(deleteResult.value.content).toBe("Note to be deleted");
				}

				// Verify note is actually deleted
				const findResult = await tryFindNoteById(
					payload,
					createResult.value.id,
				);
				expect(findResult.ok).toBe(false);
			}
		});

		test("should fail with non-existent note", async () => {
			const result = await tryDeleteNote(payload, mockRequest, 99999);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to delete note");
			}
		});
	});
});
