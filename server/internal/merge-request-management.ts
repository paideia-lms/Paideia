import "@total-typescript/ts-reset";
import type { Payload } from "payload";
import { getTx } from "server/utils/get-tx";
import { assertZod } from "server/utils/type-narrowing";
import { commits_rels } from "src/payload-generated-schema";
import { Result } from "typescript-result";
import z from "zod";
import {
	InvalidArgumentError,
	NonExistingMergeRequestError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { MergeRequest, MergeRequestComment } from "../payload-types";
import {
	tryAnalyzeMergeStrategy,
	tryCreateMergeCommit,
} from "./commit-management";

export interface CreateMergeRequestArgs {
	title: string;
	description?: string;
	fromActivityModuleId: number;
	toActivityModuleId: number;
	userId: number;
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
	async (payload: Payload, args: CreateMergeRequestArgs) => {
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
			// Verify both activity modules exist and get their origins
			const modules = await payload.find({
				collection: "activity-modules",
				where: {
					id: {
						in: [fromActivityModuleId, toActivityModuleId],
					},
				},
				req: { transactionID },
			});

			if (modules.docs.length !== 2) {
				throw new InvalidArgumentError(
					`From activity module with id '${fromActivityModuleId}' not found`,
				);
			}

			const fromModule = modules.docs.find(
				(module) => module.id === fromActivityModuleId,
			)!;
			const toModule = modules.docs.find(
				(module) => module.id === toActivityModuleId,
			)!;

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

			// Check if **open** merge request already exists between these modules
			const existingMergeRequest = await payload.find({
				collection: "merge-requests",
				where: {
					and: [
						{
							from: { equals: fromActivityModuleId },
							to: { equals: toActivityModuleId },
							status: { equals: "open" },
						},
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
					status: "open",
					description: description || null,
					from: fromActivityModuleId,
					to: toActivityModuleId,
					createdBy: userId,
				},
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const mergeRequestFrom = mergeRequest.from;
			assertZod(
				mergeRequestFrom,
				z.object({
					id: z.number(),
				}),
			);

			const mergeRequestTo = mergeRequest.to;
			assertZod(
				mergeRequestTo,
				z.object({
					id: z.number(),
				}),
			);

			const mergeRequestCreatedBy = mergeRequest.createdBy;
			assertZod(
				mergeRequestCreatedBy,
				z.object({
					id: z.number(),
				}),
			);

			return {
				mergeRequest: {
					...mergeRequest,
					from: mergeRequestFrom,
					to: mergeRequestTo,
					createdBy: mergeRequestCreatedBy,
				},
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
			// Delete all associated comments first
			await payload.delete({
				collection: "merge-request-comments",
				where: {
					mergeRequest: { equals: id },
				},
				req: { transactionID },
			});

			// Delete the merge request
			const deletedMergeRequest = await payload.delete({
				collection: "merge-requests",
				id,
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return deletedMergeRequest;
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

		// Fetch merge requests
		const mergeRequestsResult = await payload.find({
			collection: "merge-requests",
			where: {
				and: [
					{
						or: [
							{ from: { equals: activityModuleId } },
							{ to: { equals: activityModuleId } },
						],
					},
					status
						? {
								status: { equals: status },
							}
						: {},
				],
			},
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

export interface CreateMergeRequestCommentArgs {
	mergeRequestId: number;
	comment: string;
	userId: number;
}

/**
 * Creates a comment on a merge request
 *
 * This function:
 * 1. Validates the merge request exists and allows comments
 * 2. Creates a comment with the provided text
 * 3. Uses transactions to ensure atomicity
 */
export const tryCreateMergeRequestComment = Result.wrap(
	async (
		payload: Payload,
		args: CreateMergeRequestCommentArgs,
	): Promise<MergeRequestComment> => {
		const { mergeRequestId, comment, userId } = args;

		// Validate required fields
		if (!mergeRequestId) {
			throw new InvalidArgumentError("Merge request ID is required");
		}

		if (!comment || comment.trim() === "") {
			throw new InvalidArgumentError("Comment is required");
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
			// Get the merge request
			const mergeRequest = await payload.findByID({
				collection: "merge-requests",
				id: mergeRequestId,
				req: { transactionID },
			});

			if (!mergeRequest) {
				throw new NonExistingMergeRequestError(
					`Merge request with id '${mergeRequestId}' not found`,
				);
			}

			// Check if comments are allowed
			if (mergeRequest.allowComments === false) {
				throw new InvalidArgumentError(
					"Comments are not allowed on this merge request",
				);
			}

			// Create comment
			const commentDoc = await payload.create({
				collection: "merge-request-comments",
				data: {
					comment: comment.trim(),
					mergeRequest: mergeRequestId,
					createdBy: userId,
				},
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return commentDoc;
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create merge request comment", {
			cause: error,
		}),
);

export interface RejectMergeRequestArgs {
	id: number;
	reason: string;
	userId: number;
	stopComments?: boolean;
	resolvedContent?: string;
}

/**
 * Rejects a merge request with a reason
 *
 * This function:
 * 1. Creates a comment with the rejection reason
 * 2. Updates the merge request status to "rejected"
 * 3. Sets rejectedAt and rejectedBy fields
 * 4. Optionally disables comments
 * 5. Uses transactions to ensure atomicity
 */
export const tryRejectMergeRequest = Result.wrap(
	async (
		payload: Payload,
		args: RejectMergeRequestArgs,
	): Promise<MergeRequest> => {
		const { id, reason, userId, stopComments = false } = args;

		// Validate required fields
		if (!id) {
			throw new InvalidArgumentError("Merge request ID is required");
		}

		if (!reason || reason.trim() === "") {
			throw new InvalidArgumentError("Rejection reason is required");
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
			// Create rejection comment
			await payload.create({
				collection: "merge-request-comments",
				data: {
					comment: `Rejection reason: ${reason.trim()}`,
					mergeRequest: id,
					createdBy: userId,
				},
				req: { transactionID },
			});

			// Prepare update data
			const updateData: Partial<MergeRequest> = {
				status: "rejected",
				rejectedAt: new Date().toISOString(),
				rejectedBy: userId,
			};

			// Optionally disable comments
			if (stopComments) {
				updateData.allowComments = false;
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
		new UnknownError("Failed to reject merge request", {
			cause: error,
		}),
);

export interface AcceptMergeRequestArgs {
	id: number;
	reason?: string;
	userId: number;
	stopComments?: boolean;
	resolvedContent?: Record<string, unknown>;
}

/**
 * Accepts a merge request with an optional reason
 *
 * This function:
 * 1. Analyzes the merge strategy (Fast-Forward vs Three-Way)
 * 2. Optionally creates a comment with the acceptance reason
 * 3. Creates a merge commit if needed
 * 4. Updates the merge request status to "merged"
 * 5. Sets mergedAt and mergedBy fields
 * 6. Optionally disables comments
 * 7. Uses transactions to ensure atomicity
 */
export const tryAcceptMergeRequest = Result.wrap(
	async (
		payload: Payload,
		args: AcceptMergeRequestArgs,
	): Promise<MergeRequest> => {
		const { id, reason, userId, stopComments = false, resolvedContent } = args;

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
			// Get the merge request to access from/to activity modules
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

			// Get activity module IDs
			const fromActivityModuleId =
				typeof mergeRequest.from === "object"
					? mergeRequest.from.id
					: mergeRequest.from;
			const toActivityModuleId =
				typeof mergeRequest.to === "object"
					? mergeRequest.to.id
					: mergeRequest.to;

			// Analyze merge strategy
			const analysisResult = await tryAnalyzeMergeStrategy(
				payload,
				{
					fromActivityModuleId,
					toActivityModuleId,
				},
				transactionID,
			);

			if (!analysisResult.ok) {
				throw new InvalidArgumentError("Failed to analyze merge strategy");
			}

			const analysis = analysisResult.value;
			let mergeReport: string;

			// Generate merge report and handle merge based on strategy
			if (analysis.strategy === "fast-forward") {
				// Fast-forward merge: link commits from source branch to target branch
				const commitsToLink = analysis.fromCommits.filter(
					(commit) => commit.id !== analysis.commonAncestor?.id,
				);

				mergeReport =
					`Fast-forward merge from branch ${fromActivityModuleId} to ${toActivityModuleId}\n\n` +
					`This merge was performed as a fast-forward because the target branch had no unique commits since the branches diverged.\n` +
					`Common ancestor: ${analysis.commonAncestor?.hash}\n` +
					`Linked ${commitsToLink.length} commits from source branch.`;

				// Perform fast-forward merge by linking commits from source to target branch
				if (commitsToLink.length > 0) {
					const tx = getTx(payload, transactionID);
					const commitIds = commitsToLink.map((commit) => commit.id);

					// Batch insertion of commit relationships to link commits to target branch
					await tx.insert(commits_rels).values(
						commitIds.map((id) => ({
							parent: id,
							order: 1,
							path: "activityModule",
							"activity-modulesID": toActivityModuleId,
						})),
					);
				}
			} else {
				// Three-way merge: requires resolved content and creates a merge commit
				if (!resolvedContent) {
					throw new InvalidArgumentError(
						"Resolved content is required for three-way merge. The branches have diverged and conflicts need to be resolved.",
					);
				}

				mergeReport =
					`Three-way merge from branch ${fromActivityModuleId} to ${toActivityModuleId}\n\n` +
					`This merge was performed as a three-way merge because both branches had unique commits since they diverged.\n` +
					`Common ancestor: ${analysis.commonAncestor?.hash}\n` +
					`Source branch commits: ${analysis.fromCommits.length}\n` +
					`Target branch diverged commits: ${analysis.divergedCommits.length}\n` +
					`Conflicts were resolved and the merged content is included in this commit.`;

				// Create merge commit
				const mergeCommitResult = await tryCreateMergeCommit(
					payload,
					{
						toActivityModuleId,
						mergeReport,
						resolvedContent,
						authorId: userId,
					},
					transactionID,
				);

				if (!mergeCommitResult.ok) {
					throw new InvalidArgumentError("Failed to create merge commit");
				}
			}

			// Create acceptance comment with merge report
			const commentText =
				reason && reason.trim() !== ""
					? `Acceptance reason: ${reason.trim()}\n\n${mergeReport}`
					: mergeReport;

			await payload.create({
				collection: "merge-request-comments",
				data: {
					comment: commentText,
					mergeRequest: id,
					createdBy: userId,
				},
				req: { transactionID },
			});

			// Prepare update data
			const updateData: Partial<MergeRequest> = {
				status: "merged",
				mergedAt: new Date().toISOString(),
				mergedBy: userId,
			};

			// Optionally disable comments
			if (stopComments) {
				updateData.allowComments = false;
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
		new UnknownError("Failed to accept merge request", {
			cause: error,
		}),
);

export interface CloseMergeRequestArgs {
	id: number;
	reason?: string;
	userId: number;
	stopComments?: boolean;
}

/**
 * Closes a merge request with an optional reason
 *
 * This function:
 * 1. Optionally creates a comment with the closure reason
 * 2. Updates the merge request status to "closed"
 * 3. Sets closedAt and closedBy fields
 * 4. Optionally disables comments
 * 5. Uses transactions to ensure atomicity
 */
export const tryCloseMergeRequest = Result.wrap(
	async (
		payload: Payload,
		args: CloseMergeRequestArgs,
	): Promise<MergeRequest> => {
		const { id, reason, userId, stopComments = false } = args;

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
			// Create closure comment if reason is provided
			if (reason && reason.trim() !== "") {
				await payload.create({
					collection: "merge-request-comments",
					data: {
						comment: `Closure reason: ${reason.trim()}`,
						mergeRequest: id,
						createdBy: userId,
					},
					req: { transactionID },
				});
			}

			// Prepare update data
			const updateData: Partial<MergeRequest> = {
				status: "closed",
				closedAt: new Date().toISOString(),
				closedBy: userId,
			};

			// Optionally disable comments
			if (stopComments) {
				updateData.allowComments = false;
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
		new UnknownError("Failed to close merge request", {
			cause: error,
		}),
);
