import { createHash } from "node:crypto";
import { MerkleTree } from "merkletreejs";
import type { Payload } from "payload";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
	NonExistingActivityModuleError,
	TransactionIdNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { ActivityModule, Commit } from "../payload-types";

export function SHA256(data: string): string {
	return createHash("sha256").update(data).digest("hex");
}

export interface CreateActivityModuleArgs {
	title: string;
	description?: string;
	type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion";
	status?: "draft" | "published" | "archived";
	content: Record<string, unknown>; // JSON content
	commitMessage?: string;
	userId: number;
}

export interface CreateActivityModuleResult {
	activityModule: ActivityModule;
	commit: Commit;
}

/**
 * Generate content hash using MerkleTree
 */
export const generateContentHash = (
	content: Record<string, unknown>,
): string => {
	const contentString = JSON.stringify(content, Object.keys(content).sort());
	const leaves = [contentString].map((x) => SHA256(x));
	const tree = new MerkleTree(leaves, SHA256);
	return tree.getRoot().toString("hex");
};

/**
 * Generate unique commit hash using MerkleTree
 * Includes parent commit hash (like Git) to ensure uniqueness
 */
export const generateCommitHash = (
	content: Record<string, unknown>,
	message: string,
	authorId: number,
	timestamp: Date,
	parentCommitHash?: string,
): string => {
	const data = {
		content: JSON.stringify(content, Object.keys(content).sort()),
		message,
		authorId,
		timestamp: timestamp.toISOString(),
		parentCommit: parentCommitHash || null,
	};
	const dataString = JSON.stringify(data);
	const leaves = [dataString].map((x) => SHA256(x));
	const tree = new MerkleTree(leaves, SHA256);
	return tree.getRoot().toString("hex");
};

/**
 * Creates a new activity module with initial commit
 *
 * This function:
 * 1. Creates an activity module
 * 2. Creates an initial commit for the activity module
 * 3. Uses transactions to ensure atomicity
 */
