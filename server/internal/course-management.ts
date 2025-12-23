import type { Where } from "payload";
import searchQueryParser from "search-query-parser";
import {
	CourseCategories,
	CourseSections,
	Courses,
	Gradebooks,
	Groups,
} from "server/payload.config";
import { MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import {
	DevelopmentError,
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Course, Group } from "../payload-types";
import { tryFindEnrollmentsByUser } from "./enrollment-management";
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	type Depth,
	interceptPayloadError,
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import { processRichTextMediaV2 } from "server/collections/utils/rich-text-content";
import { tryCreateMedia } from "./media-management";
import { href } from "react-router";

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
							...(await processRichTextMediaV2({
								payload,
								userId: createdBy,
								req: txInfo.reqWithTransaction,
								overrideAccess,
								data: {
									description,
								},
								fields: [
									{ key: "description", alt: "Course description image" },
								],
							})),
							slug,
							createdBy,
							status,
							thumbnail,
							tags,
							category,
						},
						depth: 1,
						req: txInfo.reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<1, "create">());

				// create the gradebook as well
				const gradebookResult = await payload
					.create({
						collection: Gradebooks.slug,
						data: {
							course: newCourse.id,
						},
						depth: 0,
						req: txInfo.reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<0, "create">())
					.catch((error) => {
						interceptPayloadError({
							error,
							functionNamePrefix: "tryCreateCourse",
							args: { payload, req, overrideAccess },
						});
						throw error;
					});

				if (gradebookResult.course !== newCourse.id) {
					throw new DevelopmentError(
						"tryCreateCourse: Gradebook course ID does not match course ID",
					);
				}

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
					gradebook: gradebookResult,
					defaultSection: defaultSectionResult,
				};
				return result;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create course", {
				cause: error,
			}),
	);
}

