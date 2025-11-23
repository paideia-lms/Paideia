import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	DuplicateEnrollmentError,
	EnrollmentNotFoundError,
	InvalidArgumentError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Enrollment } from "../payload-types";
import { handleTransactionId } from "./utils/handle-transaction-id";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

export type CreateEnrollmentArgs = BaseInternalFunctionArgs & {
	userId: number; // User ID
	course: number; // Course ID
	role: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	enrolledAt?: string;
	completedAt?: string;
	groups?: number[]; // Array of group IDs
};

export type UpdateEnrollmentArgs = BaseInternalFunctionArgs & {
	enrollmentId: number;
	role?: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	enrolledAt?: string;
	completedAt?: string;
	groups?: number[]; // Array of group IDs
};

export type DeleteEnrollmentArgs = BaseInternalFunctionArgs & {
	enrollmentId: number;
};

export type FindEnrollmentByIdArgs = BaseInternalFunctionArgs & {
	enrollmentId: number;
};

export type SearchEnrollmentsArgs = BaseInternalFunctionArgs & {
	userId?: number;
	course?: number;
	role?: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	groupId?: number; // Filter by group ID
	limit?: number;
	page?: number;
};

export type FindEnrollmentsByUserArgs = BaseInternalFunctionArgs & {
	userId: number;
};

export type FindEnrollmentsByCourseArgs = BaseInternalFunctionArgs & {
	courseId: number;
	limit?: number;
};

export type FindUserEnrollmentInCourseArgs = BaseInternalFunctionArgs & {
	userId: number;
	courseId: number;
};

export type FindActiveEnrollmentsArgs = BaseInternalFunctionArgs & {
	limit?: number;
	page?: number;
};

export type UpdateEnrollmentStatusArgs = BaseInternalFunctionArgs & {
	enrollmentId: number;
	status: "active" | "inactive" | "completed" | "dropped";
	completedAt?: string;
};

export type AddGroupsToEnrollmentArgs = BaseInternalFunctionArgs & {
	enrollmentId: number;
	groupIds: number[];
};

export type RemoveGroupsFromEnrollmentArgs = BaseInternalFunctionArgs & {
	enrollmentId: number;
	groupIds: number[];
};

export type FindEnrollmentsByGroupArgs = BaseInternalFunctionArgs & {
	groupId: number;
	limit?: number;
};

/**
 * Creates a new enrollment using Payload local API
 */