export const tryCreateActivityModule = Result.wrap(
	async (
		payload: Payload,
		args: CreateActivityModuleArgs,
	): Promise<CreateActivityModuleResult> => {
		const {
			title,
			description,
			type,
			status = "draft",
			content,
			commitMessage = "Initial commit",
			userId,
		} = args;

		// Validate required fields
		if (!title || title.trim() === "") {
			throw new InvalidArgumentError("Title is required");
		}

		if (!type) {
			throw new InvalidArgumentError("Type is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		if (!content || typeof content !== "object" || Array.isArray(content)) {
			throw new InvalidArgumentError("Content must be a valid object");
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

			// Create activity module
			const activityModule = await payload.create({
				collection: "activity-modules",
				data: {
					title,
					description: description || null,
					branch: "main", // Default branch
					type,
					status,
					createdBy: userId,
				} as never,
				req: { transactionID },
			});

			// Generate hashes for the initial commit
			const contentHash = generateContentHash(content);
			const commitDate = new Date();
			const commitHash = generateCommitHash(
				content,
				commitMessage,
				userId,
				commitDate,
			);

			// Create initial commit with activityModule as array
			const commit = await payload.create({
				collection: "commits",
				data: {
					activityModule: [activityModule.id],
					hash: commitHash,
					message: commitMessage,
					author: userId,
					parentCommit: null, // First commit has no parent
					commitDate: commitDate.toISOString(),
					content,
					contentHash,
				},
				req: { transactionID },
			});

			// Commit transaction
			await payload.db.commitTransaction(transactionID);

			return {
				// ! we need to manually add the commit to the activity module
				activityModule: {
					...activityModule,
					commits: {
						docs: [commit],
						hasNextPage: false,
						totalDocs: 1,
					},
				},
				commit,
			};
		} catch (error) {
			// Rollback transaction on error
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create activity module", {
			cause: error,
		}),
);

export interface GetActivityModuleByIdArgs {
	id: number | string;
	depth?: number;
	options?: {
		branch?: string;
	};
}

/**
 * Get an activity module by ID
 *
 * This function fetches an activity module by its ID with optional depth control
 * for relationships (e.g., commits, createdBy)
 */
export const tryGetActivityModuleById = Result.wrap(
	async (
		payload: Payload,
		args: GetActivityModuleByIdArgs,
	): Promise<ActivityModule> => {
		const { id, depth = 1, options } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Fetch the activity module
		const activityModule = await payload.findByID({
			collection: "activity-modules",
			id,
			depth,
			...(options && {
				where: {
					branch: { equals: options.branch },
				},
			}),
		});

		if (!activityModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		return activityModule;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to get activity module", {
			cause: error,
		}),
);

export interface CreateBranchArgs {
	sourceActivityModuleId: number;
	branchName: string;
	userId: number;
}

/**
 * Creates a new branch from an existing activity module
 *
 * This function:
 * 1. Fetches the source activity module
 * 2. Creates a new activity module with the same properties but different branch name
 * 3. Sets the origin to point to the source module (or source's origin if it exists)
 * 4. No commits are duplicated - the new branch conceptually inherits commits from origin
 */
export const tryCreateBranch = Result.wrap(
	async (payload: Payload, args: CreateBranchArgs): Promise<ActivityModule> => {
		const { sourceActivityModuleId, branchName, userId } = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		// Validate inputs
		if (!sourceActivityModuleId) {
			throw new InvalidArgumentError("Source activity module ID is required");
		}

		if (!branchName || branchName.trim() === "") {
			throw new InvalidArgumentError("Branch name is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		try {
			// Fetch source activity module
			const sourceModule = await payload.findByID({
				collection: "activity-modules",
				id: sourceActivityModuleId,
				depth: 1,
				req: { transactionID },
			});

			if (!sourceModule) {
				throw new NonExistingActivityModuleError(
					`Source activity module with id '${sourceActivityModuleId}' not found`,
				);
			}

			// Verify user exists
			const user = await payload.findByID({
				collection: "users",
				id: userId,
				req: { transactionID },
			});

			if (!user) {
				throw new InvalidArgumentError(`User with id '${userId}' not found`);
			}

			// Determine the origin (if source has origin, use that; otherwise use source)
			const origin =
				sourceModule.origin && typeof sourceModule.origin === "object"
					? sourceModule.origin.id
					: sourceModule.origin || sourceModule.id;

			// Get the origin module to fetch all commits
			const originModule = await payload.findByID({
				collection: "activity-modules",
				id: origin,
				depth: 1,
				req: { transactionID },
			});

			if (!originModule) {
				throw new NonExistingActivityModuleError(
					`Origin activity module with id '${origin}' not found`,
				);
			}

			// Create new branch
			const newBranch = await payload.create({
				collection: "activity-modules",
				data: {
					title: sourceModule.title,
					description: sourceModule.description ?? null,
					branch: branchName,
					origin: origin,
					type: sourceModule.type,
					status: sourceModule.status,
					createdBy: userId,
				},
				req: { transactionID },
			});

			// Link all commits from origin to the new branch
			const commits = originModule.commits?.docs ?? [];
			for (const commitRef of commits) {
				const commitId =
					typeof commitRef === "number" ? commitRef : commitRef.id;

				// Fetch the commit to get its current activityModule array
				const commit = await payload.findByID({
					collection: "commits",
					id: commitId,
					req: { transactionID },
				});

				if (commit && commit.activityModule) {
					// Get current activity module IDs
					const currentModules = Array.isArray(commit.activityModule)
						? commit.activityModule.map((m) =>
								typeof m === "number" ? m : m.id,
							)
						: [];

					// Add the new branch if not already included
					if (!currentModules.includes(newBranch.id)) {
						await payload.update({
							collection: "commits",
							id: commitId,
							data: {
								activityModule: [...currentModules, newBranch.id],
							},
							req: { transactionID },
						});
					}
				}
			}

			await payload.db.commitTransaction(transactionID);

			return newBranch;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create branch", {
			cause: error,
		}),
);

type CompareBranchesArgs = {
	branch1: ActivityModule;
	branch2: ActivityModule;
};

export const tryCompareBranches = Result.wrap(
	async (payload: Payload, args: CompareBranchesArgs) => {
		const { branch1, branch2 } = args;

		const haveSameOrigin = branch1.origin === branch2.origin;
		const eitherOneIsOrigin =
			branch1.origin === branch1.id || branch2.origin === branch2.id;

		if (!haveSameOrigin && !eitherOneIsOrigin) {
			throw new InvalidArgumentError("Branches do not have the same origin");
		}

		// now we confirm that branches has the origin

		// TODO: compare the commits

		return false;
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to compare branches", {
			cause: error,
		}),
);

type DeleteActivityModuleArgs = {
	id: number;
};

/**
 * you can use this functions to delete an activity module or a branch
 *
 * ! deleting a branch will not delete the commits, the activity module will be set null .
 */
export const tryDeleteActivityModule = Result.wrap(
	async (payload: Payload, args: DeleteActivityModuleArgs) => {
		const { id } = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// fetch the activity module
			const activityModule = await payload.findByID({
				collection: "activity-modules",
				id,
			});

			if (!activityModule) {
				throw new NonExistingActivityModuleError(
					`Activity module with id '${id}' not found`,
				);
			}

			const isMainBranch = activityModule.origin === null;

			// delete the activity module
			if (!isMainBranch) {
				await payload.delete({
					collection: "activity-modules",
					id,
					req: { transactionID },
				});
			} else {
				const branchIds =
					activityModule.branches?.docs?.map((branch) =>
						typeof branch === "number" ? branch : branch.id,
					) ?? [];
				// delete the activty and all branches
				const promises = branchIds.map((branchId) =>
					payload.delete({
						collection: "activity-modules",
						id: branchId,
						req: { transactionID },
					}),
				);
				await Promise.all([
					...promises,
					payload.delete({
						collection: "activity-modules",
						id,
						req: { transactionID },
					}),
				]);
			}

			await payload.db.commitTransaction(transactionID);

			return activityModule;
		} catch (error) {
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to delete activity module", {
			cause: error,
		}),
);
