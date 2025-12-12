import { Result } from "typescript-result";
import {
	AccessGrantNotFoundError,
	ActivityModuleAccessDeniedError,
	DuplicateAccessGrantError,
	InvalidOwnerTransferError,
	NonExistingActivityModuleError,
	transformError,
	UnknownError,
} from "~/utils/error";
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	type BaseInternalFunctionArgs,
	interceptPayloadError,
	stripDepth,
} from "./utils/internal-function-utils";
import { ActivityModules } from "server/collections";
import type { Enrollment } from "server/payload-types";

export interface GrantAccessArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	grantedToUserId: number;
	grantedByUserId: number;
}

export interface RevokeAccessArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	userId: number;
}

export interface TransferOwnershipArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	newOwnerId: number;
	currentOwnerId: number;
}

export interface CheckAccessArgs extends BaseInternalFunctionArgs {
	activityModuleId: number;
	userId: number;
}

export interface FindGrantsByActivityModuleArgs
	extends BaseInternalFunctionArgs {
	activityModuleId: number;
}

export interface FindInstructorsForActivityModuleArgs
	extends BaseInternalFunctionArgs {
	activityModuleId: number;
}

export interface AccessCheckResult {
	hasAccess: boolean;
	isOwner: boolean;
	isCreator: boolean;
	isGranted: boolean;
	isAdmin: boolean;
}

/**
 * Grants access to an activity module for a user
 * Creates a grant record that allows the user to read and update the module
 * Only the owner or admin can grant access
 */
