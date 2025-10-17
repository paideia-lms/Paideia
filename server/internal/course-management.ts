import type { Simplify } from "@payloadcms/db-postgres/drizzle";
import type { Payload, PayloadRequest, TypedUser, Where } from "payload";
import searchQueryParser from "search-query-parser";
import {
	CourseSections,
	Courses,
	Gradebooks,
	Groups,
} from "server/payload.config";
import { assertZod, MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import { z } from "zod";
import {
	InvalidArgumentError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Course, Group, User } from "../payload-types";
import { tryFindEnrollmentsByUser } from "./enrollment-management";

// e.g. Replace<Enrollment, "groups", number[]>
// Omit and add a new property
type Replace<O, T extends keyof O, W> = Simplify<Omit<O, T> & { [K in T]: W }>;

export interface CreateCourseArgs {
	payload: Payload;
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
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdateCourseArgs {
	payload: Payload;
	courseId: number;
	data: {
		title?: string;
		description?: string;
		createdBy?: number; // User ID
		status?: "draft" | "published" | "archived";
		thumbnail?: number;
		tags?: { tag?: string }[];
	};
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface FindCourseByIdArgs {
	payload: Payload;
	courseId: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface SearchCoursesArgs {
	payload: Payload;
	filters?: {
		title?: string;
		createdBy?: number;
		status?: "draft" | "published" | "archived";
		limit?: number;
		page?: number;
	};
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface DeleteCourseArgs {
	payload: Payload;
	courseId: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface FindCoursesByInstructorArgs {
	payload: Payload;
	instructorId: number;
	limit?: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface FindPublishedCoursesArgs {
	payload: Payload;
	limit?: number;
	page?: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

/**
 * Creates a new course using Payload local API
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryCreateCourse = Result.wrap(
	async (args: CreateCourseArgs) => {
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
			user,
			req,
			overrideAccess = false,
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
					slug,
					createdBy,
					status,
					thumbnail,
					tags,
					category,
				},
				depth: 1,
				user,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess,
			});

			// create the gradebook as well
			const gradebookResult = await payload.create({
				collection: Gradebooks.slug,
				data: {
					course: newCourse.id,
				},
				depth: 0,
				user,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess,
			});

			// create a default section for the course
			const defaultSectionResult = await payload.create({
				collection: CourseSections.slug,
				data: {
					course: newCourse.id,
					title: "Course Content",
					description: "Default section for course content",
					contentOrder: 0,
				},
				depth: 0,
				user,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess,
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
				defaultSection: defaultSectionResult,
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
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryUpdateCourse = Result.wrap(
	async (args: UpdateCourseArgs) => {
		const { payload, courseId, data, user, req, overrideAccess = false } = args;

		// Check if course exists
		const existingCourse = await payload.findByID({
			collection: "courses",
			id: courseId,
			user,
			req,
			overrideAccess,
		});

		if (!existingCourse) {
			throw new Error(`Course with ID ${courseId} not found`);
		}

		// If createdBy is being updated, verify new user exists
		if (data.createdBy) {
			const userExists = await payload.findByID({
				collection: "users",
				id: data.createdBy,
				user,
				req,
				overrideAccess: true, // Always allow checking if user exists
			});

			if (!userExists) {
				throw new Error(`User with ID ${data.createdBy} not found`);
			}
		}

		const updatedCourse = await payload.update({
			collection: "courses",
			id: courseId,
			data,
			user,
			req,
			overrideAccess,
		});

		return updatedCourse as Course;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update course", {
			cause: error,
		}),
);

/**
 * Finds a course by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindCourseById = Result.wrap(
	async (args: FindCourseByIdArgs) => {
		const { payload, courseId, user, req, overrideAccess = false } = args;

		const course = await payload
			.find({
				collection: Courses.slug,
				where: {
					id: {
						equals: courseId,
					},
				},
				pagination: false,
				joins: {
					groups: {
						limit: MOCK_INFINITY,
					},
					enrollments: {
						limit: MOCK_INFINITY,
					},
					// ! we are not getting section in this course using join
					sections: false,
				},
				populate: {
					// ! we don't want to populate the course in the enrollments and groups
					enrollments: {
						course: false,
					},
					groups: {
						course: false,
					},
					// ! we don't need the subcategories and courses in the category
					"course-categories": {
						courses: false,
						subcategories: false,
					},
				},
				depth: 2,
				user,
				req,
				overrideAccess,
			})
			.then((result) => {
				////////////////////////////////////////////////////
				// type narrowing
				////////////////////////////////////////////////////

				const course = result.docs[0];
				if (!course) {
					throw new Error("Course not found");
				}
				const courseCreatedBy = course.createdBy;
				assertZod(
					courseCreatedBy,
					z.object({
						id: z.number(),
					}),
				);

				const courseCreatedByAvatar = courseCreatedBy.avatar;
				assertZod(
					courseCreatedByAvatar,
					z.object({ id: z.number() }).nullish(),
				);

				const courseEnrollments =
					course.enrollments?.docs?.map((e) => {
						assertZod(
							e,
							z.object({
								id: z.number(),
							}),
						);

						const course = e.course;
						// assert e has no course
						assertZod(course, z.undefined());

						const user = e.user;
						assertZod(
							user,
							z.object({
								id: z.number(),
							}),
						);

						const groups =
							e.groups?.map((g) => {
								assertZod(g, z.object({ id: z.number() }));
								const parent = g.parent;
								assertZod(parent, z.number().nullish());
								const course = g.course;
								assertZod(course, z.undefined());
								return {
									...g,
									parent,
									course,
								};
							}) ?? [];

						const avatar = user.avatar;
						assertZod(avatar, z.object({ id: z.number() }).nullish());

						return {
							...e,
							groups,
							user: {
								...user,
								avatar,
							},
							course: course,
						};
					}) ?? [];

				const groups =
					course.groups?.docs?.map((g) => {
						assertZod(g, z.object({ id: z.number() }));
						const parent = g.parent;
						assertZod(parent, z.object({ id: z.number() }).nullish());
						const course = g.course;
						assertZod(course, z.undefined());
						return {
							...g,
							parent,
							course,
						};
					}) ?? [];

				const category = course.category;
				assertZod(category, z.object({ id: z.number() }).nullish());

				const categoryCourses = category?.courses;
				assertZod(categoryCourses, z.undefined());

				const parent = category?.parent;
				assertZod(parent, z.object({ id: z.number() }).nullish());

				const categorySubcategories = category?.subcategories;
				assertZod(categorySubcategories, z.undefined());

				const sections = course.sections;
				assertZod(sections, z.undefined());

				return {
					...course,
					groups,
					createdBy: {
						...courseCreatedBy,
						avatar: courseCreatedByAvatar,
					},
					enrollments: courseEnrollments,
					category: category
						? {
								...category,
								parent,
								courses: categoryCourses,
								subcategories: categorySubcategories,
							}
						: null,
					sections,
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
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const trySearchCourses = Result.wrap(
	async (args: SearchCoursesArgs) => {
		const { payload, filters = {}, user, req, overrideAccess = false } = args;

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
			user,
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

/**
 * Deletes a course by ID
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryDeleteCourse = Result.wrap(
	async (args: DeleteCourseArgs) => {
		const { payload, courseId, user, req, overrideAccess = false } = args;

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
				user,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess,
			});

			const deletedCourse = await payload.delete({
				collection: Courses.slug,
				id: courseId,
				user,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess,
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
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindCoursesByInstructor = Result.wrap(
	async (args: FindCoursesByInstructorArgs) => {
		const {
			payload,
			instructorId,
			limit = 10,
			user,
			req,
			overrideAccess = false,
		} = args;

		const courses = await payload.find({
			collection: "courses",
			where: {
				createdBy: {
					equals: instructorId,
				},
			},
			limit,
			sort: "-createdAt",
			user,
			req,
			overrideAccess,
		});

		return courses.docs as Course[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find courses by instructor", {
			cause: error,
		}),
);

/**
 * Finds published courses only
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindPublishedCourses = Result.wrap(
	async (args: FindPublishedCoursesArgs) => {
		const {
			payload,
			limit = 10,
			page = 1,
			user,
			req,
			overrideAccess = false,
		} = args;

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
			user,
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
		new UnknownError("Failed to find published courses", {
			cause: error,
		}),
);

export interface FindAllCoursesArgs {
	payload: Payload;
	limit?: number;
	page?: number;
	sort?: string;
	query?: string;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
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
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryFindAllCourses = Result.wrap(
	async (args: FindAllCoursesArgs): Promise<FindAllCoursesResult> => {
		const {
			payload,
			limit = 10,
			page = 1,
			sort = "-createdAt",
			query,
			user,
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
				user,
				req,
				overrideAccess,
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

export interface GetUserAccessibleCoursesArgs {
	payload: Payload;
	userId: number;
	user?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UserAccessibleCourse {
	id: number;
	title: string;
	category: string | null;
	enrollmentStatus: "active" | "inactive" | "completed" | "dropped" | null;
	completionPercentage: number;
	thumbnailUrl: string | null;
	role: "student" | "teacher" | "ta" | "manager" | null;
	source: "enrollment" | "owner";
	createdBy: number;
}

/**
 * Gets all courses a user has access to via enrollments or ownership
 * When user is provided, access control is enforced based on that user
 * When overrideAccess is true, bypasses all access control
 */
export const tryGetUserAccessibleCourses = Result.wrap(
	async (
		args: GetUserAccessibleCoursesArgs,
	): Promise<UserAccessibleCourse[]> => {
		const { payload, userId, user, req, overrideAccess = false } = args;

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		const coursesMap = new Map<number, UserAccessibleCourse>();

		// 1. Get courses created by user (owner)
		const createdCourses = await payload.find({
			collection: "courses",
			where: {
				createdBy: {
					equals: userId,
				},
			},
			depth: 1,
			pagination: false,
			user,
			req,
			overrideAccess,
		});

		for (const course of createdCourses.docs) {
			const categoryName =
				typeof course.category === "object" && course.category
					? course.category.name
					: null;

			const thumbnailUrl =
				typeof course.thumbnail === "object" && course.thumbnail
					? `/api/media/file/${course.thumbnail.filename}`
					: null;

			coursesMap.set(course.id, {
				id: course.id,
				title: course.title,
				category: categoryName,
				enrollmentStatus: null, // No enrollment status for owner
				completionPercentage: 0, // Dummy for now
				thumbnailUrl,
				role: null, // No role for owner
				source: "owner",
				createdBy: userId,
			});
		}

		// 2. Get courses from enrollments
		const enrollmentsResult = await tryFindEnrollmentsByUser(
			payload,
			userId,
			user,
			req,
			overrideAccess,
		);
		if (enrollmentsResult.ok) {
			for (const enrollment of enrollmentsResult.value) {
				// Get course details
				const courseId =
					typeof enrollment.course === "number"
						? enrollment.course
						: enrollment.course.id;
				const course = await payload.findByID({
					collection: "courses",
					id: courseId,
					depth: 1,
					user,
					req,
					overrideAccess,
				});

				if (course) {
					const categoryName =
						typeof course.category === "object" && course.category
							? course.category.name
							: null;

					const thumbnailUrl =
						typeof course.thumbnail === "object" && course.thumbnail
							? `/api/media/file/${course.thumbnail.filename}`
							: null;

					// If course already exists in map (from owner), update with enrollment info
					if (coursesMap.has(course.id)) {
						const existingCourse = coursesMap.get(course.id);
						if (existingCourse) {
							coursesMap.set(course.id, {
								...existingCourse,
								enrollmentStatus: enrollment.status,
								role: enrollment.role,
								source: "enrollment", // Prioritize enrollment over owner
							});
						}
					} else {
						coursesMap.set(course.id, {
							id: course.id,
							title: course.title,
							category: categoryName,
							enrollmentStatus: enrollment.status,
							completionPercentage: enrollment.status === "completed" ? 100 : 0, // Dummy calculation
							thumbnailUrl,
							role: enrollment.role,
							source: "enrollment",
							createdBy:
								typeof course.createdBy === "number"
									? course.createdBy
									: course.createdBy.id,
						});
					}
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
