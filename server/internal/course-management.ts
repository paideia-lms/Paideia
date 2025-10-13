import type { Simplify } from "@payloadcms/db-postgres/drizzle";
import type { Payload, Where } from "payload";
import searchQueryParser from "search-query-parser";
import { Courses, Gradebooks, Groups } from "server/payload.config";
import { assertZod } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	InvalidArgumentError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Course, Enrollment, Group } from "../payload-types";
import { tryFindEnrollmentsByUser } from "./enrollment-management";
import { tryGetUserCoursesFromCategories } from "./category-role-management";

// e.g. Replace<Enrollment, "groups", number[]>
// Omit and add a new property
type Replace<O, T extends keyof O, W> = Simplify<Omit<O, T> & { [K in T]: W }>;

export interface CreateCourseArgs {
	title: string;
	description: string;
	slug: string;
	structure?: Course["structure"];
	createdBy: number;
	status?: "draft" | "published" | "archived";
	thumbnail?: number;
	tags?: { tag?: string }[];
	category?: number;
}

export interface UpdateCourseArgs {
	title?: string;
	description?: string;
	createdBy?: number; // User ID
	status?: "draft" | "published" | "archived";
	thumbnail?: number;
	tags?: { tag?: string }[];
}

export interface SearchCoursesArgs {
	title?: string;
	createdBy?: number;
	status?: "draft" | "published" | "archived";
	limit?: number;
	page?: number;
}

/**
 * Creates a new course using Payload local API
 */
export const tryCreateCourse = Result.wrap(
	async (payload: Payload, request: Request, args: CreateCourseArgs) => {
		const {
			title,
			description,
			slug,
			structure,
			createdBy,
			status = "draft",
			thumbnail,
			tags,
			category,
		} = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			const newCourse = await payload.create({
				collection: Courses.slug,
				data: {
					title,
					description,
					structure: structure ?? {
						sections: [
							{
								title: "Introduction",
								description: "Introduction to the course",
								items: [
									{
										id: 1,
									},
								],
							},
						],
					},
					slug,
					createdBy,
					status,
					thumbnail,
					tags,
					category,
				},
				depth: 1,
				req: { ...request, transactionID },
			});

			// create the gradebook as well
			const gradebookResult = await payload.create({
				collection: Gradebooks.slug,
				data: {
					course: newCourse.id,
				},
				depth: 0,
				req: { ...request, transactionID },
			});

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const createdByUser = newCourse.createdBy;
			assertZod(
				createdByUser,
				z.object({
					id: z.number(),
				}),
			);

			const newCourseThumbnail = newCourse.thumbnail;
			assertZod(
				newCourseThumbnail,
				z
					.object({
						id: z.number(),
					})
					.nullish(),
			);

			const newCourseCategory = newCourse.category;
			assertZod(
				newCourseCategory,
				z
					.object({
						id: z.number(),
					})
					.nullish(),
			);

			// commit the transaction
			await payload.db.commitTransaction(transactionID);

			const result = {
				...newCourse,
				createdBy: createdByUser,
				gradebook: gradebookResult,
				thumbnail: newCourseThumbnail,
				category: newCourseCategory,
			};
			return result;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create course", {
			cause: error,
		}),
);

/**
 * Updates an existing course using Payload local API
 */
