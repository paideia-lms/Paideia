import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import { executeAuthStrategies, Migration, type TypedUser } from "payload";
import sanitizedConfig from "payload.config";
import {
	type CreateCourseArgs,
	tryAddRecurringSchedule,
	tryAddSpecificDate,
	tryCreateCourse,
	tryDeleteCourse,
	tryFindCourseById,
	tryRemoveRecurringSchedule,
	tryRemoveSpecificDate,
	trySearchCourses,
	tryUpdateCourse,
	type UpdateCourseArgs,
} from "../services/course-management";
import { tryCreateMedia } from "../../../module-user/src/services/media-management";
import { UserModule } from "@paideia/module-user";
import { InfrastructureModule } from "@paideia/module-infrastructure";
import type { TryResultValue } from "../utils/types";
import { createLocalReq } from "@paideia/shared";
import type {
	RecurringScheduleItem,
	SpecificDateItem,
} from "../utils/schedule-types";
import { migrations } from "src/migrations";


describe("Course Management Functions", async () => {
	const payload = await getPayload({
		key: `test-${Math.random().toString(36).substring(2, 15)}`,
		config: sanitizedConfig,
	});
	const userModule = new UserModule(payload);
	const infrastructureModule = new InfrastructureModule(payload);
	let instructor: { id: number };
	let testMediaId: number;

	beforeAll(async () => {

		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();

		const createUserResult = await userModule.createUser({
			data: {
				email: "instructor@test.com",
				password: "password123",
				firstName: "John",
				lastName: "Instructor",
				role: "instructor",
			},
			overrideAccess: true,
			req: undefined,
		});
		if (!createUserResult.ok) {
			throw new Error("Failed to create test instructor");
		}
		instructor = createUserResult.value;

		const fileBuffer = await Bun.file(
			"src/fixture/gem.png",
			{ type: "application/octet-stream" },
		).arrayBuffer();
		const createMediaResult = await tryCreateMedia({
			payload,
			file: Buffer.from(fileBuffer),
			filename: "test-course-media.png",
			mimeType: "image/png",
			alt: "Test course media",
			userId: instructor.id,
			overrideAccess: true,
			req: undefined,
		});
		if (!createMediaResult.ok) {
			throw new Error("Failed to create test media");
		}
		testMediaId = createMediaResult.value.media.id;
	});

	afterAll(async () => {
		await infrastructureModule.migrateFresh({
			migrations: migrations as Migration[],
			forceAcceptWarning: true,
		});
		await infrastructureModule.cleanS3();
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

				req: undefined,
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
				req: undefined,
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
				req: undefined,
			};

			const result = await tryCreateCourse(courseArgs);

			expect(result.ok).toBe(false);
		});

		test("should create course without dates (backward compatibility)", async () => {
			const courseArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course without Dates",
					description: "Course without any dates",
					createdBy: instructor.id,
					slug: "course-without-dates",
				},
				overrideAccess: true,
				req: undefined,
			};

			const result = await tryCreateCourse(courseArgs);

			expect(result.ok).toBe(true);
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
				req: undefined,
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

				req: undefined,
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

				req: undefined,
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

					req: undefined,
				};

				const createResult = await tryCreateCourse(createArgs);
				expect(createResult.ok).toBe(true);
				if (!createResult.ok) {
					throw new Error("Failed to create course");
				}

				// Use base64 for description image (richTextContentWithHook processes it)
				const fileBuffer = await Bun.file(
					"src/fixture/gem.png",
					{ type: "application/octet-stream" },
				).arrayBuffer();
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

				// Update course with thumbnail (media ID) and description with base64 image
				const updateResult = await tryUpdateCourse({
					payload,
					courseId: createResult.value.id,
					data: {
						title: "Updated Course Title",
						description: descriptionWithBase64,
						thumbnail: testMediaId,
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

					req: undefined,
				};

				const createResult = await tryCreateCourse(createArgs);
				expect(createResult.ok).toBe(true);
				if (!createResult.ok) {
					throw new Error("Failed to create course");
				}

				// Create base64 previews (richTextContentWithHook processes them)
				const fileBuffer = await Bun.file(
					"src/fixture/gem.png",
					{ type: "application/octet-stream" },
				).arrayBuffer();
				const base64Preview1 = `data:image/png;base64,${Buffer.from(fileBuffer).toString("base64")}`;
				const base64Preview2 = `data:image/png;base64,${Buffer.from(fileBuffer).toString("base64")}`;
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

				// Verify media array contains description images (identical base64 deduplicated to 1)
				expect(updatedCourse.descriptionMedia).toBeDefined();
				if (Array.isArray(updatedCourse.descriptionMedia)) {
					expect(updatedCourse.descriptionMedia.length).toBeGreaterThanOrEqual(1);
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

					req: undefined,
				};

				const createResult = await tryCreateCourse(createArgs);
				expect(createResult.ok).toBe(true);
				if (!createResult.ok) {
					throw new Error("Failed to create course");
				}

				// Create request with user
				const req = createLocalReq({
					user: {
						...instructor,
						collection: "users",
					} as TypedUser,
					request: new Request("http://localhost:3000/api/courses"),
				});

				// Update course with thumbnail (use pre-created media ID - File upload has issues in Payload local API)
				const updateArgs: UpdateCourseArgs = {
					payload,
					courseId: createResult.value.id,
					data: {
						thumbnail: testMediaId,
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

					req: undefined,
				};

				const createResult = await tryCreateCourse(createArgs);
				expect(createResult.ok).toBe(true);
				if (!createResult.ok) {
					throw new Error("Failed to create course");
				}

				// Update course without user in request (tryUpdateCourse requires user for access check)
				const updateArgs: UpdateCourseArgs = {
					payload,
					courseId: createResult.value.id,
					data: {
						thumbnail: testMediaId,
					},
					// No req provided, so no user
					overrideAccess: false,

					req: undefined,
				};

				const updateResult = await tryUpdateCourse(updateArgs);

				expect(updateResult.ok).toBe(false);
			});
		});

		test.skip("should update course category (requires tryCreateCategory)", async () => {
			// Skipped: module-course does not include course-category-management
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

				req: undefined,
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

				req: undefined,
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

				req: undefined,
			});

			expect(result.ok).toBe(false);
		});
	});

	describe("trySearchCourses", () => {
		test("should search courses with no filters", async () => {
			const result = await trySearchCourses({
				payload,
				overrideAccess: true,

				req: undefined,
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

				req: undefined,
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

				req: undefined,
			});

			const result = await trySearchCourses({
				payload,
				filters: { title: "React" },
				overrideAccess: true,

				req: undefined,
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

				req: undefined,
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

				req: undefined,
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

				req: undefined,
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

				req: undefined,
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

					req: undefined,
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

					req: undefined,
				});
				expect(searchResult.ok).toBe(true);

				// Delete course
				const deleteResult = await tryDeleteCourse({
					payload,
					courseId,
					overrideAccess: true,

					req: undefined,
				});
				expect(deleteResult.ok).toBe(true);

				// Verify deletion
				const findAfterDeleteResult = await tryFindCourseById({
					payload,
					courseId,
					overrideAccess: true,

					req: undefined,
				});
				expect(findAfterDeleteResult.ok).toBe(false);
			}
		});
	});

	describe("Schedule Management", () => {
		test("should add recurring schedule to course", async () => {
			// Create course without schedule
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course for Recurring Schedule",
					description: "A course to add recurring schedule",
					createdBy: instructor.id,
					slug: "course-recurring-schedule",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Add recurring schedule
			const recurringItem: RecurringScheduleItem = {
				daysOfWeek: [1, 3], // Monday, Wednesday
				startTime: "09:00",
				endTime: "12:00",
			};

			const addResult = await tryAddRecurringSchedule({
				payload,
				courseId: createResult.value.id,
				data: recurringItem,
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});

			expect(addResult.ok).toBe(true);
			if (!addResult.ok) throw new Error("Failed to add recurring schedule");

			// Verify schedule was added
			const findResult = await tryFindCourseById({
				payload,
				courseId: createResult.value.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(findResult.ok).toBe(true);
			if (!findResult.ok) throw new Error("Failed to find course");

			const course = findResult.value;
			const courseData = course as unknown as {
				recurringSchedules?: Array<{
					daysOfWeek?: Array<{ day?: number }>;
					startTime?: string;
					endTime?: string;
				}>;
			};
			const recurringSchedules = courseData.recurringSchedules;
			expect(recurringSchedules).toBeDefined();
			expect(recurringSchedules).toHaveLength(1);
			expect(recurringSchedules?.[0]?.startTime).toBe("09:00");
			expect(recurringSchedules?.[0]?.endTime).toBe("12:00");
			expect(recurringSchedules?.[0]?.daysOfWeek).toHaveLength(2);
			expect(recurringSchedules?.[0]?.daysOfWeek?.[0]?.day).toBe(1);
			expect(recurringSchedules?.[0]?.daysOfWeek?.[1]?.day).toBe(3);
		});

		test("should add specific date to course", async () => {
			// Create course without schedule
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course for Specific Date",
					description: "A course to add specific date",
					createdBy: instructor.id,
					slug: "course-specific-date",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Add specific date
			const specificItem: SpecificDateItem = {
				date: "2025-02-15",
				startTime: "14:00",
				endTime: "16:00",
			};

			const addResult = await tryAddSpecificDate({
				payload,
				courseId: createResult.value.id,
				data: specificItem,
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});

			expect(addResult.ok).toBe(true);
			if (!addResult.ok) throw new Error("Failed to add specific date");

			// Verify schedule was added
			const findResult = await tryFindCourseById({
				payload,
				courseId: createResult.value.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(findResult.ok).toBe(true);
			if (!findResult.ok) throw new Error("Failed to find course");

			const course = findResult.value;
			const courseData = course as unknown as {
				specificDates?: Array<{
					date?: string | Date;
					startTime?: string;
					endTime?: string;
				}>;
			};
			const specificDates = courseData.specificDates;
			expect(specificDates).toBeDefined();
			expect(specificDates).toHaveLength(1);
			expect(specificDates?.[0]?.startTime).toBe("14:00");
			expect(specificDates?.[0]?.endTime).toBe("16:00");
			// Check date (may be Date object or string)
			const dateValue = specificDates?.[0]?.date;
			expect(dateValue).toBeDefined();
			if (dateValue instanceof Date) {
				expect(dateValue.toISOString().split("T")[0]).toBe("2025-02-15");
			} else if (typeof dateValue === "string") {
				expect(dateValue.split("T")[0]).toBe("2025-02-15");
			}
		});

		test("should reject recurring schedule with end time before start time", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course for Validation Test",
					description: "A course to test validation",
					createdBy: instructor.id,
					slug: "course-validation-test",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Try to add recurring schedule with invalid time range
			const invalidRecurring: RecurringScheduleItem = {
				daysOfWeek: [1],
				startTime: "12:00",
				endTime: "09:00", // End time before start time
			};

			const addResult = await tryAddRecurringSchedule({
				payload,
				courseId: createResult.value.id,
				data: invalidRecurring,
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});

			expect(addResult.ok).toBe(false);
			if (addResult.ok) throw new Error("Should have failed validation");
		});

		test("should reject recurring schedule with end date before start date", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course for Date Validation Test",
					description: "A course to test date validation",
					createdBy: instructor.id,
					slug: "course-date-validation-test",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Try to add recurring schedule with invalid date range
			const invalidRecurring: RecurringScheduleItem = {
				daysOfWeek: [1],
				startTime: "09:00",
				endTime: "12:00",
				startDate: "2025-05-15",
				endDate: "2025-01-15", // End date before start date
			};

			const addResult = await tryAddRecurringSchedule({
				payload,
				courseId: createResult.value.id,
				data: invalidRecurring,
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});

			expect(addResult.ok).toBe(false);
			if (addResult.ok) throw new Error("Should have failed validation");
		});

		test("should reject specific date with end time before start time", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course for Specific Date Validation Test",
					description: "A course to test specific date validation",
					createdBy: instructor.id,
					slug: "course-specific-date-validation-test",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Try to add specific date with invalid time range
			const invalidSpecific: SpecificDateItem = {
				date: "2025-02-15",
				startTime: "16:00",
				endTime: "14:00", // End time before start time
			};

			const addResult = await tryAddSpecificDate({
				payload,
				courseId: createResult.value.id,
				data: invalidSpecific,
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});

			expect(addResult.ok).toBe(false);
			if (addResult.ok) throw new Error("Should have failed validation");
		});

		test("should add multiple recurring schedules and specific dates", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course with Multiple Schedules",
					description: "A course with multiple schedules",
					createdBy: instructor.id,
					slug: "course-multiple-schedules",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Add first recurring schedule
			const recurring1: RecurringScheduleItem = {
				daysOfWeek: [1, 3], // Monday, Wednesday
				startTime: "09:00",
				endTime: "12:00",
			};

			const addRecurring1 = await tryAddRecurringSchedule({
				payload,
				courseId: createResult.value.id,
				data: recurring1,
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});
			expect(addRecurring1.ok).toBe(true);

			// Add second recurring schedule
			const recurring2: RecurringScheduleItem = {
				daysOfWeek: [5], // Friday
				startTime: "14:00",
				endTime: "16:00",
				startDate: "2025-01-15",
				endDate: "2025-05-15",
			};

			const addRecurring2 = await tryAddRecurringSchedule({
				payload,
				courseId: createResult.value.id,
				data: recurring2,
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});
			expect(addRecurring2.ok).toBe(true);

			// Add first specific date
			const specific1: SpecificDateItem = {
				date: "2025-03-10",
				startTime: "10:00",
				endTime: "12:00",
			};

			const addSpecific1 = await tryAddSpecificDate({
				payload,
				courseId: createResult.value.id,
				data: specific1,
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});
			expect(addSpecific1.ok).toBe(true);

			// Add second specific date
			const specific2: SpecificDateItem = {
				date: "2025-04-01",
				startTime: "13:00",
				endTime: "15:00",
			};

			const addSpecific2 = await tryAddSpecificDate({
				payload,
				courseId: createResult.value.id,
				data: specific2,
				req: {
					user: instructor as TypedUser,
				},
				overrideAccess: true,
			});
			expect(addSpecific2.ok).toBe(true);

			// Verify all schedules were added
			const findResult = await tryFindCourseById({
				payload,
				courseId: createResult.value.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(findResult.ok).toBe(true);
			if (!findResult.ok) throw new Error("Failed to find course");

			const course = findResult.value;
			const courseData = course as unknown as {
				recurringSchedules?: Array<{
					daysOfWeek?: Array<{ day?: number }>;
					startTime?: string;
					endTime?: string;
				}>;
				specificDates?: Array<{
					date?: string | Date;
					startTime?: string;
					endTime?: string;
				}>;
			};
			const recurringSchedules = courseData.recurringSchedules;
			const specificDates = courseData.specificDates;

			expect(recurringSchedules).toHaveLength(2);
			expect(specificDates).toHaveLength(2);
		});

		test("should remove recurring schedule from course", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course to Remove Recurring",
					description: "A course to remove recurring schedule",
					createdBy: instructor.id,
					slug: "course-remove-recurring",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Add two recurring schedules
			const recurring1: RecurringScheduleItem = {
				daysOfWeek: [1],
				startTime: "09:00",
				endTime: "12:00",
			};
			const recurring2: RecurringScheduleItem = {
				daysOfWeek: [3],
				startTime: "14:00",
				endTime: "16:00",
			};

			await tryAddRecurringSchedule({
				payload,
				courseId: createResult.value.id,
				data: recurring1,
				req: { user: instructor as TypedUser },
				overrideAccess: true,
			});
			await tryAddRecurringSchedule({
				payload,
				courseId: createResult.value.id,
				data: recurring2,
				req: { user: instructor as TypedUser },
				overrideAccess: true,
			});

			// Remove the first one (index 0)
			const removeResult = await tryRemoveRecurringSchedule({
				payload,
				courseId: createResult.value.id,
				index: 0,
				req: { user: instructor as TypedUser },
				overrideAccess: true,
			});

			expect(removeResult.ok).toBe(true);
			if (!removeResult.ok)
				throw new Error("Failed to remove recurring schedule");

			// Verify only one remains
			const findResult = await tryFindCourseById({
				payload,
				courseId: createResult.value.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(findResult.ok).toBe(true);
			if (!findResult.ok) throw new Error("Failed to find course");

			const course = findResult.value;
			const courseData = course as unknown as {
				recurringSchedules?: Array<{
					daysOfWeek?: Array<{ day?: number }>;
					startTime?: string;
					endTime?: string;
				}>;
			};
			const recurringSchedules = courseData.recurringSchedules;
			expect(recurringSchedules).toHaveLength(1);
			// The remaining one should be the second one (index 1 originally, now index 0)
			expect(recurringSchedules?.[0]?.startTime).toBe("14:00");
		});

		test("should remove specific date from course", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course to Remove Specific",
					description: "A course to remove specific date",
					createdBy: instructor.id,
					slug: "course-remove-specific",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Add two specific dates
			const specific1: SpecificDateItem = {
				date: "2025-02-15",
				startTime: "10:00",
				endTime: "12:00",
			};
			const specific2: SpecificDateItem = {
				date: "2025-03-20",
				startTime: "14:00",
				endTime: "16:00",
			};

			await tryAddSpecificDate({
				payload,
				courseId: createResult.value.id,
				data: specific1,
				req: { user: instructor as TypedUser },
				overrideAccess: true,
			});
			await tryAddSpecificDate({
				payload,
				courseId: createResult.value.id,
				data: specific2,
				req: { user: instructor as TypedUser },
				overrideAccess: true,
			});

			// Remove the first one (index 0)
			const removeResult = await tryRemoveSpecificDate({
				payload,
				courseId: createResult.value.id,
				index: 0,
				req: { user: instructor as TypedUser },
				overrideAccess: true,
			});

			expect(removeResult.ok).toBe(true);
			if (!removeResult.ok) throw new Error("Failed to remove specific date");

			// Verify only one remains
			const findResult = await tryFindCourseById({
				payload,
				courseId: createResult.value.id,
				overrideAccess: true,
				req: undefined,
			});

			expect(findResult.ok).toBe(true);
			if (!findResult.ok) throw new Error("Failed to find course");

			const course = findResult.value;
			const courseData = course as unknown as {
				specificDates?: Array<{
					date?: string | Date;
					startTime?: string;
					endTime?: string;
				}>;
			};
			const specificDates = courseData.specificDates;
			expect(specificDates).toHaveLength(1);
			// The remaining one should be the second one (index 1 originally, now index 0)
			expect(specificDates?.[0]?.startTime).toBe("14:00");
		});

		test("should fail to remove recurring schedule with invalid index", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course for Invalid Index",
					description: "A course to test invalid index",
					createdBy: instructor.id,
					slug: "course-invalid-index",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Try to remove with invalid index
			const removeResult = await tryRemoveRecurringSchedule({
				payload,
				courseId: createResult.value.id,
				index: 0,
				req: { user: instructor as TypedUser },
				overrideAccess: true,
			});

			expect(removeResult.ok).toBe(false);
			if (removeResult.ok) throw new Error("Should have failed");
			expect(removeResult.error.message).toContain("Invalid index");
		});

		test("should fail to remove specific date with invalid index", async () => {
			// Create course
			const createArgs: CreateCourseArgs = {
				payload,
				data: {
					title: "Course for Invalid Index 2",
					description: "A course to test invalid index",
					createdBy: instructor.id,
					slug: "course-invalid-index-2",
				},
				overrideAccess: true,
				req: undefined,
			};

			const createResult = await tryCreateCourse(createArgs);
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) throw new Error("Failed to create course");

			// Try to remove with invalid index
			const removeResult = await tryRemoveSpecificDate({
				payload,
				courseId: createResult.value.id,
				index: 0,
				req: { user: instructor as TypedUser },
				overrideAccess: true,
			});

			expect(removeResult.ok).toBe(false);
			if (removeResult.ok) throw new Error("Should have failed");
			expect(removeResult.error.message).toContain("Invalid index");
		});
	});
});
