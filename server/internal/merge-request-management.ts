import "@total-typescript/ts-reset";
import type { Payload } from "payload";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	NonExistingMergeRequestError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { MergeRequest } from "../payload-types";

export interface CreateMergeRequestArgs {
	title: string;
	description?: string;
	fromActivityModuleId: number;
	toActivityModuleId: number;
	userId: number;
}

export interface CreateMergeRequestResult {
	mergeRequest: MergeRequest;
}

/**
 * Creates a new merge request between two activity modules
 *
 * This function:
 * 1. Validates that both activity modules exist
 * 2. Validates that they have the same origin
 * 3. Creates a merge request with "open" status
 * 4. Uses transactions to ensure atomicity
 */
export const tryCreateMergeRequest = Result.wrap(
	async (
		payload: Payload,
		args: CreateMergeRequestArgs,
	): Promise<CreateMergeRequestResult> => {
		const {
			title,
			description,
			fromActivityModuleId,
			toActivityModuleId,
			userId,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!fromActivityModuleId) {
			throw new InvalidArgumentError("From activity module ID is required");
		}

		if (!toActivityModuleId) {
			throw new InvalidArgumentError("To activity module ID is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (fromActivityModuleId === toActivityModuleId) {
			throw new InvalidArgumentError(
				"Cannot create merge request to the same activity module",
			);
		}

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Verify user exists
			const user = await payload.findByID({
				collection: "users",
				id: userId,
				req: { transactionID },
			});

			if (!user) {
				throw new InvalidArgumentError(`User with id '${userId}' not found`);
			}

			// Verify both activity modules exist and get their origins
			const fromModule = await payload.findByID({
				collection: "activity-modules",
				id: fromActivityModuleId,
				req: { transactionID },
			});

			if (!fromModule) {
				throw new InvalidArgumentError(
					`From activity module with id '${fromActivityModuleId}' not found`,
				);
			}

			const toModule = await payload.findByID({
				collection: "activity-modules",
				id: toActivityModuleId,
				req: { transactionID },
			});

			if (!toModule) {
				throw new InvalidArgumentError(
					`To activity module with id '${toActivityModuleId}' not found`,
				);
			}

			// Get origin IDs
			const fromOriginId =
				typeof fromModule.origin === "object"
					? fromModule.origin.id
					: fromModule.origin;
			const toOriginId =
				typeof toModule.origin === "object"
					? toModule.origin.id
					: toModule.origin;

			// Validate that both modules have the same origin
			if (fromOriginId !== toOriginId) {
				throw new InvalidArgumentError(
					"Activity modules must have the same origin to create a merge request",
				);
			}

			// Check if merge request already exists between these modules
			const existingMergeRequest = await payload.find({
				collection: "merge-requests",
				where: {
					and: [
						{ from: { equals: fromActivityModuleId } },
						{ to: { equals: toActivityModuleId } },
					],
				},
				req: { transactionID },
			});

			if (existingMergeRequest.docs.length > 0) {
				throw new InvalidArgumentError(
					"Merge request already exists between these activity modules",
				);
			}

			// Create merge request
			const mergeRequest = await payload.create({
				collection: "merge-requests",
				data: {
					title,
					description: description || null,
					from: fromActivityModuleId,
					to: toActivityModuleId,
					status: "open",
					createdBy: userId,
				},
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return {
				mergeRequest,
			};
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create merge request", {
			cause: error,
		}),
);

export interface GetMergeRequestByIdArgs {
	id: number | string;
	depth?: number;
	transactionID?: string | number;
}

/**
 * Get a merge request by ID
 *
 * This function fetches a merge request by its ID with optional depth control
 * for relationships (e.g., from, to, createdBy, comments)
 */
export const tryGetMergeRequestById = Result.wrap(
	async (
		payload: Payload,
		args: GetMergeRequestByIdArgs,
	): Promise<MergeRequest> => {
		const { id, depth = 1 } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Merge request ID is required");
		}

		// Fetch the merge request
		const mergeRequestResult = await payload.find({
			collection: "merge-requests",
			where: {
				and: [
					{
						id: { equals: id },
					},
				],
			},
			depth,
		});

		const mergeRequest = mergeRequestResult.docs[0];

		if (!mergeRequest) {
			throw new NonExistingMergeRequestError(
				`Merge request with id '${id}' not found`,
			);
		}

		return mergeRequest;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get merge request", {
			cause: error,
		}),
);

export interface UpdateMergeRequestStatusArgs {
	id: number;
	status: "open" | "merged" | "rejected" | "closed";
	userId: number;
}