export const tryUpdateCourse = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		courseId: number,
		args: UpdateCourseArgs,
	) => {
		// Check if course exists
		const existingCourse = await payload.findByID({
			collection: "courses",
			id: courseId,
			req: request,
		});

		if (!existingCourse) {
			throw new Error(`Course with ID ${courseId} not found`);
		}

		// If createdBy is being updated, verify new user exists
		if (args.createdBy) {
			const user = await payload.findByID({
				collection: "users",
				id: args.createdBy,
				req: request,
			});

			if (!user) {
				throw new Error(`User with ID ${args.createdBy} not found`);
			}
		}

		const updatedCourse = await payload.update({
			collection: "courses",
			id: courseId,
			data: args,
			req: request,
		});

		return updatedCourse as Course;
	},
	(error) =>
		new Error(
			`Failed to update course: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a course by ID
 */
export const tryFindCourseById = Result.wrap(
	async (payload: Payload, courseId: number) => {
		const course = await payload
			.find({
				collection: Courses.slug,
				where: {
					id: {
						equals: courseId,
					},
				},
				pagination: false,
			})
			.then((result) => {
				////////////////////////////////////////////////////
				// type narrowing
				////////////////////////////////////////////////////

				const course = result.docs[0];
				const courseCreatedBy = course.createdBy;
				assertZod(
					courseCreatedBy,
					z.object({
						id: z.number(),
					}),
				);

				const courseEnrollments = course.enrollments?.docs;

				assertZod(
					courseEnrollments,
					z.array(z.object({ id: z.number(), groups: z.array(z.number()) })),
				);

				return {
					...course,
					createdBy: courseCreatedBy,
					enrollments: courseEnrollments as Replace<
						Enrollment,
						"groups",
						number[]
					>[],
				};
			});

		return course;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find course by ID", {
			cause: error,
		}),
);

/**
 * Searches courses with various filters
 */
export const trySearchCourses = Result.wrap(
	async (payload: Payload, args: SearchCoursesArgs = {}) => {
		const { title, createdBy, status, limit = 10, page = 1 } = args;

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
		new Error(
			`Failed to search courses: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Deletes a course by ID
 */
export const tryDeleteCourse = Result.wrap(
	async (payload: Payload, request: Request, courseId: number) => {
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}
		try {
			// first we need to delete the gradebook
			await payload.delete({
				collection: Gradebooks.slug,
				where: {
					course: { equals: courseId },
				},
				req: { ...request, transactionID },
			});

			const deletedCourse = await payload.delete({
				collection: Courses.slug,
				id: courseId,
				req: { ...request, transactionID },
			});

			// commit the transaction
			await payload.db.commitTransaction(transactionID);

			return deletedCourse;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete course", {
			cause: error,
		}),
);

/**
 * Finds courses by instructor ID
 */