export interface UpdateCourseArgs extends BaseInternalFunctionArgs {
	courseId: number;
	data: {
		title?: string;
		status?: "draft" | "published" | "archived";
		description?: string;
		thumbnail?: File | null;
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
				collection: "courses",
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
						thumbnail: !data.thumbnail
							? data.thumbnail
							: await tryCreateMedia({
									payload,
									file: await data.thumbnail.arrayBuffer().then(Buffer.from),
									filename: data.thumbnail.name || "thumbnail",
									mimeType: data.thumbnail.type || "image/png",
									alt: "Course thumbnail",
									userId,
									req,
									overrideAccess,
								})
									.getOrThrow()
									.then((r) => r.media.id),
						...(data.description
							? await processRichTextMediaV2({
									payload,
									userId,
									req,
									overrideAccess,
									data: {
										description: data.description,
									},
									fields: [
										{ key: "description", alt: "Course description image" },
									],
								})
							: {}),
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
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update course with file", {
				cause: error,
			}),
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
						// ! we don't care about performance for now so we populate all data
						// ! we don't want to populate the course in the enrollments and groups
						// enrollments: {
						// 	course: false,
						// },
						// groups: {
						// 	course: false,
						// },
						// ! we don't need the subcategories and courses in the category
						// "course-categories": {
						// 	courses: false,
						// 	subcategories: false,
						// },
					},
					depth: 2,
					req,
					overrideAccess,
				})
				.then(stripDepth<2, "find">())
				.then((r) => {
					////////////////////////////////////////////////////////
					// complex type narrowing
					////////////////////////////////////////////////////////
					return {
						...r,
						docs: r.docs.map((c) => {
							return {
								...(c as Depth<Course, 2>),
								// ! join, these items depth is controlled by maxDepth in the collection config
								groups: (c.groups as Depth<Course["groups"], 2>)?.docs ?? [],
								enrollments:
									(c.enrollments as Depth<Course["enrollments"], 2>)?.docs ??
									[],
								// ! populate, this will have depth 2
								category: c.category,
							};
						}),
					};
				})
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryFindCourseById",
						args: { payload, req, overrideAccess },
					});
					throw error;
				})
				.then((result) => {
					// console.log("result", result);
					const course = result.docs[0];
					if (!course) {
						throw new Error("Course not found");
					}

					const courseCreatedBy = course.createdBy;

					const courseCreatedByAvatar = courseCreatedBy.avatar;

					const courseEnrollments =
						course.enrollments?.map((e) => {
							const groups = e.groups ?? [];

							return {
								...e,
								groups,
							};
						}) ?? [];

					const groups = course.groups ?? [];

					const category = course.category;

					return {
						...course,
						groups,
						createdBy: {
							...courseCreatedBy,
							avatar: courseCreatedByAvatar,
						},
						enrollments: courseEnrollments,
						category,
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

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// first we need to delete the gradebook
				await payload
					.delete({
						collection: Gradebooks.slug,
						where: {
							course: { equals: courseId },
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "delete">());

				const deletedCourse = await payload
					.delete({
						collection: Courses.slug,
						id: courseId,
						depth: 0,
						req: txInfo.reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<0, "delete">());

				return deletedCourse;
			});
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
					keywords: ["status", "category"],
				});

				const searchText = typeof parsed === "string" ? parsed : parsed.text;
				const statusFilter =
					typeof parsed === "object" ? parsed.status : undefined;
				const categoryFilter =
					typeof parsed === "object" ? parsed.category : undefined;

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

				// Category filter
				if (categoryFilter) {
					const categories = Array.isArray(categoryFilter)
						? categoryFilter
						: [categoryFilter];
					// For simplicity, use the first provided category filter
					const raw = categories[0];
					if (typeof raw === "string") {
						const v = raw.trim();
						const vLower = v.toLowerCase();
						if (
							vLower === "none" ||
							vLower === "null" ||
							vLower === "uncategorized"
						) {
							where.category = { exists: false };
						} else if (!Number.isNaN(Number(v))) {
							where.category = { equals: Number(v) };
						} else if (v.length > 0) {
							// Treat as category name (partial match)
							const matched = await payload.find({
								collection: CourseCategories.slug,
								where: {
									name: { contains: v },
								},
								pagination: false,
								depth: 0,
							});
							const ids = matched.docs.map((c) => c.id);
							if (ids.length > 0) {
								where.category = { in: ids };
							} else {
								// No matches -> ensure no results
								where.category = { equals: -1 };
							}
						}
					} else if (typeof raw === "number") {
						where.category = { equals: raw };
					}
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
// Group Management Functions
// ============================================================================

export interface CreateGroupArgs extends BaseInternalFunctionArgs {
	name: string;
	course: number; // Course ID
	parent?: number; // Optional parent group ID
	description?: string;
	color?: string;
	maxMembers?: number;
	isActive?: boolean;
	metadata?: Record<string, unknown>;
}

export interface UpdateGroupArgs extends BaseInternalFunctionArgs {
	groupId: number;
	name?: string;
	parent?: number;
	description?: string;
	color?: string;
	maxMembers?: number;
	isActive?: boolean;
	metadata?: Record<string, unknown>;
}

export interface DeleteGroupArgs extends BaseInternalFunctionArgs {
	groupId: number;
}

export interface FindGroupByIdArgs extends BaseInternalFunctionArgs {
	groupId: number;
}

export interface FindGroupsByCourseArgs extends BaseInternalFunctionArgs {
	courseId: number;
	limit?: number;
}

export interface FindGroupByPathArgs extends BaseInternalFunctionArgs {
	courseId: number;
	path: string;
}

export interface FindChildGroupsArgs extends BaseInternalFunctionArgs {
	parentGroupId: number;
	limit?: number;
}

export interface FindRootGroupsArgs extends BaseInternalFunctionArgs {
	courseId: number;
	limit?: number;
}

/**
 * Creates a new group in a course
 */
export function tryCreateGroup(args: CreateGroupArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				name,
				course,
				parent,
				description,
				color,
				maxMembers,
				isActive = true,
				metadata,
				req,
				overrideAccess = false,
			} = args;

			if (!name) {
				throw new InvalidArgumentError("Group name is required");
			}

			if (!course) {
				throw new InvalidArgumentError("Course ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// If parent is specified, verify it exists and belongs to same course
				if (parent) {
					const parentGroup = await payload
						.findByID({
							collection: Groups.slug,
							id: parent,
							req: txInfo.reqWithTransaction,
							overrideAccess,
							depth: 0,
						})
						.then(stripDepth<0, "findByID">());

					// Verify parent belongs to same course
					const parentCourseId = parentGroup?.course;

					if (parentCourseId !== course) {
						throw new InvalidArgumentError(
							"Parent group must belong to the same course",
						);
					}
				}

				const newGroup = await payload
					.create({
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
							path: "", // ! Will be auto-generated by beforeValidate hook
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "create">());

				return newGroup;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create group", { cause: error }),
	);
}

/**
 * Updates an existing group
 */
export function tryUpdateGroup(args: UpdateGroupArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				groupId,
				name,
				parent,
				description,
				color,
				maxMembers,
				isActive,
				metadata,
				req,
				overrideAccess = false,
			} = args;

			if (!groupId) {
				throw new InvalidArgumentError("Group ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Get existing group
				const existingGroup = await payload
					.findByID({
						collection: Groups.slug,
						id: groupId,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 1,
					})
					.then(stripDepth<0, "findByID">());

				// If parent is being updated, verify it exists and belongs to same course
				if (parent !== undefined) {
					const parentGroup = await payload
						.findByID({
							collection: Groups.slug,
							id: parent,
							req: txInfo.reqWithTransaction,
							overrideAccess,
							depth: 0,
						})
						.then(stripDepth<0, "findByID">());

					if (existingGroup.course !== parentGroup.course) {
						throw new InvalidArgumentError(
							"Parent group must belong to the same course",
						);
					}

					// Prevent circular references
					if (parent === groupId) {
						throw new InvalidArgumentError("Group cannot be its own parent");
					}
				}

				const updatedGroup = await payload
					.update({
						collection: Groups.slug,
						id: groupId,
						data: {
							name: name,
							parent: parent,
							description: description,
							color: color,
							maxMembers: maxMembers,
							isActive: isActive,
							metadata: metadata,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "update">());

				return updatedGroup;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update group", { cause: error }),
	);
}

/**
 * Deletes a group by ID
 */
export function tryDeleteGroup(args: DeleteGroupArgs) {
	return Result.try(
		async () => {
			const { payload, groupId, req, overrideAccess = false } = args;

			if (!groupId) {
				throw new InvalidArgumentError("Group ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				// Check if group has children
				const childGroups = await payload.find({
					collection: Groups.slug,
					where: {
						parent: {
							equals: groupId,
						},
					},
					limit: 1,
					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				if (childGroups.docs.length > 0) {
					throw new InvalidArgumentError(
						"Cannot delete group with child groups. Delete children first.",
					);
				}

				const deletedGroup = await payload.delete({
					collection: Groups.slug,
					id: groupId,
					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				return deletedGroup;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete group", { cause: error }),
	);
}

/**
 * Finds a group by ID
 */
export function tryFindGroupById(args: FindGroupByIdArgs) {
	return Result.try(
		async () => {
			const { payload, groupId, req, overrideAccess = false } = args;

			if (!groupId) {
				throw new InvalidArgumentError("Group ID is required");
			}

			const group = await payload.findByID({
				collection: Groups.slug,
				id: groupId,
				req,
				overrideAccess,
			});

			return group as Group;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find group by ID", { cause: error }),
	);
}

/**
 * Finds all groups in a course
 */
export function tryFindGroupsByCourse(args: FindGroupsByCourseArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseId,
				limit = 100,

				req,
				overrideAccess = false,
			} = args;

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
				req,
				overrideAccess,
			});

			return groups.docs as Group[];
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find groups by course", { cause: error }),
	);
}

/**
 * Finds a group by path in a course
 */
export function tryFindGroupByPath(args: FindGroupByPathArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseId,
				path,

				req,
				overrideAccess = false,
			} = args;

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
				req,
				overrideAccess,
			});

			return groups.docs.length > 0 ? (groups.docs[0] as Group) : null;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find group by path", { cause: error }),
	);
}

/**
 * Finds child groups of a parent group
 */
export function tryFindChildGroups(args: FindChildGroupsArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				parentGroupId,
				limit = 100,

				req,
				overrideAccess = false,
			} = args;

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
				req,
				overrideAccess,
			});

			return groups.docs as Group[];
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find child groups", { cause: error }),
	);
}

/**
 * Finds root-level groups (groups without parents) in a course
 */
export function tryFindRootGroups(args: FindRootGroupsArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseId,
				limit = 100,

				req,
				overrideAccess = false,
			} = args;

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
				req,
				overrideAccess,
			});

			return groups.docs as Group[];
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find root groups", { cause: error }),
	);
}