/**
 * Updates the status of a merge request
 *
 * This function:
 * 1. Validates the merge request exists
 * 2. Updates the status and related fields (mergedAt, mergedBy, rejectedAt, rejectedBy)
 * 3. Uses transactions to ensure atomicity
 */
export const tryUpdateMergeRequestStatus = Result.wrap(
	async (
		payload: Payload,
		args: UpdateMergeRequestStatusArgs,
	): Promise<MergeRequest> => {
		const { id, status, userId } = args;

		// Validate required fields
		if (!id) {
			throw new InvalidArgumentError("Merge request ID is required");
		}

		if (!status) {
			throw new InvalidArgumentError("Status is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Verify user exists
			const user = await payload.findByID({
				collection: "users",
				id: userId,
				req: { transactionID },
			});

			if (!user) {
				throw new InvalidArgumentError(`User with id '${userId}' not found`);
			}

			// Get the merge request
			const mergeRequest = await payload.findByID({
				collection: "merge-requests",
				id,
				req: { transactionID },
			});

			if (!mergeRequest) {
				throw new NonExistingMergeRequestError(
					`Merge request with id '${id}' not found`,
				);
			}

			// Prepare update data
			const updateData: Partial<MergeRequest> = {
				status,
			};

			// Set status-specific fields
			if (status === "merged") {
				updateData.mergedAt = new Date().toISOString();
				updateData.mergedBy = userId;
			} else if (status === "rejected") {
				updateData.rejectedAt = new Date().toISOString();
				updateData.rejectedBy = userId;
			}

			// Update the merge request
			const updatedMergeRequest = await payload.update({
				collection: "merge-requests",
				id,
				data: updateData,
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return updatedMergeRequest;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to update merge request status", {
			cause: error,
		}),
);

export interface DeleteMergeRequestArgs {
	id: number;
	userId: number;
}

/**
 * Deletes a merge request
 *
 * This function:
 * 1. Validates the merge request exists
 * 2. Deletes the merge request and all associated comments
 * 3. Uses transactions to ensure atomicity
 */
export const tryDeleteMergeRequest = Result.wrap(
	async (
		payload: Payload,
		args: DeleteMergeRequestArgs,
	): Promise<MergeRequest> => {
		const { id, userId } = args;

		// Validate required fields
		if (!id) {
			throw new InvalidArgumentError("Merge request ID is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		// Begin transaction
		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Verify user exists
			const user = await payload.findByID({
				collection: "users",
				id: userId,
				req: { transactionID },
			});

			if (!user) {
				throw new InvalidArgumentError(`User with id '${userId}' not found`);
			}

			// Get the merge request
			const mergeRequest = await payload.findByID({
				collection: "merge-requests",
				id,
				req: { transactionID },
			});

			if (!mergeRequest) {
				throw new NonExistingMergeRequestError(
					`Merge request with id '${id}' not found`,
				);
			}

			// Delete all associated comments first
			await payload.delete({
				collection: "merge-request-comments",
				where: {
					mergeRequest: { equals: id },
				},
				req: { transactionID },
			});

			// Delete the merge request
			await payload.delete({
				collection: "merge-requests",
				id,
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return mergeRequest;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete merge request", {
			cause: error,
		}),
);

export interface GetMergeRequestsByActivityModuleArgs {
	activityModuleId: number;
	depth?: number;
	status?: "open" | "merged" | "rejected" | "closed";
}

/**
 * Gets all merge requests related to an activity module (either as source or target)
 *
 * This function fetches merge requests where the activity module is either
 * the source (from) or target (to) of the merge request
 */
export const tryGetMergeRequestsByActivityModule = Result.wrap(
	async (
		payload: Payload,
		args: GetMergeRequestsByActivityModuleArgs,
	): Promise<MergeRequest[]> => {
		const { activityModuleId, depth = 1, status } = args;

		// Validate ID
		if (!activityModuleId) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Build where clause
		let whereClause: any = {
			or: [
				{ from: { equals: activityModuleId } },
				{ to: { equals: activityModuleId } },
			],
		};

		// Add status filter if provided
		if (status) {
			whereClause = {
				and: [whereClause, { status: { equals: status } }],
			};
		}

		// Fetch merge requests
		const mergeRequestsResult = await payload.find({
			collection: "merge-requests",
			where: whereClause,
			depth,
			sort: "-createdAt",
		});

		return mergeRequestsResult.docs;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get merge requests by activity module", {
			cause: error,
		}),
);