export const tryGrantAccessToActivityModule = Result.wrap(
	async (args: GrantAccessArgs) => {
		const {
			payload,
			activityModuleId,
			grantedToUserId,
			grantedByUserId,

			req,
			overrideAccess = false,
		} = args;

		// Verify activity module exists
		const activityModule = await payload.findByID({
			collection: "activity-modules",
			id: activityModuleId,
			depth: 0,
			overrideAccess: true,
		});

		if (!activityModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with ID ${activityModuleId} not found`,
			);
		}

		// Verify both users exist using Promise.all
		const [grantedToUser, grantedByUser] = await Promise.all([
			payload.findByID({
				collection: "users",
				id: grantedToUserId,
				overrideAccess: true,
			}),
			payload.findByID({
				collection: "users",
				id: grantedByUserId,
				overrideAccess: true,
			}),
		]);

		if (!grantedToUser) {
			throw new Error(`User with ID ${grantedToUserId} not found`);
		}

		if (!grantedByUser) {
			throw new Error(`User with ID ${grantedByUserId} not found`);
		}

		// Check if granter has permission (owner or admin)
		const ownerId =
			typeof activityModule.owner === "number"
				? activityModule.owner
				: activityModule.owner?.id;

		if (
			!overrideAccess &&
			grantedByUser.role !== "admin" &&
			ownerId !== grantedByUserId
		) {
			throw new ActivityModuleAccessDeniedError(
				"Only the owner or admin can grant access",
			);
		}

		// Check if grant already exists
		const existingGrant = await payload.find({
			collection: "activity-module-grants",
			where: {
				and: [
					{ activityModule: { equals: activityModuleId } },
					{ grantedTo: { equals: grantedToUserId } },
				],
			},
			depth: 0,
			overrideAccess: true,
		});

		if (existingGrant.docs.length > 0) {
			throw new DuplicateAccessGrantError(
				`User ${grantedToUserId} already has access to activity module ${activityModuleId}`,
			);
		}

		// Create the grant
		const grant = await payload
			.create({
				collection: "activity-module-grants",
				data: {
					activityModule: activityModuleId,
					grantedTo: grantedToUserId,
					grantedBy: grantedByUserId,
					grantedAt: new Date().toISOString(),
				},
				depth: 0,
				req,
				overrideAccess,
			})
			.then(stripDepth<0>());

		return grant;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to grant access to activity module", {
			cause: error,
		}),
);

/**
 * Revokes access to an activity module for a user
 * Removes the grant record
 * Only the owner or admin can revoke access
 */
export const tryRevokeAccessFromActivityModule = Result.wrap(
	async (args: RevokeAccessArgs) => {
		const {
			payload,
			activityModuleId,
			userId,
			req,
			overrideAccess = false,
		} = args;

		// Find the grant
		const existingGrant = await payload
			.find({
				collection: "activity-module-grants",
				where: {
					and: [
						{ activityModule: { equals: activityModuleId } },
						{ grantedTo: { equals: userId } },
					],
				},
				depth: 0,
				limit: 1,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "find">())
			.then((result) => result.docs)
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryRevokeAccessFromActivityModule",
					args,
				});
				throw error;
			});

		const existingGrantId = existingGrant[0]?.id;

		if (!existingGrantId) {
			throw new AccessGrantNotFoundError(
				`No access grant found for user ${userId} on activity module ${activityModuleId}`,
			);
		}

		// Delete the grant
		const deletedGrant = await payload
			.delete({
				collection: "activity-module-grants",
				id: existingGrantId,
				req,
				overrideAccess,
				depth: 0,
			})
			.then(stripDepth<0, "delete">())
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryRevokeAccessFromActivityModule",
					args,
				});
				throw error;
			});

		return deletedGrant;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to revoke access from activity module", {
			cause: error,
		}),
);

/**
 * Transfers ownership of an activity module to another user
 * The previous owner is automatically granted access (becomes an admin without delete permission)
 * Only the current owner or admin can transfer ownership
 */
export const tryTransferActivityModuleOwnership = Result.wrap(
	async (args: TransferOwnershipArgs) => {
		const {
			payload,
			activityModuleId,
			newOwnerId,
			currentOwnerId,

			req,
			overrideAccess = false,
		} = args;

		// Verify activity module exists
		const activityModule = await payload.findByID({
			collection: "activity-modules",
			id: activityModuleId,
			depth: 0,
			overrideAccess: true,
		});

		if (!activityModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with ID ${activityModuleId} not found`,
			);
		}

		// Verify new owner exists
		const newOwner = await payload.findByID({
			collection: "users",
			id: newOwnerId,
			overrideAccess: true,
		});

		if (!newOwner) {
			throw new Error(`User with ID ${newOwnerId} not found`);
		}

		// Verify current owner
		const ownerId =
			typeof activityModule.owner === "number"
				? activityModule.owner
				: activityModule.owner?.id;

		if (ownerId !== currentOwnerId && !overrideAccess) {
			throw new InvalidOwnerTransferError(
				`User ${currentOwnerId} is not the owner of activity module ${activityModuleId}`,
			);
		}

		// Check if new owner is same as current owner
		if (newOwnerId === currentOwnerId) {
			throw new InvalidOwnerTransferError(
				"New owner cannot be the same as current owner",
			);
		}

		// Use transaction for atomic operation
		const transactionInfo = await handleTransactionId(payload, req);

		return transactionInfo.tx(async ({ reqWithTransaction }) => {
			// Update owner field using raw update (bypassing access control that prevents owner update)
			await payload
				.update({
					collection: ActivityModules.slug,
					id: activityModuleId,
					data: {
						owner: newOwnerId,
					},
					depth: 1,
					overrideAccess: true, // ?? Must override since owner field update is disabled
					req: reqWithTransaction,
				})
				.then(stripDepth<1, "update">());

			// Grant access to previous owner if they don't already have it
			const existingGrant = await payload
				.find({
					collection: "activity-module-grants",
					where: {
						and: [
							{ activityModule: { equals: activityModuleId } },
							{ grantedTo: { equals: currentOwnerId } },
						],
					},
					depth: 0,
					overrideAccess: true,
					req: reqWithTransaction,
				})
				.then(stripDepth<0, "find">());

			if (existingGrant.docs.length === 0) {
				await payload.create({
					collection: "activity-module-grants",
					data: {
						activityModule: activityModuleId,
						grantedTo: currentOwnerId,
						grantedBy: newOwnerId,
						grantedAt: new Date().toISOString(),
					},
					overrideAccess: true,
					req: reqWithTransaction,
				});
			}

			// Remove grant for new owner if they had one (since they're now the owner)
			const newOwnerGrant = await payload
				.find({
					collection: "activity-module-grants",
					where: {
						and: [
							{ activityModule: { equals: activityModuleId } },
							{ grantedTo: { equals: newOwnerId } },
						],
					},
					depth: 0,
					overrideAccess: true,
					req: reqWithTransaction,
				})
				.then(stripDepth<0, "find">());

			const newOwnerGrantId = newOwnerGrant.docs[0]?.id;

			if (newOwnerGrantId) {
				await payload.delete({
					collection: "activity-module-grants",
					id: newOwnerGrantId,
					overrideAccess: true,
					req: reqWithTransaction,
				});
			}

			// Return updated activity module
			return await payload
				.findByID({
					collection: "activity-modules",
					id: activityModuleId,
					depth: 0,
					overrideAccess: true,
				})
				.then(stripDepth<0, "findByID">());
		});
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to transfer activity module ownership", {
			cause: error,
		}),
);

/**
 * Finds all grants for an activity module
 * Returns grants with populated user data
 */
