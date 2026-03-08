import type { Where } from "payload";
import searchQueryParser from "search-query-parser";
import { CourseSections } from "../collections/course-sections";
import { Courses } from "../collections/courses";
import { Result } from "typescript-result";
import {
	DevelopmentError,
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "../errors";
import type { Course } from "payload-types";
import { handleTransactionId } from "@paideia/shared";
import {
	type Depth,
	interceptPayloadError,
	stripDepth,
	type BaseInternalFunctionArgs,
} from "@paideia/shared";
import type {
	RecurringScheduleItem,
	SpecificDateItem,
} from "../utils/schedule-types";

export interface CreateCourseArgs extends BaseInternalFunctionArgs {
	data: {
		title: string;
		description: string;
		slug: string;
		createdBy: number;
		status?: "draft" | "published" | "archived";
		thumbnail?: number;
		tags?: { tag?: string }[];
		category?: number;
	};
}

export interface FindCourseByIdArgs extends BaseInternalFunctionArgs {
	courseId: number;
}

export interface SearchCoursesArgs extends BaseInternalFunctionArgs {
	filters?: {
		title?: string;
		createdBy?: number;
		status?: "draft" | "published" | "archived";
		limit?: number;
		page?: number;
	};
}

export interface DeleteCourseArgs extends BaseInternalFunctionArgs {
	courseId: number;
}

export interface FindCoursesByInstructorArgs extends BaseInternalFunctionArgs {
	instructorId: number;
	limit?: number;
}

export interface FindPublishedCoursesArgs extends BaseInternalFunctionArgs {
	limit?: number;
	page?: number;
}

/**
 * Creates a new course using Payload local API
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryCreateCourse(args: CreateCourseArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				data: {
					title,
					description,
					slug,
					createdBy,
					status = "draft",
					thumbnail,
					tags,
					category,
				},
				req,
				overrideAccess = false,
			} = args;

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const newCourse = await payload
					.create({
						collection: Courses.slug,
						data: {
							title,
							description,
							slug,
							createdBy,
							status,
							thumbnail,
							tags,
							// category,
						},
						depth: 1,
						req: txInfo.reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<1, "create">());

				// create the gradebook as well
				// const gradebookResult = await payload
				// 	.create({
				// 		collection: Gradebooks.slug,
				// 		data: {
				// 			course: newCourse.id,
				// 		},
				// 		depth: 0,
				// 		req: txInfo.reqWithTransaction,
				// 		overrideAccess,
				// 	})
				// 	.then(stripDepth<0, "create">())
				// 	.catch((error) => {
				// 		interceptPayloadError({
				// 			error,
				// 			functionNamePrefix: "tryCreateCourse",
				// 			args: { payload, req, overrideAccess },
				// 		});
				// 		throw error;
				// 	});

				// if (gradebookResult.course !== newCourse.id) {
				// 	throw new DevelopmentError(
				// 		"tryCreateCourse: Gradebook course ID does not match course ID",
				// 	);
				// }

				// create a default section for the course
				const defaultSectionResult = await payload
					.create({
						collection: CourseSections.slug,
						data: {
							course: newCourse.id,
							title: "Course Content",
							description: "Default section for course content",
							contentOrder: 0,
						},
						depth: 0,
						req: txInfo.reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<0, "create">());

				const result = {
					...newCourse,
					defaultSection: defaultSectionResult,
				};
				return result;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError(
				error instanceof Error ? error.message : "Failed to create course",
				{
					cause: error,
				},
			),
	);
}

export interface UpdateCourseArgs extends BaseInternalFunctionArgs {
	courseId: number;
	data: {
		title?: string;
		status?: "draft" | "published" | "archived";
		description?: string;
		thumbnail?: number | File | null;
		tags?: { tag?: string }[];
		category?: number | null;
	};
}
export function tryUpdateCourse(args: UpdateCourseArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, data, req, overrideAccess = false } = args;

			const currentUser = req?.user;
			const userId = currentUser?.id;
			if (!userId) {
				throw new InvalidArgumentError("User ID is required");
			}

			// Check if course exists
			const existingCourse = await payload.findByID({
				collection: Courses.slug,
				id: courseId,
				req,
				overrideAccess,
			});

			if (!existingCourse) {
				throw new Error(`Course with ID ${courseId} not found`);
			}

			const updatedCourse = await payload
				.update({
					collection: "courses",
					id: courseId,
					data: {
						...data,
						// field hook 
						thumbnail: data.thumbnail as number | null,
					},
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "update">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryUpdateCourse",
						args: { payload, req, overrideAccess },
					});
					throw error;
				});

			return updatedCourse;
		},
		(error) => {
			const transformed = transformError(error);
			if (transformed) return transformed;
			// Preserve original error message if available
			const errorMessage =
				error instanceof Error ? error.message : "Failed to update course";
			return new UnknownError(errorMessage, {
				cause: error,
			});
		},
	);
}

// ============================================================================
// SCHEDULE MANAGEMENT FUNCTIONS
// ============================================================================

export interface AddRecurringScheduleArgs extends BaseInternalFunctionArgs {
	courseId: number;
	data: RecurringScheduleItem;
}

export interface AddSpecificDateArgs extends BaseInternalFunctionArgs {
	courseId: number;
	data: SpecificDateItem;
}

export interface RemoveRecurringScheduleArgs extends BaseInternalFunctionArgs {
	courseId: number;
	index: number;
}

export interface RemoveSpecificDateArgs extends BaseInternalFunctionArgs {
	courseId: number;
	index: number;
}

/**
 * Adds a recurring schedule item to a course
 */
export function tryAddRecurringSchedule(args: AddRecurringScheduleArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, data, req, overrideAccess = false } = args;

			// Check if course exists
			const existingCourse = await payload.findByID({
				collection: Courses.slug,
				id: courseId,
				req,
				overrideAccess,
			});

			if (!existingCourse) {
				throw new Error(`Course with ID ${courseId} not found`);
			}

			// Validate time range
			if (data.startTime >= data.endTime) {
				throw new InvalidArgumentError(
					"End time must be later than start time",
				);
			}

			// Validate date range if both are provided
			if (data.startDate && data.endDate) {
				const startDate = new Date(data.startDate);
				const endDate = new Date(data.endDate);
				if (endDate < startDate) {
					throw new InvalidArgumentError(
						"End date must be later than or equal to start date",
					);
				}
			}

			// Get current recurring schedules
			const courseData = existingCourse as unknown as {
				recurringSchedules?: Array<{
					daysOfWeek?: Array<{ day?: number }>;
					startTime?: string;
					endTime?: string;
					startDate?: string | Date;
					endDate?: string | Date;
				}>;
			};
			const currentRecurring = courseData.recurringSchedules ?? [];

			// Convert RecurringScheduleItem to Payload array format
			const newItem = {
				daysOfWeek: data.daysOfWeek.map((day) => ({ day })),
				startTime: data.startTime,
				endTime: data.endTime,
				startDate: data.startDate ? new Date(data.startDate) : undefined,
				endDate: data.endDate ? new Date(data.endDate) : undefined,
			};

			// Add the new item
			const updatedRecurring = [...currentRecurring, newItem];

			// Update the course
			const updatedCourse = await payload
				.update({
					collection: Courses.slug,
					id: courseId,
					data: {
						recurringSchedules: updatedRecurring,
					} as any,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "update">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryAddRecurringSchedule",
						args: { payload, req, overrideAccess },
					});
					throw error;
				});

			return updatedCourse;
		},
		(error) => {
			const transformed = transformError(error);
			if (transformed) return transformed;
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to add recurring schedule";
			return new UnknownError(errorMessage, {
				cause: error,
			});
		},
	);
}

