import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
} from "./activity-module-management";
import { type CreateCommitArgs, tryCreateCommit } from "./commit-management";
import {
	type CreateCourseActivityModuleCommitLinkArgs,
	tryCheckCourseCommitLinkExists,
	tryCreateCourseActivityModuleCommitLink,
	tryDeleteCourseActivityModuleCommitLink,
	tryFindCourseActivityModuleCommitLinkById,
	tryFindLinksByCommit,
	tryFindLinksByCourse,
	trySearchCourseActivityModuleCommitLinks,
} from "./course-activity-module-commit-link-management";
import { type CreateCourseArgs, tryCreateCourse } from "./course-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Course Activity Module Commit Link Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUser: { id: number };
	let testCourse: { id: number };
	let testActivityModule: { id: number };
	let testCommit: { id: number };

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

		// Create test user
		const userArgs: CreateUserArgs = {
			email: "testuser@example.com",
			password: "testpassword123",
			firstName: "Test",
			lastName: "User",
			role: "instructor",
		};

		const userResult = await tryCreateUser(payload, mockRequest, userArgs);
		expect(userResult.ok).toBe(true);
		if (userResult.ok) {
			testUser = userResult.value;
		}

		// Create test course
		const courseArgs: CreateCourseArgs = {
			title: "Test Course",
			description: "A test course for link management",
			slug: "test-course",
			createdBy: testUser.id,
		};

		const courseResult = await tryCreateCourse(
			payload,
			mockRequest,
			courseArgs,
		);
		expect(courseResult.ok).toBe(true);
		if (courseResult.ok) {
			testCourse = courseResult.value;
		}

		// Create test activity module first
		const activityModuleArgs: CreateActivityModuleArgs = {
			title: "Test Activity Module",
			description: "A test activity module for link management",
			type: "page",
			status: "draft",
			content: { body: "Test activity module content" },
			commitMessage: "Initial commit for test activity module",
			userId: testUser.id,
		};

		const activityModuleResult = await tryCreateActivityModule(
			payload,
			activityModuleArgs,
		);
		expect(activityModuleResult.ok).toBe(true);
		if (!activityModuleResult.ok)
			throw new Error("Test Error: Activity module creation failed");
		testActivityModule = activityModuleResult.value.activityModule;
		// Use the initial commit from the activity module creation
		testCommit = activityModuleResult.value.activityModule.commits[0];
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateCourseActivityModuleCommitLink", () => {
		test("should create a new link successfully", async () => {
			const linkArgs: CreateCourseActivityModuleCommitLinkArgs = {
				course: testCourse.id,
				commit: testCommit.id,
			};

			const result = await tryCreateCourseActivityModuleCommitLink(
				payload,
				mockRequest,
				linkArgs,
			);

			expect(result.ok).toBe(true);
			if (!result.ok)
				throw new Error(
					"Test Error: Failed to create course activity module commit link",
				);
			const activityModuleCommitLink = result.value;
			const course = activityModuleCommitLink.course;
			expect(course.id).toBe(testCourse.id);

			const commit = activityModuleCommitLink.commit;
			expect(commit.id).toBe(testCommit.id);

			expect(activityModuleCommitLink.id).toBeDefined();
			expect(activityModuleCommitLink.createdAt).toBeDefined();
		});

		test("should create multiple links for the same course", async () => {
			// Create another activity module with its own commit for testing
			const activityModuleArgs2: CreateActivityModuleArgs = {
				title: "Second Test Activity Module",
				description: "A second test activity module for link management",
				type: "assignment",
				status: "draft",
				content: { body: "Second test activity module content" },
				commitMessage: "Initial commit for second test activity module",
				userId: testUser.id,
			};

			const activityModuleResult2 = await tryCreateActivityModule(
				payload,
				activityModuleArgs2,
			);
			expect(activityModuleResult2.ok).toBe(true);
			if (!activityModuleResult2.ok) return;

			const linkArgs: CreateCourseActivityModuleCommitLinkArgs = {
				course: testCourse.id,
				commit: activityModuleResult2.value.activityModule.commits[0].id,
			};

			const result = await tryCreateCourseActivityModuleCommitLink(
				payload,
				mockRequest,
				linkArgs,
			);

			expect(result.ok).toBe(true);
			if (!result.ok)
				throw new Error(
					"Test Error: Failed to create course activity module commit link",
				);
			// Handle both depth 0 (ID) and depth 1 (object) cases
			const course = result.value.course;
			expect(course.id).toBe(testCourse.id);
		});
	});

	describe("tryFindLinksByCourse", () => {
		test("should find links by course ID", async () => {
			const result = await tryFindLinksByCourse(payload, testCourse.id);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThan(0);
				result.value.forEach((link) => {
					// Handle both depth 0 (ID) and depth 1 (object) cases
					const course = link.course;
					expect(course.id).toBe(testCourse.id);
				});
			}
		});

		test("should return empty array for course with no links", async () => {
			// Create a new course with no links
			const courseArgs: CreateCourseArgs = {
				title: "Empty Course",
				description: "A course with no links",
				slug: "empty-course",
				createdBy: testUser.id,
			};

			const courseResult = await tryCreateCourse(
				payload,
				mockRequest,
				courseArgs,
			);
			if (courseResult.ok) {
				const result = await tryFindLinksByCourse(
					payload,
					courseResult.value.id,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBe(0);
				}
			}
		});
	});

	describe("tryFindLinksByCommit", () => {
		test("should find links by commit ID", async () => {
			const result = await tryFindLinksByCommit(payload, testCommit.id);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThan(0);
				result.value.forEach((link) => {
					// Handle both depth 0 (ID) and depth 1 (object) cases
					if (link.commit && typeof link.commit === "object") {
						expect(link.commit.id).toBe(testCommit.id);
					} else {
						expect(link.commit).toBe(testCommit.id);
					}
				});
			}
		});
	});

	describe("trySearchCourseActivityModuleCommitLinks", () => {
		test("should search links by course", async () => {
			const result = await trySearchCourseActivityModuleCommitLinks(payload, {
				course: testCourse.id,
				limit: 10,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				result.value.docs.forEach((link) => {
					// Handle both depth 0 (ID) and depth 1 (object) cases
					if (link.course && typeof link.course === "object") {
						expect(link.course.id).toBe(testCourse.id);
					} else {
						expect(link.course).toBe(testCourse.id);
					}
				});
			}
		});

		test("should search links by commit", async () => {
			const result = await trySearchCourseActivityModuleCommitLinks(payload, {
				commit: testCommit.id,
				limit: 10,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				result.value.docs.forEach((link) => {
					// Handle both depth 0 (ID) and depth 1 (object) cases
					if (link.commit && typeof link.commit === "object") {
						expect(link.commit.id).toBe(testCommit.id);
					} else {
						expect(link.commit).toBe(testCommit.id);
					}
				});
			}
		});

		test("should return paginated results", async () => {
			const result = await trySearchCourseActivityModuleCommitLinks(payload, {
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
			const result = await trySearchCourseActivityModuleCommitLinks(payload, {
				course: 99999, // Non-existent course
				limit: 10,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBe(0);
			}
		});
	});

	describe("tryFindCourseActivityModuleCommitLinkById", () => {
		let testLink: { id: number };

		beforeAll(async () => {
			// Create a test link for find tests
			const linkArgs: CreateCourseActivityModuleCommitLinkArgs = {
				course: testCourse.id,
				commit: testCommit.id,
			};

			const result = await tryCreateCourseActivityModuleCommitLink(
				payload,
				mockRequest,
				linkArgs,
			);
			if (result.ok) {
				testLink = result.value;
			}
		});

		test("should find link by ID successfully", async () => {
			const result = await tryFindCourseActivityModuleCommitLinkById(
				payload,
				testLink.id,
			);

			expect(result.ok).toBe(true);
			if (!result.ok)
				throw new Error(
					"Test Error: Failed to find course activity module commit link by ID",
				);
			expect(result.value.id).toBe(testLink.id);
			// Handle both depth 0 (ID) and depth 1 (object) cases
			const course = result.value.course;
			expect(course.id).toBe(testCourse.id);
		});

		test("should fail with non-existent link", async () => {
			const result = await tryFindCourseActivityModuleCommitLinkById(
				payload,
				99999,
			);

			expect(result.ok).toBe(false);
			if (result.ok)
				throw new Error(
					"Test Error: Failed to find course activity module commit link by ID",
				);
		});
	});

	describe("tryCheckCourseCommitLinkExists", () => {
		test("should return true for existing link", async () => {
			const result = await tryCheckCourseCommitLinkExists(
				payload,
				testCourse.id,
				testCommit.id,
			);

			expect(result.ok).toBe(true);
			if (!result.ok)
				throw new Error(
					"Test Error: Failed to find course activity module commit link by ID",
				);
			expect(result.value).toBe(true);
		});

		test("should return false for non-existing link", async () => {
			// Create a new course and commit that don't have a link
			const courseArgs: CreateCourseArgs = {
				title: "Unlinked Course",
				description: "A course with no links",
				slug: "unlinked-course",
				createdBy: testUser.id,
			};

			const courseResult = await tryCreateCourse(
				payload,
				mockRequest,
				courseArgs,
			);
			if (courseResult.ok) {
				const commitArgs: CreateCommitArgs = {
					activityModule: testActivityModule.id,
					parentCommit: testCommit.id,
					message: "Unlinked commit",
					author: testUser.id,
					content: { body: "Unlinked content" },
				};

				const commitResult = await tryCreateCommit(payload, commitArgs);

				if (!commitResult.ok)
					throw new Error("Test Error: Failed to create commit");

				const result = await tryCheckCourseCommitLinkExists(
					payload,
					courseResult.value.id,
					commitResult.value.id,
				);

				expect(result.ok).toBe(true);
				if (!result.ok)
					throw new Error(
						"Test Error: Failed to check course commit link exists",
					);
				expect(result.value).toBe(false);
			}
		});
	});

	describe("tryDeleteCourseActivityModuleCommitLink", () => {
		test("should delete link successfully", async () => {
			// Create a link to delete
			const linkArgs: CreateCourseActivityModuleCommitLinkArgs = {
				course: testCourse.id,
				commit: testCommit.id,
			};

			const createResult = await tryCreateCourseActivityModuleCommitLink(
				payload,
				mockRequest,
				linkArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteCourseActivityModuleCommitLink(
					payload,
					mockRequest,
					createResult.value.id,
				);

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
				}

				// Verify link is actually deleted
				const findResult = await tryFindCourseActivityModuleCommitLinkById(
					payload,
					createResult.value.id,
				);
				expect(findResult.ok).toBe(false);
			}
		});

		test("should fail with non-existent link", async () => {
			const result = await tryDeleteCourseActivityModuleCommitLink(
				payload,
				mockRequest,
				99999,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain(
					"Failed to delete course-activity-module-commit-link",
				);
			}
		});
	});
});