// ============================================================================
// User Course Access Functions
// ============================================================================

export interface GetUserAccessibleCoursesArgs extends BaseInternalFunctionArgs {
	userId: number;
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
export function tryGetUserAccessibleCourses(
	args: GetUserAccessibleCoursesArgs,
) {
	return Result.try(
		async () => {
			const { payload, userId, req, overrideAccess = false } = args;

			if (!userId) {
				throw new InvalidArgumentError("User ID is required");
			}

			const coursesMap = new Map<number, UserAccessibleCourse>();

			// 1. Get courses created by user (owner)
			const createdCourses = await payload
				.find({
					collection: "courses",
					where: {
						createdBy: {
							equals: userId,
						},
					},
					depth: 1,
					pagination: false,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">());

			for (const course of createdCourses.docs) {
				const categoryName = course.category ? course.category.name : null;

				const thumbnailUrl = course.thumbnail
					? href(`/api/media/file/:filenameOrId`, {
							filenameOrId: course.thumbnail.id.toString(),
						})
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
			const enrollmentsResult = await tryFindEnrollmentsByUser({
				payload,
				userId,
				req,
				overrideAccess,
			});
			if (enrollmentsResult.ok) {
				for (const enrollment of enrollmentsResult.value) {
					// Get course details
					const courseId = enrollment.course.id;
					const course = await payload
						.findByID({
							collection: "courses",
							id: courseId,
							depth: 1,
							req,
							overrideAccess,
						})
						.then(stripDepth<1, "findByID">());

					if (course) {
						const categoryName = course.category?.name ?? null;

						const thumbnailUrl = course.thumbnail
							? href(`/api/media/file/:filenameOrId`, {
									filenameOrId: course.thumbnail.id.toString(),
								})
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
								completionPercentage:
									enrollment.status === "completed" ? 100 : 0, // Dummy calculation
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
}
