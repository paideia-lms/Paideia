import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { getPayload, type TypedUser } from "payload";
import sanitizedConfig from "../payload.config";
import { tryCreateCategory } from "./course-category-management";
import {
	type CreateCourseArgs,
	tryCreateCourse,
	tryDeleteCourse,
	tryFindCourseById,
	tryGetUserAccessibleCourses,
	trySearchCourses,
	tryUpdateCourse,
	type UpdateCourseArgs,
} from "./course-management";
import { tryCreateEnrollment } from "./enrollment-management";
import { tryCreateMedia } from "./media-management";
import { tryCreateUser } from "./user-management";
import type { TryResultValue } from "server/utils/type-narrowing";
import { createLocalReq } from "./utils/internal-function-utils";

describe("Course Management Functions", () => {
	let payload: Awaited<ReturnType<typeof getPayload>>;
	let instructor: TryResultValue<typeof tryCreateUser>;
	let testMediaId: number;

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

		// Create test instructor
		instructor = await tryCreateUser({
			payload,
			data: {
				email: "instructor@test.com",
				password: "password123",
				firstName: "John",
				lastName: "Instructor",
				role: "instructor",
			},
			overrideAccess: true,
		}).getOrThrow();

		// Create test media file
		const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
		const createMediaResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-course-media.png",
			mimeType: "image/png",
			alt: "Test course media",
			userId: instructor.id,
			// ! beforeAll and afterAll can have overrideAccess: true because they are not part of the test suite and are not affected by the test suite.
			overrideAccess: true,
		});

		if (!createMediaResult.ok) {
			throw new Error("Failed to create test media");
		}

		testMediaId = createMediaResult.value.media.id;
	});

	afterAll(async () => {
		// Clean up any test data
		try {
			await $`bun run migrate:fresh --force-accept-warning`;
		} catch (error) {
			console.warn("Cleanup failed:", error);
		}
	});

	describe("tryCreateCourse", () => {
		test("should create a new course successfully", async () => {
			const courseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Introduction to JavaScript",
					description: "Learn the basics of JavaScript programming",
					createdBy: instructor.id,
					slug: "introduction-to-javascript",
					status: "draft",
					tags: [{ tag: "javascript" }, { tag: "programming" }],
				},
				overrideAccess: true,
			};

			const result = await tryCreateCourse(courseArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.title).toBe(courseArgs.data.title);
				expect(result.value.description).toBe(courseArgs.data.description);
				expect(result.value.status).toBe(courseArgs.data.status || "draft");
				// Media array should be empty when no media references
				expect(result.value.descriptionMedia).toBeDefined();
				if (Array.isArray(result.value.descriptionMedia)) {
					expect(result.value.descriptionMedia.length).toBe(0);
				}
			}
		});

		test("should create course with default values", async () => {
			const courseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Basic HTML",
					description: "Learn HTML fundamentals",
					createdBy: instructor.id,
					slug: "basic-html",
				},
				overrideAccess: true,
			};

			const result = await tryCreateCourse(courseArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.status).toBe("draft");
			}
		});

		test("should fail when instructor does not exist", async () => {
			const courseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Non-existent Instructor Course",
					description: "This should fail",
					createdBy: 99999,
					slug: "non-existent-instructor-course",
				},
				overrideAccess: true,
			};

			const result = await tryCreateCourse(courseArgs);

			expect(result.ok).toBe(false);
		});
	});

	describe("tryUpdateCourse", () => {
		test("should update course successfully", async () => {
			// First create a course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Original Title",
					description: "Original description",
					createdBy: instructor.id,
					slug: "original-title",
				},
				overrideAccess: true,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			const updateResult = await tryUpdateCourse({
				payload,
				courseId: createResult.value.id,
				data: {
					title: "Updated Title",
					description: "Updated description",
					status: "published",
				},
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});

			expect(updateResult.ok).toBe(true);
			if (!updateResult.ok) throw new Error("Failed to update course");
			expect(updateResult.value.title).toBe("Updated Title");
			expect(updateResult.value.description).toBe("Updated description");
			expect(updateResult.value.status).toBe("published");
			// Media array should be empty when no media references
			expect(updateResult.value.descriptionMedia).toBeDefined();
			expect(updateResult.value.descriptionMedia?.length).toBe(0);
		});

		test("should create a course with media references in description", async () => {
			const description = `<p>Learn the basics of JavaScript programming</p><img src="/api/media/file/${testMediaId}" alt="Course image" />`;

			const courseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "JavaScript Course with Media",
					description,
					createdBy: instructor.id,
					slug: "javascript-course-with-media",
					status: "draft",
				},
				overrideAccess: true,
			};

			const result = await tryCreateCourse(courseArgs);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.description).toBe(description);
				expect(result.value.descriptionMedia).toBeDefined();
				if (Array.isArray(result.value.descriptionMedia)) {
					expect(result.value.descriptionMedia.length).toBe(1);
					const mediaId = result.value.descriptionMedia[0]?.id;
					expect(mediaId).toBe(testMediaId);
				}
			}
		});

		test("should update course media array when description changes", async () => {
			// First create a course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Original Title",
					description: "Original description without images",
					createdBy: instructor.id,
					slug: "original-title-media-update",
				},
				overrideAccess: true,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);

			if (!createResult.ok) throw new Error("Failed to create course");
			// Update with media reference
			const updatedDescription = `<p>Updated description with images!</p><img src="/api/media/file/${testMediaId}" alt="Course image" />`;

			const updateResult = await tryUpdateCourse({
				payload,
				courseId: createResult.value.id,
				data: {
					description: updatedDescription,
				},
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});

			expect(updateResult.ok).toBe(true);
			if (!updateResult.ok) throw new Error("Failed to update course");
			expect(updateResult.value.description).toBe(updatedDescription);
			expect(updateResult.value.descriptionMedia).toBeDefined();
			expect(updateResult.value.descriptionMedia?.length).toBe(1);
			const mediaId = updateResult.value.descriptionMedia?.[0]?.id;
			expect(mediaId).toBe(testMediaId);
		});

		describe("tryUpdateCourseWithFile", () => {
			test("should update course with thumbnail and description images", async () => {
				// First create a course
				const createArgs: CreateCourseArgs = {
					payload,
					data: {
						title: "Course for File Update",
						description: "Original description",
						createdBy: instructor.id,
						slug: "course-for-file-update",
					},
					overrideAccess: true,
				};

				const createResult = await tryCreateCourse(createArgs);
				expect(createResult.ok).toBe(true);
				if (!createResult.ok) {
					throw new Error("Failed to create course");
				}

				// Create File objects from fixture
				const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
				const timestamp = Date.now();
				const thumbnailFile = new File(
					[fileBuffer],
					`thumbnail-${timestamp}.png`,
					{
						type: "image/png",
					},
				);
				const _descriptionImageFile = new File(
					[fileBuffer],
					`description-image-0-${timestamp}.png`,
					{
						type: "image/png",
					},
				);

				// Create base64 preview for description image
				const base64Preview = `data:image/png;base64,${Buffer.from(fileBuffer).toString("base64")}`;
				const descriptionWithBase64 = `<p>Updated description with image</p><img src="${base64Preview}" alt="Description image" />`;

				// Create request with user
				const req = createLocalReq({
					user: {
						...instructor,
						collection: "users",
					} as TypedUser,
					request: new Request("http://localhost:3000/api/courses"),
				});

				// Update course with files

				const updateResult = await tryUpdateCourse({
					payload,
					courseId: createResult.value.id,
					data: {
						title: "Updated Course Title",
						description: descriptionWithBase64,
						thumbnail: thumbnailFile,
					},
					req,
					overrideAccess: true,
				});

				expect(updateResult.ok).toBe(true);
				if (!updateResult.ok) {
					throw new Error("Failed to update course with file");
				}

				const updatedCourse = updateResult.value;

				// Verify title was updated
				expect(updatedCourse.title).toBe("Updated Course Title");

				// Verify thumbnail was created and linked
				expect(updatedCourse.thumbnail).toBeDefined();
				if (updatedCourse.thumbnail) {
					const thumbnailId = updatedCourse.thumbnail.id;
					expect(typeof thumbnailId).toBe("number");
					expect(thumbnailId).toBeGreaterThan(0);
				}

				// Verify description has media URLs instead of base64
				expect(updatedCourse.description).toBeDefined();
				if (updatedCourse.description) {
					expect(updatedCourse.description).not.toContain("data:image");
					expect(updatedCourse.description).toContain("/api/media/file/");
				}

				// Verify media array contains the description image
				expect(updatedCourse.descriptionMedia).toBeDefined();
				if (Array.isArray(updatedCourse.descriptionMedia)) {
					expect(updatedCourse.descriptionMedia.length).toBeGreaterThan(0);
				}
			});

			test("should update course with only description images (no thumbnail)", async () => {
				// First create a course
				const createArgs: CreateCourseArgs = {
					payload,
					data: {
						title: "Course for Description Images Only",
						description: "Original description",
						createdBy: instructor.id,
						slug: "course-for-description-images-only",
					},
					overrideAccess: true,
				};

				const createResult = await tryCreateCourse(createArgs);
				expect(createResult.ok).toBe(true);
				if (!createResult.ok) {
					throw new Error("Failed to create course");
				}

				// Create File objects from fixture
				const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
				const fileBuffer2 = await Bun.file(
					"fixture/paideia-logo.png",
				).arrayBuffer();
				const timestamp = Date.now();
				const _descriptionImageFile1 = new File(
					[fileBuffer],
					`test-image-1-${timestamp}.png`,
					{
						type: "image/png",
					},
				);
				const _descriptionImageFile2 = new File(
					[fileBuffer2],
					`test-image-2-${timestamp}.png`,
					{
						type: "image/png",
					},
				);

				// Create base64 previews
				const base64Preview1 = `data:image/png;base64,${Buffer.from(fileBuffer).toString("base64")}`;
				const base64Preview2 = `data:image/png;base64,${Buffer.from(fileBuffer2).toString("base64")}`;
				const descriptionWithBase64 = `<p>Description with multiple images</p><img src="${base64Preview1}" alt="Image 1" /><img src="${base64Preview2}" alt="Image 2" />`;

				// Create request with user
				const req = createLocalReq({
					user: {
						...instructor,
						collection: "users",
					} as TypedUser,
					request: new Request("http://localhost:3000/api/courses"),
				});

				// Update course with description images only
				const updateArgs: UpdateCourseArgs = {
					payload,
					courseId: createResult.value.id,
					data: {
						description: descriptionWithBase64,
					},
					req,
					overrideAccess: true,
				};

				const updateResult = await tryUpdateCourse(updateArgs);

				expect(updateResult.ok).toBe(true);
				if (!updateResult.ok) {
					throw new Error("Failed to update course with description images");
				}

				const updatedCourse = updateResult.value;

				// Verify description has media URLs instead of base64
				expect(updatedCourse.description).toBeDefined();
				if (updatedCourse.description) {
					expect(updatedCourse.description).not.toContain("data:image");
					expect(updatedCourse.description).toContain("/api/media/file/");
				}

				// Verify media array contains both description images
				expect(updatedCourse.descriptionMedia).toBeDefined();
				if (Array.isArray(updatedCourse.descriptionMedia)) {
					expect(updatedCourse.descriptionMedia.length).toBe(2);
				}
			});

			test("should update course with thumbnail only (no description images)", async () => {
				// First create a course
				const createArgs: CreateCourseArgs = {
					payload,
					data: {
						title: "Course for Thumbnail Only",
						description: "Original description",
						createdBy: instructor.id,
						slug: "course-for-thumbnail-only",
					},
					overrideAccess: true,
				};

				const createResult = await tryCreateCourse(createArgs);
				expect(createResult.ok).toBe(true);
				if (!createResult.ok) {
					throw new Error("Failed to create course");
				}

				// Create File object from fixture
				const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
				const timestamp = Date.now();
				const thumbnailFile = new File(
					[fileBuffer],
					`thumbnail-${timestamp}.png`,
					{
						type: "image/png",
					},
				);

				// Create request with user
				const req = createLocalReq({
					user: {
						...instructor,
						collection: "users",
					} as TypedUser,
					request: new Request("http://localhost:3000/api/courses"),
				});

				// Update course with thumbnail only
				const updateArgs: UpdateCourseArgs = {
					payload,
					courseId: createResult.value.id,
					data: {
						thumbnail: thumbnailFile,
					},
					req,
					overrideAccess: true,
				};

				const updateResult = await tryUpdateCourse(updateArgs);

				expect(updateResult.ok).toBe(true);
				if (!updateResult.ok) {
					throw new Error("Failed to update course with thumbnail");
				}

				const updatedCourse = updateResult.value;

				// Verify thumbnail was created and linked
				expect(updatedCourse.thumbnail).toBeDefined();
				if (updatedCourse.thumbnail) {
					const thumbnailId = updatedCourse.thumbnail.id;
					expect(typeof thumbnailId).toBe("number");
					expect(thumbnailId).toBeGreaterThan(0);
				}
			});

			test("should fail when user is not provided", async () => {
				// First create a course
				const createArgs: CreateCourseArgs = {
					payload,
					data: {
						title: "Course for Error Test",
						description: "Original description",
						createdBy: instructor.id,
						slug: "course-for-error-test",
					},
					overrideAccess: true,
				};

				const createResult = await tryCreateCourse(createArgs);
				expect(createResult.ok).toBe(true);
				if (!createResult.ok) {
					throw new Error("Failed to create course");
				}

				// Create File object from fixture
				const fileBuffer = await Bun.file("fixture/gem.png").arrayBuffer();
				const timestamp = Date.now();
				const thumbnailFile = new File(
					[fileBuffer],
					`thumbnail-${timestamp}.png`,
					{
						type: "image/png",
					},
				);

				// Update course without user in request
				const updateArgs: UpdateCourseArgs = {
					payload,
					courseId: createResult.value.id,
					data: {
						thumbnail: thumbnailFile,
					},
					// No req provided, so no user
					overrideAccess: false,
				};

				const updateResult = await tryUpdateCourse(updateArgs);

				expect(updateResult.ok).toBe(false);
			});
		});

		test("should update course category", async () => {
			// create base course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course With Category",
					description: "Original description",
					createdBy: instructor.id,
					slug: "course-with-category",
				},
				overrideAccess: true,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// create a category to assign
			const req = new Request("http://localhost/test");
			const catResult = await tryCreateCategory({
				payload,
				req,
				name: "Test Category",
			});
			expect(catResult.ok).toBe(true);
			if (!catResult.ok) throw new Error("Failed to create category");

			// update course with category id
			const updateResult = await tryUpdateCourse({
				payload,
				courseId: createResult.value.id,
				data: {
					category: catResult.value.id,
				},
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});
			expect(updateResult.ok).toBe(true);
			if (!updateResult.ok) throw new Error("Failed to update course category");

			// verify via find
			const findResult = await tryFindCourseById({
				payload,
				courseId: createResult.value.id,
				overrideAccess: true,
			});
			expect(findResult.ok).toBe(true);
			if (findResult.ok) {
				expect(findResult.value.category?.id).toBe(catResult.value.id);
			}
		});
	});

	describe("tryFindCourseById", () => {
		test("should find existing course by ID", async () => {
			const courseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Find By ID Test",
					description: "Test course for finding by ID",
					createdBy: instructor.id,
					slug: "find-by-id-test",
				},
				overrideAccess: true,
			};

			const createResult = await tryCreateCourse(courseArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) {
				throw new Error("Failed to create course");
			}
			const findResult = await tryFindCourseById({
				payload,
				courseId: createResult.value.id,
				overrideAccess: true,
			});

			expect(findResult.ok).toBe(true);
			if (!findResult.ok) {
				throw new Error("Failed to find course");
			}
			expect(findResult.value.id).toBe(createResult.value.id);
			expect(findResult.value.title).toBe("Find By ID Test");
		});

		test("should fail when finding non-existent course by ID", async () => {
			const result = await tryFindCourseById({
				payload,
				courseId: 99999,
				overrideAccess: true,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("trySearchCourses", () => {
		test("should search courses with no filters", async () => {
			const result = await trySearchCourses({
				payload,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs).toBeInstanceOf(Array);
				expect(typeof result.value.totalDocs).toBe("number");
				expect(typeof result.value.page).toBe("number");
				expect(typeof result.value.limit).toBe("number");
			}
		});

		test("should search courses by title", async () => {
			// Create test courses
			await tryCreateCourse({
				payload,
				data: {
					title: "React Fundamentals",
					description: "Learn React",
					createdBy: instructor.id,
					slug: "react-fundamentals",
				},
				overrideAccess: true,
			});

			await tryCreateCourse({
				payload,
				data: {
					title: "Vue.js Basics",
					description: "Learn Vue",
					createdBy: instructor.id,
					slug: "vue-js-basics",
				},
				overrideAccess: true,
			});

			const result = await trySearchCourses({
				payload,
				filters: { title: "React" },
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.docs.length).toBeGreaterThan(0);
				// Should contain React course
				const reactCourse = result.value.docs.find((course) =>
					course.title.includes("React"),
				);
				expect(reactCourse).toBeDefined();
			}
		});
	});

	describe("tryDeleteCourse", () => {
		test("should delete course successfully", async () => {
			const courseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course to Delete",
					description: "This course will be deleted",
					createdBy: instructor.id,
					slug: "course-to-delete",
				},
				overrideAccess: true,
			};

			const createResult = await tryCreateCourse(courseArgs);
			expect(createResult.ok).toBe(true);

			if (!createResult.ok) {
				throw new Error("Test Error: Failed to create course");
			}
			const deleteResult = await tryDeleteCourse({
				payload,
				courseId: createResult.value.id,
				overrideAccess: true,
			});

			expect(deleteResult.ok).toBe(true);
			if (!deleteResult.ok) {
				throw new Error("Test Error: Failed to delete course");
			}
			expect(deleteResult.value.id).toBe(createResult.value.id);

			// Verify course is actually deleted
			const findResult = await tryFindCourseById({
				payload,
				courseId: createResult.value.id,
				overrideAccess: true,
			});
			expect(findResult.ok).toBe(false);
		});
	});

	describe("tryFindCoursesByInstructor", () => {
		test("should find courses by instructor", async () => {
			// This test is disabled as tryFindCoursesByInstructor doesn't exist
			// const result = await tryFindCoursesByInstructor(payload, instructorId);
			// expect(result.ok).toBe(true);
			// if (result.ok) {
			// 	expect(result.value).toBeInstanceOf(Array);
			// }
		});
	});

	describe("tryFindPublishedCourses", () => {
		test("should find only published courses", async () => {
			// This test is disabled as tryFindPublishedCourses doesn't exist
			// Create published course
			// await tryCreateCourse(payload, mockRequest, {
			// 	title: "Published Course",
			// 	description: "This course is published",
			// 	createdBy: instructorId,
			// 	slug: "published-course",
			// 	status: "published",
			// 	structure: {
			// 		sections: [
			// 			{
			// 				title: "Introduction",
			// 				description: "Published section",
			// 				items: [
			// 					{
			// 						id: 1,
			// 					},
			// 				],
			// 			},
			// 		],
			// 	},
			// });
			// Create draft course
			// await tryCreateCourse(payload, mockRequest, {
			// 	title: "Draft Course",
			// 	description: "This course is draft",
			// 	createdBy: instructorId,
			// 	slug: "draft-course",
			// 	status: "draft",
			// 	structure: {
			// 		sections: [
			// 			{
			// 				title: "Introduction",
			// 				description: "Draft section",
			// 				items: [
			// 					{
			// 						id: 1,
			// 					},
			// 				],
			// 			},
			// 		],
			// 	},
			// });
			// const result = await tryFindPublishedCourses(payload);
			// expect(result.ok).toBe(true);
			// if (result.ok) {
			// 	result.value.docs.forEach((course: any) => {
			// 		expect(course.status).toBe("published");
			// 	});
			// }
		});
	});

	describe("Integration Tests", () => {
		test("should handle complete course lifecycle", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Lifecycle Test Course",
					description: "Testing complete lifecycle",
					createdBy: instructor.id,
					slug: "lifecycle-test-course",
					status: "draft",
				},
				overrideAccess: true,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const courseId = createResult.value.id;

				// Find by ID
				const findResult = await tryFindCourseById({
					payload,
					courseId,
					overrideAccess: true,
				});
				expect(findResult.ok).toBe(true);

				// Update course
				const updateResult = await tryUpdateCourse({
					payload,
					courseId,
					data: {
						status: "published",
					},
					req: {
						user: instructor as TypedUser,
					},
					overrideAccess: true,
				});
				expect(updateResult.ok).toBe(true);

				// Search for updated course
				const searchResult = await trySearchCourses({
					payload,
					filters: { status: "published" },
					overrideAccess: true,
				});
				expect(searchResult.ok).toBe(true);

				// Delete course
				const deleteResult = await tryDeleteCourse({
					payload,
					courseId,
					overrideAccess: true,
				});
				expect(deleteResult.ok).toBe(true);

				// Verify deletion
				const findAfterDeleteResult = await tryFindCourseById({
					payload,
					courseId,
					overrideAccess: true,
				});
				expect(findAfterDeleteResult.ok).toBe(false);
			}
		});
	});

	describe("tryGetUserAccessibleCourses", () => {
		let adminUser: TryResultValue<typeof tryCreateUser>;
		let contentManagerUser: TryResultValue<typeof tryCreateUser>;
		let regularUser: TryResultValue<typeof tryCreateUser>;
		let course1: TryResultValue<typeof tryCreateCourse>;
		let course2: TryResultValue<typeof tryCreateCourse>;
		let course3: TryResultValue<typeof tryCreateCourse>;

		beforeAll(async () => {
			// Create additional test users in parallel
			const [adminResult, contentManagerResult, regularUserResult] =
				await Promise.all([
					tryCreateUser({
						payload,
						data: {
							email: "admin@test.com",
							password: "password123",
							firstName: "Admin",
							lastName: "User",
							role: "admin",
						},
						overrideAccess: true,
					}).getOrThrow(),
					tryCreateUser({
						payload,
						data: {
							email: "contentmanager@test.com",
							password: "password123",
							firstName: "Content",
							lastName: "Manager",
							role: "content-manager",
						},
						overrideAccess: true,
					}).getOrThrow(),
					tryCreateUser({
						payload,
						data: {
							email: "regular@test.com",
							password: "password123",
							firstName: "Regular",
							lastName: "User",
							role: "student",
						},
						overrideAccess: true,
					}).getOrThrow(),
				]);

			adminUser = adminResult;
			contentManagerUser = contentManagerResult;
			regularUser = regularUserResult;

			// Create test courses
			course1 = await tryCreateCourse({
				payload,
				data: {
					title: "Course 1 - Admin Access",
					description: "Test course for admin access",
					createdBy: instructor.id,
					slug: "course-1-admin-access",
					status: "published",
				},
				overrideAccess: true,
			}).getOrThrow();

			course2 = await tryCreateCourse({
				payload,
				data: {
					title: "Course 2 - Enrollment Access",
					description: "Test course for enrollment access",
					createdBy: instructor.id,
					slug: "course-2-enrollment-access",
					status: "published",
				},
				overrideAccess: true,
			}).getOrThrow();

			course3 = await tryCreateCourse({
				payload,
				data: {
					title: "Course 3 - Category Access",
					description: "Test course for category access",
					createdBy: instructor.id,
					slug: "course-3-category-access",
					status: "published",
				},
				overrideAccess: true,
			}).getOrThrow();

			// Create enrollment for regular user in course2
			await tryCreateEnrollment({
				payload,
				userId: regularUser.id,
				course: course2.id,
				role: "student",
				status: "active",
				overrideAccess: true,
			}).getOrThrow();
		});

		test("should return only owned courses for admin user", async () => {
			// Create a course owned by admin
			const adminCourseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Admin Owned Course",
					description: "Course owned by admin",
					createdBy: adminUser.id,
					slug: "admin-owned-course",
					status: "published",
				},
				overrideAccess: true,
			};

			const adminCourseResult = await tryCreateCourse(adminCourseArgs);
			expect(adminCourseResult.ok).toBe(true);

			if (!adminCourseResult.ok) {
				throw new Error("Failed to create admin course");
			}

			const result = await tryGetUserAccessibleCourses({
				payload,
				userId: adminUser.id,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Admin should only see courses they own
				const courseIds = result.value.map((course) => course.id);
				expect(courseIds).toContain(adminCourseResult.value.id);

				// Check owner role assignment
				const adminCourse = result.value.find(
					(course) => course.id === adminCourseResult.value.id,
				);
				expect(adminCourse?.role).toBeNull();
				expect(adminCourse?.source).toBe("owner");
				expect(adminCourse?.createdBy).toBe(adminUser.id);
			}
		});

		test("should return only owned courses for content manager user", async () => {
			// Create a course owned by content manager
			const contentManagerCourseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Content Manager Owned Course",
					description: "Course owned by content manager",
					createdBy: contentManagerUser.id,
					slug: "content-manager-owned-course",
					status: "published",
				},
				overrideAccess: true,
			};

			const contentManagerCourseResult = await tryCreateCourse(
				contentManagerCourseArgs,
			);
			expect(contentManagerCourseResult.ok).toBe(true);

			if (!contentManagerCourseResult.ok) {
				throw new Error("Failed to create content manager course");
			}

			const result = await tryGetUserAccessibleCourses({
				payload,
				userId: contentManagerUser.id,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Content manager should only see courses they own
				const courseIds = result.value.map((course) => course.id);
				expect(courseIds).toContain(contentManagerCourseResult.value.id);

				// Check owner role assignment
				const contentManagerCourse = result.value.find(
					(course) => course.id === contentManagerCourseResult.value.id,
				);
				expect(contentManagerCourse?.role).toBeNull();
				expect(contentManagerCourse?.source).toBe("owner");
				expect(contentManagerCourse?.createdBy).toBe(contentManagerUser.id);
			}
		});

		test("should return courses from enrollments and ownership for regular user", async () => {
			// Create a course owned by regular user
			const regularUserCourseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Regular User Owned Course",
					description: "Course owned by regular user",
					createdBy: regularUser.id,
					slug: "regular-user-owned-course",
					status: "published",
				},
				overrideAccess: true,
			};

			const regularUserCourseResult = await tryCreateCourse(
				regularUserCourseArgs,
			);
			expect(regularUserCourseResult.ok).toBe(true);

			if (!regularUserCourseResult.ok) {
				throw new Error("Failed to create regular user course");
			}

			const result = await tryGetUserAccessibleCourses({
				payload,
				userId: regularUser.id,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should have course2 (enrollment) and owned course, but not course1 or course3 (no access)
				expect(result.value.length).toBeGreaterThanOrEqual(2);

				// Check enrollment access
				const enrollmentCourse = result.value.find(
					(course) => course.id === course2.id,
				);
				expect(enrollmentCourse).toBeDefined();
				expect(enrollmentCourse?.role).toBe("student");
				expect(enrollmentCourse?.source).toBe("enrollment");
				expect(enrollmentCourse?.enrollmentStatus).toBe("active");

				// Check ownership access
				const ownedCourse = result.value.find(
					(course) => course.id === regularUserCourseResult.value.id,
				);
				expect(ownedCourse).toBeDefined();
				expect(ownedCourse?.role).toBeNull();
				expect(ownedCourse?.source).toBe("owner");
				expect(ownedCourse?.createdBy).toBe(regularUser.id);
			}
		});

		test("should not return courses from category roles for regular user", async () => {
			const result = await tryGetUserAccessibleCourses({
				payload,
				userId: regularUser.id,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Category access is no longer supported - should not see course3
				const categoryCourse = result.value.find(
					(course) => course.id === course3.id,
				);
				expect(categoryCourse).toBeUndefined();
			}
		});

		test("should not return courses user has no access to", async () => {
			const result = await tryGetUserAccessibleCourses({
				payload,
				userId: regularUser.id,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Regular user should not see course1 (no enrollment or ownership)
				const courseIds = result.value.map((course) => course.id);
				expect(courseIds).not.toContain(course1.id);
			}
		});

		test("should prioritize enrollment over ownership when user has both", async () => {
			// Create a course owned by regular user
			const ownedCourseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Owned and Enrolled Course",
					description: "Course owned by regular user who is also enrolled",
					createdBy: regularUser.id,
					slug: "owned-and-enrolled-course",
					status: "published",
				},
				overrideAccess: true,
			};

			const ownedCourseResult = await tryCreateCourse(ownedCourseArgs);
			expect(ownedCourseResult.ok).toBe(true);

			if (!ownedCourseResult.ok) {
				throw new Error("Failed to create owned course");
			}

			// Enroll the regular user in their own course
			const enrollmentResult = await tryCreateEnrollment({
				payload,
				userId: regularUser.id,
				course: ownedCourseResult.value.id,
				role: "teacher",
				status: "active",
				overrideAccess: true,
			});
			expect(enrollmentResult.ok).toBe(true);

			const result = await tryGetUserAccessibleCourses({
				payload,
				userId: regularUser.id,
				overrideAccess: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should prioritize enrollment over ownership
				const course = result.value.find(
					(course) => course.id === ownedCourseResult.value.id,
				);
				expect(course).toBeDefined();
				expect(course?.role).toBe("teacher");
				expect(course?.source).toBe("enrollment");
				expect(course?.enrollmentStatus).toBe("active");
				expect(course?.createdBy).toBe(regularUser.id);
			}
		});

		test("should handle completed enrollment status", async () => {
			// Update enrollment to completed
			const enrollments = await payload.find({
				collection: "enrollments",
				where: {
					and: [
						{ user: { equals: regularUser.id } },
						{ course: { equals: course2.id } },
					],
				},
			});

			if (enrollments.docs.length > 0) {
				await payload.update({
					collection: "enrollments",
					id: enrollments.docs[0]!.id,
					data: { status: "completed" },
				});

				const result = await tryGetUserAccessibleCourses({
					payload,
					userId: regularUser.id,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					const enrollmentCourse = result.value.find(
						(course) => course.id === course2.id,
					);
					expect(enrollmentCourse?.enrollmentStatus).toBe("completed");
					expect(enrollmentCourse?.completionPercentage).toBe(100);
				}
			}
		});

		test("should handle user with no course access", async () => {
			// Create a user with no enrollments or category roles
			const noAccessUserArgs = {
				payload,
				data: {
					email: "noaccess@test.com",
					password: "password123",
					firstName: "No",
					lastName: "Access",
					role: "student" as const,
				},
				overrideAccess: true,
			};

			const noAccessUserResult = await tryCreateUser(noAccessUserArgs);
			expect(noAccessUserResult.ok).toBe(true);

			if (noAccessUserResult.ok) {
				const result = await tryGetUserAccessibleCourses({
					payload,
					userId: noAccessUserResult.value.id,
					overrideAccess: true,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBe(0);
				}
			}
		});
	});

	describe("tryGetUserAccessibleCourses - Access Control Tests", () => {
		let testUser: TryResultValue<typeof tryCreateUser>;
		let otherUser: TryResultValue<typeof tryCreateUser>;
		let course1: TryResultValue<typeof tryCreateCourse>;
		let course2: TryResultValue<typeof tryCreateCourse>;
		let course3: TryResultValue<typeof tryCreateCourse>;

		beforeAll(async () => {
			// Refresh environment and database for clean test state
			try {
				await $`bun run migrate:fresh --force-accept-warning`;
			} catch (error) {
				console.warn(
					"Migration failed, continuing with existing state:",
					error,
				);
			}

			// Create test users in parallel
			const [testUserResult, otherUserResult] = await Promise.all([
				tryCreateUser({
					payload,
					data: {
						email: "testuser@access.com",
						password: "password123",
						firstName: "Test",
						lastName: "User",
						role: "student",
					},
					overrideAccess: true,
				}).getOrThrow(),
				tryCreateUser({
					payload,
					data: {
						email: "otheruser@access.com",
						password: "password123",
						firstName: "Other",
						lastName: "User",
						role: "student",
					},
					overrideAccess: true,
				}).getOrThrow(),
			]);

			testUser = testUserResult;
			otherUser = otherUserResult;

			// Create test courses
			course1 = await tryCreateCourse({
				payload,
				data: {
					title: "Course 1 - Owned by Test User",
					description: "Course owned by test user",
					createdBy: testUser.id,
					slug: "course-1-owned-by-test-user",
					status: "published",
				},
				overrideAccess: true,
			}).getOrThrow();

			course2 = await tryCreateCourse({
				payload,
				data: {
					title: "Course 2 - Owned by Other User",
					description: "Course owned by other user",
					createdBy: otherUser.id,
					slug: "course-2-owned-by-other-user",
					status: "published",
				},
				overrideAccess: true,
			}).getOrThrow();

			course3 = await tryCreateCourse({
				payload,
				data: {
					title: "Course 3 - Test User Enrolled",
					description: "Course where test user is enrolled",
					createdBy: otherUser.id,
					slug: "course-3-test-user-enrolled",
					status: "published",
				},
				overrideAccess: true,
			}).getOrThrow();

			// Enroll test user in course3
			await tryCreateEnrollment({
				payload,
				userId: testUser.id,
				course: course3.id,
				role: "student",
				status: "active",
				overrideAccess: true,
			}).getOrThrow();
		});

		afterAll(async () => {
			// Clean up any test data
			try {
				await $`bun run migrate:fresh --force-accept-warning`;
			} catch (error) {
				console.warn("Cleanup failed:", error);
			}
		});

		test("should only return courses user owns or is enrolled in with overrideAccess false", async () => {
			// Get test user object for authentication
			const testUserDoc = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryGetUserAccessibleCourses({
				payload,
				userId: testUser.id,
				req: createLocalReq({
					user: testUserDoc as TypedUser,
					request: new Request("http://localhost:3000/api/courses"),
				}),
				overrideAccess: false,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const courseIds = result.value.map((course) => course.id);

				// Should see course1 (owned by test user)
				expect(courseIds).toContain(course1.id);
				const ownedCourse = result.value.find(
					(course) => course.id === course1.id,
				);
				expect(ownedCourse?.source).toBe("owner");
				expect(ownedCourse?.role).toBeNull();
				expect(ownedCourse?.createdBy).toBe(testUser.id);

				// Should see course3 (enrolled in)
				expect(courseIds).toContain(course3.id);
				const enrolledCourse = result.value.find(
					(course) => course.id === course3.id,
				);
				expect(enrolledCourse?.source).toBe("enrollment");
				expect(enrolledCourse?.role).toBe("student");
				expect(enrolledCourse?.enrollmentStatus).toBe("active");

				// Should NOT see course2 (owned by other user, no enrollment)
				expect(courseIds).not.toContain(course2.id);
			}
		});

		test("should work with overrideAccess true even for different user", async () => {
			// Get test user object for authentication
			const _testUserDoc = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			// Try to get courses for otherUser while authenticated as testUser but with overrideAccess
			const result = await tryGetUserAccessibleCourses({
				payload,
				userId: otherUser.id,
				overrideAccess: true,
			});

			// This should work because overrideAccess bypasses access control
			expect(result.ok).toBe(true);
			if (result.ok) {
				const courseIds = result.value.map((course) => course.id);

				// Should see course2 (owned by other user)
				expect(courseIds).toContain(course2.id);
				const ownedCourse = result.value.find(
					(course) => course.id === course2.id,
				);
				expect(ownedCourse?.source).toBe("owner");
				expect(ownedCourse?.createdBy).toBe(otherUser.id);
			}
		});

		test("should handle user with no courses gracefully", async () => {
			// Create a user with no courses or enrollments
			const noCoursesUserArgs = {
				payload,
				data: {
					email: "nocourses@access.com",
					password: "password123",
					firstName: "No",
					lastName: "Courses",
					role: "student" as const,
				},
				overrideAccess: true,
			};

			const noCoursesUserResult = await tryCreateUser(noCoursesUserArgs);
			expect(noCoursesUserResult.ok).toBe(true);

			if (noCoursesUserResult.ok) {
				const noCoursesUser = await payload.findByID({
					collection: "users",
					id: noCoursesUserResult.value.id,
					overrideAccess: true,
				});

				const result = await tryGetUserAccessibleCourses({
					payload,
					userId: noCoursesUserResult.value.id,
					req: {
						user: noCoursesUser
							? {
									...noCoursesUser,
									collection: "users",
								}
							: null,
					},
					overrideAccess: false,
				});

				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.length).toBe(0);
				}
			}
		});

		test("should prioritize enrollment over ownership when user has both", async () => {
			// Create a course owned by test user
			const ownedCourseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Owned and Enrolled Course",
					description: "Course owned by test user who is also enrolled",
					createdBy: testUser.id,
					slug: "owned-and-enrolled-course-access-test",
					status: "published",
				},
				overrideAccess: true,
			};

			const ownedCourseResult = await tryCreateCourse(ownedCourseArgs);
			expect(ownedCourseResult.ok).toBe(true);

			if (!ownedCourseResult.ok) {
				throw new Error("Failed to create owned course");
			}

			// Enroll the test user in their own course
			const enrollmentResult = await tryCreateEnrollment({
				payload,
				userId: testUser.id,
				course: ownedCourseResult.value.id,
				role: "teacher",
				status: "active",
				overrideAccess: true,
			});
			expect(enrollmentResult.ok).toBe(true);

			// Get test user object for authentication
			const testUserDoc = await payload.findByID({
				collection: "users",
				id: testUser.id,
				overrideAccess: true,
			});

			const result = await tryGetUserAccessibleCourses({
				payload,
				userId: testUser.id,
				req: {
					user: {
						...testUserDoc,
						collection: "users",
					},
				},
				overrideAccess: false,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should prioritize enrollment over ownership
				const course = result.value.find(
					(course) => course.id === ownedCourseResult.value.id,
				);
				expect(course).toBeDefined();
				expect(course?.role).toBe("teacher");
				expect(course?.source).toBe("enrollment");
				expect(course?.enrollmentStatus).toBe("active");
				expect(course?.createdBy).toBe(testUser.id);
			}
		});
	});
});
