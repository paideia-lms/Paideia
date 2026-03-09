import { Result } from "typescript-result";
import {
	DuplicateEnrollmentError,
	EnrollmentNotFoundError,
	transformError,
} from "../errors";
import {
	InvalidArgumentError,
	UnknownError,
} from "@paideia/shared";
import { handleTransactionId } from "@paideia/shared";
import {
	type Depth,
	stripDepth,
	type BaseInternalFunctionArgs,
	interceptPayloadError,
} from "@paideia/shared";

export interface CreateEnrollmentArgs extends BaseInternalFunctionArgs {
	userId: number;
	course: number;
	role: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	enrolledAt?: string;
	completedAt?: string;
	groups?: number[];
}

export interface UpdateEnrollmentArgs extends BaseInternalFunctionArgs {
	enrollmentId: number;
	role?: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	enrolledAt?: string;
	completedAt?: string;
	groups?: number[];
}

export interface DeleteEnrollmentArgs extends BaseInternalFunctionArgs {
	enrollmentId: number;
}

export interface FindEnrollmentByIdArgs extends BaseInternalFunctionArgs {
	enrollmentId: number;
}

export interface SearchEnrollmentsArgs extends BaseInternalFunctionArgs {
	userId?: number;
	course?: number;
	role?: "student" | "teacher" | "ta" | "manager";
	status?: "active" | "inactive" | "completed" | "dropped";
	groupId?: number;
	limit?: number;
	page?: number;
}

export interface FindEnrollmentsByUserArgs extends BaseInternalFunctionArgs {
	userId: number;
}

export interface FindEnrollmentsByCourseArgs extends BaseInternalFunctionArgs {
	courseId: number;
	limit?: number;
}

export interface FindUserEnrollmentInCourseArgs
	extends BaseInternalFunctionArgs {
	userId: number;
	courseId: number;
}

export interface FindActiveEnrollmentsArgs extends BaseInternalFunctionArgs {
	limit?: number;
	page?: number;
}

export interface UpdateEnrollmentStatusArgs extends BaseInternalFunctionArgs {
	enrollmentId: number;
	status: "active" | "inactive" | "completed" | "dropped";
	completedAt?: string;
}

export interface AddGroupsToEnrollmentArgs extends BaseInternalFunctionArgs {
	enrollmentId: number;
	groupIds: number[];
}

export interface RemoveGroupsFromEnrollmentArgs
	extends BaseInternalFunctionArgs {
	enrollmentId: number;
	groupIds: number[];
}

export interface FindEnrollmentsByGroupArgs extends BaseInternalFunctionArgs {
	groupId: number;
	limit?: number;
}

export function tryCreateEnrollment(args: CreateEnrollmentArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				userId,
				course,
				role,
				status = "active",
				enrolledAt,
				completedAt,
				groups = [],
				req,
				overrideAccess = false,
			} = args;

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const existingEnrollments = await payload
					.find({
						collection: "enrollments",
						where: {
							and: [
								{ user: { equals: userId } },
								{ course: { equals: course } },
							],
						},
						limit: 1,
						req: txInfo.reqWithTransaction,
						overrideAccess: true,
					})
					.then(stripDepth<1, "find">());

				if (existingEnrollments.docs.length > 0) {
					throw new DuplicateEnrollmentError(
						`Enrollment already exists for user ${userId} in course ${course}`,
					);
				}

				const newEnrollment = await payload
					.create({
						collection: "enrollments",
						data: {
							user: userId,
							course,
							role,
							status,
							enrolledAt: enrolledAt ?? new Date().toISOString(),
							completedAt,
							groups,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "create">())
					.catch((error) => {
						interceptPayloadError({
							error,
							functionNamePrefix: "tryCreateEnrollment",
							args: { payload, req, overrideAccess },
						});
						console.log(JSON.stringify(error, null, 2));
						throw error;
					});

				return newEnrollment;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create enrollment", {
				cause: error,
			}),
	);
}