export const tryFindCoursesByInstructor = Result.wrap(
	async (payload: Payload, instructorId: number, limit: number = 10) => {
		const courses = await payload.find({
			collection: "courses",
			where: {
				createdBy: {
					equals: instructorId,
				},
			},
			limit,
			sort: "-createdAt",
		});

		return courses.docs as Course[];
	},
	(error) =>
		new Error(
			`Failed to find courses by instructor: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds published courses only
 */
export const tryFindPublishedCourses = Result.wrap(
	async (payload: Payload, limit: number = 10, page: number = 1) => {
		const courses = await payload.find({
			collection: "courses",
			where: {
				status: {
					equals: "published",
				},
			},
			limit,
			page,
			sort: "-createdAt",
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
		new Error(
			`Failed to find published courses: ${error instanceof Error ? error.message : String(error)}`,
		),
);

export interface FindAllCoursesArgs {
	payload: Payload;
	limit?: number;
	page?: number;
	sort?: string;
	query?: string;
}

export interface FindAllCoursesResult {
	docs: Course[];
	totalDocs: number;
	limit: number;
	totalPages: number;
	page: number;
	pagingCounter: number;
	hasPrevPage: boolean;
	hasNextPage: boolean;
	prevPage: number | null;
	nextPage: number | null;
}

/**
 * Finds all courses with pagination and search
 * Supports search by title and filter by status
 */
export const tryFindAllCourses = Result.wrap(
	async (args: FindAllCoursesArgs): Promise<FindAllCoursesResult> => {
		const { payload, limit = 10, page = 1, sort = "-createdAt", query } = args;

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
				const textArray = Array.isArray(searchText) ? searchText : [searchText];
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

		const coursesResult = await payload
			.find({
				collection: Courses.slug,
				where,
				limit,
				page,
				sort,
				depth: 1,
			})
			.then((result) => {
				const docs = result.docs.map((doc) => {
					// Type narrowing for relationships
					const createdBy = doc.createdBy;
					assertZod(
						createdBy,
						z.object({
							id: z.number(),
							email: z.string(),
							firstName: z.string().nullable(),
							lastName: z.string().nullable(),
						}),
					);

					const thumbnail = doc.thumbnail;
					assertZod(
						thumbnail,
						z
							.object({
								id: z.number(),
								filename: z.string(),
							})
							.nullable(),
					);

					const category = doc.category;
					assertZod(
						category,
						z
							.object({
								id: z.number(),
								name: z.string(),
							})
							.nullable(),
					);

					return {
						...doc,
						createdBy,
						thumbnail,
						category,
					};
				});
				return {
					...result,
					docs,
				};
			});

		return {
			docs: coursesResult.docs,
			totalDocs: coursesResult.totalDocs,
			limit: coursesResult.limit || limit,
			totalPages: coursesResult.totalPages || 0,
			page: coursesResult.page || page,
			pagingCounter: coursesResult.pagingCounter || 0,
			hasPrevPage: coursesResult.hasPrevPage || false,
			hasNextPage: coursesResult.hasNextPage || false,
			prevPage: coursesResult.prevPage || null,
			nextPage: coursesResult.nextPage || null,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find all courses", {
			cause: error,
		}),
);

// ============================================================================
// Group Management Functions
// ============================================================================

export interface CreateGroupArgs {
	name: string;
	course: number; // Course ID
	parent?: number; // Optional parent group ID
	description?: string;
	color?: string;
	maxMembers?: number;
	isActive?: boolean;
	metadata?: Record<string, unknown>;
}

export interface UpdateGroupArgs {
	name?: string;
	parent?: number;
	description?: string;
	color?: string;
	maxMembers?: number;
	isActive?: boolean;
	metadata?: Record<string, unknown>;
}

/**
 * Creates a new group in a course
 */
export const tryCreateGroup = Result.wrap(
	async (payload: Payload, request: Request, args: CreateGroupArgs) => {
		const {
			name,
			course,
			parent,
			description,
			color,
			maxMembers,
			isActive = true,
			metadata,
		} = args;

		if (!name) {
			throw new InvalidArgumentError("Group name is required");
		}

		if (!course) {
			throw new InvalidArgumentError("Course ID is required");
		}

		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Verify course exists
			await payload.findByID({
				collection: Courses.slug,
				id: course,
				req: { ...request, transactionID },
			});

			// If parent is specified, verify it exists and belongs to same course
			if (parent) {
				const parentGroup = await payload.findByID({
					collection: Groups.slug,
					id: parent,
					req: { ...request, transactionID },
				});

				// Verify parent belongs to same course
				const parentCourseId =
					typeof parentGroup.course === "number"
						? parentGroup.course
						: parentGroup.course.id;

				if (parentCourseId !== course) {
					throw new InvalidArgumentError(
						"Parent group must belong to the same course",
					);
				}
			}

			const newGroup = await payload.create({
				collection: Groups.slug,
				data: {
					name,
					course,
					parent,
					description,
					color,
					maxMembers,
					isActive,
					metadata,
					path: "", // Will be auto-generated by beforeValidate hook
				},
				req: { ...request, transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return newGroup as Group;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create group", { cause: error }),
);

/**
 * Updates an existing group
 */
export const tryUpdateGroup = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		groupId: number,
		args: UpdateGroupArgs,
	) => {
		if (!groupId) {
			throw new InvalidArgumentError("Group ID is required");
		}

		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Get existing group
			const existingGroup = await payload.findByID({
				collection: Groups.slug,
				id: groupId,
				req: { ...request, transactionID },
			});

			// If parent is being updated, verify it exists and belongs to same course
			if (args.parent) {
				const parentGroup = await payload.findByID({
					collection: Groups.slug,
					id: args.parent,
					req: { ...request, transactionID },
				});

				const existingCourseId =
					typeof existingGroup.course === "number"
						? existingGroup.course
						: existingGroup.course.id;

				const parentCourseId =
					typeof parentGroup.course === "number"
						? parentGroup.course
						: parentGroup.course.id;

				if (parentCourseId !== existingCourseId) {
					throw new InvalidArgumentError(
						"Parent group must belong to the same course",
					);
				}

				// Prevent circular references
				if (args.parent === groupId) {
					throw new InvalidArgumentError("Group cannot be its own parent");
				}
			}

			const updatedGroup = await payload.update({
				collection: Groups.slug,
				id: groupId,
				data: args,
				req: { ...request, transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return updatedGroup as Group;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update group", { cause: error }),
);

/**
 * Deletes a group by ID
 */
export const tryDeleteGroup = Result.wrap(
	async (payload: Payload, request: Request, groupId: number) => {
		if (!groupId) {
			throw new InvalidArgumentError("Group ID is required");
		}

		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Check if group has children
			const childGroups = await payload.find({
				collection: Groups.slug,
				where: {
					parent: {
						equals: groupId,
					},
				},
				limit: 1,
				req: { ...request, transactionID },
			});

			if (childGroups.docs.length > 0) {
				throw new InvalidArgumentError(
					"Cannot delete group with child groups. Delete children first.",
				);
			}

			const deletedGroup = await payload.delete({
				collection: Groups.slug,
				id: groupId,
				req: { ...request, transactionID },
			});

			await payload.db.commitTransaction(transactionID);

			return deletedGroup;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete group", { cause: error }),
);

/**
 * Finds a group by ID
 */
export const tryFindGroupById = Result.wrap(
	async (payload: Payload, groupId: number) => {
		if (!groupId) {
			throw new InvalidArgumentError("Group ID is required");
		}

		const group = await payload.findByID({
			collection: Groups.slug,
			id: groupId,
		});

		return group as Group;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find group by ID", { cause: error }),
);

/**
 * Finds all groups in a course
 */
export const tryFindGroupsByCourse = Result.wrap(
	async (payload: Payload, courseId: number, limit: number = 100) => {
		if (!courseId) {
			throw new InvalidArgumentError("Course ID is required");
		}

		const groups = await payload.find({
			collection: Groups.slug,
			where: {
				course: {
					equals: courseId,
				},
			},
			limit,
			sort: "path",
		});

		return groups.docs as Group[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find groups by course", { cause: error }),
);

/**
 * Finds a group by path in a course
 */
export const tryFindGroupByPath = Result.wrap(
	async (payload: Payload, courseId: number, path: string) => {
		if (!courseId) {
			throw new InvalidArgumentError("Course ID is required");
		}

		if (!path) {
			throw new InvalidArgumentError("Group path is required");
		}

		const groups = await payload.find({
			collection: Groups.slug,
			where: {
				and: [
					{
						course: {
							equals: courseId,
						},
					},
					{
						path: {
							equals: path,
						},
					},
				],
			},
			limit: 1,
		});

		return groups.docs.length > 0 ? (groups.docs[0] as Group) : null;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find group by path", { cause: error }),
);

/**
 * Finds child groups of a parent group
 */
export const tryFindChildGroups = Result.wrap(
	async (payload: Payload, parentGroupId: number, limit: number = 100) => {
		if (!parentGroupId) {
			throw new InvalidArgumentError("Parent group ID is required");
		}

		const groups = await payload.find({
			collection: Groups.slug,
			where: {
				parent: {
					equals: parentGroupId,
				},
			},
			limit,
			sort: "name",
		});

		return groups.docs as Group[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find child groups", { cause: error }),
);

/**
 * Finds root-level groups (groups without parents) in a course
 */
export const tryFindRootGroups = Result.wrap(
	async (payload: Payload, courseId: number, limit: number = 100) => {
		if (!courseId) {
			throw new InvalidArgumentError("Course ID is required");
		}

		const groups = await payload.find({
			collection: Groups.slug,
			where: {
				and: [
					{
						course: {
							equals: courseId,
						},
					},
					{
						parent: {
							exists: false,
						},
					},
				],
			},
			limit,
			sort: "name",
		});

		return groups.docs as Group[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find root groups", { cause: error }),
);

// ============================================================================
// User Course Access Functions
// ============================================================================

export interface UserAccessibleCourse {
	id: number;
	title: string;
	category: string | null;
	enrollmentStatus: "active" | "inactive" | "completed" | "dropped" | null;
	completionPercentage: number;
	thumbnailUrl: string | null;
	role: "student" | "teacher" | "ta" | "manager" | "category-admin" | "category-coordinator" | "category-reviewer" | null;
	source: "enrollment" | "category" | "global-admin";
}

/**
 * Gets all courses a user has access to via enrollments and category roles
 */
export const tryGetUserAccessibleCourses = Result.wrap(
	async (payload: Payload, userId: number): Promise<UserAccessibleCourse[]> => {
		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Check if user is admin or content-manager - they see all courses
		const user = await payload.findByID({
			collection: "users",
			id: userId,
			depth: 0,
		});

		if (user.role === "admin" || user.role === "content-manager") {
			// Get all courses for admin/content-manager
			const allCoursesResult = await tryFindAllCourses({
				payload,
				limit: 1000, // Large limit to get all courses
			});

			if (!allCoursesResult.ok) {
				throw new Error("Failed to fetch all courses");
			}

			return allCoursesResult.value.docs.map((course) => ({
				id: course.id,
				title: course.title,
				category: typeof course.category === "object" && course.category
					? course.category.name
					: null,
				enrollmentStatus: null, // No enrollment status for admin view
				completionPercentage: 0, // Dummy for now
				thumbnailUrl: typeof course.thumbnail === "object" && course.thumbnail
					? `/api/media/file/${course.thumbnail.filename}`
					: null,
				role: user.role === "admin" ? "manager" : "category-coordinator",
				source: "global-admin" as const,
			}));
		}

		// For regular users, get courses from enrollments and category roles
		const coursesMap = new Map<number, UserAccessibleCourse>();

		// Get courses from direct enrollments
		const enrollmentsResult = await tryFindEnrollmentsByUser(payload, userId, 100);
		if (enrollmentsResult.ok) {
			for (const enrollment of enrollmentsResult.value) {
				// Get course details
				const courseId = typeof enrollment.course === "number"
					? enrollment.course
					: enrollment.course.id;
				const course = await payload.findByID({
					collection: "courses",
					id: courseId,
					depth: 1,
				});

				if (course) {
					const categoryName = typeof course.category === "object" && course.category
						? course.category.name
						: null;

					const thumbnailUrl = typeof course.thumbnail === "object" && course.thumbnail
						? `/api/media/file/${course.thumbnail.filename}`
						: null;

					coursesMap.set(course.id, {
						id: course.id,
						title: course.title,
						category: categoryName,
						enrollmentStatus: enrollment.status,
						completionPercentage: enrollment.status === "completed" ? 100 : 0, // Dummy calculation
						thumbnailUrl,
						role: enrollment.role,
						source: "enrollment",
					});
				}
			}
		}

		// Get courses from category roles
		const categoryCoursesResult = await tryGetUserCoursesFromCategories(payload, userId);
		if (categoryCoursesResult.ok) {
			for (const courseAccess of categoryCoursesResult.value) {
				// Skip if already added via enrollment
				if (coursesMap.has(courseAccess.courseId)) {
					continue;
				}

				// Get course details
				const course = await payload.findByID({
					collection: "courses",
					id: courseAccess.courseId,
					depth: 1,
				});

				if (course) {
					const categoryName = typeof course.category === "object" && course.category
						? course.category.name
						: null;

					const thumbnailUrl = typeof course.thumbnail === "object" && course.thumbnail
						? `/api/media/file/${course.thumbnail.filename}`
						: null;

					coursesMap.set(course.id, {
						id: course.id,
						title: course.title,
						category: categoryName,
						enrollmentStatus: null, // No enrollment status for category access
						completionPercentage: 0, // Dummy for now
						thumbnailUrl,
						role: courseAccess.categoryRole,
						source: "category",
					});
				}
			}
		}

		return Array.from(coursesMap.values());
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get user accessible courses", {
			cause: error,
		}),
);
