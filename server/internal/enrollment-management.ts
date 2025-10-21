import type { Payload, PayloadRequest } from "payload";
import { assertZodInternal } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import z from "zod";
import {
	DuplicateEnrollmentError,
	EnrollmentNotFoundError,
	InvalidArgumentError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { Enrollment, User } from "../payload-types";

export interface CreateEnrollmentArgs {
	payload: Payload;
	user: number; // User ID
	course: number; // Course ID
	role: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	enrolledAt?: string;
	completedAt?: string;
	groups?: number[]; // Array of group IDs
	authenticatedUser?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface UpdateEnrollmentArgs {
	payload: Payload;
	enrollmentId: number;
	role?: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	enrolledAt?: string;
	completedAt?: string;
	groups?: number[]; // Array of group IDs
	authenticatedUser?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

export interface SearchEnrollmentsArgs {
	payload: Payload;
	user?: number;
	course?: number;
	role?: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	groupId?: number; // Filter by group ID
	limit?: number;
	page?: number;
	authenticatedUser?: User | null;
	req?: Partial<PayloadRequest>;
	overrideAccess?: boolean;
}

/**
 * Creates a new enrollment using Payload local API
 */
export const tryCreateEnrollment = Result.wrap(
	async (args: CreateEnrollmentArgs) => {
		const {
			payload,
			user,
			course,
			role,
			status = "active",
			enrolledAt,
			completedAt,
			groups = [],
			authenticatedUser = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!user) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!course) {
			throw new InvalidArgumentError("Course ID is required");
		}

		if (!role) {
			throw new InvalidArgumentError("Role is required");
		}

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Verify user exists
			const userExists = await payload.findByID({
				collection: "users",
				id: user,
				user: authenticatedUser,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess: true, // Always allow checking if user exists
			});

			if (!userExists) {
				throw new InvalidArgumentError(`User with ID ${user} not found`);
			}

			// Verify course exists
			const courseExists = await payload.findByID({
				collection: "courses",
				id: course,
				user: authenticatedUser,
				req: req ? { ...req, transactionID } : { transactionID },
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
								equals: user,
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
				user: authenticatedUser,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess: true, // Always allow checking if enrollment exists
			});

			if (existingEnrollments.docs.length > 0) {
				throw new DuplicateEnrollmentError(
					`Enrollment already exists for user ${user} in course ${course}`,
				);
			}

			const newEnrollment = await payload.create({
				collection: "enrollments",
				data: {
					user,
					course,
					role,
					status,
					enrolledAt: enrolledAt || new Date().toISOString(),
					completedAt,
					groups,
				},
				user: authenticatedUser,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess,
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return newEnrollment as Enrollment;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
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
			authenticatedUser = null,
			req,
			overrideAccess = false,
		} = args;

		// Validate required fields
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

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
				user: authenticatedUser,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess,
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return updatedEnrollment;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
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
	async (
		payload: Payload,
		enrollmentId: number,
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
		// Validate required fields
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		const enrollment = await payload.findByID({
			collection: "enrollments",
			id: enrollmentId,
			user: authenticatedUser,
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
			user,
			course,
			role,
			status,
			groupId,
			limit = 10,
			page = 1,
			authenticatedUser = null,
			req,
			overrideAccess = false,
		} = args;

		const where: Record<string, any> = {};

		if (user) {
			where.user = {
				equals: user,
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
			user: authenticatedUser,
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
	async (
		payload: Payload,
		enrollmentId: number,
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
		// Validate required fields
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		const deletedEnrollment = await payload.delete({
			collection: "enrollments",
			id: enrollmentId,
			user: authenticatedUser,
			req: req ? { ...req, transactionID } : { transactionID },
			overrideAccess,
		});

		// Commit transaction
		await payload.db.commitTransaction(transactionID);

		return deletedEnrollment;
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
	async (
		payload: Payload,
		userId: number,
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
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
				user: authenticatedUser,
				req: req || {},
				overrideAccess,
			})
			.then((result) => {
				return result.docs.map((doc) => {
					const user = doc.user;
					assertZodInternal(
						"tryFindEnrollmentsByUser: User is required",
						user,
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
						user: user.id,
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
	async (
		payload: Payload,
		courseId: number,
		limit: number = 10,
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
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
			user: authenticatedUser,
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
	async (
		payload: Payload,
		userId: number,
		courseId: number,
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
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
			user: authenticatedUser,
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
	async (
		payload: Payload,
		limit: number = 10,
		page: number = 1,
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
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
			user: authenticatedUser,
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
	async (
		payload: Payload,
		enrollmentId: number,
		status: "active" | "inactive" | "completed" | "dropped",
		completedAt?: string,
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
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
			authenticatedUser,
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
	async (
		payload: Payload,
		enrollmentId: number,
		groupIds: number[],
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		if (!groupIds || groupIds.length === 0) {
			throw new InvalidArgumentError("Groups array is required");
		}

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Get current enrollment
			const enrollment = await payload.findByID({
				collection: "enrollments",
				id: enrollmentId,
				user: authenticatedUser,
				req: req ? { ...req, transactionID } : { transactionID },
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
				user: authenticatedUser,
				req: req ? { ...req, transactionID } : { transactionID },
				overrideAccess,
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return updatedEnrollment;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
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
	async (
		payload: Payload,
		enrollmentId: number,
		groupIds: number[],
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
		if (!enrollmentId) {
			throw new InvalidArgumentError("Enrollment ID is required");
		}

		if (!groupIds || groupIds.length === 0) {
			throw new InvalidArgumentError("Groups array is required");
		}

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();
		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Get current enrollment
			const enrollment = await payload.findByID({
				collection: "enrollments",
				id: enrollmentId,
				req: req ? { ...req, transactionID } : { transactionID },
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
				user: authenticatedUser,
				data: {
					groups: remainingGroupIds,
				},
				req: req ? { ...req, transactionID } : { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return updatedEnrollment;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
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
	async (
		payload: Payload,
		groupId: number,
		limit: number = 10,
		authenticatedUser?: User | null,
		req?: Partial<PayloadRequest>,
		overrideAccess: boolean = false,
	) => {
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
			user: authenticatedUser,
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