export function tryUpdateEnrollment(args: UpdateEnrollmentArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				enrollmentId,
				role,
				status,
				enrolledAt,
				completedAt,
				groups,
				req,
				overrideAccess = false,
			} = args;

			if (!enrollmentId) {
				throw new InvalidArgumentError("Enrollment ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const updatedEnrollment = await payload
					.update({
						collection: "enrollments",
						id: enrollmentId,
						data: {
							role,
							status,
							enrolledAt,
							completedAt,
							groups,
						},
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "update">());

				return updatedEnrollment;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update enrollment", {
				cause: error,
			}),
	);
}

export function tryFindEnrollmentById(args: FindEnrollmentByIdArgs) {
	return Result.try(
		async () => {
			const { payload, enrollmentId, req, overrideAccess = false } = args;

			if (!enrollmentId) {
				throw new InvalidArgumentError("Enrollment ID is required");
			}

			const enrollment = await payload
				.findByID({
					collection: "enrollments",
					id: enrollmentId,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "findByID">());

			return enrollment;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find enrollment by ID", {
				cause: error,
			}),
	);
}

export function trySearchEnrollments(args: SearchEnrollmentsArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				userId,
				course,
				role,
				status,
				groupId,
				limit = 10,
				page = 1,
				req,
				overrideAccess = false,
			} = args;

			const enrollments = await payload
				.find({
					collection: "enrollments",
					where: {
						...(userId ? { user: { equals: userId } } : {}),
						...(course ? { course: { equals: course } } : {}),
						...(role ? { role: { equals: role } } : {}),
						...(status ? { status: { equals: status } } : {}),
						...(groupId ? { groups: { equals: groupId } } : {}),
					},
					limit,
					page,
					sort: "-createdAt",
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "find">());

			return {
				docs: enrollments.docs,
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
}

export function tryDeleteEnrollment(args: DeleteEnrollmentArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				enrollmentId,
				req,
				overrideAccess = false,
			} = args;

			if (!enrollmentId) {
				throw new InvalidArgumentError("Enrollment ID is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const deletedEnrollment = await payload
					.delete({
						collection: "enrollments",
						id: enrollmentId,
						req: txInfo.reqWithTransaction,
						overrideAccess,
						depth: 0,
					})
					.then(stripDepth<0, "delete">());

				return deletedEnrollment;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to delete enrollment", {
				cause: error,
			}),
	);
}

export function tryFindEnrollmentsByUser(args: FindEnrollmentsByUserArgs) {
	return Result.try(
		async () => {
			const { payload, userId, req, overrideAccess = false } = args;

			if (!userId) {
				throw new InvalidArgumentError("User ID is required");
			}

			const enrollments = await payload
				.find({
					collection: "enrollments",
					where: {
						user: { equals: userId },
					},
					sort: "-createdAt",
					pagination: false,
					req,
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "find">())
				.then((result) => {
					return result.docs.map((doc) => {
						const groups = doc.groups ?? [];
						return {
							...doc,
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
}

export function tryFindEnrollmentsByCourse(args: FindEnrollmentsByCourseArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseId,
				limit = 10,
				req,
				overrideAccess = false,
			} = args;

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			const enrollments = await payload
				.find({
					collection: "enrollments",
					where: {
						course: { equals: courseId },
					},
					limit,
					sort: "-createdAt",
					pagination: false,
					req: req || {},
					overrideAccess,
					depth: 1,
				})
				.then(stripDepth<1, "find">());

			return enrollments.docs;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find enrollments by course", {
				cause: error,
			}),
	);
}

export function tryFindUserEnrollmentInCourse(
	args: FindUserEnrollmentInCourseArgs,
) {
	return Result.try(
		async () => {
			const { payload, userId, courseId, req, overrideAccess = false } = args;

			if (!userId) {
				throw new InvalidArgumentError("User ID is required");
			}

			if (!courseId) {
				throw new InvalidArgumentError("Course ID is required");
			}

			const enrollments = await payload
				.find({
					collection: "enrollments",
					where: {
						and: [
							{ user: { equals: userId } },
							{ course: { equals: courseId } },
						],
					},
					limit: 1,
					depth: 1,
					req: req,
					overrideAccess,
				})
				.then(stripDepth<1, "find">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryFindUserEnrollmentInCourse",
						args,
					});
					throw error;
				});

			return enrollments.docs[0] ?? null;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find user enrollment in course", {
				cause: error,
			}),
	);
}