export const tryFindGrantsByActivityModule = Result.wrap(
	async (args: FindGrantsByActivityModuleArgs) => {
		const { payload, activityModuleId, req, overrideAccess = false } = args;

		const grants = await payload
			.find({
				collection: "activity-module-grants",
				where: {
					activityModule: { equals: activityModuleId },
				},
				select: {
					activityModule: false,
				},
				// ! we don't care about performance for now
				pagination: false,
				overrideAccess,
				req,
			})
			.then(stripDepth<1, "find">())
			.then((result) => result.docs);

		return grants;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to fetch activity module grants", {
			cause: error,
		}),
);

/**
 * Finds instructors from courses linked to an activity module
 * Returns instructors (teachers/TAs) with their course count
 */
export const tryFindInstructorsForActivityModule = Result.wrap(
	async (args: FindInstructorsForActivityModuleArgs) => {
		const { payload, activityModuleId } = args;

		// Find all course links for this activity module
		const links = await payload
			.find({
				collection: "course-activity-module-links",
				where: {
					activityModule: { equals: activityModuleId },
				},
				depth: 0,
				overrideAccess: true,
			})
			.then(stripDepth<0, "find">());

		if (links.docs.length === 0) {
			return [];
		}

		// Extract course IDs
		const courseIds = links.docs.map((link) => link.course);

		// Find all enrollments for these courses with teacher/ta roles
		const enrollments = await payload
			.find({
				collection: "enrollments",
				where: {
					and: [
						{ course: { in: courseIds } },
						{ role: { in: ["teacher", "ta"] satisfies Enrollment["role"][] } },
						{ status: { equals: "active" satisfies Enrollment["status"] } },
					],
				},
				depth: 1, // Populate user data
				pagination: false,
				overrideAccess: true,
			})
			.then(stripDepth<1, "find">())
			.then((result) => result.docs)
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryFindInstructorsForActivityModule",
					args,
				});
				throw error;
			});

		const tempInstructors = enrollments.map((enrollment) => {
			return {
				id: enrollment.user.id,
				email: enrollment.user.email,
				firstName: enrollment.user.firstName ?? "",
				lastName: enrollment.user.lastName ?? "",
				avatar: enrollment.user.avatar ?? null,
				enrollments: [
					{
						courseId: enrollment.course.id,
						role: enrollment.role as Extract<
							Enrollment["role"],
							"teacher" | "ta"
						>,
					},
				],
			};
		});

		// reduce the duplicate instructors into enrollments
		const instructors = tempInstructors.reduce(
			(acc, instructor) => {
				const existing = acc.find((i) => i.id === instructor.id);
				if (existing) {
					existing.enrollments.push(...instructor.enrollments);
				} else {
					acc.push(instructor);
				}
				return acc;
			},
			[] as typeof tempInstructors,
		);

		return instructors;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to fetch instructors for activity module", {
			cause: error,
		}),
);

type FindAutoGrantedModulesForInstructorArgs = BaseInternalFunctionArgs & {
	userId: number;
};

export const tryFindAutoGrantedModulesForInstructor = Result.wrap(
	async (args: FindAutoGrantedModulesForInstructorArgs) => {
		const { payload, userId, req, overrideAccess = false } = args;

		// get all the enrollments for this user
		const enrollments = await payload
			.find({
				collection: "enrollments",
				where: {
					and: [
						{ user: { equals: userId } },
						{ role: { in: ["teacher", "ta"] satisfies Enrollment["role"][] } },
						{ status: { equals: "active" satisfies Enrollment["status"] } },
					],
				},
				depth: 0,
				// ! we don't care about pagination and performance for now
				pagination: false,
				req,
				overrideAccess,
			})
			.then(stripDepth<0, "find">())
			.then((result) => result.docs)
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryFindAutoGrantedModulesForInstructor",
					args,
				});
				throw error;
			});

		// unique by course id, these are the courses that the instructor is teaching
		const courseIds = enrollments
			.map((enrollment) => enrollment.course)
			.filter((course, index, self) => self.indexOf(course) === index);

		// get all the course-activity-module-links for these courses
		const links = await payload
			.find({
				collection: "course-activity-module-links",
				where: {
					course: { in: courseIds },
				},
				overrideAccess,
				depth: 2,
				req,
				// ! we don't care about pagination and performance for now
				pagination: false,
			})
			.then(stripDepth<2, "find">())
			.then((result) => result.docs)
			// unique by activity module id
			.then((links) =>
				links.filter((link, index, self) => {
					return (
						self.findIndex(
							(l) => l.activityModule.id === link.activityModule.id,
						) === index
					);
				}),
			)
			.catch((error) => {
				interceptPayloadError({
					error,
					functionNamePrefix: "tryFindAutoGrantedModulesForInstructor",
					args,
				});
				throw error;
			});

		return links.map((link) => ({
			...link.activityModule,
			// Use the courses from the links directly, not from linkedCourses join field
			linkedCourses: [link.course],
		}));
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to fetch auto granted modules for instructor", {
			cause: error,
		}),
);
