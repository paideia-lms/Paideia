import "@total-typescript/ts-reset";
import { createHash } from "node:crypto";
import { asc, inArray } from "@payloadcms/db-postgres/drizzle";
import { MerkleTree } from "merkletreejs";
import type { Payload } from "payload";
import { getTx } from "server/utils/get-tx";
import { assertZod, MOCK_INFINITY } from "server/utils/type-narrowing";
import { commits, commits_rels } from "src/payload-generated-schema";
import { Result } from "typescript-result";
import z from "zod";
import {
	DevelopmentError,
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
 * Creates a new activity module with initial commit.
 *
 * ! this function is not used for creating branches. you should use tryCreateBranch instead.
 *
 * This function:
 * 1. Creates an origin (root of all branches)
 * 2. Creates an activity module with the origin
 * 3. Creates an initial commit for the activity module
 * 4. Uses transactions to ensure atomicity
 */
export const tryCreateActivityModule = Result.wrap(
	async (payload: Payload, args: CreateActivityModuleArgs) => {
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
			// Create origin first (root of all branches)
			const origin = await payload.create({
				collection: "origins",
				data: {
					title,
					description,
					createdBy: userId,
				},
				req: { transactionID },
			});

			// Create activity module with the origin
			const activityModule = await payload.create({
				collection: "activity-modules",
				data: {
					branch: "main", // Default branch
					type,
					status,
					origin: origin.id,
					createdBy: userId,
				},
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

			////////////////////////////////////////////////////
			// type narrowing
			////////////////////////////////////////////////////

			const createdBy = activityModule.createdBy;
			assertZod(
				createdBy,
				z.object({
					id: z.number(),
				}),
			);

			const activityModuleOrigin = activityModule.origin;
			assertZod(
				activityModuleOrigin,
				z.object({
					id: z.number(),
				}),
			);

			const commitActivityModule = commit.activityModule;
			assertZod(
				commitActivityModule,
				z.array(
					z.object({
						id: z.number(),
					}),
				),
			);

			const commitAuthor = commit.author;
			assertZod(
				commitAuthor,
				z.object({
					id: z.number(),
				}),
			);

			return {
				// ! we need to manually add the commit to the activity module
				activityModule: {
					...activityModule,
					createdBy,
					commits: [
						{
							...commit,
							activityModule: commitActivityModule as ActivityModule[],
							author: commitAuthor,
						},
					],
					origin: activityModuleOrigin,
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
		new UnknownError("Failed to create activity module", {
			cause: error,
		}),
);

export interface GetActivityModuleByIdArgs {
	id: number | string;
	transactionID?: string | number;
}

/**
 * Get an activity module by ID. You can also use this function to get a branch by its ID.
 */
export const tryGetActivityModuleById = Result.wrap(
	async (payload: Payload, args: GetActivityModuleByIdArgs) => {
		const { id } = args;

		// Validate ID
		if (!id) {
			throw new InvalidArgumentError("Activity module ID is required");
		}

		// Fetch the activity module
		const activityModuleResult = await payload.find({
			collection: "activity-modules",
			where: {
				and: [
					{
						id: { equals: id },
					},
				],
			},
			joins: {
				commits: {
					limit: MOCK_INFINITY,
				},
			},
		});

		const activityModule = activityModuleResult.docs[0];

		if (!activityModule) {
			throw new NonExistingActivityModuleError(
				`Activity module with id '${id}' not found`,
			);
		}

		const origin = activityModule.origin;

		// assert the origin is an object
		assertZod(
			origin,
			z.object({
				id: z.number(),
			}),
		);

		const commits = activityModule.commits?.docs ?? [];
		assertZod(
			commits,
			z.array(
				z.object({
					id: z.number(),
				}),
			),
		);

		const createdBy = activityModule.createdBy;
		assertZod(
			createdBy,
			z.object({
				id: z.number(),
			}),
		);

		// narrow the type
		return {
			...activityModule,
			origin,
			/**
			 * no pagination
			 */
			commits: commits as Commit[],
			createdBy,
		};
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
	transactionID?: string | number;
}

export interface CreateBranchFromCommitArgs {
	commitId?: number | string;
	hash?: string;
	branchName: string;
	userId: number;
	transactionID?: string | number;
}

/**
 * Creates a new branch from an existing activity module
 *
 * This function:
 * 1. Fetches the source activity module
 * 2. Gets the origin ID from the source module
 * 3. Creates a new activity module with the same properties but different branch name
 * 4. Links all commits from the source module to the new branch
 */
export const tryCreateBranch = Result.wrap(
	async (payload: Payload, args: CreateBranchArgs): Promise<ActivityModule> => {
		const {
			sourceActivityModuleId,
			branchName,
			userId,
			transactionID: _transactionID,
		} = args;

		const transactionID =
			_transactionID ?? (await payload.db.beginTransaction());

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
			////////////////////////////////////////////////////
			// Fetch source activity module with commits
			////////////////////////////////////////////////////
			const sourceModuleResult = await tryGetActivityModuleById(payload, {
				id: sourceActivityModuleId,
				transactionID,
			});

			if (!sourceModuleResult.ok) {
				throw new NonExistingActivityModuleError(
					`Source activity module with id '${sourceActivityModuleId}' not found`,
				);
			}

			const sourceModule = sourceModuleResult.value;

			// Link all commits from source module to the new branch
			const commits = sourceModule.commits;

			// Get the origin ID from the source module
			const originId =
				typeof sourceModule.origin === "object"
					? sourceModule.origin.id
					: sourceModule.origin;

			if (!originId) {
				throw new InvalidArgumentError(
					"Source module does not have a valid origin",
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

			// Create new branch
			const newBranch = await payload.duplicate({
				collection: "activity-modules",
				id: sourceModule.id,
				data: {
					branch: branchName,
					status: "draft",
					createdBy: userId,
					origin: originId,
				},
				// depth 1 is ok here because we just need the id of the commits
				depth: 1,
				req: { transactionID },
			});

			const tx = getTx(payload, transactionID);

			if (!newBranch.id) throw new Error("New branch ID not found");

			// Batch insertion of commit relationships

			await tx.insert(commits_rels).values(
				commits.map((c) => ({
					parent: c.id,
					// ? order is 1, I don't know why
					order: 1,
					// ! the path is the name of the activity module
					path: "activityModule",
					"activity-modulesID": newBranch.id,
				})),
			);

			await payload.db.commitTransaction(transactionID);

			return newBranch;
		} catch (error) {
			console.error(error);
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

/**
 * Creates a new branch from a specific commit
 *
 * This function:
 * 1. Finds a commit by ID or hash
 * 2. Gets any activity module associated with that commit
 * 3. Creates a new branch from that activity module
 * 4. Copies all commits from the root up to the target commit
 * 5. Uses transactions to ensure atomicity
 */
export const tryCreateBranchFromCommit = Result.wrap(
	async (
		payload: Payload,
		args: CreateBranchFromCommitArgs,
	): Promise<ActivityModule> => {
		const {
			commitId,
			branchName,
			userId,
			hash,
			transactionID: _transactionID,
		} = args;

		const transactionID =
			_transactionID ?? (await payload.db.beginTransaction());

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		// Validate inputs
		if (!commitId && !hash) {
			throw new InvalidArgumentError("Commit ID or hash is required");
		}

		if (!branchName || branchName.trim() === "") {
			throw new InvalidArgumentError("Branch name is required");
		}

		if (!userId) {
			throw new InvalidArgumentError("User ID is required");
		}

		try {
			const tx = getTx(payload, transactionID);
			// Find the commit by ID or hash
			const commitResult = await payload.find({
				collection: "commits",
				where: {
					or: [{ id: { equals: commitId } }, { hash: { equals: hash } }],
				},
				depth: 1,
				req: { transactionID },
			});

			if (commitResult.docs.length === 0) {
				throw new InvalidArgumentError(
					`Commit with id/hash '${commitId || hash}' not found`,
				);
			}

			const commit = commitResult.docs[0];

			// Get the first activity module associated with this commit
			const activityModules = commit.activityModule;
			if (!activityModules || activityModules.length === 0) {
				throw new InvalidArgumentError(
					"Commit is not associated with any activity module",
				);
			}

			// Get the first activity module (they should all have the same origin)
			const firstActivityModule = Array.isArray(activityModules)
				? activityModules[0]
				: activityModules;

			if (typeof firstActivityModule === "number") {
				// development error
				throw new DevelopmentError("First activity module is a number");
			}

			const sourceModule = firstActivityModule;

			// Get the origin ID from the source module
			const originId = sourceModule.origin;
			assertZod(originId, z.number());

			// Get all commits from the source module
			const allCommits = sourceModule.commits?.docs ?? [];

			// assert the commits are nubmers[]
			assertZod(allCommits, z.array(z.number()));

			// use drizzle to select all the commits from the source module (older first)
			const allCommitsDrizzle = await tx
				.select({
					id: commits.id,
					hash: commits.hash,
					commitDate: commits.commitDate,
				})
				.from(commits)
				.where(inArray(commits.id, allCommits))
				.orderBy(asc(commits.commitDate));

			// Create new branch
			const newBranch = await payload.duplicate({
				collection: "activity-modules",
				id: sourceModule.id,
				data: {
					branch: branchName,
					status: "draft",
					createdBy: userId,
					origin: originId,
				},
				depth: 1,
				req: { transactionID },
			});

			// Find the target commit index
			const targetCommitIndex = allCommitsDrizzle.findIndex(
				(c) => c.hash === hash || c.id === commitId,
			);

			if (targetCommitIndex === -1) {
				throw new InvalidArgumentError(
					`Commit with id/hash '${commitId || hash}' not found`,
				);
			}

			// Get commits from root to target commit (inclusive) - first N commits
			const commitsToCopy = allCommitsDrizzle.slice(0, targetCommitIndex + 1);
			const commitIds = commitsToCopy.map((commit) => commit.id);

			if (!newBranch.id) throw new Error("New branch ID not found");

			// Batch insertion of commit relationships
			if (commitIds.length > 0) {
				await tx.insert(commits_rels).values(
					commitIds.map((id) => ({
						parent: id,
						order: 1,
						path: "activityModule",
						"activity-modulesID": newBranch.id,
					})),
				);
			}

			await payload.db.commitTransaction(transactionID);

			return newBranch;
		} catch (error) {
			console.error(error);
			await payload.db.rollbackTransaction(transactionID);
			throw error;
		}
	},
	(error) =>
		transformError(error) ??
		new UnknownError("Failed to create branch from commit", {
			cause: error,
		}),
);

type CompareBranchesArgs = {
	branch1: ActivityModule;
	branch2: ActivityModule;
};

export const tryCompareBranches = Result.wrap(
	async (_payload: Payload, args: CompareBranchesArgs) => {
		const { branch1, branch2 } = args;

		// Get origin IDs from both branches
		const origin1Id =
			typeof branch1.origin === "object" ? branch1.origin.id : branch1.origin;
		const origin2Id =
			typeof branch2.origin === "object" ? branch2.origin.id : branch2.origin;

		if (origin1Id !== origin2Id) {
			throw new InvalidArgumentError("Branches do not have the same origin");
		}

		// now we confirm that branches have the same origin

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
	/**
	 * If true, deletes all branches (activity modules) associated with the same origin
	 * If false, only deletes the specified activity module
	 */
	deleteAllBranches?: boolean;
};

/**
 * Deletes an activity module (branch)
 *
 * By default, only deletes the specified activity module.
 * Set deleteAllBranches to true to delete all branches of the same origin.
 *
 * Note: Deleting an activity module does not delete the commits,
 * as commits may be referenced by other branches.
 */
export const tryDeleteActivityModule = Result.wrap(
	async (payload: Payload, args: DeleteActivityModuleArgs) => {
		const { id, deleteAllBranches = false } = args;

		const transactionID = await payload.db.beginTransaction();

		if (!transactionID) {
			throw new TransactionIdNotFoundError("Failed to begin transaction");
		}

		try {
			// Fetch the activity module
			const activityModule = await payload.findByID({
				collection: "activity-modules",
				id,
				depth: 1,
				req: { transactionID },
			});

			if (!activityModule) {
				throw new NonExistingActivityModuleError(
					`Activity module with id '${id}' not found`,
				);
			}

			if (deleteAllBranches) {
				// Get the origin ID
				const originId =
					typeof activityModule.origin === "object"
						? activityModule.origin.id
						: activityModule.origin;

				if (!originId) {
					throw new InvalidArgumentError("Activity module has no valid origin");
				}

				// Delete all activity modules with this origin
				await payload.delete({
					collection: "activity-modules",
					where: {
						origin: { equals: originId },
					},
					req: { transactionID },
				});

				// Optionally delete the origin itself
				await payload.delete({
					collection: "origins",
					id: originId,
					req: { transactionID },
				});
			} else {
				// Delete only the specified activity module
				await payload.delete({
					collection: "activity-modules",
					id,
					req: { transactionID },
				});
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
