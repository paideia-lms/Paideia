import type { Payload, TypedUser } from "payload";
import { Result } from "typescript-result";
import {
	AccessGrantNotFoundError,
	ActivityModuleAccessDeniedError,
	DuplicateAccessGrantError,
	InvalidOwnerTransferError,
	NonExistingActivityModuleError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";

export interface GrantAccessArgs {
	payload: Payload;
	activityModuleId: number;
	grantedToUserId: number;
	grantedByUserId: number;
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface RevokeAccessArgs {
	payload: Payload;
	activityModuleId: number;
	userId: number;
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface TransferOwnershipArgs {
	payload: Payload;
	activityModuleId: number;
	newOwnerId: number;
	currentOwnerId: number;
	user?: TypedUser | null;
	req?: Request;
	overrideAccess?: boolean;
}

export interface CheckAccessArgs {
	payload: Payload;
	activityModuleId: number;
	userId: number;
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
			user = null,
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

		// Verify both users exist
		const grantedToUser = await payload.findByID({
			collection: "users",
			id: grantedToUserId,
			overrideAccess: true,
		});

		if (!grantedToUser) {
			throw new Error(`User with ID ${grantedToUserId} not found`);
		}

		const grantedByUser = await payload.findByID({
			collection: "users",
			id: grantedByUserId,
			overrideAccess: true,
		});

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
		const grant = await payload.create({
			collection: "activity-module-grants",
			data: {
				activityModule: activityModuleId,
				grantedTo: grantedToUserId,
				grantedBy: grantedByUserId,
				grantedAt: new Date().toISOString(),
			},
			user,
			req,
			overrideAccess: true, // We've already checked permissions
		});

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
			user = null,
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

		// Find the grant
		const existingGrant = await payload.find({
			collection: "activity-module-grants",
			where: {
				and: [
					{ activityModule: { equals: activityModuleId } },
					{ grantedTo: { equals: userId } },
				],
			},
			depth: 0,
			overrideAccess: true,
		});

		if (existingGrant.docs.length === 0) {
			throw new AccessGrantNotFoundError(
				`No access grant found for user ${userId} on activity module ${activityModuleId}`,
			);
		}

		// Delete the grant
		const deletedGrant = await payload.delete({
			collection: "activity-module-grants",
			id: existingGrant.docs[0].id,
			user,
			req,
			overrideAccess: true,
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
			user = null,
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
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Update owner field using raw update (bypassing access control that prevents owner update)
			await payload.update({
				collection: "activity-modules",
				id: activityModuleId,
				data: {
					owner: newOwnerId,
				},
				overrideAccess: true, // Must override since owner field update is disabled
				req: { transactionID },
			});

			// Grant access to previous owner if they don't already have it
			const existingGrant = await payload.find({
				collection: "activity-module-grants",
				where: {
					and: [
						{ activityModule: { equals: activityModuleId } },
						{ grantedTo: { equals: currentOwnerId } },
					],
				},
				depth: 0,
				overrideAccess: true,
			});

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
					req: { transactionID },
				});
			}

			// Remove grant for new owner if they had one (since they're now the owner)
			const newOwnerGrant = await payload.find({
				collection: "activity-module-grants",
				where: {
					and: [
						{ activityModule: { equals: activityModuleId } },
						{ grantedTo: { equals: newOwnerId } },
					],
				},
				depth: 0,
				overrideAccess: true,
			});

			if (newOwnerGrant.docs.length > 0) {
				await payload.delete({
					collection: "activity-module-grants",
					id: newOwnerGrant.docs[0].id,
					overrideAccess: true,
					req: { transactionID },
				});
			}

			await payload.db.commitTransaction(transactionID);

			// Return updated activity module
			return await payload.findByID({
				collection: "activity-modules",
				id: activityModuleId,
				depth: 0,
				overrideAccess: true,
			});
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to transfer activity module ownership", {
			cause: error,
		}),
);

/**
 * Checks if a user has access to an activity module
 * Returns detailed access information including the source of access
 */
export const tryCheckActivityModuleAccess = Result.wrap(
	async (args: CheckAccessArgs): Promise<AccessCheckResult> => {
		const { payload, activityModuleId, userId } = args;

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

		// Get user
		const user = await payload.findByID({
			collection: "users",
			id: userId,
			overrideAccess: true,
		});

		if (!user) {
			throw new Error(`User with ID ${userId} not found`);
		}

		// Check if user is admin
		const isAdmin = user.role === "admin";

		// Check if user is owner
		const ownerId =
			typeof activityModule.owner === "number"
				? activityModule.owner
				: activityModule.owner?.id;
		const isOwner = ownerId === userId;

		// Check if user is creator
		const createdById =
			typeof activityModule.createdBy === "number"
				? activityModule.createdBy
				: activityModule.createdBy?.id;
		const isCreator = createdById === userId;

		// Check if user has granted access
		const grant = await payload.find({
			collection: "activity-module-grants",
			where: {
				and: [
					{ activityModule: { equals: activityModuleId } },
					{ grantedTo: { equals: userId } },
				],
			},
			depth: 0,
			overrideAccess: true,
		});
		const isGranted = grant.docs.length > 0;

		const hasAccess = isAdmin || isOwner || isCreator || isGranted;

		return {
			hasAccess,
			isOwner,
			isCreator,
			isGranted,
			isAdmin,
		};
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to check activity module access", {
			cause: error,
		}),
);