export function tryFindActiveEnrollments(args: FindActiveEnrollmentsArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				limit = 10,
				page = 1,
				req,
				overrideAccess = false,
			} = args;

			const enrollments = await payload.find({
				collection: "enrollments",
				where: {
					status: { equals: "active" },
				},
				limit,
				page,
				sort: "-createdAt",
				req: req || {},
				overrideAccess,
			});

			return {
				docs: enrollments.docs,
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
}

export function tryUpdateEnrollmentStatus(args: UpdateEnrollmentStatusArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				enrollmentId,
				status,
				completedAt,
				req,
				overrideAccess = false,
			} = args;

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
				req,
				overrideAccess,
			};

			if (status === "completed" && completedAt) {
				updateData.completedAt = completedAt;
			}

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
}

export function tryAddGroupsToEnrollment(args: AddGroupsToEnrollmentArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				enrollmentId,
				groupIds,
				req,
				overrideAccess = false,
			} = args;

			if (!enrollmentId) {
				throw new InvalidArgumentError("Enrollment ID is required");
			}

			if (!groupIds || groupIds.length === 0) {
				throw new InvalidArgumentError("Groups array is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const enrollment = await payload.findByID({
					collection: "enrollments",
					id: enrollmentId,
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				if (!enrollment) {
					throw new EnrollmentNotFoundError(
						`Enrollment with ID ${enrollmentId} not found`,
					);
				}

				const currentGroupIds = (enrollment.groups || []).map((g: any) =>
					typeof g === "number" ? g : g.id,
				);

				const allGroupIds = [...new Set([...currentGroupIds, ...groupIds])];

				const updatedEnrollment = await payload.update({
					collection: "enrollments",
					id: enrollmentId,
					data: {
						groups: allGroupIds,
					},
					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				return updatedEnrollment;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to add groups to enrollment", {
				cause: error,
			}),
	);
}

export function tryRemoveGroupsFromEnrollment(
	args: RemoveGroupsFromEnrollmentArgs,
) {
	return Result.try(
		async () => {
			const {
				payload,
				enrollmentId,
				groupIds,
				req,
				overrideAccess = false,
			} = args;

			if (!enrollmentId) {
				throw new InvalidArgumentError("Enrollment ID is required");
			}

			if (!groupIds || groupIds.length === 0) {
				throw new InvalidArgumentError("Groups array is required");
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const enrollment = await payload.findByID({
					collection: "enrollments",
					id: enrollmentId,
					req: txInfo.reqWithTransaction,
					overrideAccess: true,
				});

				if (!enrollment) {
					throw new EnrollmentNotFoundError(
						`Enrollment with ID ${enrollmentId} not found`,
					);
				}

				const currentGroupIds = (enrollment.groups || []).map((g: any) =>
					typeof g === "number" ? g : g.id,
				);

				const groupIdsToRemove = new Set(groupIds);
				const remainingGroupIds = currentGroupIds.filter(
					(id: number) => !groupIdsToRemove.has(id),
				);

				const updatedEnrollment = await payload.update({
					collection: "enrollments",
					id: enrollmentId,
					data: {
						groups: remainingGroupIds,
					},
					req: txInfo.reqWithTransaction,
					overrideAccess,
				});

				return updatedEnrollment;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to remove groups from enrollment", {
				cause: error,
			}),
	);
}

export function tryFindEnrollmentsByGroup(args: FindEnrollmentsByGroupArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				groupId,
				limit = 10,
				req,
				overrideAccess = false,
			} = args;

			if (!groupId) {
				throw new InvalidArgumentError("Group ID is required");
			}

			const enrollments = await payload.find({
				collection: "enrollments",
				where: {
					groups: { equals: groupId },
				},
				limit,
				sort: "-createdAt",
				req: req || {},
				overrideAccess,
			});

			return enrollments.docs;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to find enrollments by group", {
				cause: error,
			}),
	);
}
