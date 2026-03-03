import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import {
	tryCreateCourse,
	tryDeleteCourse,
	tryUpdateCourse,
} from "./course-management";
import { parseQuery, tryGlobalSearch } from "./search-management";
import { tryCreateUser } from "./user-management";
import { createLocalReq } from "./utils/internal-function-utils";
import type { TryResultValue } from "server/utils/types";

describe("parseQuery", () => {
	test("should parse query", () => {
		const result = parseQuery("John");
		expect(result).toEqual({ text: "John", in: [] });
	});

	test("should parse query with in", () => {
		const result = parseQuery("John in:users");
		expect(result).toMatchObject({ text: "John", in: ["users"] });
	});

	test("should parse query with multiple in", () => {
		const result = parseQuery("John in:users,courses");
		expect(result).toMatchObject({ text: "John", in: ["users", "courses"] });
	});
});

describe("Search Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let user1: TryResultValue<typeof tryCreateUser>;
	let user2: TryResultValue<typeof tryCreateUser>;

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

		mockRequest = new Request("http://localhost:3000/test");

		// Create test users in parallel
		const [user1Result, user2Result] = await Promise.all([
			tryCreateUser({
				payload,
				data: {
					email: "john.doe@test.com",
					password: "password123",
					firstName: "John",
					lastName: "Doe",
					role: "student",
				},
				req: undefined,
				overrideAccess: true,
			}),
			tryCreateUser({
				payload,
				data: {
					email: "jane.smith@test.com",
					password: "password123",
					firstName: "Jane Pattern",
					lastName: "Smith",
					role: "student",
				},
				req: undefined,
				overrideAccess: true,
			}),
		]);

		user1 = user1Result.getOrThrow();
		user2 = user2Result.getOrThrow();

		// Create test courses
		await tryCreateCourse({
			payload,
			data: {
				title: "Introduction to JavaScript Programming",
				description: "Learn the fundamentals of JavaScript",
				createdBy: user1.id,
				slug: "intro-javascript",
				status: "published",
			},
			req: undefined,
			overrideAccess: true,
		});

		await tryCreateCourse({
			payload,
			data: {
				title: "Advanced Python Development Patterns",
				description: "Master advanced Python concepts and design patterns",
				createdBy: user2.id,
				slug: "advanced-python",
				status: "published",
			},
			req: undefined,
			overrideAccess: true,
		});

		// Wait a bit for search indexing
		await new Promise((resolve) => setTimeout(resolve, 1000));
	});

	afterAll(async () => {
		// Clean up test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryGlobalSearch", () => {
		test("should return courses and users", async () => {
			const result = await tryGlobalSearch({
				payload,
				query: "",
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Failed to search");
			}
			// should have 4 itesm in the result
			expect(result.value.docs.length).toBe(4);
		});

		test("should users by name", async () => {
			const result = await tryGlobalSearch({
				payload,
				query: "John in:users",
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Failed to search");
			}
			// should have 1 item in the result
			expect(result.value.docs.length).toBe(1);
		});

		test("should search users by in", async () => {
			const result = await tryGlobalSearch({
				payload,
				query: "in:users",
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Failed to search");
			}
			// should have 2 item in the result
			expect(result.value.docs.length).toBe(2);
		});

		test("should search courses by in", async () => {
			const result = await tryGlobalSearch({
				payload,
				query: "in:courses",
				req: undefined,
			});

			expect(result.ok).toBe(true);
		});

		test("should search courses by name", async () => {
			const result = await tryGlobalSearch({
				payload,
				query: "Pattern in:courses",
				req: undefined,
			});

			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Failed to search");
			}

			expect(result.value.docs.length).toBe(1);
			// should be python course
			expect(result.value.docs[0]!.title).toBe(
				"Advanced Python Development Patterns",
			);
		});
	});

	describe("Search Collection Sync on Deletion", () => {
		test("should remove course from search when course is deleted", async () => {
			// Create a course with unique title
			const uniqueTitle = `Temporary Course ${Date.now()}`;
			const createResult = await tryCreateCourse({
				payload,
				data: {
					title: uniqueTitle,
					description: "This course will be deleted",
					createdBy: user2.id,
					slug: `temp-course-${Date.now()}`,
					status: "published",
				},
				overrideAccess: true,
				req: undefined,
			});
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) {
				throw new Error("Failed to create course");
			}

			const courseId = createResult.value.id;

			// Wait for search indexing
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify course appears in search
			const searchBefore = await tryGlobalSearch({
				payload,
				query: `Temporary in:courses`,
				req: undefined,
			});
			expect(searchBefore.ok).toBe(true);
			if (!searchBefore.ok) {
				throw new Error("Failed to search before deletion");
			}

			const foundBefore = searchBefore.value.docs.find(
				(doc) =>
					"doc" in doc &&
					doc.doc.relationTo === "courses" &&
					doc.doc.value === courseId,
			);
			expect(foundBefore).toBeDefined();

			// Delete the course
			const deleteResult = await tryDeleteCourse({
				payload,
				courseId,
				overrideAccess: true,
				req: undefined,
			});
			expect(deleteResult.ok).toBe(true);

			// Wait for search index to update
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify course no longer appears in search
			const searchAfter = await tryGlobalSearch({
				payload,
				query: `Temporary in:courses`,
				req: undefined,
			});
			expect(searchAfter.ok).toBe(true);
			if (!searchAfter.ok) {
				throw new Error("Failed to search after deletion");
			}

			const foundAfter = searchAfter.value.docs.find(
				(doc) =>
					"doc" in doc &&
					doc.doc.relationTo === "courses" &&
					doc.doc.value === courseId,
			);
			expect(foundAfter).toBeUndefined();
		});

		test("should remove user from search when user is deleted", async () => {
			// Create a user with unique name
			const uniqueName = `TempUser${Date.now()}`;
			const createResult = await tryCreateUser({
				payload,
				data: {
					email: `${uniqueName.toLowerCase()}@test.com`,
					password: "password123",
					firstName: uniqueName,
					lastName: "ToDelete",
					role: "student",
				},
				overrideAccess: true,
				req: undefined,
			});
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) {
				throw new Error("Failed to create user");
			}

			const userId = createResult.value.id;

			// Wait for search indexing
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify user appears in search
			const searchBefore = await tryGlobalSearch({
				payload,
				query: `TempUser in:users`,
				req: undefined,
			});
			expect(searchBefore.ok).toBe(true);
			if (!searchBefore.ok) {
				throw new Error("Failed to search before deletion");
			}

			const foundBefore = searchBefore.value.docs.find(
				(doc) =>
					"doc" in doc &&
					doc.doc.relationTo === "users" &&
					doc.doc.value === userId,
			);
			expect(foundBefore).toBeDefined();

			// Delete the user
			await payload.delete({
				collection: "users",
				id: userId,
				req: mockRequest,
			});

			// Wait for search index to update
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify user no longer appears in search
			const searchAfter = await tryGlobalSearch({
				payload,
				query: `TempUser in:users`,
				req: undefined,
			});
			expect(searchAfter.ok).toBe(true);
			if (!searchAfter.ok) {
				throw new Error("Failed to search after deletion");
			}

			const foundAfter = searchAfter.value.docs.find(
				(doc) =>
					"doc" in doc &&
					doc.doc.relationTo === "users" &&
					doc.doc.value === userId,
			);
			expect(foundAfter).toBeUndefined();
		});

		test("should update search when course is updated", async () => {
			// Create a course with initial title
			const initialTitle = `Original Course ${Date.now()}`;

			// Create a new request
			// ! this is important, we need to create a new request to avoid the request being cached
			const newRequest = new Request("http://localhost:3000/test");

			const createResult = await tryCreateCourse({
				payload,
				data: {
					title: initialTitle,
					description: "This course will be updated",
					createdBy: user2.id,
					slug: `update-course-${Date.now()}`,
					status: "published",
				},
				req: newRequest,
				overrideAccess: true,
			});
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) {
				throw new Error("Failed to create course");
			}

			const courseId = createResult.value.id;

			// Wait for search indexing
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Update the course title
			const updatedTitle = `Updated Course ${Date.now()}`;
			await tryUpdateCourse({
				payload,
				courseId,
				data: {
					title: updatedTitle,
				},
				req: createLocalReq({
					request: mockRequest,
					user: user2 as TypedUser,
				}),
				overrideAccess: true,
			});

			const courseAfterUpdate = await payload.findByID({
				collection: "courses",
				id: courseId,
				req: mockRequest,
			});

			// Confirm the title is updated
			expect(courseAfterUpdate.title).toBe(updatedTitle);

			// Wait for search index to update
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Search for updated title
			const searchAfterUpdate = await tryGlobalSearch({
				payload,
				query: `Updated in:courses`,
				req: undefined,
			});
			expect(searchAfterUpdate.ok).toBe(true);
			if (!searchAfterUpdate.ok) {
				throw new Error("Failed to search after update");
			}

			const foundUpdated = searchAfterUpdate.value.docs.find(
				(doc) =>
					"doc" in doc &&
					doc.doc.relationTo === "courses" &&
					doc.doc.value === courseId,
			);
			expect(foundUpdated).toBeDefined();
			if (foundUpdated) {
				expect(foundUpdated.title).toBe(updatedTitle);
			}

			// Old title should not appear in search results for this course
			const searchForOld = await tryGlobalSearch({
				payload,
				query: `Original in:courses`,
				req: undefined,
			});
			expect(searchForOld.ok).toBe(true);
			if (!searchForOld.ok) {
				throw new Error("Failed to search for old title");
			}

			const foundOld = searchForOld.value.docs.find(
				(doc) =>
					"doc" in doc &&
					doc.doc.relationTo === "courses" &&
					doc.doc.value === courseId,
			);
			// The course should not be found with old title
			expect(foundOld).toBeUndefined();
		});
	});
});
