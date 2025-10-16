import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload } from "payload";
import sanitizedConfig from "../payload.config";
import {
	type CreateActivityModuleArgs,
	tryCreateActivityModule,
} from "./activity-module-management";
import {
	type CreateCourseActivityModuleLinkArgs,
	tryCheckCourseActivityModuleLinkExists,
	tryCreateCourseActivityModuleLink,
	tryDeleteCourseActivityModuleLink,
	tryFindCourseActivityModuleLinkById,
	tryFindLinksByActivityModule,
	tryFindLinksByCourse,
	trySearchCourseActivityModuleLinks,
} from "./course-activity-module-link-management";
import { type CreateCourseArgs, tryCreateCourse } from "./course-management";
import { tryCreateSection } from "./course-section-management";
import { type CreateUserArgs, tryCreateUser } from "./user-management";

describe("Course Activity Module Link Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let mockRequest: Request;
	let testUser: { id: number };
	let testCourse: { id: number };
	let testSection: { id: number };
	let testActivityModule: { id: number };

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
			payload,
			data: {
				email: "testuser@example.com",
				password: "testpassword123",
				firstName: "Test",
				lastName: "User",
				role: "student",
			},
			overrideAccess: true,
		};

		const userResult = await tryCreateUser(userArgs);
		expect(userResult.ok).toBe(true);
		if (userResult.ok) {
			testUser = userResult.value;
		}

		// Create test course
		const courseArgs: CreateCourseArgs = {
			payload,
			data: {
				title: "Test Course",
				description: "A test course for link management",
				slug: "test-course",
				createdBy: testUser.id,
			},
			overrideAccess: true,
		};

		const courseResult = await tryCreateCourse(courseArgs);
		expect(courseResult.ok).toBe(true);
		if (courseResult.ok) {
			testCourse = courseResult.value;
		}

		// Create test section
		const sectionResult = await tryCreateSection({
			payload,
			data: {
				course: testCourse.id,
				title: "Test Section",
				description: "A test section for link management",
			},
			overrideAccess: true,
		});
		expect(sectionResult.ok).toBe(true);
		if (sectionResult.ok) {
			testSection = sectionResult.value;
		}

		// Create test activity module first
		const activityModuleArgs: CreateActivityModuleArgs = {
			title: "Test Activity Module",
			description: "A test activity module for link management",
			type: "page",
			status: "draft",
			userId: testUser.id,
		};

		const activityModuleResult = await tryCreateActivityModule(
			payload,
			activityModuleArgs,
		);
		expect(activityModuleResult.ok).toBe(true);
		if (!activityModuleResult.ok)
			throw new Error("Test Error: Activity module creation failed");
		testActivityModule = activityModuleResult.value;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateCourseActivityModuleLink", () => {
		test("should create a new link successfully", async () => {
			const linkArgs: CreateCourseActivityModuleLinkArgs = {
				course: testCourse.id,
				activityModule: testActivityModule.id,
				section: testSection.id,
				order: 0,
			};

			const result = await tryCreateCourseActivityModuleLink(
				payload,
				mockRequest,
				linkArgs,
			);

			expect(result.ok).toBe(true);
			if (!result.ok)
				throw new Error(
					"Test Error: Failed to create course activity module link",
				);
			const activityModuleLink = result.value;
			const course = activityModuleLink.course;
			expect(course.id).toBe(testCourse.id);

			const activityModule = activityModuleLink.activityModule;
			expect(activityModule.id).toBe(testActivityModule.id);

			expect(activityModuleLink.id).toBeDefined();
			expect(activityModuleLink.createdAt).toBeDefined();
		});

		test("should create multiple links for the same course", async () => {
			// Create another activity module for testing
			const activityModuleArgs2: CreateActivityModuleArgs = {
				title: "Second Test Activity Module",
				description: "A second test activity module for link management",
				type: "assignment",
				status: "draft",
				userId: testUser.id,
				assignmentData: {
					instructions: "Complete this assignment",
					dueDate: "2025-12-31T23:59:59Z",
					maxAttempts: 3,
					allowLateSubmissions: true,
					requireTextSubmission: true,
					requireFileSubmission: false,
				},
			};

			const activityModuleResult2 = await tryCreateActivityModule(
				payload,
				activityModuleArgs2,
			);
			expect(activityModuleResult2.ok).toBe(true);
			if (!activityModuleResult2.ok) return;

			const linkArgs: CreateCourseActivityModuleLinkArgs = {
				course: testCourse.id,
				activityModule: activityModuleResult2.value.id,
				section: testSection.id,
				order: 1,
			};

			const result = await tryCreateCourseActivityModuleLink(
				payload,
				mockRequest,
				linkArgs,
			);

			expect(result.ok).toBe(true);
			if (!result.ok)
				throw new Error(
					"Test Error: Failed to create course activity module link",
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
				payload,
				data: {
					title: "Empty Course",
					description: "A course with no links",
					slug: "empty-course",
					createdBy: testUser.id,
				},
				overrideAccess: true,
			};

			const courseResult = await tryCreateCourse(courseArgs);
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

	describe("tryFindLinksByActivityModule", () => {
		test("should find links by activity module ID", async () => {
			const result = await tryFindLinksByActivityModule(
				payload,
				testActivityModule.id,
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThan(0);
				result.value.forEach((link) => {
					// Handle both depth 0 (ID) and depth 1 (object) cases
					if (link.activityModule && typeof link.activityModule === "object") {
						expect(link.activityModule.id).toBe(testActivityModule.id);
					} else {
						expect(link.activityModule).toBe(testActivityModule.id);
					}
				});
			}
		});
	});

	describe("trySearchCourseActivityModuleLinks", () => {
		test("should search links by course", async () => {
			const result = await trySearchCourseActivityModuleLinks(payload, {
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

		test("should search links by activity module", async () => {
			const result = await trySearchCourseActivityModuleLinks(payload, {
				activityModule: testActivityModule.id,
				limit: 10,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				result.value.docs.forEach((link) => {
					// Handle both depth 0 (ID) and depth 1 (object) cases
					if (link.activityModule && typeof link.activityModule === "object") {
						expect(link.activityModule.id).toBe(testActivityModule.id);
					} else {
						expect(link.activityModule).toBe(testActivityModule.id);
					}
				});
			}
		});

		test("should return paginated results", async () => {
			const result = await trySearchCourseActivityModuleLinks(payload, {
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
			const result = await trySearchCourseActivityModuleLinks(payload, {
				course: 99999, // Non-existent course
				limit: 10,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBe(0);
			}
		});
	});

	describe("tryFindCourseActivityModuleLinkById", () => {
		let testLink: { id: number };

		beforeAll(async () => {
			// Create a test link for find tests
			const linkArgs: CreateCourseActivityModuleLinkArgs = {
				course: testCourse.id,
				activityModule: testActivityModule.id,
				section: testSection.id,
				order: 0,
			};

			const result = await tryCreateCourseActivityModuleLink(
				payload,
				mockRequest,
				linkArgs,
			);
			if (result.ok) {
				testLink = result.value;
			}
		});

		test("should find link by ID successfully", async () => {
			const result = await tryFindCourseActivityModuleLinkById(
				payload,
				testLink.id,
			);

			expect(result.ok).toBe(true);
			if (!result.ok)
				throw new Error(
					"Test Error: Failed to find course activity module link by ID",
				);
			expect(result.value.id).toBe(testLink.id);
			// Handle both depth 0 (ID) and depth 1 (object) cases
			const course = result.value.course;
			expect(course.id).toBe(testCourse.id);
		});

		test("should fail with non-existent link", async () => {
			const result = await tryFindCourseActivityModuleLinkById(payload, 99999);

			expect(result.ok).toBe(false);
			if (result.ok)
				throw new Error(
					"Test Error: Failed to find course activity module link by ID",
				);
		});
	});

	describe("tryCheckCourseActivityModuleLinkExists", () => {
		test("should return true for existing link", async () => {
			const result = await tryCheckCourseActivityModuleLinkExists(
				payload,
				testCourse.id,
				testActivityModule.id,
			);

			expect(result.ok).toBe(true);
			if (!result.ok)
				throw new Error(
					"Test Error: Failed to check course activity module link exists",
				);
			expect(result.value).toBe(true);
		});

		test("should return false for non-existing link", async () => {
			// Create a new course and activity module that don't have a link
			const courseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Unlinked Course",
					description: "A course with no links",
					slug: "unlinked-course",
					createdBy: testUser.id,
				},
				overrideAccess: true,
			};

			const courseResult = await tryCreateCourse(courseArgs);
			if (courseResult.ok) {
				// Create a section for the new course
				const sectionResult = await tryCreateSection({
					payload,
					data: {
						course: courseResult.value.id,
						title: "Unlinked Section",
						description: "A section with no links",
					},
					overrideAccess: true,
				});

				if (!sectionResult.ok) return;

				const activityModuleArgs: CreateActivityModuleArgs = {
					title: "Unlinked Activity Module",
					description: "An activity module with no links",
					type: "page",
					status: "draft",
					userId: testUser.id,
				};

				const activityModuleResult = await tryCreateActivityModule(
					payload,
					activityModuleArgs,
				);

				if (!activityModuleResult.ok)
					throw new Error("Test Error: Failed to create activity module");

				const result = await tryCheckCourseActivityModuleLinkExists(
					payload,
					courseResult.value.id,
					activityModuleResult.value.id,
				);

				expect(result.ok).toBe(true);
				if (!result.ok)
					throw new Error(
						"Test Error: Failed to check course activity module link exists",
					);
				expect(result.value).toBe(false);
			}
		});
	});

	describe("tryDeleteCourseActivityModuleLink", () => {
		test("should delete link successfully", async () => {
			// Create a link to delete
			const linkArgs: CreateCourseActivityModuleLinkArgs = {
				course: testCourse.id,
				activityModule: testActivityModule.id,
				section: testSection.id,
				order: 0,
			};

			const createResult = await tryCreateCourseActivityModuleLink(
				payload,
				mockRequest,
				linkArgs,
			);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const deleteResult = await tryDeleteCourseActivityModuleLink(
					payload,
					mockRequest,
					createResult.value.id,
				);

				expect(deleteResult.ok).toBe(true);
				if (deleteResult.ok) {
					expect(deleteResult.value.id).toBe(createResult.value.id);
				}

				// Verify link is actually deleted
				const findResult = await tryFindCourseActivityModuleLinkById(
					payload,
					createResult.value.id,
				);
				expect(findResult.ok).toBe(false);
			}
		});

		test("should fail with non-existent link", async () => {
			const result = await tryDeleteCourseActivityModuleLink(
				payload,
				mockRequest,
				99999,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain(
					"Failed to delete course-activity-module-link",
				);
			}
		});
	});
});
