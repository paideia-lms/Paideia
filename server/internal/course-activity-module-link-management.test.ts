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
	tryGetCourseModuleSettings,
	trySearchCourseActivityModuleLinks,
	tryUpdateCourseModuleSettings,
} from "./course-activity-module-link-management";
import type { CourseModuleSettingsV1 } from "server/json/course-module-settings.types";
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
			pageData: {
				content: "<p>Test content</p>",
			},
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
					expect(link.activityModule.id).toBe(testActivityModule.id);
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
					pageData: {
						content: "<p>Unlinked module content</p>",
					},
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

	describe("Course Module Settings", () => {
		let assignmentModule: { id: number };
		let quizModule: { id: number };
		let discussionModule: { id: number };
		let assignmentLink: { id: number };
		let quizLink: { id: number };
		let discussionLink: { id: number };

		beforeAll(async () => {
			// Create assignment module
			const assignmentArgs: CreateActivityModuleArgs = {
				title: "Test Assignment for Settings",
				description: "Assignment module to test settings",
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

			const assignmentResult = await tryCreateActivityModule(
				payload,
				assignmentArgs,
			);
			expect(assignmentResult.ok).toBe(true);
			if (assignmentResult.ok) {
				assignmentModule = assignmentResult.value;
			}

			// Create quiz module
			const quizArgs: CreateActivityModuleArgs = {
				title: "Test Quiz for Settings",
				description: "Quiz module to test settings",
				type: "quiz",
				status: "draft",
				userId: testUser.id,
				quizData: {
					instructions: "Complete this quiz",
					dueDate: "2025-12-31T23:59:59Z",
					timeLimit: 60,
					maxAttempts: 2,
				},
			};

			const quizResult = await tryCreateActivityModule(payload, quizArgs);
			expect(quizResult.ok).toBe(true);
			if (quizResult.ok) {
				quizModule = quizResult.value;
			}

			// Create discussion module
			const discussionArgs: CreateActivityModuleArgs = {
				title: "Test Discussion for Settings",
				description: "Discussion module to test settings",
				type: "discussion",
				status: "draft",
				userId: testUser.id,
				discussionData: {
					instructions: "Participate in this discussion",
					dueDate: "2025-12-31T23:59:59Z",
					requireThread: true,
					requireReplies: true,
					minReplies: 2,
				},
			};

			const discussionResult = await tryCreateActivityModule(
				payload,
				discussionArgs,
			);
			expect(discussionResult.ok).toBe(true);
			if (discussionResult.ok) {
				discussionModule = discussionResult.value;
			}

			// Create links for testing
			const assignmentLinkResult = await tryCreateCourseActivityModuleLink(
				payload,
				mockRequest,
				{
					course: testCourse.id,
					activityModule: assignmentModule.id,
					section: testSection.id,
				},
			);
			if (assignmentLinkResult.ok) {
				assignmentLink = assignmentLinkResult.value;
			}

			const quizLinkResult = await tryCreateCourseActivityModuleLink(
				payload,
				mockRequest,
				{
					course: testCourse.id,
					activityModule: quizModule.id,
					section: testSection.id,
				},
			);
			if (quizLinkResult.ok) {
				quizLink = quizLinkResult.value;
			}

			const discussionLinkResult = await tryCreateCourseActivityModuleLink(
				payload,
				mockRequest,
				{
					course: testCourse.id,
					activityModule: discussionModule.id,
					section: testSection.id,
				},
			);
			if (discussionLinkResult.ok) {
				discussionLink = discussionLinkResult.value;
			}
		});

		describe("Creating links with initial settings", () => {
			test("should create link with assignment settings", async () => {
				const settings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Weekly Learning Journal - Week 1",
						allowSubmissionsFrom: "2025-11-01T00:00:00Z",
						dueDate: "2025-11-07T23:59:59Z",
						cutoffDate: "2025-11-10T23:59:59Z",
					},
				};

				const result = await tryCreateCourseActivityModuleLink(
					payload,
					mockRequest,
					{
						course: testCourse.id,
						activityModule: assignmentModule.id,
						section: testSection.id,
						settings,
					},
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.settings).toBeDefined();
				}
			});

			test("should create link with quiz settings", async () => {
				const settings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "quiz",
						name: "Mid-term Quiz",
						openingTime: "2025-11-15T09:00:00Z",
						closingTime: "2025-11-15T17:00:00Z",
					},
				};

				const result = await tryCreateCourseActivityModuleLink(
					payload,
					mockRequest,
					{
						course: testCourse.id,
						activityModule: quizModule.id,
						section: testSection.id,
						settings,
					},
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.settings).toBeDefined();
				}
			});

			test("should create link with discussion settings", async () => {
				const settings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "discussion",
						name: "Weekly Discussion Forum",
						dueDate: "2025-11-14T23:59:59Z",
						cutoffDate: "2025-11-17T23:59:59Z",
					},
				};

				const result = await tryCreateCourseActivityModuleLink(
					payload,
					mockRequest,
					{
						course: testCourse.id,
						activityModule: discussionModule.id,
						section: testSection.id,
						settings,
					},
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.settings).toBeDefined();
				}
			});

			test("should create link with page settings (name only)", async () => {
				const pageModule = await tryCreateActivityModule(payload, {
					title: "Test Page",
					description: "Page module",
					type: "page",
					status: "draft",
					userId: testUser.id,
					pageData: { content: "<p>Page content</p>" },
				});

				if (!pageModule.ok) return;

				const settings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "page",
						name: "Custom Page Title",
					},
				};

				const result = await tryCreateCourseActivityModuleLink(
					payload,
					mockRequest,
					{
						course: testCourse.id,
						activityModule: pageModule.value.id,
						section: testSection.id,
						settings,
					},
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.settings).toBeDefined();
				}
			});

			test("should create link with whiteboard settings (name only)", async () => {
				const whiteboardModule = await tryCreateActivityModule(payload, {
					title: "Test Whiteboard",
					description: "Whiteboard module",
					type: "whiteboard",
					status: "draft",
					userId: testUser.id,
					whiteboardData: { content: "" },
				});

				if (!whiteboardModule.ok) return;

				const settings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "whiteboard",
						name: "Brainstorming Session 1",
					},
				};

				const result = await tryCreateCourseActivityModuleLink(
					payload,
					mockRequest,
					{
						course: testCourse.id,
						activityModule: whiteboardModule.value.id,
						section: testSection.id,
						settings,
					},
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.settings).toBeDefined();
				}
			});
		});

		describe("tryUpdateCourseModuleSettings", () => {
			test("should update assignment settings successfully", async () => {
				const newSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Updated Assignment Name",
						allowSubmissionsFrom: "2025-11-05T00:00:00Z",
						dueDate: "2025-11-12T23:59:59Z",
						cutoffDate: "2025-11-15T23:59:59Z",
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					assignmentLink.id,
					newSettings,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.settings).toBeDefined();
				}
			});

			test("should update quiz settings successfully", async () => {
				const newSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "quiz",
						name: "Updated Quiz Name",
						openingTime: "2025-11-20T08:00:00Z",
						closingTime: "2025-11-20T18:00:00Z",
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					quizLink.id,
					newSettings,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.settings).toBeDefined();
				}
			});

			test("should update discussion settings successfully", async () => {
				const newSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "discussion",
						name: "Updated Discussion Name",
						dueDate: "2025-11-18T23:59:59Z",
						cutoffDate: "2025-11-21T23:59:59Z",
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					discussionLink.id,
					newSettings,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.settings).toBeDefined();
				}
			});
		});

		describe("tryGetCourseModuleSettings", () => {
			test("should retrieve settings for a link", async () => {
				// First update with known settings
				const settings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Test Assignment Settings",
						dueDate: "2025-12-01T23:59:59Z",
						cutoffDate: "2025-12-05T23:59:59Z",
					},
				};

				await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					assignmentLink.id,
					settings,
				);

				// Now retrieve
				const result = await tryGetCourseModuleSettings(
					payload,
					assignmentLink.id,
				);

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.settings).toBeDefined();
					if (result.value.settings?.settings.type === "assignment") {
						expect(result.value.settings.settings.name).toBe(
							"Test Assignment Settings",
						);
					}
				}
			});

			test("should handle link without settings", async () => {
				// Create a link without settings
				const newLinkResult = await tryCreateCourseActivityModuleLink(
					payload,
					mockRequest,
					{
						course: testCourse.id,
						activityModule: assignmentModule.id,
						section: testSection.id,
					},
				);

				if (!newLinkResult.ok) return;

				const result = await tryGetCourseModuleSettings(
					payload,
					newLinkResult.value.id,
				);

				expect(result.ok).toBe(true);
				// Settings should be null or undefined for links without settings
			});
		});

		describe("Date Validation", () => {
			test("should reject assignment with due date after cutoff date", async () => {
				const invalidSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Invalid Assignment",
						dueDate: "2025-11-20T23:59:59Z",
						cutoffDate: "2025-11-15T23:59:59Z", // Cutoff before due date
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					assignmentLink.id,
					invalidSettings,
				);

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.message).toContain(
						"Due date must be before cutoff date",
					);
				}
			});

			test("should reject assignment with allowSubmissionsFrom after due date", async () => {
				const invalidSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Invalid Assignment",
						allowSubmissionsFrom: "2025-11-20T00:00:00Z",
						dueDate: "2025-11-15T23:59:59Z", // Due date before submissions open
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					assignmentLink.id,
					invalidSettings,
				);

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.message).toContain(
						"Allow submissions from date must be before due date",
					);
				}
			});

			test("should reject assignment with allowSubmissionsFrom after cutoff date", async () => {
				const invalidSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Invalid Assignment",
						allowSubmissionsFrom: "2025-11-25T00:00:00Z",
						cutoffDate: "2025-11-20T23:59:59Z", // Cutoff before submissions open
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					assignmentLink.id,
					invalidSettings,
				);

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.message).toContain(
						"Allow submissions from date must be before cutoff date",
					);
				}
			});

			test("should reject quiz with opening time after closing time", async () => {
				const invalidSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "quiz",
						name: "Invalid Quiz",
						openingTime: "2025-11-15T18:00:00Z",
						closingTime: "2025-11-15T09:00:00Z", // Closes before opens
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					quizLink.id,
					invalidSettings,
				);

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.message).toContain(
						"Opening time must be before closing time",
					);
				}
			});

			test("should reject discussion with due date after cutoff date", async () => {
				const invalidSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "discussion",
						name: "Invalid Discussion",
						dueDate: "2025-11-20T23:59:59Z",
						cutoffDate: "2025-11-15T23:59:59Z", // Cutoff before due date
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					discussionLink.id,
					invalidSettings,
				);

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.message).toContain(
						"Due date must be before cutoff date",
					);
				}
			});

			test("should accept valid assignment date ranges", async () => {
				const validSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Valid Assignment",
						allowSubmissionsFrom: "2025-11-01T00:00:00Z",
						dueDate: "2025-11-15T23:59:59Z",
						cutoffDate: "2025-11-20T23:59:59Z",
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					assignmentLink.id,
					validSettings,
				);

				expect(result.ok).toBe(true);
			});

			test("should accept valid quiz time range", async () => {
				const validSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "quiz",
						name: "Valid Quiz",
						openingTime: "2025-11-15T09:00:00Z",
						closingTime: "2025-11-15T17:00:00Z",
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					quizLink.id,
					validSettings,
				);

				expect(result.ok).toBe(true);
			});

			test("should accept valid discussion date range", async () => {
				const validSettings: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "discussion",
						name: "Valid Discussion",
						dueDate: "2025-11-15T23:59:59Z",
						cutoffDate: "2025-11-20T23:59:59Z",
					},
				};

				const result = await tryUpdateCourseModuleSettings(
					payload,
					mockRequest,
					discussionLink.id,
					validSettings,
				);

				expect(result.ok).toBe(true);
			});
		});

		describe("Same module, multiple links with different settings", () => {
			test("should allow same assignment module with different settings in same course", async () => {
				// Create first link with settings
				const settings1: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Learning Journal - Week 1",
						dueDate: "2025-11-07T23:59:59Z",
						cutoffDate: "2025-11-10T23:59:59Z",
					},
				};

				const link1 = await tryCreateCourseActivityModuleLink(
					payload,
					mockRequest,
					{
						course: testCourse.id,
						activityModule: assignmentModule.id,
						section: testSection.id,
						settings: settings1,
					},
				);

				expect(link1.ok).toBe(true);

				// Create second link with different settings
				const settings2: CourseModuleSettingsV1 = {
					version: "v1",
					settings: {
						type: "assignment",
						name: "Learning Journal - Week 2",
						dueDate: "2025-11-14T23:59:59Z",
						cutoffDate: "2025-11-17T23:59:59Z",
					},
				};

				const link2 = await tryCreateCourseActivityModuleLink(
					payload,
					mockRequest,
					{
						course: testCourse.id,
						activityModule: assignmentModule.id,
						section: testSection.id,
						settings: settings2,
					},
				);

				expect(link2.ok).toBe(true);

				// Verify both links exist with different settings
				if (link1.ok && link2.ok) {
					const retrievedLink1 = await tryGetCourseModuleSettings(
						payload,
						link1.value.id,
					);
					const retrievedLink2 = await tryGetCourseModuleSettings(
						payload,
						link2.value.id,
					);

					expect(retrievedLink1.ok).toBe(true);
					expect(retrievedLink2.ok).toBe(true);

					if (
						retrievedLink1.ok &&
						retrievedLink2.ok &&
						retrievedLink1.value.settings?.settings.type === "assignment" &&
						retrievedLink2.value.settings?.settings.type === "assignment"
					) {
						expect(retrievedLink1.value.settings.settings.name).toBe(
							"Learning Journal - Week 1",
						);
						expect(retrievedLink2.value.settings.settings.name).toBe(
							"Learning Journal - Week 2",
						);
					}
				}
			});
		});
	});
});
