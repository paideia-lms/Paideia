import type { Payload } from "payload";
import { Result } from "typescript-result";
import type { Enrollment } from "../payload-types";

export interface CreateEnrollmentArgs {
	user: number; // User ID
	course: number; // Course ID
	role: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	enrolledAt?: string;
	completedAt?: string;
}

export interface UpdateEnrollmentArgs {
	role?: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	enrolledAt?: string;
	completedAt?: string;
}

export interface SearchEnrollmentsArgs {
	user?: number;
	course?: number;
	role?: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	limit?: number;
	page?: number;
}

/**
 * Creates a new enrollment using Payload local API
 */
export const tryCreateEnrollment = Result.wrap(
	async (payload: Payload, request: Request, args: CreateEnrollmentArgs) => {
		const {
			user,
			course,
			role,
			status = "active",
			enrolledAt,
			completedAt,
		} = args;

		// Verify user exists
		const userExists = await payload.findByID({
			collection: "users",
			id: user,
			req: request,
		});

		if (!userExists) {
			throw new Error(`User with ID ${user} not found`);
		}

		// Verify course exists
		const courseExists = await payload.findByID({
			collection: "courses",
			id: course,
			req: request,
		});

		if (!courseExists) {
			throw new Error(`Course with ID ${course} not found`);
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
			req: request,
		});

		if (existingEnrollments.docs.length > 0) {
			throw new Error(
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
			},
			req: request,
		});

		return newEnrollment as Enrollment;
	},
	(error) => {
		if (error instanceof Error) {
			// Check if it's a specific error we can make more descriptive
			if (error.message.includes("Not Found")) {
				return new Error(
					`Failed to create enrollment: Referenced user or course not found`,
				);
			}
			return new Error(`Failed to create enrollment: ${error.message}`);
		}
		return new Error(`Failed to create enrollment: ${String(error)}`);
	},
);

/**
 * Updates an existing enrollment using Payload local API
 */
export const tryUpdateEnrollment = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		enrollmentId: number,
		args: UpdateEnrollmentArgs,
	) => {
		// Check if enrollment exists
		const existingEnrollment = await payload.findByID({
			collection: "enrollments",
			id: enrollmentId,
			req: request,
		});

		if (!existingEnrollment) {
			throw new Error(`Enrollment with ID ${enrollmentId} not found`);
		}

		const updatedEnrollment = await payload.update({
			collection: "enrollments",
			id: enrollmentId,
			data: args,
			req: request,
		});

		return updatedEnrollment;
	},
	(error) => {
		if (error instanceof Error) {
			if (error.message.includes("Not Found")) {
				return new Error(`Failed to update enrollment: Enrollment not found`);
			}
			return new Error(`Failed to update enrollment: ${error.message}`);
		}
		return new Error(`Failed to update enrollment: ${String(error)}`);
	},
);

/**
 * Finds an enrollment by ID
 */
export const tryFindEnrollmentById = Result.wrap(
	async (payload: Payload, enrollmentId: number) => {
		const enrollment = await payload.findByID({
			collection: "enrollments",
			id: enrollmentId,
		});

		if (!enrollment) {
			throw new Error(`Enrollment with ID ${enrollmentId} not found`);
		}

		return enrollment as Enrollment;
	},
	(error) => {
		if (error instanceof Error) {
			if (error.message.includes("Not Found")) {
				return new Error(
					`Failed to find enrollment by ID: Enrollment not found`,
				);
			}
			return new Error(`Failed to find enrollment by ID: ${error.message}`);
		}
		return new Error(`Failed to find enrollment by ID: ${String(error)}`);
	},
);

/**
 * Searches enrollments with various filters
 */
export const trySearchEnrollments = Result.wrap(
	async (payload: Payload, args: SearchEnrollmentsArgs = {}) => {
		const { user, course, role, status, limit = 10, page = 1 } = args;

		const where: Record<string, { equals: number | string }> = {};

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

		const enrollments = await payload.find({
			collection: "enrollments",
			where,
			limit,
			page,
			sort: "-createdAt",
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
		new Error(
			`Failed to search enrollments: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Deletes an enrollment by ID
 */
export const tryDeleteEnrollment = Result.wrap(
	async (payload: Payload, request: Request, enrollmentId: number) => {
		const deletedEnrollment = await payload.delete({
			collection: "enrollments",
			id: enrollmentId,
			req: request,
		});

		return deletedEnrollment as Enrollment;
	},
	(error) =>
		new Error(
			`Failed to delete enrollment: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds enrollments by user ID
 */
export const tryFindEnrollmentsByUser = Result.wrap(
	async (payload: Payload, userId: number, limit: number = 10) => {
		const enrollments = await payload.find({
			collection: "enrollments",
			where: {
				user: {
					equals: userId,
				},
			},
			limit,
			sort: "-createdAt",
		});

		return enrollments.docs as Enrollment[];
	},
	(error) =>
		new Error(
			`Failed to find enrollments by user: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds enrollments by course ID
 */
export const tryFindEnrollmentsByCourse = Result.wrap(
	async (payload: Payload, courseId: number, limit: number = 10) => {
		const enrollments = await payload.find({
			collection: "enrollments",
			where: {
				course: {
					equals: courseId,
				},
			},
			limit,
			sort: "-createdAt",
		});

		return enrollments.docs as Enrollment[];
	},
	(error) =>
		new Error(
			`Failed to find enrollments by course: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds a specific user enrollment in a course
 */
export const tryFindUserEnrollmentInCourse = Result.wrap(
	async (payload: Payload, userId: number, courseId: number) => {
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
		});

		return enrollments.docs.length > 0
			? (enrollments.docs[0] as Enrollment)
			: null;
	},
	(error) =>
		new Error(
			`Failed to find user enrollment in course: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Finds active enrollments only
 */
export const tryFindActiveEnrollments = Result.wrap(
	async (payload: Payload, limit: number = 10, page: number = 1) => {
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
		new Error(
			`Failed to find active enrollments: ${error instanceof Error ? error.message : String(error)}`,
		),
);

/**
 * Updates enrollment status (convenience function for common status changes)
 */
export const tryUpdateEnrollmentStatus = Result.wrap(
	async (
		payload: Payload,
		request: Request,
		enrollmentId: number,
		status: "active" | "inactive" | "completed" | "dropped",
		completedAt?: string,
	) => {
		const updateData: UpdateEnrollmentArgs = { status };

		// If marking as completed and completedAt is provided, set it
		if (status === "completed" && completedAt) {
			updateData.completedAt = completedAt;
		}

		// If marking as completed but no completedAt provided, set to current time
		if (status === "completed" && !completedAt) {
			updateData.completedAt = new Date().toISOString();
		}

		return tryUpdateEnrollment(payload, request, enrollmentId, updateData);
	},
	(error) =>
		new Error(
			`Failed to update enrollment status: ${error instanceof Error ? error.message : String(error)}`,
		),
);