export const tryCreateEnrollment = Result.wrap(
	async (args: CreateEnrollmentArgs) => {
		const {
			payload,
			userId,
			course,
			role,
			status = "active",
			enrolledAt,
			completedAt,
			groups = [],
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!course) {
			throw new InvalidArgumentError("Course ID is required");
		}

		if (!role) {
			throw new InvalidArgumentError("Role is required");
		}

		// Handle transaction
		const { transactionID, isTransactionCreated, reqWithTransaction } =
			await handleTransactionId(payload, req);

		try {
			// Verify user exists
			const userExists = await payload.findByID({
				collection: "users",
				id: userId,
				user,
				req: reqWithTransaction,
				overrideAccess: true, // Always allow checking if user exists
			});

			if (!userExists) {
				throw new InvalidArgumentError(`User with ID ${userId} not found`);
			}

			// Verify course exists
			const courseExists = await payload.findByID({
				collection: "courses",
				id: course,
				user,
				req: reqWithTransaction,
				overrideAccess: true, // Always allow checking if course exists
			});

			if (!courseExists) {
				throw new InvalidArgumentError(`Course with ID ${course} not found`);
			}

			// Check if enrollment already exists
			const existingEnrollments = await payload.find({
				collection: "enrollments",
				where: {
					and: [
						{
							user: {
								equals: userId,
							},
						},
						{
							course: {
								equals: course,
							},
						},
					],
				},
				limit: 1,
				user,
				req: reqWithTransaction,
				overrideAccess: true, // Always allow checking if enrollment exists
			});

			if (existingEnrollments.docs.length > 0) {
				throw new DuplicateEnrollmentError(
					`Enrollment already exists for user ${userId} in course ${course}`,
				);
			}

			const newEnrollment = await payload.create({
				collection: "enrollments",
				data: {
					user: userId,
					course,
					role,
					status,
					enrolledAt: enrolledAt || new Date().toISOString(),
					completedAt,
					groups,
				},
				user: user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit transaction if we created it
			if (isTransactionCreated) {
				await payload.db.commitTransaction(transactionID);
			}

			return newEnrollment as Enrollment;
		} catch (error) {
			// Rollback transaction if we created it
			if (isTransactionCreated) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create enrollment", {
			cause: error,
		}),
);

/**
 * Updates an existing enrollment using Payload local API
 */
export const tryUpdateEnrollment = Result.wrap(
	async (args: UpdateEnrollmentArgs) => {
		const {
			payload,
			enrollmentId,
			role,
			status,
			enrolledAt,
			completedAt,
			groups,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		// Handle transaction
		const { transactionID, isTransactionCreated, reqWithTransaction } =
			await handleTransactionId(payload, req);

		try {
			const updatedEnrollment = await payload.update({
				collection: "enrollments",
				id: enrollmentId,
				data: {
					role,
					status,
					enrolledAt,
					completedAt,
					groups,
				},
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit transaction if we created it
			if (isTransactionCreated) {
				await payload.db.commitTransaction(transactionID);
			}

			return updatedEnrollment;
		} catch (error) {
			// Rollback transaction if we created it
			if (isTransactionCreated) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update enrollment", {
			cause: error,
		}),
);

/**
 * Finds an enrollment by ID
 */
export const tryFindEnrollmentById = Result.wrap(
	async (args: FindEnrollmentByIdArgs) => {
		const {
			payload,
			enrollmentId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		const enrollment = await payload.findByID({
			collection: "enrollments",
			id: enrollmentId,
			user,
			req: req || {},
			overrideAccess,
		});

		return enrollment;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find enrollment by ID", {
			cause: error,
		}),
);

/**
 * Searches enrollments with various filters
 */
export const trySearchEnrollments = Result.wrap(
	async (args: SearchEnrollmentsArgs) => {
		const {
			payload,
			userId,
			course,
			role,
			status,
			groupId,
			limit = 10,
			page = 1,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		const where: Record<string, any> = {};

		if (userId) {
			where.user = {
				equals: userId,
			};
		}

		if (course) {
			where.course = {
				equals: course,
			};
		}

		if (role) {
			where.role = {
				equals: role,
			};
		}

		if (status) {
			where.status = {
				equals: status,
			};
		}

		if (groupId) {
			where.groups = {
				equals: groupId,
			};
		}

		const enrollments = await payload.find({
			collection: "enrollments",
			where,
			limit,
			page,
			sort: "-createdAt",
			user,
			req: req || {},
			overrideAccess,
		});

		return {
			docs: enrollments.docs as Enrollment[],
			totalDocs: enrollments.totalDocs,
			totalPages: enrollments.totalPages,
			page: enrollments.page,
			limit: enrollments.limit,
			hasNextPage: enrollments.hasNextPage,
			hasPrevPage: enrollments.hasPrevPage,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to search enrollments", {
			cause: error,
		}),
);

/**
 * Deletes an enrollment by ID
 */
export const tryDeleteEnrollment = Result.wrap(
	async (args: DeleteEnrollmentArgs) => {
		const {
			payload,
			enrollmentId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		// Handle transaction
		const { transactionID, isTransactionCreated, reqWithTransaction } =
			await handleTransactionId(payload, req);

		try {
			const deletedEnrollment = await payload.delete({
				collection: "enrollments",
				id: enrollmentId,
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit transaction if we created it
			if (isTransactionCreated) {
				await payload.db.commitTransaction(transactionID);
			}

			return deletedEnrollment;
		} catch (error) {
			// Rollback transaction if we created it
			if (isTransactionCreated) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete enrollment", {
			cause: error,
		}),
);

/**
 * Finds enrollments by user ID
 */
export const tryFindEnrollmentsByUser = Result.wrap(
	async (args: FindEnrollmentsByUserArgs) => {
		const { payload, userId, user = null, req, overrideAccess = false } = args;

		// Validate required fields
		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		const enrollments = await payload
			.find({
				collection: "enrollments",
				where: {
					user: {
						equals: userId,
					},
				},
				sort: "-createdAt",
				pagination: false,
				user,
				req: req || {},
				overrideAccess,
			})
			.then((result) => {
				return result.docs.map((doc) => {
					const userDoc = doc.user;
					assertZodInternal(
						"tryFindEnrollmentsByUser: User is required",
						userDoc,
						z.object({
							id: z.number(),
						}),
					);
					const course = doc.course;
					assertZodInternal(
						"tryFindEnrollmentsByUser: Course is required",
						course,
						z.object({
							id: z.number(),
						}),
					);

					const groups =
						doc.groups?.map((group) => {
							assertZodInternal(
								"tryFindEnrollmentsByUser: Group is required",
								group,
								z.object({
									id: z.number(),
								}),
							);
							return group;
						}) ?? [];
					return {
						...doc,
						user: userDoc.id,
						course: course,
						groups,
					};
				});
			});

		return enrollments;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find enrollments by user", {
			cause: error,
		}),
);

/**
 * Finds enrollments by course ID
 */
export const tryFindEnrollmentsByCourse = Result.wrap(
	async (args: FindEnrollmentsByCourseArgs) => {
		const {
			payload,
			courseId,
			limit = 10,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!courseId) {
			throw new InvalidArgumentError("Course ID is required");
		}

		const enrollments = await payload.find({
			collection: "enrollments",
			where: {
				course: {
					equals: courseId,
				},
			},
			limit,
			sort: "-createdAt",
			user,
			req: req || {},
			overrideAccess,
		});

		return enrollments.docs as Enrollment[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find enrollments by course", {
			cause: error,
		}),
);

/**
 * Finds a specific user enrollment in a course
 */
export const tryFindUserEnrollmentInCourse = Result.wrap(
	async (args: FindUserEnrollmentInCourseArgs) => {
		const {
			payload,
			userId,
			courseId,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!courseId) {
			throw new InvalidArgumentError("Course ID is required");
		}

		const enrollments = await payload.find({
			collection: "enrollments",
			where: {
				and: [
					{
						user: {
							equals: userId,
						},
					},
					{
						course: {
							equals: courseId,
						},
					},
				],
			},
			limit: 1,
			user,
			req: req || {},
			overrideAccess,
		});

		return enrollments.docs.length > 0
			? (enrollments.docs[0] as Enrollment)
			: null;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find user enrollment in course", {
			cause: error,
		}),
);

/**
 * Finds active enrollments only
 */
export const tryFindActiveEnrollments = Result.wrap(
	async (args: FindActiveEnrollmentsArgs) => {
		const {
			payload,
			limit = 10,
			page = 1,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		const enrollments = await payload.find({
			collection: "enrollments",
			where: {
				status: {
					equals: "active",
				},
			},
			limit,
			page,
			sort: "-createdAt",
			user,
			req: req || {},
			overrideAccess,
		});

		return {
			docs: enrollments.docs as Enrollment[],
			totalDocs: enrollments.totalDocs,
			totalPages: enrollments.totalPages,
			page: enrollments.page,
			limit: enrollments.limit,
			hasNextPage: enrollments.hasNextPage,
			hasPrevPage: enrollments.hasPrevPage,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find active enrollments", {
			cause: error,
		}),
);

/**
 * Updates enrollment status (convenience function for common status changes)
 */
export const tryUpdateEnrollmentStatus = Result.wrap(
	async (args: UpdateEnrollmentStatusArgs) => {
		const {
			payload,
			enrollmentId,
			status,
			completedAt,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		if (!status) {
			throw new InvalidArgumentError("Status is required");
		}

		const updateData: UpdateEnrollmentArgs = {
			payload,
			enrollmentId,
			status,
			user,
			req,
			overrideAccess,
		};

		// If marking as completed and completedAt is provided, set it
		if (status === "completed" && completedAt) {
			updateData.completedAt = completedAt;
		}

		// If marking as completed but no completedAt provided, set to current time
		if (status === "completed" && !completedAt) {
			updateData.completedAt = new Date().toISOString();
		}

		return tryUpdateEnrollment(updateData);
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update enrollment status", {
			cause: error,
		}),
);

/**
 * Adds groups to an enrollment
 */
export const tryAddGroupsToEnrollment = Result.wrap(
	async (args: AddGroupsToEnrollmentArgs) => {
		const {
			payload,
			enrollmentId,
			groupIds,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		if (!groupIds || groupIds.length === 0) {
			throw new InvalidArgumentError("Groups array is required");
		}

		// Handle transaction
		const { transactionID, isTransactionCreated, reqWithTransaction } =
			await handleTransactionId(payload, req);

		try {
			// Get current enrollment
			const enrollment = await payload.findByID({
				collection: "enrollments",
				id: enrollmentId,
				user,
				req: reqWithTransaction,
				overrideAccess: true, // Always allow reading enrollment for group management
			});

			if (!enrollment) {
				throw new EnrollmentNotFoundError(
					`Enrollment with ID ${enrollmentId} not found`,
				);
			}

			// Get current group IDs
			const currentGroupIds = (enrollment.groups || []).map((g: any) =>
				typeof g === "number" ? g : g.id,
			);

			// Merge with new groups (remove duplicates)
			const allGroupIds = [...new Set([...currentGroupIds, ...groupIds])];

			// Update enrollment with new groups
			const updatedEnrollment = await payload.update({
				collection: "enrollments",
				id: enrollmentId,
				data: {
					groups: allGroupIds,
				},
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit transaction if we created it
			if (isTransactionCreated) {
				await payload.db.commitTransaction(transactionID);
			}

			return updatedEnrollment;
		} catch (error) {
			// Rollback transaction if we created it
			if (isTransactionCreated) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to add groups to enrollment", {
			cause: error,
		}),
);

/**
 * Removes groups from an enrollment
 */
export const tryRemoveGroupsFromEnrollment = Result.wrap(
	async (args: RemoveGroupsFromEnrollmentArgs) => {
		const {
			payload,
			enrollmentId,
			groupIds,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		if (!groupIds || groupIds.length === 0) {
			throw new InvalidArgumentError("Groups array is required");
		}

		// Handle transaction
		const { transactionID, isTransactionCreated, reqWithTransaction } =
			await handleTransactionId(payload, req);

		try {
			// Get current enrollment
			const enrollment = await payload.findByID({
				collection: "enrollments",
				id: enrollmentId,
				user,
				req: reqWithTransaction,
				overrideAccess: true, // Always allow reading enrollment for group management
			});

			if (!enrollment) {
				throw new EnrollmentNotFoundError(
					`Enrollment with ID ${enrollmentId} not found`,
				);
			}

			// Get current group IDs
			const currentGroupIds = (enrollment.groups || []).map((g: any) =>
				typeof g === "number" ? g : g.id,
			);

			// Remove specified groups
			const groupIdsToRemove = new Set(groupIds);
			const remainingGroupIds = currentGroupIds.filter(
				(id: number) => !groupIdsToRemove.has(id),
			);

			// Update enrollment with remaining groups
			const updatedEnrollment = await payload.update({
				collection: "enrollments",
				id: enrollmentId,
				data: {
					groups: remainingGroupIds,
				},
				user,
				req: reqWithTransaction,
				overrideAccess,
			});

			// Commit transaction if we created it
			if (isTransactionCreated) {
				await payload.db.commitTransaction(transactionID);
			}

			return updatedEnrollment;
		} catch (error) {
			// Rollback transaction if we created it
			if (isTransactionCreated) {
				await payload.db.rollbackTransaction(transactionID);
			}
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to remove groups from enrollment", {
			cause: error,
		}),
);

/**
 * Finds enrollments by group ID
 */
export const tryFindEnrollmentsByGroup = Result.wrap(
	async (args: FindEnrollmentsByGroupArgs) => {
		const {
			payload,
			groupId,
			limit = 10,
			user = null,
			req,
			overrideAccess = false,
		} = args;

		if (!groupId) {
			throw new InvalidArgumentError("Group ID is required");
		}

		const enrollments = await payload.find({
			collection: "enrollments",
			where: {
				groups: {
					equals: groupId,
				},
			},
			limit,
			sort: "-createdAt",
			user,
			req: req || {},
			overrideAccess,
		});

		return enrollments.docs as Enrollment[];
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to find enrollments by group", {
			cause: error,
		}),
);