/**
 * Adds a specific date schedule item to a course
 */
export function tryAddSpecificDate(args: AddSpecificDateArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, data, req, overrideAccess = false } = args;

			// Check if course exists
			const existingCourse = await payload.findByID({
				collection: Courses.slug,
				id: courseId,
				req,
				overrideAccess,
			});

			if (!existingCourse) {
				throw new Error(`Course with ID ${courseId} not found`);
			}

			// Validate time range
			if (data.startTime >= data.endTime) {
				throw new InvalidArgumentError(
					"End time must be later than start time",
				);
			}

			// Get current specific dates
			const courseData = existingCourse as unknown as {
				specificDates?: Array<{
					date?: string | Date;
					startTime?: string;
					endTime?: string;
				}>;
			};
			const currentSpecific = courseData.specificDates ?? [];

			// Convert SpecificDateItem to Payload array format
			const newItem = {
				date: new Date(data.date),
				startTime: data.startTime,
				endTime: data.endTime,
			};

			// Add the new item
			const updatedSpecific = [...currentSpecific, newItem];

			// Update the course
			const updatedCourse = await payload
				.update({
					collection: Courses.slug,
					id: courseId,
					data: {
						specificDates: updatedSpecific,
					} as any,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "update">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryAddSpecificDate",
						args: { payload, req, overrideAccess },
					});
					throw error;
				});

			return updatedCourse;
		},
		(error) => {
			const transformed = transformError(error);
			if (transformed) return transformed;
			const errorMessage =
				error instanceof Error ? error.message : "Failed to add specific date";
			return new UnknownError(errorMessage, {
				cause: error,
			});
		},
	);
}

