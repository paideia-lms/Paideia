import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateCourseArgs,
	tryCreateCourse,
	tryDeleteCourse,
	tryUpdateCourse,
} from "./course-management";
import { tryCreateSection } from "./course-section-management";
import { parseQuery, tryGlobalSearch } from "./search-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

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
	let userId2: number;

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

		mockRequest = new Request("http://localhost:3000/test");

		// Create test users
		const user1Args: CreateUserArgs = {
			payload,
			data: {
				email: "john.doe@test.com",
				password: "password123",
				firstName: "John",
				lastName: "Doe",
				role: "student",
			},
			overrideAccess: true,
		};

		const user2Args: CreateUserArgs = {
			payload,
			data: {
				email: "jane.smith@test.com",
				password: "password123",
				firstName: "Jane Pattern",
				lastName: "Smith",
				role: "student",
			},
			overrideAccess: true,
		};

		const user1Result = await tryCreateUser(user1Args);
		const user2Result = await tryCreateUser(user2Args);

		expect(user1Result.ok).toBe(true);
		expect(user2Result.ok).toBe(true);

		if (!user1Result.ok || !user2Result.ok) {
			throw new Error("Failed to create test users");
		}

		if (user2Result.ok) {
			userId2 = user2Result.value.id;
		}

		// Create test courses
		const course1Args: CreateCourseArgs = {
			payload,
			data: {
				title: "Introduction to JavaScript Programming",
				description: "Learn the fundamentals of JavaScript",
				createdBy: user1Result.value.id,
				slug: "intro-javascript",
				status: "published",
			},
			overrideAccess: true,
		};

		const course2Args: CreateCourseArgs = {
			payload,
			data: {
				title: "Advanced Python Development Patterns",
				description: "Master advanced Python concepts and design patterns",
				createdBy: userId2,
				slug: "advanced-python",
				status: "published",
			},
			overrideAccess: true,
		};

		const course1Result = await tryCreateCourse(course1Args);
		const course2Result = await tryCreateCourse(course2Args);

		expect(course1Result.ok).toBe(true);
		expect(course2Result.ok).toBe(true);

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
			const result = await tryGlobalSearch(payload, {
				query: "",
			});

			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Failed to search");
			}
			// should have 4 itesm in the result
			expect(result.value.docs.length).toBe(4);
		});

		test("should users by name", async () => {
			const result = await tryGlobalSearch(payload, {
				query: "John in:users",
			});

			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Failed to search");
			}
			// should have 1 item in the result
			expect(result.value.docs.length).toBe(1);
		});

		test("should search users by in", async () => {
			const result = await tryGlobalSearch(payload, {
				query: "in:users",
			});

			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Failed to search");
			}
			// should have 2 item in the result
			expect(result.value.docs.length).toBe(2);
		});

		test("should search courses by in", async () => {
			const result = await tryGlobalSearch(payload, {
				query: "in:courses",
			});

			expect(result.ok).toBe(true);
		});

		test("should search courses by name", async () => {
			const result = await tryGlobalSearch(payload, {
				query: "Pattern in:courses",
			});

			expect(result.ok).toBe(true);
			if (!result.ok) {
				throw new Error("Failed to search");
			}

			expect(result.value.docs.length).toBe(1);
			// should be python course
			expect(result.value.docs[0].title).toBe(
				"Advanced Python Development Patterns",
			);
		});
	});

	describe("Search Collection Sync on Deletion", () => {
		test("should remove course from search when course is deleted", async () => {
			// Create a course with unique title
			const uniqueTitle = `Temporary Course ${Date.now()}`;
			const courseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: uniqueTitle,
					description: "This course will be deleted",
					createdBy: userId2,
					slug: `temp-course-${Date.now()}`,
					status: "published",

				},
				overrideAccess: true,
			};

			const createResult = await tryCreateCourse(courseArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) {
				throw new Error("Failed to create course");
			}

			const courseId = createResult.value.id;

			// Wait for search indexing
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify course appears in search
			const searchBefore = await tryGlobalSearch(payload, {
				query: `Temporary in:courses`,
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
			});
			expect(deleteResult.ok).toBe(true);

			// Wait for search index to update
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify course no longer appears in search
			const searchAfter = await tryGlobalSearch(payload, {
				query: `Temporary in:courses`,
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
			const userArgs: CreateUserArgs = {
				payload,
				data: {
					email: `${uniqueName.toLowerCase()}@test.com`,
					password: "password123",
					firstName: uniqueName,
					lastName: "ToDelete",
					role: "student",
				},
				overrideAccess: true,
			};

			const createResult = await tryCreateUser(userArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) {
				throw new Error("Failed to create user");
			}

			const userId = createResult.value.id;

			// Wait for search indexing
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify user appears in search
			const searchBefore = await tryGlobalSearch(payload, {
				query: `TempUser in:users`,
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
			const searchAfter = await tryGlobalSearch(payload, {
				query: `TempUser in:users`,
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

			// creata a new request
			// ! this is important, we need to create a new request to avoid the request being cached
			const newRequest = new Request("http://localhost:3000/test");

			const createResult = await tryCreateCourse({
				payload,
				data: {
					title: initialTitle,
					description: "This course will be updated",
					createdBy: userId2,
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

			console.log("course created");

			const courseId = createResult.value.id;

			// Wait for search indexing
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Update the course title
			const updatedTitle = `Updated Course ${Date.now()}`;
			console.log("updating course", courseId, updatedTitle);
			await tryUpdateCourse({
				payload,
				courseId,
				data: {
					title: updatedTitle,
				},
				overrideAccess: true,
			});

			console.log("course after update");

			const courseAfterUpdate = await payload.findByID({
				collection: "courses",
				id: courseId,
				req: mockRequest,
			});

			// confirm the title is updated
			expect(courseAfterUpdate.title).toBe(updatedTitle);

			// Wait for search index to update
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Search for updated title
			const searchAfterUpdate = await tryGlobalSearch(payload, {
				query: `Updated in:courses`,
			});
			expect(searchAfterUpdate.ok).toBe(true);
			if (!searchAfterUpdate.ok) {
				throw new Error("Failed to search after update");
			}

			console.log(searchAfterUpdate.value.docs);

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
			const searchForOld = await tryGlobalSearch(payload, {
				query: `Original in:courses`,
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
