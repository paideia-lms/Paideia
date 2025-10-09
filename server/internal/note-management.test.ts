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
	let user1Token: string;
	let user2Token: string;
	let adminToken: string;

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

		const adminArgs: CreateUserArgs = {
			email: "admin@example.com",
			password: "adminpassword123",
			firstName: "Admin",
			lastName: "User",
			role: "admin",
		};

		const userResult1 = await tryCreateUser(payload, mockRequest, userArgs1);
		const userResult2 = await tryCreateUser(payload, mockRequest, userArgs2);
		const adminResult = await tryCreateUser(payload, mockRequest, adminArgs);

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
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const noteArgs: CreateNoteArgs = {
				content: "This is my first note!",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, user1Request, noteArgs, true);

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
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const noteArgs: CreateNoteArgs = {
				content: "I'm learning about [[math-101-a-fa-2025]] and it's great!",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, user1Request, noteArgs, true);

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
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const noteArgs: CreateNoteArgs = {
				content: "   This note has extra spaces   ",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, user1Request, noteArgs, true);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("This note has extra spaces");
			}
		});

		test("should fail with empty content", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const noteArgs: CreateNoteArgs = {
				content: "",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, user1Request, noteArgs, true);

			expect(result.ok).toBe(false);
		});

		test("should fail with whitespace-only content", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const noteArgs: CreateNoteArgs = {
				content: "   \n\t   ",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, user1Request, noteArgs, true);

			expect(result.ok).toBe(false);
		});

		test("should fail with non-existent user", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const noteArgs: CreateNoteArgs = {
				content: "This should fail",
				createdBy: 99999, // Non-existent user ID
			};

			const result = await tryCreateNote(payload, user1Request, noteArgs, true);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to create note");
			}
		});
	});

	describe("tryUpdateNote", () => {
		let testNote: { id: number };

		beforeAll(async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			// Create a test note for update tests
			const noteArgs: CreateNoteArgs = {
				content: "Original content",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, user1Request, noteArgs, true);
			if (result.ok) {
				testNote = result.value;
			}
		});

		test("should update note content successfully", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const updateArgs: UpdateNoteArgs = {
				content: "Updated content",
			};

			const result = await tryUpdateNote(
				payload,
				user1Request,
				testNote.id,
				updateArgs,
				true,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("Updated content");
				expect(result.value.id).toBe(testNote.id);
			}
		});

		test("should trim whitespace from updated content", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const updateArgs: UpdateNoteArgs = {
				content: "   Updated with spaces   ",
			};

			const result = await tryUpdateNote(
				payload,
				user1Request,
				testNote.id,
				updateArgs,
				true,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe("Updated with spaces");
			}
		});

		test("should fail with empty content", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const updateArgs: UpdateNoteArgs = {
				content: "",
			};

			const result = await tryUpdateNote(
				payload,
				user1Request,
				testNote.id,
				updateArgs,
				true,
			);

			expect(result.ok).toBe(false);
		});

		test("should fail with whitespace-only content", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const updateArgs: UpdateNoteArgs = {
				content: "   \n\t   ",
			};

			const result = await tryUpdateNote(
				payload,
				user1Request,
				testNote.id,
				updateArgs,
				true,
			);

			expect(result.ok).toBe(false);
		});

		test("should fail with non-existent note", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const updateArgs: UpdateNoteArgs = {
				content: "This should fail",
			};

			const result = await tryUpdateNote(
				payload,
				user1Request,
				99999,
				updateArgs,
				true,
			);

			expect(result.ok).toBe(false);
		});
	});

	describe("tryFindNoteById", () => {
		let testNote: { id: number };

		beforeAll(async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			// Create a test note for find tests
			const noteArgs: CreateNoteArgs = {
				content: "Note for finding",
				createdBy: testUser.id,
			};

			const result = await tryCreateNote(payload, user1Request, noteArgs, true);
			if (result.ok) {
				testNote = result.value;
			}
		});

		test("should find note by ID successfully", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const result = await tryFindNoteById(
				payload,
				testNote.id,
				user1Request,
				true,
			);

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
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const user2Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user2Token}`,
				},
			});

			// Create multiple test notes for search tests
			const notes = [
				{
					content: "First note about learning",
					createdBy: testUser.id,
					request: user1Request,
				},
				{
					content: "Second note about coding",
					createdBy: testUser.id,
					request: user1Request,
				},
				{
					content: "Third note about [[math-101-a-fa-2025]]",
					createdBy: testUser2.id,
					request: user2Request,
				},
				{
					content: "Fourth note about programming",
					createdBy: testUser2.id,
					request: user2Request,
				},
			];

			for (const note of notes) {
				const { request, ...noteData } = note;
				await tryCreateNote(payload, request, noteData, true);
			}
		});

		test("should search notes by user", async () => {
			const result = await trySearchNotes(
				payload,
				{
					createdBy: testUser.id,
					limit: 10,
				},
				undefined,
				true,
			);

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
			const result = await trySearchNotes(
				payload,
				{
					content: "coding",
					limit: 10,
				},
				undefined,
				true,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				result.value.docs.forEach((note) => {
					expect(note.content.toLowerCase()).toContain("coding");
				});
			}
		});

		test("should search notes with course links", async () => {
			const result = await trySearchNotes(
				payload,
				{
					content: "[[math-101-a-fa-2025]]",
					limit: 10,
				},
				undefined,
				true,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				result.value.docs.forEach((note) => {
					expect(note.content).toContain("[[math-101-a-fa-2025]]");
				});
			}
		});

		test("should return paginated results", async () => {
			const result = await trySearchNotes(
				payload,
				{
					limit: 2,
					page: 1,
				},
				undefined,
				true,
			);

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
			const result = await trySearchNotes(
				payload,
				{
					content: "nonexistentcontent12345",
					limit: 10,
				},
				undefined,
				true,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBe(0);
			}
		});
	});

	describe("tryFindNotesByUser", () => {
		test("should find notes by user ID", async () => {
			const result = await tryFindNotesByUser(
				payload,
				testUser.id,
				10,
				mockRequest,
				true,
			);

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
			const result = await tryFindNotesByUser(
				payload,
				testUser.id,
				1,
				mockRequest,
				true,
			);

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
					mockRequest,
					true,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBe(0);
				}
			}
		});
	});

	describe("tryDeleteNote", () => {
		test("should delete note successfully", async () => {
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			// Create a note to delete
			const noteArgs: CreateNoteArgs = {
				content: "Note to be deleted",
				createdBy: testUser.id,
			};

			const createResult = await tryCreateNote(
				payload,
				user1Request,
				noteArgs,
				true,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteNote(
					payload,
					user1Request,
					createResult.value.id,
					true,
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
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const result = await tryDeleteNote(payload, user1Request, 99999, true);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Failed to delete note");
			}
		});
	});

	describe("Access Control Tests", () => {
		let user1PrivateNote: { id: number };
		let user1PublicNote: { id: number };
		let user2PrivateNote: { id: number };

		beforeAll(async () => {
			// Create authenticated requests for each user
			const user1Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user1Token}`,
				},
			});

			const user2Request = new Request("http://localhost:3000/test", {
				headers: {
					Authorization: `JWT ${user2Token}`,
				},
			});

			// Create private note for user1
			const privateNote1 = await tryCreateNote(payload, user1Request, {
				content: "User1 private note",
				createdBy: testUser.id,
				isPublic: false,
			});

			if (privateNote1.ok) {
				user1PrivateNote = privateNote1.value;
			}

			// Create public note for user1
			const publicNote1 = await tryCreateNote(payload, user1Request, {
				content: "User1 public note",
				createdBy: testUser.id,
				isPublic: true,
			});

			if (publicNote1.ok) {
				user1PublicNote = publicNote1.value;
			}

			// Create private note for user2
			const privateNote2 = await tryCreateNote(payload, user2Request, {
				content: "User2 private note",
				createdBy: testUser2.id,
				isPublic: false,
			});

			if (privateNote2.ok) {
				user2PrivateNote = privateNote2.value;
			}
		});

		describe("Read Access Control", () => {
			test("user should be able to read their own private note", async () => {
				const user1Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user1Token}`,
					},
				});

				const result = await tryFindNoteById(
					payload,
					user1PrivateNote.id,
					user1Request,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.content).toBe("User1 private note");
				}
			});

			test("user should be able to read public notes from other users", async () => {
				const user2Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user2Token}`,
					},
				});

				const result = await tryFindNoteById(
					payload,
					user1PublicNote.id,
					user2Request,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.content).toBe("User1 public note");
				}
			});

			test("user should NOT be able to read private notes from other users", async () => {
				const user1Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user1Token}`,
					},
				});

				const result = await tryFindNoteById(
					payload,
					user2PrivateNote.id,
					user1Request,
				);

				expect(result.ok).toBe(false);
			});

			test("admin should be able to read all notes", async () => {
				const adminRequest = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${adminToken}`,
					},
				});

				const result1 = await tryFindNoteById(
					payload,
					user1PrivateNote.id,
					adminRequest,
				);
				const result2 = await tryFindNoteById(
					payload,
					user2PrivateNote.id,
					adminRequest,
				);

				expect(result1.ok).toBe(true);
				expect(result2.ok).toBe(true);
			});

			test("unauthenticated request should fail to read private notes", async () => {
				const unauthRequest = new Request("http://localhost:3000/test");

				const result = await tryFindNoteById(
					payload,
					user1PrivateNote.id,
					unauthRequest,
				);

				expect(result.ok).toBe(false);
			});
		});

		describe("Update Access Control", () => {
			test("user should be able to update their own note", async () => {
				const user1Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user1Token}`,
					},
				});

				const result = await tryUpdateNote(
					payload,
					user1Request,
					user1PrivateNote.id,
					{
						content: "Updated by user1",
					},
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.content).toBe("Updated by user1");
				}
			});

			test("user should NOT be able to update other users' notes", async () => {
				const user1Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user1Token}`,
					},
				});

				const result = await tryUpdateNote(
					payload,
					user1Request,
					user2PrivateNote.id,
					{
						content: "Trying to update user2 note",
					},
				);

				expect(result.ok).toBe(false);
			});

			test("admin should be able to update any note", async () => {
				const adminRequest = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${adminToken}`,
					},
				});

				const result = await tryUpdateNote(
					payload,
					adminRequest,
					user2PrivateNote.id,
					{
						content: "Updated by admin",
					},
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.content).toBe("Updated by admin");
				}
			});

			test("user should be able to change note visibility", async () => {
				const user1Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user1Token}`,
					},
				});

				const result = await tryUpdateNote(
					payload,
					user1Request,
					user1PrivateNote.id,
					{
						isPublic: true,
					},
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.isPublic).toBe(true);
				}
			});

			test("unauthenticated request should fail to update notes", async () => {
				const unauthRequest = new Request("http://localhost:3000/test");

				const result = await tryUpdateNote(
					payload,
					unauthRequest,
					user1PrivateNote.id,
					{
						content: "Trying to update without auth",
					},
				);

				expect(result.ok).toBe(false);
			});
		});

		describe("Delete Access Control", () => {
			test("user should be able to delete their own note", async () => {
				const user1Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user1Token}`,
					},
				});

				// Create a note to delete
				const createResult = await tryCreateNote(payload, user1Request, {
					content: "Note to be deleted by owner",
					createdBy: testUser.id,
				});

				expect(createResult.ok).toBe(true);

				if (createResult.ok) {
					const deleteResult = await tryDeleteNote(
						payload,
						user1Request,
						createResult.value.id,
					);

					expect(deleteResult.ok).toBe(true);
				}
			});

			test("user should NOT be able to delete other users' notes", async () => {
				const user1Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user1Token}`,
					},
				});

				const result = await tryDeleteNote(
					payload,
					user1Request,
					user2PrivateNote.id,
				);

				expect(result.ok).toBe(false);
			});

			test("admin should be able to delete any note", async () => {
				const adminRequest = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${adminToken}`,
					},
				});

				// Create a note to delete
				const user2Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user2Token}`,
					},
				});

				const createResult = await tryCreateNote(payload, user2Request, {
					content: "Note to be deleted by admin",
					createdBy: testUser2.id,
				});

				expect(createResult.ok).toBe(true);

				if (createResult.ok) {
					const deleteResult = await tryDeleteNote(
						payload,
						adminRequest,
						createResult.value.id,
					);

					expect(deleteResult.ok).toBe(true);
				}
			});

			test("unauthenticated request should fail to delete notes", async () => {
				const unauthRequest = new Request("http://localhost:3000/test");

				const result = await tryDeleteNote(
					payload,
					unauthRequest,
					user1PublicNote.id,
				);

				expect(result.ok).toBe(false);
			});
		});

		describe("Search with Access Control", () => {
			test("authenticated user should only see their own notes and public notes in search", async () => {
				const user1Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user1Token}`,
					},
				});

				const result = await trySearchNotes(
					payload,
					{
						limit: 100,
					},
					user1Request,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					const noteVisibility = result.value.docs.map((note) => ({
						creator:
							typeof note.createdBy === "object"
								? note.createdBy.id
								: note.createdBy,
						isPublic: note.isPublic,
					}));

					// Should see all user1's notes (public and private)
					// Should only see public notes from other users
					for (const note of noteVisibility) {
						if (note.creator !== testUser.id) {
							expect(note.isPublic).toBe(true);
						}
					}
				}
			});

			test("admin should see all notes in search", async () => {
				const adminRequest = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${adminToken}`,
					},
				});

				const result = await trySearchNotes(
					payload,
					{
						limit: 100,
					},
					adminRequest,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					// Admin should see both private and public notes from all users
					const hasPrivateNotes = result.value.docs.some(
						(note) => !note.isPublic,
					);
					expect(hasPrivateNotes).toBe(true);
				}
			});

			test("unauthenticated search should fail", async () => {
				const unauthRequest = new Request("http://localhost:3000/test");

				const result = await trySearchNotes(
					payload,
					{
						limit: 10,
					},
					unauthRequest,
				);

				expect(result.ok).toBe(false);
			});
		});

		describe("Create with Authentication", () => {
			test("authenticated user should be able to create notes", async () => {
				const user1Request = new Request("http://localhost:3000/test", {
					headers: {
						Authorization: `JWT ${user1Token}`,
					},
				});

				const result = await tryCreateNote(payload, user1Request, {
					content: "New authenticated note",
					createdBy: testUser.id,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.content).toBe("New authenticated note");
				}
			});

			test("unauthenticated request should fail to create notes", async () => {
				const unauthRequest = new Request("http://localhost:3000/test");

				const result = await tryCreateNote(payload, unauthRequest, {
					content: "Trying to create without auth",
					createdBy: testUser.id,
				});

				expect(result.ok).toBe(false);
			});
		});
	});
});