/**
 * Removes a recurring schedule item from a course by index
 */
export function tryRemoveRecurringSchedule(args: RemoveRecurringScheduleArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, index, req, overrideAccess = false } = args;

			// Check if course exists
			const existingCourse = await payload.findByID({
				collection: Courses.slug,
				id: courseId,
				req,
				overrideAccess,
			});

			if (!existingCourse) {
				throw new Error(`Course with ID ${courseId} not found`);
			}

			// Get current recurring schedules
			const courseData = existingCourse as unknown as {
				recurringSchedules?: Array<{
					daysOfWeek?: Array<{ day?: number }>;
					startTime?: string;
					endTime?: string;
					startDate?: string | Date;
					endDate?: string | Date;
				}>;
			};
			const currentRecurring = courseData.recurringSchedules ?? [];

			// Validate index
			if (index < 0 || index >= currentRecurring.length) {
				throw new InvalidArgumentError(
					`Invalid index ${index}. Recurring schedules array has ${currentRecurring.length} items.`,
				);
			}

			// Remove the item at the specified index
			const updatedRecurring = currentRecurring.filter((_, i) => i !== index);

			// Update the course
			const updatedCourse = await payload
				.update({
					collection: Courses.slug,
					id: courseId,
					data: {
						recurringSchedules: updatedRecurring,
					} as any,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "update">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryRemoveRecurringSchedule",
						args: { payload, req, overrideAccess },
					});
					throw error;
				});

			return updatedCourse;
		},
		(error) => {
			const transformed = transformError(error);
			if (transformed) return transformed;
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to remove recurring schedule";
			return new UnknownError(errorMessage, {
				cause: error,
			});
		},
	);
}

/**
 * Removes a specific date schedule item from a course by index
 */
export function tryRemoveSpecificDate(args: RemoveSpecificDateArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, index, req, overrideAccess = false } = args;

			// Check if course exists
			const existingCourse = await payload.findByID({
				collection: Courses.slug,
				id: courseId,
				req,
				overrideAccess,
			});

			if (!existingCourse) {
				throw new Error(`Course with ID ${courseId} not found`);
			}

			// Get current specific dates
			const courseData = existingCourse as unknown as {
				specificDates?: Array<{
					date?: string | Date;
					startTime?: string;
					endTime?: string;
				}>;
			};
			const currentSpecific = courseData.specificDates ?? [];

			// Validate index
			if (index < 0 || index >= currentSpecific.length) {
				throw new InvalidArgumentError(
					`Invalid index ${index}. Specific dates array has ${currentSpecific.length} items.`,
				);
			}

			// Remove the item at the specified index
			const updatedSpecific = currentSpecific.filter((_, i) => i !== index);

			// Update the course
			const updatedCourse = await payload
				.update({
					collection: Courses.slug,
					id: courseId,
					data: {
						specificDates: updatedSpecific,
					} as any,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "update">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryRemoveSpecificDate",
						args: { payload, req, overrideAccess },
					});
					throw error;
				});

			return updatedCourse;
		},
		(error) => {
			const transformed = transformError(error);
			if (transformed) return transformed;
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to remove specific date";
			return new UnknownError(errorMessage, {
				cause: error,
			});
		},
	);
}

