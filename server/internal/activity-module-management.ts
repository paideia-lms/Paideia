import { createHash } from "node:crypto";
import { MerkleTree } from "merkletreejs";
import type { Payload } from "payload";
import { Result } from "typescript-result";
import {
	InvalidArgumentError,
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

			// Create initial commit
			const commit = await payload.create({
				collection: "commits",
				data: {
					activityModule: activityModule.id,
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