/**
 * Finds a course by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryFindCourseById(args: FindCourseByIdArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, req, overrideAccess = false } = args;

			const course = await payload
				.findByID({
					collection: Courses.slug,
					id: courseId,
					depth: 2,
					req,
					overrideAccess,
				})
				.then(stripDepth<2, "findByID">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryFindCourseById",
						args: { payload, req, overrideAccess },
					});
					throw error;
				})


			return course;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find course by ID", {
				cause: error,
			}),
	);
}

/**
 * Searches courses with various filters
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function trySearchCourses(args: SearchCoursesArgs) {
	return Result.try(
		async () => {
			const { payload, filters = {}, req, overrideAccess = false } = args;

			const { title, createdBy, status, limit = 10, page = 1 } = filters;

			const where: Where = {};

			if (title) {
				where.title = {
					contains: title,
				};
			}

			if (createdBy) {
				where.createdBy = {
					equals: createdBy,
				};
			}

			if (status) {
				where.status = {
					equals: status,
				};
			}

			const courses = await payload.find({
				collection: "courses",
				where,
				limit,
				page,
				sort: "-createdAt",
				req,
				overrideAccess,
			});

			return {
				docs: courses.docs as Course[],
				totalDocs: courses.totalDocs,
				totalPages: courses.totalPages,
				page: courses.page,
				limit: courses.limit,
				hasNextPage: courses.hasNextPage,
				hasPrevPage: courses.hasPrevPage,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to search courses", {
				cause: error,
			}),
	);
}

/**
 * Deletes a course by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryDeleteCourse(args: DeleteCourseArgs) {
	return Result.try(
		async () => {
			const { payload, courseId, req, overrideAccess = false } = args;

			const deletedCourse = await payload
				.delete({
					collection: Courses.slug,
					id: courseId,
					depth: 0,
					req,
					overrideAccess,
				})
				.then(stripDepth<0, "delete">());

			return deletedCourse;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete course", {
				cause: error,
			}),
	);
}

/**
 * Finds courses by instructor ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryFindCoursesByInstructor(args: FindCoursesByInstructorArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				instructorId,
				limit = 10,
				req,
				overrideAccess = false,
			} = args;

			const courses = await payload
				.find({
					collection: "courses",
					where: {
						createdBy: {
							equals: instructorId,
						},
					},
					limit,
					depth: 1,
					sort: "-createdAt",
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			return courses.docs as Course[];
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find courses by instructor", {
				cause: error,
			}),
	);
}

/**
 * Finds published courses only
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryFindPublishedCourses(args: FindPublishedCoursesArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				limit = 10,
				page = 1,
				req,
				overrideAccess = false,
			} = args;

			const courses = await payload
				.find({
					collection: "courses",
					where: {
						status: {
							equals: "published",
						},
					},
					limit,
					page,
					sort: "-createdAt",
					req,
					depth: 1,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			return courses;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find published courses", {
				cause: error,
			}),
	);
}

export interface FindAllCoursesArgs extends BaseInternalFunctionArgs {
	limit?: number;
	page?: number;
	sort?: string;
	query?: string;
}

/**
 * Finds all courses with pagination and search
 * Supports search by title and filter by status
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export function tryFindAllCourses(args: FindAllCoursesArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				limit = 10,
				page = 1,
				sort = "-createdAt",
				query,
				req,
				overrideAccess = false,
			} = args;

			// Parse search query
			const where: Where = {};
			if (query) {
				const parsed = searchQueryParser.parse(query, {
					keywords: ["status"],
				});

				const searchText = typeof parsed === "string" ? parsed : parsed.text;
				const statusFilter =
					typeof parsed === "object" ? parsed.status : undefined;

				const orConditions = [];

				// Text search across title and description
				if (searchText) {
					const textArray = Array.isArray(searchText)
						? searchText
						: [searchText];
					for (const text of textArray) {
						if (text) {
							orConditions.push(
								{
									title: {
										contains: text,
									},
								},
								{
									description: {
										contains: text,
									},
								},
								{
									slug: {
										contains: text,
									},
								},
							);
						}
					}
				}

				if (orConditions.length > 0) {
					where.or = orConditions;
				}

				// Status filter
				if (statusFilter) {
					const statuses = Array.isArray(statusFilter)
						? statusFilter
						: [statusFilter];
					where.status = {
						in: statuses as Course["status"][],
					};
				}

			}

			// console.log("where", where);

			const coursesResult = await payload
				.find({
					collection: Courses.slug,
					where,
					limit,
					page,
					sort,
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			return coursesResult;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find all courses", {
				cause: error,
			}),
	);
}

// ============================================================================
// User Course Access Functions
// ============================================================================

// export interface GetUserAccessibleCoursesArgs extends BaseInternalFunctionArgs {
// 	userId: number;
// }

// export interface UserAccessibleCourse {
// 	id: number;
// 	title: string;
// 	category: string | null;
// 	enrollmentStatus: "active" | "inactive" | "completed" | "dropped" | null;
// 	completionPercentage: number;
// 	thumbnailId: number | null;
// 	role: "student" | "teacher" | "ta" | "manager" | null;
// 	source: "enrollment" | "owner";
// 	createdBy: number;
// }

// /**
//  * Gets all courses a user has access to via enrollments or ownership
//  * When user is provided, access control is enforced based on that user
//  * When overrideAccess is true, bypasses all access control
//  */
// export function tryGetUserAccessibleCourses(
// 	args: GetUserAccessibleCoursesArgs,
// ) {
// 	return Result.try(
// 		async () => {
// 			const { payload, userId, req, overrideAccess = false } = args;

// 			if (!userId) {
// 				throw new InvalidArgumentError("User ID is required");
// 			}

// 			const coursesMap = new Map<number, UserAccessibleCourse>();

// 			// 1. Get courses created by user (owner)
// 			const createdCourses = await payload
// 				.find({
// 					collection: "courses",
// 					where: {
// 						createdBy: {
// 							equals: userId,
// 						},
// 					},
// 					depth: 1,
// 					pagination: false,
// 					req,
// 					overrideAccess,
// 				})
// 				.then(stripDepth<1, "find">());

// 			for (const course of createdCourses.docs) {
// 				const categoryName = course.category ? course.category.name : null;

// 				coursesMap.set(course.id, {
// 					id: course.id,
// 					title: course.title,
// 					category: categoryName,
// 					enrollmentStatus: null, // No enrollment status for owner
// 					completionPercentage: 0, // Dummy for now
// 					thumbnailId: course.thumbnail?.id ?? null,
// 					role: null, // No role for owner
// 					source: "owner",
// 					createdBy: userId,
// 				});
// 			}

// 			// 2. Get courses from enrollments
// 			const enrollmentsResult = await tryFindEnrollmentsByUser({
// 				payload,
// 				userId,
// 				req,
// 				overrideAccess,
// 			});
// 			if (enrollmentsResult.ok) {
// 				for (const enrollment of enrollmentsResult.value) {
// 					// Get course details
// 					const courseId = enrollment.course.id;
// 					const course = await payload
// 						.findByID({
// 							collection: "courses",
// 							id: courseId,
// 							depth: 1,
// 							req,
// 							overrideAccess,
// 						})
// 						.then(stripDepth<1, "findByID">());

// 					if (course) {
// 						const categoryName = course.category?.name ?? null;

// 						// const thumbnailUrl = course.thumbnail
// 						// 	? href(`/api/media/file/:mediaId`, {
// 						// 			mediaId: course.thumbnail.id.toString(),
// 						// 		})
// 						// 	: null;

// 						// If course already exists in map (from owner), update with enrollment info
// 						if (coursesMap.has(course.id)) {
// 							const existingCourse = coursesMap.get(course.id);
// 							if (existingCourse) {
// 								coursesMap.set(course.id, {
// 									...existingCourse,
// 									enrollmentStatus: enrollment.status,
// 									role: enrollment.role,
// 									source: "enrollment", // Prioritize enrollment over owner
// 								});
// 							}
// 						} else {
// 							coursesMap.set(course.id, {
// 								id: course.id,
// 								title: course.title,
// 								category: categoryName,
// 								enrollmentStatus: enrollment.status,
// 								completionPercentage:
// 									enrollment.status === "completed" ? 100 : 0, // Dummy calculation
// 								thumbnailId: course.thumbnail?.id ?? null,
// 								role: enrollment.role,
// 								source: "enrollment",
// 								createdBy: course.createdBy.id,
// 							});
// 						}
// 					}
// 				}
// 			}

// 			return Array.from(coursesMap.values());
// 		},
// 		(error) =>
// 			transformError(error) ??
// 			new UnknownError("Failed to get user accessible courses", {
// 				cause: error,
// 			}),
// 	);
// }
